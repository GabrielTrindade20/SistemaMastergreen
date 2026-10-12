import pg from 'pg';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const url=new URL(process.env.DATABASE_URL??'');
if(url.pathname!=='/mastergreen_develop')throw Error('Permitido somente em mastergreen_develop.');
const client=new pg.Client({connectionString:url.toString()});
await client.connect();
try{
  await client.query('BEGIN');
  const before=await client.query('SELECT id,to_jsonb(p)-\'quotation_number\' AS data FROM mobile_quick_proposals p ORDER BY id');
  const webBefore=await client.query('SELECT id,quotation_number FROM quotations ORDER BY id');
  const previousNumbers=await client.query("SELECT id,to_jsonb(p)->>'quotation_number' AS number FROM mobile_quick_proposals p ORDER BY id");
  await client.query(await readFile(new URL('../migrations/0003_mobile_proposal_numbers.sql',import.meta.url),'utf8'));
  const after=await client.query('SELECT id,to_jsonb(p)-\'quotation_number\' AS data FROM mobile_quick_proposals p ORDER BY id');
  assert.deepEqual(after.rows,before.rows);
  const nextNumbers=await client.query('SELECT id,quotation_number AS number FROM mobile_quick_proposals ORDER BY id');
  for(const previous of previousNumbers.rows){
    if(previous.number)assert.equal(nextNumbers.rows.find(row=>row.id===previous.id).number,previous.number);
  }
  assert.deepEqual((await client.query('SELECT id,quotation_number FROM quotations ORDER BY id')).rows,webBefore.rows);
  const numbers=await client.query('SELECT quotation_number FROM mobile_quick_proposals');
  assert.ok(numbers.rows.every(row=>/^#\d{8}$/.test(row.quotation_number)));
  await client.query('COMMIT');
  console.log(`Numeração aplicada a ${numbers.rowCount} propostas do app; dados originais e números web preservados.`);
}catch(error){await client.query('ROLLBACK');throw error;}
finally{await client.end();}
