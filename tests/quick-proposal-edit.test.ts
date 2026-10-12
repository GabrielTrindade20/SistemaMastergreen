import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { quickProposalSchema } from '../shared/mobile-contract';
import { quickProposalEditSchema } from '../shared/quick-proposal-edit';
import { getQuickProposal, editQuickProposal } from '../server/quick-proposal-edit';
import { saveQuickProposal } from '../server/mobile';
import { pool } from '../server/db';

if(new URL(process.env.DATABASE_URL!).pathname !== '/mastergreen_develop') throw new Error('Somente mastergreen_develop.');
after(() => pool.end());
const original = () => quickProposalSchema.parse({clientId:randomUUID(),customer:{name:'Teste edição revertido',contact:'Contato',phone:'11999998888',address:'Endereço de teste',document:'00000000000'},proposalDate:'2026-10-12',freight:'Incluso',warranty:'12 meses',payment:'À vista',discountPercent:10,totalCents:90001});

test('contrato de edição protege identidade e rejeita valores/datas inválidos', () => {
  const {clientId: _id,...data} = original();
  const valid = {...data,revision:'a'.repeat(64)};
  assert.ok(quickProposalEditSchema.safeParse(valid).success);
  for(const extra of [{revision:''},{totalCents:0},{totalCents:1.5},{totalCents:-1},{totalCents:1_000_000_001},{discountPercent:101},{proposalDate:'2026-02-30'},{quotationNumber:'#12345678'},{userId:randomUUID()},{clientId:randomUUID()},{items:[]},{customer:{...data.customer,name:''}}]) {
    assert.equal(quickProposalEditSchema.safeParse({...valid,...extra}).success,false);
  }
});

test('editar/reabrir/reeditar conserva número, centavos, cadastros e retry do celular', async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const owner = (await client.query("SELECT id FROM users WHERE email='admin@dev.mastergreen.local'")).rows[0].id;
    const data = original();
    const saved = await saveQuickProposal(client,owner,data);
    const counts = (await client.query('SELECT (SELECT count(*) FROM quotations) AS web,(SELECT count(*) FROM mobile_quick_proposals) AS mobile')).rows[0];
    const immutable = async () => (await client.query('SELECT client_id,user_id,customer_id,payload_hash,quotation_number,created_at FROM mobile_quick_proposals WHERE id=$1',[saved.id])).rows[0];
    const before = await immutable();
    const customerBefore = (await client.query('SELECT * FROM customers WHERE id=$1',[before.customer_id])).rows[0];
    const first = (await getQuickProposal(client,saved.id))!;
    const {clientId:_clientId,...fields} = data;
    assert.equal((await editQuickProposal(client,saved.id,{...fields,revision:first.revision})).kind,'updated');
    assert.equal((await getQuickProposal(client,saved.id))!.totalCents,90001);
    const current = (await getQuickProposal(client,saved.id))!;
    const editedFields = {...fields,customer:{name:'Nome editado',contact:'Novo contato',phone:'11912345678',address:'Novo endereço',document:'11111111111'},proposalDate:'2026-09-30',payment:'3 parcelas',freight:'A combinar',warranty:'24 meses',discountPercent:5,totalCents:95013};
    const result = await editQuickProposal(client,saved.id,{...editedFields,revision:current.revision});
    assert.equal(result.kind,'updated');
    assert.equal((await editQuickProposal(client,saved.id,{...fields,revision:current.revision})).kind,'conflict');
    const reopened = (await getQuickProposal(client,saved.id))!;
    assert.deepEqual(reopened.customer,editedFields.customer);
    assert.equal(reopened.date,editedFields.proposalDate);
    for(const field of ['payment','freight','warranty','discountPercent','totalCents'] as const) assert.equal(reopened[field],editedFields[field]);
    assert.equal(reopened.quotationNumber,saved.quotationNumber);
    assert.deepEqual(await immutable(),before);
    assert.deepEqual((await client.query('SELECT * FROM customers WHERE id=$1',[before.customer_id])).rows[0],customerBefore);
    const retry = await saveQuickProposal(client,owner,data);
    assert.equal(retry.replayed,true);assert.equal(retry.conflict,false);assert.equal(retry.id,saved.id);
    assert.deepEqual(await getQuickProposal(client,saved.id),reopened);
    assert.equal((await saveQuickProposal(client,owner,{...data,totalCents:100})).conflict,true);
    assert.equal((await editQuickProposal(client,saved.id,{...editedFields,payment:'50% de entrada',revision:reopened.revision})).kind,'updated');
    assert.equal((await getQuickProposal(client,saved.id))!.payment,'50% de entrada');
    assert.deepEqual((await client.query('SELECT (SELECT count(*) FROM quotations) AS web,(SELECT count(*) FROM mobile_quick_proposals) AS mobile')).rows[0],counts);
    assert.equal(await getQuickProposal(client,randomUUID()),null);
    assert.equal((await editQuickProposal(client,randomUUID(),{...fields,revision:first.revision})).kind,'missing');
  } finally { await client.query('ROLLBACK'); client.release(); }
});
