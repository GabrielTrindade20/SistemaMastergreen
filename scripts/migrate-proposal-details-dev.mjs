import pg from 'pg';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const url = new URL(process.env.DATABASE_URL ?? '');
if(url.pathname !== '/mastergreen_develop') throw Error('Permitido somente em mastergreen_develop.');
const client = new pg.Client({connectionString:url.toString()});
await client.connect();
try {
  await client.query('BEGIN');
  const before = await client.query("SELECT id,to_jsonb(p)-'web_details' AS data FROM mobile_quick_proposals p ORDER BY id");
  await client.query(await readFile(new URL('../migrations/0004_mobile_proposal_details.sql',import.meta.url),'utf8'));
  assert.deepEqual((await client.query("SELECT id,to_jsonb(p)-'web_details' AS data FROM mobile_quick_proposals p ORDER BY id")).rows,before.rows);
  await client.query('COMMIT');
  console.log('Detalhamento web habilitado; propostas existentes preservadas. Somente develop.');
} catch(error) { await client.query('ROLLBACK'); throw error; }
finally { await client.end(); }
