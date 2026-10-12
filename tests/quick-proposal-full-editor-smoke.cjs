const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',productId='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
let proposal={id,quotationNumber:'#12345678',revision:'a'.repeat(64),date:'2026-10-12',customer:{name:'Cliente teste',contact:'Contato',phone:'11999990000',document:'12345678900',address:'Rua teste'},freight:'Incluso',warranty:'12 meses',payment:'À vista',discountPercent:10,totalCents:90001};
const product={id:productId,name:'Grama teste',pricePerM2:'100',costPerM2:'20',category:'Grama'};
const cost={id:'cccccccc-cccc-4ccc-cccc-cccccccccccc',name:'CUSTO_CONFIDENCIAL',value:'1000'};
let writes=0;
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'}),page=await browser.newPage({viewport:{width:1440,height:1000},timezoneId:'America/Sao_Paulo'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>Object.defineProperty(navigator,'canShare',{value:()=>false,configurable:true}));
  await page.clock.setFixedTime(new Date('2026-10-12T12:00:00Z'));
  await page.route('**/api/**',async route=>{
    const req=route.request(),path=new URL(req.url()).pathname;
    const response=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
    if(path===`/api/quick-proposals/${id}`){
      if(req.method()==='PUT'){
        const data=req.postDataJSON();assert.equal(data.revision,proposal.revision);writes++;
        const {proposalDate,revision,...fields}=data;proposal={...proposal,...fields,date:proposalDate,revision:(writes%2?'b':'a').repeat(64)};
      }return response(proposal);
    }
    assert.equal(req.method(),'GET');
    return response({'/api/me':{id:'test',name:'Admin teste',type:'admin'},'/api/quick-proposals':{quickProposals:[proposal]},'/api/quotations':[], '/api/products':[product],'/api/costs':[cost],'/api/settings':[{key:'invoice_percent',value:'5'},{key:'tithe_percent',value:'10'}],'/api/company-profile':{name:'MasterGreen',socialName:'Empresa teste',cnpj:'',address:'',phone:'',email:'',pixKey:'',pixBeneficiary:'',responsibleName:'Admin teste',responsibleRole:'Administrador'}}[path]||[]);
  });
  const open=async()=>{
    await page.goto('http://127.0.0.1:5001/orcamentos',{waitUntil:'networkidle'});
    await page.locator('button[aria-label="Ações da proposta"]:visible').click();
    await page.getByRole('menuitem',{name:'Editar',exact:true}).click();
    await page.getByLabel('Nome do cliente',{exact:true}).waitFor();
  };
  const save=async()=>{await page.getByTestId('button-submit').click();await page.waitForURL('**/orcamentos');};
  try{
    await open();
    for(const title of ['Produtos','Custos','Resumo Financeiro','Configurações da Proposta'])assert.equal(await page.getByText(title,{exact:true}).count()>0,true);
    assert.equal(await page.getByLabel('Valor final da proposta (R$)',{exact:true}).inputValue(),'900.01');
    await save();assert.equal(proposal.totalCents,90001);assert.deepEqual(proposal.webDetails.items,[]);
    await open();
    await page.getByTestId('button-add-item').click();
    await page.getByTestId('select-product-0').first().click();await page.getByRole('option',{name:'Grama teste',exact:true}).click();
    await page.getByTestId('input-quantity-0').fill('10.5');
    await page.getByTestId('input-unit-price-0').fill('20');
    await page.getByTestId('input-sale-price-0').fill('100');
    await page.getByTestId('button-add-cost').click();
    await page.getByTestId('button-calc-percentage-0').click();
    await page.getByTestId('input-cost-percentage-0').fill('10');
    await page.getByTestId('input-pdf-title').fill('Proposta Completa');
    await page.getByTestId('textarea-notes').fill('Observacoes comerciais');
    await page.getByLabel('Condições de pagamento',{exact:true}).fill('3 parcelas');
    await page.getByTestId('input-valid-until').fill('2026-11-30');
    await save();assert.equal(proposal.totalCents,90001);assert.equal(proposal.webDetails.items.length,1);assert.equal(proposal.webDetails.costs[0].calculationType,'percentage');
    await open();assert.equal(await page.getByTestId('input-quantity-0').inputValue(),'10.5');
    assert.equal(await page.getByTestId('input-unit-price-0').inputValue(),'20');
    assert.equal(await page.getByTestId('input-cost-percentage-0').inputValue(),'10');
    assert.equal(await page.getByTestId('input-valid-until').inputValue(),'2026-11-30');
    assert.equal(await page.getByTestId('textarea-notes').inputValue(),'Observacoes comerciais');
    await page.getByLabel('Como definir o total').selectOption('items');
    await save();assert.equal(proposal.totalCents,94500);
    await open();
    const downloading=page.waitForEvent('download');await page.getByTestId('button-share').click();const download=await downloading;
    const pdf=fs.readFileSync(await download.path()).toString('latin1');
    for(const value of ['Grama teste','Proposta Completa','Observacoes comerciais'])assert.ok(pdf.includes(value),value);
    assert.ok(!pdf.includes('CUSTO_CONFIDENCIAL'));
    fs.mkdirSync('dist',{recursive:true});await page.screenshot({path:'dist/quick-proposal-full-editor.png',fullPage:true});
    await page.getByTestId('button-add-item').click();
    await page.getByTestId('select-product-1').first().click();await page.getByRole('option',{name:'Grama teste',exact:true}).click();
    await page.getByTestId('input-quantity-1').fill('2');await page.getByTestId('input-sale-price-1').fill('25');
    await page.getByTestId('button-add-cost').click();await page.getByTestId('input-cost-unit-value-1').fill('50');await page.getByTestId('input-cost-quantity-1').fill('2');
    await save();assert.equal(proposal.totalCents,99000);assert.equal(proposal.webDetails.costs.length,2);
    await open();await page.getByTestId('button-remove-item-1').click();await page.getByTestId('button-remove-cost-1').click();
    await page.getByTestId('input-cost-percentage-0').fill('0');await save();
    assert.equal(proposal.totalCents,94500);assert.equal(proposal.webDetails.costs[0].percentageValue,0);
    await open();await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    // Received item snapshots, including multiple unlinked manual items, survive edits.
    proposal.webDetails={...proposal.webDetails,pricingMode:'manual',manualTotalCents:94500,costs:[],items:[
      {productId:product.id,name:'Grama negociada no app',quantity:2.5,unitCost:0,unitPrice:80.5,unit:'m²'},
      {productId:null,name:'Instalação livre',quantity:1,unitCost:0,unitPrice:100,unit:'serviço'},
      {productId:null,name:'Acabamento livre',quantity:3,unitCost:0,unitPrice:10,unit:'m'},
    ]};
    await open();
    assert.equal(await page.getByLabel('Descrição do item 1',{exact:true}).inputValue(),'Grama negociada no app');
    assert.equal(await page.getByTestId('input-quantity-0').inputValue(),'2.5');
    assert.equal(await page.getByTestId('input-sale-price-0').inputValue(),'80.5');
    assert.equal(await page.getByLabel('Unidade do item 2',{exact:true}).inputValue(),'serviço');
    await page.getByLabel('Descrição do item 2',{exact:true}).fill('Instalação revisada');
    await page.getByTestId('input-sale-price-1').fill('120');await save();
    assert.equal(proposal.totalCents,94500);assert.equal(proposal.webDetails.items[0].unitCost,0);
    assert.equal(proposal.webDetails.items[1].name,'Instalação revisada');assert.equal(proposal.webDetails.items[1].productId,null);
    assert.equal(proposal.webDetails.items[2].name,'Acabamento livre');
    await open();assert.equal(await page.getByTestId('input-sale-price-1').inputValue(),'120');
    const longName='Aplicação de Pó de Brita com nivelamento e compactação do piso';
    await page.getByLabel('Descrição do item 2',{exact:true}).fill(longName);
    for(const width of [1280,1024,768,390]){
      await page.setViewportSize({width,height:1000});
      await page.evaluate(async()=>{await Promise.all(document.getAnimations().filter(animation=>animation.effect?.getTiming().iterations!==Infinity).map(animation=>animation.finished.catch(()=>{})));});
      const card=page.getByTestId('proposal-item-1');await card.scrollIntoViewIfNeeded();
      const description=await page.getByLabel('Descrição do item 2',{exact:true}).boundingBox();
      const quantity=await page.getByTestId('input-quantity-1').boundingBox();
      assert.ok(description.width>(width>=1024?300:120),`description at ${width}`);
      assert.ok(quantity.y>=description.y+description.height,`numbers below description at ${width}`);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      await card.screenshot({path:`dist/proposal-item-layout-${width}.png`});
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: editor completo, total preservado, produtos/custos fixos e %, reabertura, recálculo, PDF sem custos e layout compacto.');
  }catch(error){console.error({errors,body:(await page.locator('body').innerText()).slice(-2200)});await page.screenshot({path:'dist/quick-proposal-full-editor-failure.png',fullPage:true});throw error;}
  finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
