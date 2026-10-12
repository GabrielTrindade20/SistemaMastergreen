// Synthetic data only. The login and every API request are intercepted.
const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
const id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const origin='http://127.0.0.1:5001',target=`${origin}/orcamentos?view=${id}`;
const proposal={id,quotationNumber:'#12345678',createdAt:'2024-02-20T12:00:00Z',validUntil:'2024-03-20',customer:{name:'Cliente histórico teste',phone:'11999999999'},total:'200.00',status:'pending',items:[],costs:[]};
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  let authenticated=false,proposalStatus=200,reads=0;const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname;
    const respond=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    if(path==='/api/login'){assert.equal(request.method(),'POST');authenticated=true;return respond({id:'test',name:'Teste',type:'admin'});}
    assert.equal(request.method(),'GET');
    if(path==='/api/me')return respond(authenticated?{id:'test',name:'Teste',type:'admin'}:{message:'Unauthorized'},authenticated?200:401);
    if(path===`/api/quotations/${id}`){assert.ok(authenticated);reads++;return respond(proposalStatus===200?proposal:{message:'Unavailable'},proposalStatus);}
    return respond({'/api/quotations':[],'/api/quick-proposals':{quickProposals:[]},'/api/company-profile':{name:'MasterGreen',socialName:'Empresa teste',cnpj:'',address:'',phone:'',email:'',pixKey:'',pixBeneficiary:'',responsibleName:'Teste',responsibleRole:'Administrador'}}[path]||[]);
  });
  try{
    await page.goto(target,{waitUntil:'networkidle'});
    assert.equal(reads,0);
    await page.getByLabel('Email',{exact:true}).fill('test@example.com');
    await page.getByLabel('Senha',{exact:true}).fill('test');
    await page.getByRole('button',{name:'Entrar',exact:true}).click();
    await page.getByRole('heading',{name:'Proposta #12345678',exact:true}).waitFor();
    assert.equal(page.url(),target);assert.ok(reads>0);
    await page.getByText('Cliente: Cliente histórico teste',{exact:true}).waitFor();
    const download=page.waitForEvent('download');await page.getByTestId('button-generate-pdf').click();
    assert.ok((await download).suggestedFilename().endsWith('.pdf'));
    await page.screenshot({path:'dist/proposal-web-link.png',fullPage:true});
    await page.getByRole('button',{name:'← Voltar',exact:true}).click();
    await page.waitForURL(`${origin}/orcamentos`);
    for(const status of [404,500]){
      proposalStatus=status;await page.goto(target,{waitUntil:'networkidle'});
      await page.getByText(status===404?'Proposta não encontrada ou sem permissão de acesso.':'Não foi possível carregar a proposta. Confira sua conexão e tente novamente.',{exact:true}).waitFor();
      assert.equal(await page.getByTestId('button-generate-pdf').count(),0);
    }
    proposalStatus=200;await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();
    await page.getByRole('heading',{name:'Proposta #12345678',exact:true}).waitFor();
    const beforeInvalid=reads;
    await page.goto(`${origin}/orcamentos?view=invalid`,{waitUntil:'networkidle'});
    await page.getByText('Link de proposta inválido.',{exact:true}).waitFor();assert.equal(reads,beforeInvalid);
    assert.deepEqual(errors,[]);
    console.log('PASS: protected deep link, login return, old proposal outside current month, PDF download, back, invalid link, 404 and retry.');
  }catch(error){await page.screenshot({path:'dist/proposal-web-link-failure.png',fullPage:true});throw error;}
  finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
