// Read-only business-data audit. Authentication creates temporary sessions only.
// Run: node --env-file=.env --env-file=.env.local tests/integration-audit.mjs
import pg from 'pg';
import { isDeepStrictEqual } from 'node:util';

const base = 'http://127.0.0.1:5001';
if (new URL(process.env.DATABASE_URL ?? '').pathname !== '/mastergreen_develop') throw new Error('Only mastergreen_develop is allowed.');
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
const cents = value => Math.round(Number(value) * 100);
const sum = (rows, fn) => rows.reduce((value, row) => value + fn(row), 0);
const checks = new Map();
function check(label, actual, expected) {
  const result = checks.get(label) ?? { checked: 0, mismatches: 0 };
  result.checked++;
  if (!isDeepStrictEqual(actual, expected)) result.mismatches++;
  checks.set(label, result); // Never emit customer data, IDs or credentials.
}
function compare(label, actual, expected, fields) {
  check(label + '.ids', actual.map(row => row.id).sort(), expected.map(row => row.id).sort());
  const index = new Map(actual.map(row => [row.id, row]));
  for (const row of expected) for (const field of fields) check(label + '.' + field, index.get(row.id)?.[field] ?? null, row[field] ?? null);
}
let cookie, token;
async function get(path, mobile = false) {
  const response = await fetch(base + path, { headers: mobile ? { Authorization: `Bearer ${token}` } : { cookie }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`GET ${path}: ${response.status}`);
  return response.json();
}
await db.connect();
try {
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const customers = (await db.query('SELECT * FROM customers')).rows;
  const products = (await db.query('SELECT * FROM products')).rows;
  const quotations = (await db.query(`SELECT *, created_at::text AS created_text,
    to_char(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD') AS business_date FROM quotations`)).rows;
  const quick = (await db.query('SELECT * FROM mobile_quick_proposals')).rows;
  const users = (await db.query('SELECT id,name,commission_percent FROM users')).rows;
  const customerIndex = new Map(customers.map(row => [row.id, row]));
  const userIndex = new Map(users.map(row => [row.id, row]));
  const quotationIndex = new Map(quotations.map(row => [row.id, row]));
  // Independent canonical selection, performed outside the server reporting helper.
  const groups = new Map();
  for (const row of quotations) {
    const key = row.original_quotation_id || row.id;
    const group = groups.get(key) ?? [];
    group.push(row); groups.set(key, group);
  }
  const canonical = [...groups.values()].map(rows => rows.sort((a, b) => Number(b.admin_calculated) - Number(a.admin_calculated) || b.created_text.localeCompare(a.created_text) || a.id.localeCompare(b.id))[0])
    .map(row => ({ ...row, day: (quotationIndex.get(row.original_quotation_id) ?? row).business_date }));
  const credentials = JSON.stringify({ email: process.env.DEV_ADMIN_EMAIL, password: process.env.DEV_ADMIN_PASSWORD });
  const login = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: credentials });
  if (!login.ok) throw new Error(`Web login: ${login.status}`);
  cookie = login.headers.get('set-cookie')?.split(';', 1)[0];
  const mobileLogin = await fetch(base + '/api/mobile/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: credentials });
  if (!mobileLogin.ok) throw new Error(`Mobile login: ${mobileLogin.status}`);
  const session = await mobileLogin.json(); token = session.token;
  const [webCustomers, webProducts, webQuotations, webQuick, advanced, mobile] = await Promise.all([
    get('/api/customers'), get('/api/products'), get('/api/quotations'), get('/api/quick-proposals'), get('/api/reports/advanced'), get('/api/mobile/data', true),
  ]);
  const customerFields = { name:'name',phone:'phone',email:'email',cpfCnpj:'cpf_cnpj',address:'address',number:'number',neighborhood:'neighborhood',city:'city',state:'state',zipCode:'zip_code',notes:'notes',customerStatus:'customer_status',leadOrigin:'lead_origin',createdById:'created_by_id' };
  compare('web.customers', webCustomers, customers.map(row => ({ id:row.id,...Object.fromEntries(Object.entries(customerFields).map(([api, column]) => [api,row[column]])) })), Object.keys(customerFields));
  compare('mobile.customers', mobile.customers, customers.map(row => ({...row,document:row.cpf_cnpj,zipCode:row.zip_code})), ['name','phone','email','document','address','number','neighborhood','zipCode','city','state']);
  const expectedProducts = products.map(row => ({...row,pricePerM2:row.price_per_m2,costPerM2:row.cost_per_m2,hasInstallation:row.has_installation}));
  compare('web.products',webProducts,expectedProducts,['name','category','description','pricePerM2','costPerM2','hasInstallation']);
  compare('mobile.products',mobile.products,expectedProducts,['name','category','description','pricePerM2']);
  const expectedQuick = quick.map(row => ({id:row.id,clientId:row.client_id,customer:row.customer_snapshot,date:row.proposal_date,freight:row.freight,warranty:row.warranty,payment:row.payment,discountPercent:Number(row.discount_percent),totalCents:row.total_cents,source:'mobile',status:'Enviada'}));
  const quickFields=['clientId','customer','date','freight','warranty','payment','discountPercent','totalCents','source','status'];
  compare('web.quick',webQuick.quickProposals,expectedQuick,quickFields);
  compare('mobile.quick',mobile.quickProposals,expectedQuick,quickFields);
  compare('mobile.history.quick',mobile.history.filter(row=>row.source==='mobile'),expectedQuick,quickFields);
  const expectedHistory = canonical.map(row => ({id:row.id,customer:{name:customerIndex.get(row.customer_id)?.name||'Cliente'},date:row.day,totalCents:cents(row.total),status:row.status}));
  compare('mobile.history.web',mobile.history.filter(row=>row.source==='web'),expectedHistory,['customer','date','totalCents','status']);
  compare('web.quotations',webQuotations,canonical.map(row=>({...row,customerId:row.customer_id,totalCosts:row.total_costs,netProfit:row.net_profit,quotationNumber:row.quotation_number})),['customerId','total','totalCosts','netProfit','status','quotationNumber']);
  compare('web.advanced',advanced.map(row=>({...row,id:row.quotationId})),canonical.map(row=>({id:row.id,quotationNumber:row.quotation_number,quotationTotal:Number(row.total),quotationNetProfit:Number(row.net_profit),quotationCosts:Number(row.total_costs),quotationStatus:row.status,businessDate:row.day,customerId:row.customer_id,customerName:customerIndex.get(row.customer_id)?.name,responsibleId:row.responsible_id||row.user_id})),['quotationNumber','quotationTotal','quotationNetProfit','quotationCosts','quotationStatus','businessDate','customerId','customerName','responsibleId']);
  const months = [...new Set([...canonical.map(row=>row.day.slice(0,7)),...quick.map(row=>row.proposal_date.slice(0,7))])].sort();
  const dashboards=[];
  const summaries=[];
  for (const month of months) {
    const from=month+'-01',to=new Date(Date.UTC(+month.slice(0,4),+month.slice(5,7),0)).toISOString().slice(0,10);
    const [report, webReport, dashboard] = await Promise.all([get(`/api/mobile/summary?from=${from}&to=${to}`,true),get(`/api/reports/advanced?dateFrom=${from}&dateTo=${to}`),get('/api/dashboard/'+month)]);
    const extract=await get('/api/extract/pdf/'+month);
    check('monthly.extract', [extract.totalRevenue,extract.totalCosts,extract.netProfit,extract.financialCoverage], [dashboard.totalRevenue,dashboard.totalCosts,dashboard.totalNetProfit,dashboard.financialCoverage]);
    const period=canonical.filter(row=>row.day>=from&&row.day<=to);
    const approved=period.filter(row=>row.status==='approved');
    const covered=approved.filter(row=>Number(row.total_costs)>0);
    const total=sum(approved,row=>cents(row.total));
    const costs=covered.length?sum(covered,row=>cents(row.total_costs)):null;
    const profit=covered.length?sum(covered,row=>cents(row.net_profit)):null;
    check('monthly.web.ids',webReport.map(row=>row.quotationId).sort(),period.map(row=>row.id).sort());
    check('monthly.mobile.approvedCount',report.approvedCount,approved.length);
    check('monthly.mobile.approvedCents',report.approvedCents,total);
    check('monthly.mobile.averageCents',report.averageCents,approved.length?Math.round(total/approved.length):0);
    check('monthly.mobile.financial',report.financial,{covered:covered.length,total:approved.length,costsCents:costs,profitCents:profit});
    check('monthly.mobile.graph',report.months,[{month,totalCents:total}]);
    const qp=quick.filter(row=>row.proposal_date>=from&&row.proposal_date<=to);
    check('monthly.mobile.quick',report.quick,{count:qp.length,totalCents:sum(qp,row=>row.total_cents)});
    const start=Date.parse(from+'T12:00:00Z'),end=Date.parse(to+'T12:00:00Z');
    const prevFrom=new Date(start-(end-start+86400000)).toISOString().slice(0,10),prevTo=new Date(start-86400000).toISOString().slice(0,10);
    const prevTotal=sum(canonical.filter(row=>row.status==='approved'&&row.day>=prevFrom&&row.day<=prevTo),row=>cents(row.total));
    check('monthly.mobile.previous',report.previous,{from:prevFrom,to:prevTo,approvedCents:prevTotal,changePercent:prevTotal?Math.round((total-prevTotal)/prevTotal*1000)/10:null});
    const teamIds=[...new Set(approved.map(row=>row.responsible_id||row.user_id))];
    const expectedTeam=teamIds.map(id=>{
      const rows=approved.filter(row=>(row.responsible_id||row.user_id)===id),user=userIndex.get(id),rate=Number((user.commission_percent||'').replace(',','.'));
      return {id,name:user.name,count:rows.length,totalCents:sum(rows,row=>cents(row.total)),commissionCents:user.commission_percent!=null&&Number.isFinite(rate)&&rate>=0&&rate<=100?sum(rows,row=>Math.round(cents(row.total)*rate/100)):null};
    });
    compare('monthly.mobile.team',report.team,expectedTeam,['name','count','totalCents','commissionCents']);
    summaries.push({month,approved:approved.length,revenueCents:total,covered:covered.length,costsCents:costs,profitCents:profit,quick:report.quick});
    if(cents(dashboard.totalRevenue)!==total||dashboard.approvedQuotations!==approved.length||cents(dashboard.totalCosts)!==(costs??0)||cents(dashboard.totalNetProfit)!==(profit??0)) dashboards.push({month,web:{approved:dashboard.approvedQuotations,revenueCents:cents(dashboard.totalRevenue),costsCents:cents(dashboard.totalCosts),profitCents:cents(dashboard.totalNetProfit)},mobile:{approved:approved.length,revenueCents:total,costsCents:costs,profitCents:profit}});
  }
  const digits=value=>(value||'').replace(/\D/g,'');
  const addressMissing=customers.filter(row=>{const cached=mobile.customers.find(item=>item.id===row.id);return [['number','number'],['neighborhood','neighborhood'],['zip_code','zipCode']].some(([db,api])=>row[db]?.trim()&&cached?.[api]!==row[db]);});
  const report={checkedAt:new Date().toISOString(),database:'mastergreen_develop',counts:{customers:customers.length,products:products.length,rawQuotations:quotations.length,canonical:canonical.length,webList:webQuotations.length,quick:quick.length,mobileHistory:mobile.history.length},
    totals:{approved:canonical.filter(row=>row.status==='approved').length,approvedCents:sum(canonical.filter(row=>row.status==='approved'),row=>cents(row.total)),quickCents:sum(quick,row=>row.total_cents),costsCents:sum(canonical.filter(row=>row.status==='approved'&&Number(row.total_costs)>0),row=>cents(row.total_costs)),profitCents:sum(canonical.filter(row=>row.status==='approved'&&Number(row.total_costs)>0),row=>cents(row.net_profit))},
    assertions:sum([...checks.values()],row=>row.checked),mismatches:[...checks].filter(([,result])=>result.mismatches).map(([group,result])=>({group,...result})),
    omissions:{customersWithAddressPartsNotSent:addressMissing.length,customersWithoutDocumentOrPhone:customers.filter(row=>!digits(row.cpf_cnpj)&&!digits(row.phone)).length,quickWithMissingCustomerLink:quick.filter(row=>!customerIndex.has(row.customer_id)).length,duplicateQuickKeys:quick.length-new Set(quick.map(row=>row.user_id+'/'+row.client_id)).size},
    monthly:summaries,dashboardDifferences:dashboards};
  console.log(JSON.stringify(report,null,2));
  if(report.mismatches.length || dashboards.length)process.exitCode=1;
} finally {
  if(token)await fetch(base+'/api/mobile/auth/logout',{method:'POST',headers:{Authorization:`Bearer ${token}`}}).catch(()=>{});
  if(cookie)await fetch(base+'/api/logout',{method:'POST',headers:{cookie}}).catch(()=>{});
  await db.query('ROLLBACK').catch(()=>{});await db.end();
}
