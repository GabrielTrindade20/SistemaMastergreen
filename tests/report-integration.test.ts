import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pool} from '../server/db';
import {loadReportRows} from '../server/reporting';
if(new URL(process.env.DATABASE_URL||'').pathname!=='/mastergreen_develop')throw new Error('Teste restrito à base develop.');
test('SQL: versão calculada única, situação final, data original e isolamento do funcionário',async()=>{
  const client=await pool.connect(),user=randomUUID(),customer=randomUUID(),original=randomUUID(),calculated=randomUUID();
  try{
    await client.query('BEGIN');
    await client.query("INSERT INTO users (id,name,email,password,type,branch) VALUES ($1,'Fixture relatório',$2,'test-only','employee','Teste')",[user,user+'@example.invalid']);
    await client.query("INSERT INTO customers (id,name,phone,city,created_by_id) VALUES ($1,'Fixture relatório','','Teste',$2)",[customer,user]);
    await client.query(`INSERT INTO quotations (id,customer_id,user_id,quotation_number,subtotal,total,valid_until,branch,created_at,status,total_costs,net_profit,admin_calculated,original_quotation_id)
      VALUES ($1::uuid,$3,$4,$1::text,100,100,now(),'Teste','2026-10-01 02:30:00','pending',0,0,0,null),
      ($2::uuid,$3,$4,$2::text,120,120,now(),'Teste','2026-11-01 12:00:00','approved',60,40,1,$1::text)`,[original,calculated,customer,user]);
    const admin=await loadReportRows({isAdmin:true,customerId:customer,fromDay:'2026-09-30',toDay:'2026-09-30'},client);
    assert.equal(admin.length,1);assert.equal(admin[0].quotationId,calculated);assert.equal(admin[0].quotationTotal,120);assert.equal(admin[0].businessDate,'2026-09-30');assert.equal(admin[0].quotationStatus,'approved');
    const employee=await loadReportRows({userId:user,customerId:customer},client);assert.equal(employee.length,1);assert.equal(employee[0].quotationTotal,100);assert.equal(employee[0].quotationStatus,'pending');
    await client.query("UPDATE quotations SET status='rejected' WHERE id=$1",[calculated]);
    assert.equal((await loadReportRows({isAdmin:true,customerId:customer},client))[0].quotationStatus,'rejected');
    assert.equal((await loadReportRows({userId:randomUUID(),customerId:customer},client)).length,0);
    assert.equal((await loadReportRows({},client)).length,0);
  }finally{await client.query('ROLLBACK');client.release();await pool.end();}
});
