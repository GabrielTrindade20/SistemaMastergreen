import assert from 'node:assert/strict';
import pg from 'pg';

const base = 'http://127.0.0.1:5001';
if (new URL(process.env.DATABASE_URL ?? '').pathname !== '/mastergreen_develop') throw new Error('Apenas desenvolvimento.');
const db = new pg.Client({ connectionString:process.env.DATABASE_URL });
await db.connect();
try {
  await db.query('BEGIN READ ONLY');
  const count = await db.query(`SELECT
    (SELECT count(*)::int FROM customers) AS customers,
    (SELECT count(*)::int FROM quotations) AS quotations,
    (SELECT count(*)::int FROM quotation_items) AS items,
    (SELECT count(*)::int FROM quotation_costs) AS costs,
    (SELECT count(*)::int FROM mobile_quick_proposals) AS quick,
    (SELECT count(*)::int FROM quotations WHERE status='approved') AS approved,
    (SELECT count(DISTINCT coalesce(nullif(original_quotation_id,''),id::text))::int FROM quotations) AS canonical`);
  assert.ok(count.rows[0].customers>=286);
  assert.ok(count.rows[0].quotations>=126);
  assert.ok(count.rows[0].items>=189);
  assert.ok(count.rows[0].costs>=462);
  assert.ok(count.rows[0].quick>=1);
  assert.ok(count.rows[0].approved>=51);
  const login = await fetch(`${base}/api/login`, { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:process.env.DEV_ADMIN_EMAIL,password:process.env.DEV_ADMIN_PASSWORD}) });
  assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie')?.split(';',1)[0];
  const endpoints=['/api/customers','/api/quotations','/api/reports/advanced'];
  const sizes={};
  for (const path of endpoints) {
    const response=await fetch(base+path,{headers:{cookie}});
    assert.equal(response.status,200,`Falha na consulta ${path}`);
    const data=await response.json();
    sizes[path]=Array.isArray(data)?data.length:null;
  }
  assert.equal(sizes['/api/customers'],count.rows[0].customers);
  assert.ok(sizes['/api/quotations']>=120);
  assert.equal(sizes['/api/reports/advanced'],count.rows[0].canonical);
  const quickResponse=await fetch(`${base}/api/quick-proposals`,{headers:{cookie}});
  assert.equal(quickResponse.status,200);
  const quickData=await quickResponse.json();
  assert.equal(quickData.quickProposals.length,count.rows[0].quick);
  const mobileLogin=await fetch(`${base}/api/mobile/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:process.env.DEV_ADMIN_EMAIL,password:process.env.DEV_ADMIN_PASSWORD})});
  assert.equal(mobileLogin.status,200);
  const mobileSession=await mobileLogin.json();
  const mobile=await fetch(`${base}/api/mobile/data`,{headers:{Authorization:`Bearer ${mobileSession.token}`}});
  assert.equal(mobile.status,200);
  const mobileData=await mobile.json();
  assert.equal(mobileData.customers.length,count.rows[0].customers);
  assert.equal(mobileData.history.length,count.rows[0].canonical+count.rows[0].quick);
  assert.ok(Array.isArray(mobileData.products));
  assert.ok(mobileData.products.length>=73);
  assert.ok(mobileData.products.every(product=>typeof product.pricePerM2==='string'&&!('costPerM2' in product)));
  const range='from=2000-01-01&to=2100-12-31';
  assert.equal((await fetch(`${base}/api/mobile/summary?${range}`)).status,401);
  assert.equal((await fetch(`${base}/api/mobile/summary?from=2026-02-30&to=2026-03-01`,{headers:{Authorization:`Bearer ${mobileSession.token}`}})).status,400);
  const reportResponse=await fetch(`${base}/api/mobile/summary?${range}`,{headers:{Authorization:`Bearer ${mobileSession.token}`}});assert.equal(reportResponse.status,200);
  const report=await reportResponse.json();
  const webReport=await (await fetch(`${base}/api/reports/advanced?dateFrom=2000-01-01&dateTo=2100-12-31`,{headers:{cookie}})).json();
  const approvedRows=webReport.filter(row=>row.quotationStatus==='approved');
  assert.equal(report.approvedCount,approvedRows.length);assert.equal(report.approvedCents,approvedRows.reduce((sum,row)=>sum+Math.round(row.quotationTotal*100),0));
  assert.equal(report.approvedCents,mobileData.history.filter(row=>row.source==='web'&&row.status==='approved').reduce((sum,row)=>sum+row.totalCents,0));
  await fetch(`${base}/api/mobile/auth/logout`,{method:'POST',headers:{Authorization:`Bearer ${mobileSession.token}`}});
  console.log(JSON.stringify({database:count.rows[0],api:sizes,mobile:{customers:mobileData.customers.length,products:mobileData.products.length,history:mobileData.history.length}}));
} finally { await db.query('ROLLBACK').catch(()=>{});await db.end(); }
