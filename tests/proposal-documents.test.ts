import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {defaultCompany} from '../shared/company-profile';
import {companyProfileSchema} from '../server/company-profile';
import {pool} from '../server/db';
import {renderProposalDocument,type ProposalDocument} from '../client/src/lib/proposal-document';
import {createRequire} from 'node:module';
const {gerarHTML}=createRequire(import.meta.url)('../../app-mobile/app-mastergreen/src/lib/proposal-html.ts');
after(()=>pool.end());
const fixture:ProposalDocument={number:'MG-2026-001',date:'11/10/2026',customer:'Cliente de demonstração',customerDetails:['(61) 99999-0000','Rua das Palmeiras, 120 · Brasília · DF'],items:[{description:'Grama sintética 20 mm com instalação',quantity:25.5,unit:'m²',unitPrice:99,total:2524.5},{description:'Preparação e nivelamento do piso',quantity:25.5,unit:'m²',unitPrice:20,total:510}],total:3034.5,conditions:[['Garantia','12 meses'],['Pagamento','50% de entrada + 50% na entrega'],['Frete','Incluso'],['Validade','10/11/2026']]};
test('contratos compartilhados com mobile permanecem idênticos',()=>{
  for(const name of ['company-profile'])assert.equal(readFileSync(`shared/${name}.ts`,'utf8'),readFileSync(`../app-mobile/app-mastergreen/src/lib/${name}.ts`,'utf8'));
});
test('configuração valida campos, limites e não aceita extras',()=>{
  assert.ok(companyProfileSchema.safeParse(defaultCompany).success);
  for(const patch of [{name:''},{email:'inválido'},{validityDays:0},{validityDays:366},{pixKey:'x'.repeat(251)},{unknown:'x'}])assert.equal(companyProfileSchema.safeParse({...defaultCompany,...patch}).success,false);
});
test('PDFs reais: documento curto, resumo sem itens e múltiplas páginas',()=>{
  const logo='data:image/png;base64,'+readFileSync('attached_assets/mastergreen-logo.png').toString('base64');
  mkdirSync('dist/pdf-review',{recursive:true});
  for(const [name,data] of Object.entries({web:fixture,summary:{...fixture,number:'#12345678',items:[],note:'Itens não enviados ao sistema.'},long:{...fixture,items:Array.from({length:65},(_,i)=>({...fixture.items[0],description:`Item ${i+1} · Grama sintética com instalação e acabamento profissional.`,quantity:1,total:99})),total:6435}})){
    const doc=renderProposalDocument(data,defaultCompany,logo);
    assert.ok(doc.output('arraybuffer').byteLength>1000);
    if(name==='long')assert.ok(doc.getNumberOfPages()>1);else assert.equal(doc.getNumberOfPages(),1);
    writeFileSync(`dist/pdf-review/${name}.pdf`,Buffer.from(doc.output('arraybuffer')));
  }
});
test('HTML mobile usa empresa configurada, escapa textos e não expõe custo interno',()=>{
  const logo='data:image/png;base64,'+readFileSync('attached_assets/mastergreen-logo.png').toString('base64');
  const company={...defaultCompany,name:'Empresa <teste>',pixKey:'chave-teste'};
  const item={id:1,descricao:'Grama <script>alert(1)</script>',metragem:'25,5',valorPorMetro:'99',unit:'m²',costReference:'SEGREDO_INTERNO'};
  const html=gerarHTML('Cliente de demonstração','','(61) 99999-0000','Rua das Palmeiras, 120 · Brasília · DF','','11/10/2026','Incluso',[item],2524.5,'12 meses','50% de entrada + 50% na entrega',logo,'0',company);
  assert.ok(html.includes('Empresa &lt;teste&gt;'));assert.ok(html.includes('chave-teste'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('SEGREDO_INTERNO'));
  mkdirSync('dist/pdf-review',{recursive:true});
  const sample=(count:number)=>gerarHTML('Cliente de demonstração','','(61) 99999-0000','Rua das Palmeiras, 120 · Brasília · DF','','11/10/2026','Incluso',Array.from({length:count},(_,i)=>({...item,id:i,descricao:'Grama sintética 20 mm com instalação'})),2524.5*count,'12 meses','50% de entrada + 50% na entrega',logo,'0',defaultCompany);
  writeFileSync('dist/pdf-review/mobile.html',sample(2));writeFileSync('dist/pdf-review/mobile-long.html',sample(65));
});
