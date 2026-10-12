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
    (SELECT count(*)::int FROM quotations WHERE status='approved') AS approved`);
  assert.deepEqual(count.rows[0], {customers:286,quotations:126,items:189,costs:462,quick:1,approved:51});
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
  assert.equal(sizes['/api/customers'],286);
  assert.ok(sizes['/api/quotations']>=120);
  assert.ok(sizes['/api/reports/advanced']>=120);
  const mobileLogin=await fetch(`${base}/api/mobile/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:process.env.DEV_ADMIN_EMAIL,password:process.env.DEV_ADMIN_PASSWORD})});
  assert.equal(mobileLogin.status,200);
  const mobileSession=await mobileLogin.json();
  const mobile=await fetch(`${base}/api/mobile/data`,{headers:{Authorization:`Bearer ${mobileSession.token}`}});
  assert.equal(mobile.status,200);
  const mobileData=await mobile.json();
  assert.equal(mobileData.customers.length,286);
  assert.equal(mobileData.history.length,127);
  await fetch(`${base}/api/mobile/auth/logout`,{method:'POST',headers:{Authorization:`Bearer ${mobileSession.token}`}});
  console.log(JSON.stringify({database:count.rows[0],api:sizes,mobile:{customers:mobileData.customers.length,history:mobileData.history.length}}));
} finally { await db.query('ROLLBACK').catch(()=>{});await db.end(); }
