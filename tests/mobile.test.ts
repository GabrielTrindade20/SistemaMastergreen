import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {quickProposalSchema} from '../shared/mobile-contract';
import {pool} from '../server/db';
import {saveQuickProposal} from '../server/mobile';

if(new URL(process.env.DATABASE_URL!).pathname!=='/mastergreen_develop')throw new Error('Teste permitido somente em mastergreen_develop.');
after(()=>pool.end());
const input=()=>quickProposalSchema.parse({clientId:randomUUID(),customer:{name:'Teste transacional',phone:'11999990000',document:'00000000000'},proposalDate:'2026-10-12',freight:'Incluso',warranty:'12 meses',payment:'50% de entrada',discountPercent:10,totalCents:90000});
test('contrato rejeita itens, custos, datas inválidas e valores negativos',()=>{
  const valid=input();assert.equal(quickProposalSchema.safeParse(valid).success,true);
  for(const extra of [{items:[]},{cost:500},{totalCents:-1},{totalCents:0},{totalCents:1.5},{proposalDate:'2026-02-30'},{discountPercent:101}])assert.equal(quickProposalSchema.safeParse({...valid,...extra}).success,false);
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
    const conflict=await saveQuickProposal(client,owner,{...data,totalCents:85000});assert.equal(conflict.conflict,true);
    const other=await saveQuickProposal(client,owner,{...data,clientId:randomUUID()});
    const rows=await client.query('SELECT customer_id,total_cents FROM mobile_quick_proposals WHERE id=ANY($1::uuid[])',[[first.id,other.id]]);
    assert.equal(rows.rowCount,2);assert.equal(rows.rows[0].customer_id,rows.rows[1].customer_id);assert.equal(rows.rows[0].total_cents,90000);
  } finally {await client.query('ROLLBACK');client.release();}
});
