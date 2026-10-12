const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base='http://127.0.0.1:5001';
(async()=>{
  assert.equal(new URL(process.env.DATABASE_URL).pathname,'/mastergreen_develop');
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  const context=await browser.newContext({viewport:{width:1400,height:1000}});
  let token;
  try{
    const response=await context.request.post(base+'/api/login',{data:{email:process.env.DEV_ADMIN_EMAIL,password:process.env.DEV_ADMIN_PASSWORD}});assert.equal(response.status(),200);
    const company=await (await context.request.get(base+'/api/company-profile')).json();assert.ok(company.name.length>0);
    const saved=await context.request.put(base+'/api/company-profile',{data:company});assert.equal(saved.status(),200);
    assert.deepEqual(await (await context.request.get(base+'/api/company-profile')).json(),company);
    assert.equal((await context.request.put(base+'/api/company-profile',{data:{...company,validityDays:0}})).status(),400);
    assert.equal((await fetch(base+'/api/company-profile')).status,401);
    assert.equal((await fetch(base+'/api/company-profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(company)})).status,403);
    const login=await context.request.post(base+'/api/mobile/auth/login',{data:{email:process.env.DEV_ADMIN_EMAIL,password:process.env.DEV_ADMIN_PASSWORD}});assert.equal(login.status(),200);token=(await login.json()).token;
    const mobile=await(await context.request.get(base+'/api/mobile/data',{headers:{Authorization:'Bearer '+token}})).json();
    assert.ok(mobile.quickProposals.every(row=>/^#\d{8}$/.test(row.quotationNumber)));
    assert.equal(new Set(mobile.quickProposals.map(row=>row.quotationNumber)).size,mobile.quickProposals.length);
    assert.deepEqual(mobile.company,company);assert.ok(mobile.costs.length);assert.ok(mobile.products.every(row=>!('catalog' in row)&&!('costPerM2' in row)));
    const webProducts=await(await context.request.get(base+'/api/products')).json();
    assert.equal(mobile.products.length,webProducts.length);
    for(const product of webProducts){
      const row=mobile.products.find(item=>item.id===product.id);
      assert.ok(row);
      for(const field of ['name','category','description','pricePerM2'])assert.equal(row[field],product[field]);
    }
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/configuracoes',{waitUntil:'networkidle'});
    await page.getByRole('heading',{name:'Empresa e propostas'}).waitFor();
    assert.equal(await page.getByLabel('Nome da empresa',{exact:true}).inputValue(),company.name);
    assert.equal(await page.getByText('Organização do catálogo no aplicativo',{exact:true}).count(),0);
    await page.screenshot({path:'dist/pdf-review/settings.png',fullPage:true});
    await page.goto(base+'/orcamentos',{waitUntil:'networkidle'});
    await page.getByRole('button',{name:'Ações da proposta',exact:true}).first().click();
    await page.getByRole('menuitem',{name:'Visualizar',exact:true}).click();
    await page.getByRole('dialog').waitFor();assert.ok((await page.getByRole('dialog').innerText()).includes('Desconto aplicado'));
    // Verify download without retaining a customer's real PDF in the artifacts.
    const proposalNumber=(await page.getByRole('dialog').innerText()).match(/#\d{8}/)?.[0];
    assert.ok(proposalNumber);
    const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Baixar PDF do resumo'}).click();const download=await downloaded;
    assert.ok(download.suggestedFilename().includes(proposalNumber));
    assert.ok(fs.readFileSync(await download.path()).includes(Buffer.from(proposalNumber)));
    await page.getByRole('button',{name:'Fechar',exact:true}).click();
    assert.deepEqual(errors,[]);
    for(const name of ['mobile','mobile-long']){
      await page.setContent(fs.readFileSync(`dist/pdf-review/${name}.html`,'utf8'),{waitUntil:'networkidle'});
      await page.pdf({path:`dist/pdf-review/${name}.pdf`,format:'A4',printBackground:true,preferCSSPageSize:true});
    }
    console.log('PASS: settings persistence/validation/auth, mobile company + original web categories/prices; no catalog settings, opening existing proposals, PDF download and mobile PDF rendering.');
  }finally{
    if(token)await context.request.post(base+'/api/mobile/auth/logout',{headers:{Authorization:'Bearer '+token}});
    await context.request.post(base+'/api/logout');await browser.close();
  }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
