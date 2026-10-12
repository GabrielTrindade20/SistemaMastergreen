import pg from 'pg';
import { readFile } from 'node:fs/promises';

const url = new URL(process.env.DATABASE_URL ?? '');
if (url.pathname !== '/mastergreen_develop') throw new Error('Esta ferramenta só migra mastergreen_develop.');
const client = new pg.Client({ connectionString: url.toString() });
await client.connect();
try {
  await client.query('BEGIN');
  await client.query("SET LOCAL lock_timeout = '5s'");
  await client.query(await readFile(new URL('../migrations/0002_mobile_quick_proposals.sql', import.meta.url), 'utf8'));
  await client.query(await readFile(new URL('../migrations/0003_mobile_proposal_numbers.sql', import.meta.url), 'utf8'));
  await client.query(await readFile(new URL('../migrations/0004_mobile_proposal_details.sql', import.meta.url), 'utf8'));
  await client.query('COMMIT');
  console.log('Migração mobile aplicada somente em mastergreen_develop.');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally { await client.end(); }
