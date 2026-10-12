// APIs intercepted: current web revision, not the original on-device PDF.
const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
const id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',origin='http://127.0.0.1:5001',target=`${origin}/orcamentos?view=${id}&source=app`;
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'}),page=await browser.newPage({viewport:{width:390,height:844}});
  let authenticated=false;const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    const send=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    if(path==='/api/login'){authenticated=true;return send({user:{id:'owner',type:'admin',name:'Teste'}});}
    if(path==='/api/me')return send(authenticated?{id:'owner',type:'admin',name:'Teste'}:{},authenticated?200:401);
    if(path===`/api/quick-proposals/${id}`){assert.ok(authenticated);return send({id,clientId:id,quotationNumber:'#12345678',customer:{name:'Cliente revisado',phone:'11999999999'},date:'2024-01-01',totalCents:98765,discountPercent:0,freight:'Incluso',warranty:'12 meses',payment:'À vista',revision:2,source:'mobile',status:'Enviada'});}
    if(path==='/api/company-profile')return send({name:'MasterGreen',socialName:'Empresa teste',cnpj:'',address:'',phone:'',email:'',pixKey:'',pixBeneficiary:'',responsibleName:'Teste',responsibleRole:'Administrador'});
    return send(path==='/api/quick-proposals'?{quickProposals:[]}:[]);
  });
  try{
    await page.goto(target,{waitUntil:'networkidle'});
    await page.getByLabel('Email',{exact:true}).fill('test@example.com');await page.getByLabel('Senha',{exact:true}).fill('test');await page.getByRole('button',{name:'Entrar',exact:true}).click();
    await page.getByRole('heading',{name:'Proposta do aplicativo',exact:true}).waitFor();assert.equal(page.url(),target);
    await page.getByRole('heading',{name:'Cliente revisado',exact:true}).waitFor();await page.getByText(/R\$\s*987,65/).waitFor();
    const download=page.waitForEvent('download');await page.getByRole('button',{name:'Baixar PDF do resumo',exact:true}).click();assert.match((await download).suggestedFilename(),/\.pdf$/);
    await page.getByRole('button',{name:'Editar proposta',exact:true}).click();await page.waitForURL(`**/orcamentos/novo?edit=${id}&source=app`);
    assert.deepEqual(errors,[]);console.log('PASS: app proposal authenticated deep link, current server revision, PDF download and full web editor link.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
