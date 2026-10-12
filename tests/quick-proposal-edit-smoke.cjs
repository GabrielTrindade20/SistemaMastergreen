// Browser fixtures only. No customer or proposal is written to the database.
const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
let proposal={id,quotationNumber:'#12345678',revision:'a'.repeat(64),date:'2026-10-12',customer:{name:'Cliente teste',contact:'Contato teste',phone:'11999990000',document:'12345678900',address:'Rua teste, 10'},freight:'Incluso',warranty:'12 meses',payment:'À vista',discountPercent:10,totalCents:90001};
let writes=0,conflict=false,missing=false;
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  const page=await browser.newPage({viewport:{width:1400,height:1000},timezoneId:'America/Sao_Paulo'});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-10-12T12:00:00Z'));
  await page.route('**/api/**',async route=>{
    const req=route.request(),path=new URL(req.url()).pathname;
    const respond=(status,data)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    if(path===`/api/quick-proposals/${id}`){
      if(missing)return respond(404,{message:'Proposta não encontrada.'});
      if(req.method()==='PUT'){
        const data=req.postDataJSON();writes++;
        if(conflict)return respond(409,{message:'Alterada em outra aba.'});
        assert.equal(data.revision,proposal.revision);
        assert.deepEqual(Object.keys(data).sort(),['customer','proposalDate','freight','warranty','payment','discountPercent','totalCents','revision','webDetails'].sort());
        const {proposalDate,revision,...fields}=data;
        proposal={...proposal,...fields,date:proposalDate,revision:(writes%2?'b':'a').repeat(64)};
      }else assert.equal(req.method(),'GET');
      return respond(200,proposal);
    }
    assert.equal(req.method(),'GET');
    return respond(200,{'/api/me':{id:'test',name:'Admin teste',type:'admin'},'/api/quick-proposals':{quickProposals:[proposal]},'/api/quotations':[]}[path]||[]);
  });
  fs.mkdirSync('dist',{recursive:true});
  const open=async()=>{
    await page.goto('http://127.0.0.1:5001/orcamentos',{waitUntil:'networkidle'});
    // Reconnaissance before actions: locate the rendered app row and its edit action.
    const row=page.locator('table:visible tbody tr').filter({hasText:'#12345678'});
    assert.ok((await row.innerText()).includes('App'));
    assert.equal(await row.getByRole('button').count(),1);
    await row.getByRole('button',{name:'Ações da proposta',exact:true}).click();
    await page.getByRole('menuitem',{name:'Editar',exact:true}).click();
    await page.getByRole('heading',{name:'Editar Proposta',exact:true}).waitFor();
    await page.getByLabel('Nome do cliente',{exact:true}).waitFor();
    assert.ok(page.url().includes('/orcamentos/novo?edit='));
  };
  try{
    await open();
    const expected={'Nome do cliente':'Cliente teste','Contato':'Contato teste','Telefone':'11999990000','CPF / CNPJ':'12345678900','Endereço':'Rua teste, 10','Data da proposta':'2026-10-12','Condições de pagamento':'À vista','Frete':'Incluso','Texto da Garantia':'12 meses','Valor final da proposta (R$)':'900.01','Desconto (%)':'10'};
    for(const [label,value] of Object.entries(expected))assert.equal(await page.getByLabel(label,{exact:true}).inputValue(),value);
    await page.getByRole('button',{name:'Salvar Alterações',exact:true}).click();await page.waitForURL('**/orcamentos');
    assert.equal(proposal.totalCents,90001);assert.equal(writes,1);
    await open();
    await page.getByLabel('Nome do cliente',{exact:true}).fill('Cliente revisado');
    await page.getByLabel('Condições de pagamento',{exact:true}).fill('3 parcelas');
    await page.getByLabel('Endereço',{exact:true}).fill('Novo endereço');
    await page.getByLabel('Desconto (%)',{exact:true}).fill('5');
    assert.equal(await page.getByLabel('Valor final da proposta (R$)',{exact:true}).inputValue(),'900.01');
    await page.getByLabel('Valor final da proposta (R$)',{exact:true}).fill('950.13');
    await page.getByRole('button',{name:'Salvar Alterações',exact:true}).click();await page.waitForURL('**/orcamentos');
    await open();
    assert.equal(await page.getByLabel('Nome do cliente',{exact:true}).inputValue(),'Cliente revisado');
    assert.equal(await page.getByLabel('Valor final da proposta (R$)',{exact:true}).inputValue(),'950.13');
    assert.equal(proposal.quotationNumber,'#12345678');
    await page.screenshot({path:'dist/quick-proposal-edit.png',fullPage:true});
    await page.getByLabel('Nome do cliente',{exact:true}).fill('');
    await page.getByRole('button',{name:'Salvar Alterações',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'Confira os dados'}).waitFor();
    assert.equal(writes,2);
    await page.getByLabel('Nome do cliente',{exact:true}).fill('Não perder edição');
    await page.getByLabel('Condições de pagamento',{exact:true}).focus();
    await page.waitForFunction(()=>!document.querySelector('input[aria-invalid="true"]'));
    conflict=true;
    await page.getByRole('button',{name:'Salvar Alterações',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'Seus dados continuam no formulário'}).waitFor();
    assert.equal(await page.getByLabel('Nome do cliente',{exact:true}).inputValue(),'Não perder edição');
    assert.ok(page.url().includes('/orcamentos/novo?edit='));
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
    await page.getByRole('button',{name:'Cancelar',exact:true}).click();await page.waitForURL('**/orcamentos');
    const card=page.locator('div.block.md\\:hidden.space-y-4 > div').filter({hasText:'#12345678'});
    assert.equal(await card.getByRole('button').count(),1);
    await card.getByRole('button',{name:'Ações da proposta',exact:true}).click();
    await page.getByRole('menuitem',{name:'Visualizar',exact:true}).click();
    await page.getByRole('button',{name:'Editar proposta',exact:true}).click();
    await page.getByLabel('Nome do cliente',{exact:true}).waitFor();
    missing=true;
    await page.reload({waitUntil:'networkidle'});
    await page.getByText(/Não foi possível abrir esta proposta/).waitFor();
    assert.equal(await page.getByRole('button',{name:'Salvar Alterações',exact:true}).count(),0);
    assert.deepEqual(errors,[]);
    console.log('PASS: edição na página existente, hidratação, centavos, salvar/reabrir, validação, conflito sem perder texto, tela compacta e 404 seguro.');
  }catch(error){console.error({writes,errors,body:(await page.locator('body').innerText()).slice(-4000)});await page.screenshot({path:'dist/quick-proposal-edit-failure.png',fullPage:true});throw error;}
  finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
