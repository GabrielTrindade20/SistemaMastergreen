// Isolated UI fixtures: no business data is read or written.
const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const quotation=(id,createdAt)=>({id,quotationNumber:id,createdAt,customer:{name:'Cliente de teste'},total:'100.00',status:'pending',branch:'Matriz',items:[],costs:[]});
const web=[quotation('WEB-OLD','2026-10-01T12:00:00Z'),quotation('WEB-NEW','2026-10-15T12:00:00Z'),quotation('WEB-SEPT','2026-09-20T12:00:00Z'),quotation('WEB-2025','2025-10-20T12:00:00Z')];
const mobile=[{id:'new-app1',quotationNumber:'#12345678',date:'2026-10-17',customer:{name:'Cliente do app'},totalCents:20000,payment:'À vista'},{id:'mid-app1',quotationNumber:'#87654321',date:'2026-10-10',customer:{name:'Cliente do app'},totalCents:30000,payment:'À vista'}];
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  const page=await browser.newPage({viewport:{width:1400,height:1000},timezoneId:'America/Sao_Paulo'});
  await page.clock.setFixedTime(new Date('2026-10-12T12:00:00Z'));
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/**',route=>{
    assert.equal(route.request().method(),'GET');
    const data={'/api/me':{id:'test',name:'Teste',type:'admin'},'/api/quotations':web,'/api/quick-proposals':{quickProposals:mobile}}[new URL(route.request().url()).pathname]||[];
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  fs.mkdirSync('dist',{recursive:true});
  try{
    await page.goto('http://127.0.0.1:5001/orcamentos',{waitUntil:'networkidle'});
    const year=page.getByRole('combobox',{name:'Ano das propostas'}),month=page.getByRole('combobox',{name:'Mês das propostas'});
    assert.equal(await year.innerText(),'2026');assert.equal(await month.innerText(),'Outubro');
    const rows=page.locator('table:visible tbody tr');
    const numbers=()=>rows.locator('td:first-child').allTextContents();
    assert.deepEqual(await numbers(),['#12345678','WEB-NEW','#87654321','WEB-OLD']);
    assert.deepEqual(await rows.locator('td:nth-child(2)').allTextContents(),['App','Web','App','Web']);
    const search=page.getByPlaceholder('Buscar por cliente ou número da proposta...');
    await search.fill('#12345678');
    assert.deepEqual(await numbers(),['#12345678']);
    await rows.getByRole('button',{name:'Ações da proposta',exact:true}).click();
    await page.getByRole('menuitem',{name:'Visualizar',exact:true}).click();
    await page.getByRole('dialog').waitFor();
    assert.ok((await page.getByRole('dialog').innerText()).includes('#12345678'));
    await page.getByRole('button',{name:'Fechar',exact:true}).click();
    await search.fill('');
    await page.screenshot({path:'dist/quotation-filters.png',fullPage:true});
    await month.click();assert.equal(await page.getByRole('option').count(),12);
    assert.equal(await page.getByRole('option',{name:'Todos os meses'}).count(),0);
    await page.getByRole('option',{name:'Setembro',exact:true}).click();
    assert.deepEqual(await numbers(),['WEB-SEPT']);
    await year.click();assert.equal(await page.getByRole('option',{name:'Todos os anos'}).count(),0);
    await page.getByRole('option',{name:'2025',exact:true}).click();
    assert.equal(await month.innerText(),'Setembro');assert.equal(await rows.count(),0);
    await month.click();await page.getByRole('option',{name:'Outubro',exact:true}).click();
    assert.deepEqual(await numbers(),['WEB-2025']);
    await page.getByRole('button',{name:'Limpar filtros',exact:true}).first().click();
    assert.equal(await year.innerText(),'2026');assert.equal(await month.innerText(),'Outubro');
    assert.deepEqual(await numbers(),['#12345678','WEB-NEW','#87654321','WEB-OLD']);
    await page.setViewportSize({width:390,height:844});
    const cards=page.locator('div.block.md\\:hidden.space-y-4 > div');
    assert.equal(await cards.count(),4);
    const texts=await cards.allTextContents();
    ['#12345678','WEB-NEW','#87654321','WEB-OLD'].forEach((number,index)=>assert.ok(texts[index].includes(number)));
    assert.deepEqual(errors,[]);
    console.log('PASS: mês atual obrigatório, 12 meses, troca de ano, período vazio, limpar filtros e ordem unificada desktop/compacta.');
  }catch(error){await page.screenshot({path:'dist/quotation-filters-failure.png',fullPage:true});throw error;}
  finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
