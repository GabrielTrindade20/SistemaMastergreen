import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {quickProposalSchema} from '../shared/mobile-contract';
import {pool} from '../server/db';
import {saveQuickProposal} from '../server/mobile';
import {getQuickProposal,editQuickProposal} from '../server/quick-proposal-edit';

if(new URL(process.env.DATABASE_URL!).pathname!=='/mastergreen_develop')throw new Error('Teste permitido somente em mastergreen_develop.');
after(()=>pool.end());
const input=()=>quickProposalSchema.parse({clientId:randomUUID(),customer:{name:'Teste transacional',phone:'11999990000',document:'00000000000'},proposalDate:'2026-10-12',freight:'Incluso',warranty:'12 meses',payment:'50% de entrada',discountPercent:10,totalCents:90000});
test('contrato rejeita itens vazios, custos, datas inválidas e valores negativos',()=>{
  const valid=input();assert.equal(quickProposalSchema.safeParse(valid).success,true);
  for(const extra of [{items:[]},{cost:500},{totalCents:-1},{totalCents:0},{totalCents:1.5},{proposalDate:'2026-02-30'},{discountPercent:101}])assert.equal(quickProposalSchema.safeParse({...valid,...extra}).success,false);
});

test('itens do app chegam ao editor; recuperação legada é idempotente e não sobrescreve web',async()=>{
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const owner=(await client.query("SELECT id FROM users WHERE email='admin@dev.mastergreen.local'")).rows[0].id;
    const items=[{productId:randomUUID(),name:'Produto com preço negociado',quantity:2.5,unitPrice:80.5,unit:'m²' as const},{productId:null,name:'Serviço livre',quantity:1,unitPrice:100,unit:'serviço' as const}];
    const data=quickProposalSchema.parse({...input(),items});
    for(const invalid of [{...items[0],quantity:0},{...items[0],unit:'kg'},{...items[0],unitCost:3},{...items[0],productId:'invalido'}])assert.equal(quickProposalSchema.safeParse({...data,items:[invalid]}).success,false);
    const receipt=await saveQuickProposal(client,owner,data);
    const opened=(await getQuickProposal(client,receipt.id))!;
    assert.deepEqual(opened.webDetails!.items,items.map(item=>({...item,unitCost:0})));
    assert.equal(opened.totalCents,data.totalCents);assert.equal(opened.webDetails!.pricingMode,'manual');
    assert.equal((await saveQuickProposal(client,owner,data)).conflict,false);
    assert.equal((await saveQuickProposal(client,owner,{...data,items:[{...items[0],unitPrice:99}]})).conflict,true);
    const legacy=input(),old=await saveQuickProposal(client,owner,legacy);
    assert.equal((await saveQuickProposal(client,owner,{...legacy,items})).conflict,false);
    const enriched=(await getQuickProposal(client,old.id))!;
    assert.equal(enriched.webDetails!.items.length,2);
    const {clientId,...summary}=legacy;
    await editQuickProposal(client,old.id,{...summary,revision:enriched.revision,webDetails:{...enriched.webDetails!,items:[{...enriched.webDetails!.items[0],name:'Editado no web',unitPrice:999}]}});
    const edited=await getQuickProposal(client,old.id);
    await saveQuickProposal(client,owner,{...legacy,items});
    assert.deepEqual(await getQuickProposal(client,old.id),edited);
    assert.equal((await saveQuickProposal(client,owner,legacy)).conflict,false);
    assert.equal((await client.query('SELECT count(*)::int AS n FROM mobile_quick_proposals WHERE client_id=$1',[clientId])).rows[0].n,1);
  }finally{await client.query('ROLLBACK');client.release();}
});
test('transação: valor preservado, cliente associado, retry idempotente e conflito detectado',async()=>{
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const user=await client.query("SELECT id FROM users WHERE email='admin@dev.mastergreen.local'");
    assert.ok(user.rows[0]);const owner=user.rows[0].id;const data=input();
    const first=await saveQuickProposal(client,owner,data);
    const second=await saveQuickProposal(client,owner,data);
    assert.equal(first.id,second.id);assert.equal(second.replayed,true);
    assert.match(first.quotationNumber,/^#\d{8}$/);
    assert.equal(first.quotationNumber,second.quotationNumber);
    const conflict=await saveQuickProposal(client,owner,{...data,totalCents:85000});assert.equal(conflict.conflict,true);
    const other=await saveQuickProposal(client,owner,{...data,clientId:randomUUID()});
    assert.notEqual(first.quotationNumber,other.quotationNumber);
    const webCollision=await client.query(`INSERT INTO quotations
      SELECT (jsonb_populate_record(NULL::quotations,to_jsonb(q)||jsonb_build_object('id',gen_random_uuid(),'quotation_number',$1::text))).*
      FROM quotations q LIMIT 1 RETURNING quotation_number`,[first.quotationNumber]);
    assert.equal(webCollision.rowCount,1);
    assert.match(webCollision.rows[0].quotation_number,/^#\d{8}$/);
    assert.notEqual(webCollision.rows[0].quotation_number,first.quotationNumber);
    const mobileCollision=await client.query(`INSERT INTO mobile_quick_proposals
      SELECT (jsonb_populate_record(NULL::mobile_quick_proposals,to_jsonb(q)||jsonb_build_object('id',gen_random_uuid(),'client_id',gen_random_uuid(),'quotation_number',$1::text))).*
      FROM mobile_quick_proposals q WHERE id=$2 RETURNING quotation_number`,[webCollision.rows[0].quotation_number,first.id]);
    assert.notEqual(mobileCollision.rows[0].quotation_number,webCollision.rows[0].quotation_number);
    await client.query('SAVEPOINT immutable_number');
    await assert.rejects(client.query('UPDATE mobile_quick_proposals SET quotation_number=$1 WHERE id=$2',['#00000000',first.id]),/immutable/);
    await client.query('ROLLBACK TO SAVEPOINT immutable_number');
    const rows=await client.query('SELECT customer_id,total_cents FROM mobile_quick_proposals WHERE id=ANY($1::uuid[])',[[first.id,other.id]]);
    assert.equal(rows.rowCount,2);assert.equal(rows.rows[0].customer_id,rows.rows[1].customer_id);assert.equal(rows.rows[0].total_cents,90000);
  } finally {await client.query('ROLLBACK');client.release();}
});

test('cliente selecionado sem documento/telefone não duplica; ID ausente falha sem criar cadastro',async()=>{
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const owner=(await client.query("SELECT id FROM users WHERE email='admin@dev.mastergreen.local'")).rows[0].id;
    const customer=(await client.query("INSERT INTO customers(name,phone,city,created_by_id) VALUES('Cliente sem documento','','',$1) RETURNING id",[owner])).rows[0].id;
    const data=quickProposalSchema.parse({...input(),customerId:customer,customer:{name:'Contato atualizado',phone:'',document:''}});
    const before=(await client.query('SELECT count(*)::int AS count FROM customers')).rows[0].count;
    const saved=await saveQuickProposal(client,owner,data);
    assert.equal((await client.query('SELECT customer_id FROM mobile_quick_proposals WHERE id=$1',[saved.id])).rows[0].customer_id,customer);
    assert.equal((await client.query('SELECT count(*)::int AS count FROM customers')).rows[0].count,before);
    assert.equal((await saveQuickProposal(client,owner,data)).replayed,true);
    await assert.rejects(saveQuickProposal(client,owner,{...data,clientId:randomUUID(),customerId:randomUUID()}),/Cliente selecionado/);
  }finally{await client.query('ROLLBACK');client.release();}
});
