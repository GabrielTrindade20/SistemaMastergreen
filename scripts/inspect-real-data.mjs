import pg from 'pg';

const devUrl = new URL(process.env.DATABASE_URL ?? '');
if (devUrl.pathname !== '/mastergreen_develop') throw new Error('Esperado DATABASE_URL de mastergreen_develop.');
const officialUrl = new URL(devUrl);
officialUrl.pathname = '/sistema-mastergren-web';

const databases = [
  ['oficial', officialUrl],
  ['desenvolvimento', devUrl],
];
let officialColumns;
for (const [label, url] of databases) {
  const client = new pg.Client({ connectionString: url.toString(), statement_timeout: 15000 });
  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    const identity = await client.query('SELECT current_database() AS name');
    if (identity.rows[0].name !== url.pathname.slice(1)) throw new Error('Banco conectado inesperado.');
    const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name");
    const counts = {};
    for (const { table_name: table } of tables.rows) {
      if (!/^[a-z_]+$/.test(table)) continue;
      counts[table] = Number((await client.query(`SELECT count(*) AS total FROM "${table}"`)).rows[0].total);
    }
    const columns = await client.query(`SELECT table_name,column_name,data_type,is_nullable FROM information_schema.columns
      WHERE table_schema='public' AND table_name=ANY($1) ORDER BY table_name,ordinal_position`,
    [['users','customers','quotations','quotation_items','quotation_costs','products','costs','system_settings','saved_report_templates','mobile_quick_proposals']]);
    const keys = await client.query(`SELECT tc.table_name,kcu.column_name,ccu.table_name AS target_table,ccu.column_name AS target_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=tc.constraint_name AND kcu.table_schema=tc.table_schema
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name AND ccu.table_schema=tc.table_schema
      WHERE tc.table_schema='public' AND tc.constraint_type='FOREIGN KEY' ORDER BY tc.table_name,kcu.column_name`);
    const proposalStats = counts.quotations === undefined ? null : await client.query(`SELECT status,count(*)::int AS count,min(created_at)::date AS oldest,max(created_at)::date AS newest
      FROM quotations GROUP BY status ORDER BY count DESC`);
    const columnMap = Object.groupBy(columns.rows, row => row.table_name);
    if (label === 'oficial') officialColumns = columnMap;
    const differences = label === 'desenvolvimento' ? Object.fromEntries(Object.entries(columnMap).map(([table, list]) => [table, {
      onlyInOfficial: (officialColumns[table] ?? []).filter(row => !list.some(other => other.column_name === row.column_name)).map(row => row.column_name),
      typeMismatch: list.filter(row => (officialColumns[table] ?? []).some(other => other.column_name === row.column_name && other.data_type !== row.data_type)).map(row => row.column_name),
    }]).filter(([, value]) => value.onlyInOfficial.length || value.typeMismatch.length)) : undefined;
    console.log(JSON.stringify({ database:label, counts, proposalStats:proposalStats?.rows, differences, foreignKeys:keys.rows.map(row=>`${row.table_name}.${row.column_name}→${row.target_table}.${row.target_column}`) },null,2));
    await client.query('ROLLBACK');
  } catch (error) {
    console.error(`${label}: falha de inspeção (${error.code || error.name}).`);
    process.exitCode = 1;
  } finally { await client.end().catch(()=>{}); }
}
