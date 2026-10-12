import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../server/db';
import { saveQuickProposal } from '../server/mobile';
import { getQuickProposal, editQuickProposal } from '../server/quick-proposal-edit';
import { quickProposalEditSchema } from '../shared/quick-proposal-edit';
import { quickProposalDetailsSchema,calculateQuickDetails,quickCostTotal } from '../shared/quick-proposal-details';

if(new URL(process.env.DATABASE_URL!).pathname!=='/mastergreen_develop')throw Error('Somente develop.');
after(()=>pool.end());
const productId=randomUUID();
const details=()=>quickProposalDetailsSchema.parse({version:1,pricingMode:'manual',manualTotalCents:90001,validUntil:'2026-11-01',notes:'Observação do teste',pdfTitle:'Título do teste',responsibleName:'Responsável',responsiblePosition:'Administrador',shippingIncluded:true,invoicePercent:5,tithePercent:10,items:[{productId,name:'Grama de teste',quantity:10.5,unitCost:20,unitPrice:100}],costs:[{costId:null,name:'Instalação',unitValue:1000,quantity:2,calculationType:'percentage',percentageValue:10,productId,supplier:'Fornecedor',description:'Custo interno'}]});
test('cálculo compartilhado: total negociado não sofre desconto duplo, itens e custos corretos',()=>{
  const d=details(),manual=calculateQuickDetails(d,10);
  assert.equal(manual.total,900.01);assert.equal(manual.discount,0);assert.equal(manual.totalCosts,310);
  assert.equal(quickCostTotal({...d.costs[0],percentageValue:0}),0);
  assert.equal(quickCostTotal({...d.costs[0],calculationType:'fixed'}),2000);
  const detailed=calculateQuickDetails({...d,pricingMode:'items'},10);
  assert.equal(detailed.subtotal,1050);assert.equal(detailed.discount,105);assert.equal(detailed.total,945);
  assert.equal(detailed.invoiceAmount,47.25);assert.equal(detailed.companyProfit,587.75);assert.equal(detailed.tithe,58.78);assert.equal(detailed.netProfit,528.97);
  assert.equal(quickProposalDetailsSchema.safeParse({...d,pricingMode:'items',items:[]}).success,false);
  assert.equal(quickProposalDetailsSchema.safeParse({...d,items:[{...d.items[0],quantity:-1}]}).success,false);
  assert.equal(quickProposalDetailsSchema.safeParse({...d,costs:[{...d.costs[0],productId:randomUUID()}]}).success,false);
});
test('banco: detalhar/reabrir/reeditar preserva campos, número e retry, sem duplicação',async()=>{
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const owner=(await client.query("SELECT id FROM users WHERE email='admin@dev.mastergreen.local'")).rows[0].id;
    const input={clientId:randomUUID(),customer:{name:'Teste detalhado revertido',phone:'',contact:'',document:'',address:'Endereço'},proposalDate:'2026-10-12',freight:'Incluso',warranty:'24 meses',payment:'Parcelado',discountPercent:10,totalCents:90001};
    const receipt=await saveQuickProposal(client,owner,input),first=(await getQuickProposal(client,receipt.id))!;
    assert.equal(first.webDetails,undefined);
    const {clientId,...fields}=input;
    const body=quickProposalEditSchema.parse({...fields,revision:first.revision,webDetails:details()});
    assert.equal((await editQuickProposal(client,receipt.id,body)).kind,'updated');
    const reopened=(await getQuickProposal(client,receipt.id))!;
    assert.deepEqual(reopened.webDetails,body.webDetails);assert.equal(reopened.totalCents,90001);assert.equal(reopened.quotationNumber,receipt.quotationNumber);
    assert.equal((await editQuickProposal(client,receipt.id,{...fields,revision:reopened.revision})).kind,'conflict');
    assert.equal((await editQuickProposal(client,receipt.id,{...body,revision:reopened.revision,totalCents:1,webDetails:{...details(),pricingMode:'items'}})).kind,'updated');
    const recalculated=(await getQuickProposal(client,receipt.id))!;assert.equal(recalculated.totalCents,94500);
    assert.equal((await saveQuickProposal(client,owner,input)).replayed,true);
    assert.deepEqual(await getQuickProposal(client,receipt.id),recalculated);
    assert.equal((await editQuickProposal(client,receipt.id,{...body,revision:reopened.revision})).kind,'conflict');
    assert.equal((await client.query('SELECT count(*)::int AS n FROM mobile_quick_proposals WHERE client_id=$1',[clientId])).rows[0].n,1);
  }finally{await client.query('ROLLBACK');client.release();}
});
