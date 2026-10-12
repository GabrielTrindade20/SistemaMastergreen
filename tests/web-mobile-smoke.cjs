const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
const pg=require('pg');
(async()=>{
  assert.equal(new URL(process.env.DATABASE_URL).pathname,'/mastergreen_develop');
  const base='http://127.0.0.1:5001';
  const login=await fetch(base+'/api/mobile/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:process.env.DEV_ADMIN_EMAIL,password:process.env.DEV_ADMIN_PASSWORD})});
  assert.equal(login.status,200);const session=await login.json();const headers={'Content-Type':'application/json',Authorization:'Bearer '+session.token};
  const fixture={clientId:'f4e13c53-c827-4e74-9555-68879523f5e9',customer:{name:'Cliente de teste — integração',phone:'',contact:'Teste automatizado',document:'',address:''},proposalDate:'2026-10-11',freight:'Incluso',warranty:'12 meses',payment:'50% de entrada + 50% na entrega',discountPercent:10,totalCents:72000};
  const first=await fetch(base+'/api/mobile/proposals',{method:'POST',headers,body:JSON.stringify(fixture)});assert.ok([200,201].includes(first.status));const result=await first.json();
  const second=await fetch(base+'/api/mobile/proposals',{method:'POST',headers,body:JSON.stringify(fixture)});assert.equal(second.status,200);assert.equal((await second.json()).id,result.id);
  const conflict=await fetch(base+'/api/mobile/proposals',{method:'POST',headers,body:JSON.stringify({...fixture,totalCents:73000})});assert.equal(conflict.status,409);
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try {
    const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/propostas-app');await page.getByLabel('Email',{exact:true}).fill(process.env.DEV_ADMIN_EMAIL);await page.getByLabel('Senha',{exact:true}).fill(process.env.DEV_ADMIN_PASSWORD);
    await page.getByRole('button',{name:'Entrar',exact:true}).click();
    await page.waitForURL('**/dashboard');
    await page.goto(base+'/propostas-app');
    await page.getByRole('heading',{name:'Propostas do aplicativo',exact:true}).waitFor();
    await page.getByLabel('Mês das propostas').fill('2026-10');
    await page.getByRole('heading',{name:fixture.customer.name,exact:true}).waitFor();
    await page.getByText('720,00',{exact:false}).first().waitFor();
    await page.goto(base+'/relatorios');await page.getByRole('link',{name:'Ver valores e propostas do aplicativo'}).waitFor();
    assert.deepEqual(errors,[]);
  } finally {await browser.close();await fetch(base+'/api/mobile/auth/logout',{method:'POST',headers,body:'{}'});}
  const client=new pg.Client({connectionString:process.env.DATABASE_URL});await client.connect();
  try {
    const count=await client.query('SELECT count(*)::int AS count FROM mobile_quick_proposals WHERE client_id=$1',[fixture.clientId]);assert.equal(count.rows[0].count,1);
  }finally{await client.end();}
  console.log('PASS: POST real, replay, conflito, registro único no banco, consulta web e separação de relatórios. Uma proposta fictícia de R$ 720 permanece no banco develop.');
})().catch(e=>{console.error(e);process.exit(1);});
