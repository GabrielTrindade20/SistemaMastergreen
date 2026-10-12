import { randomBytes, scryptSync } from 'node:crypto';
import pg from 'pg';

// Executar com: node --env-file=.env scripts/import-real-sample.mjs [--apply]
// A origem é SEMPRE uma transação de leitura. A aplicação só ocorre em mastergreen_develop.
const devUrl = new URL(process.env.DATABASE_URL ?? '');
if (devUrl.pathname !== '/mastergreen_develop') throw new Error('DATABASE_URL deve apontar para mastergreen_develop.');
const officialUrl = new URL(devUrl);
officialUrl.pathname = '/sistema-mastergren-web';
if (officialUrl.host !== devUrl.host || officialUrl.username !== devUrl.username) throw new Error('Origem e destino inesperados.');
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, value => value);

const source = new pg.Client({ connectionString: officialUrl.toString(), statement_timeout: 30000 });
const target = new pg.Client({ connectionString: devUrl.toString(), statement_timeout: 60000 });
const quote = name => `"${name}"`;
const readRows = async (table, ids) => {
  if (ids && !ids.length) return [];
  return (await source.query(`SELECT * FROM ${quote(table)}${ids ? ' WHERE quotation_id=ANY($1::uuid[])' : ''}`, ids ? [ids] : [])).rows;
};
const disabledPassword = () => {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${scryptSync(randomBytes(32), salt, 64).toString('hex')}`;
};
const chunk = (rows, size) => Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size));
const insert = async (table, rows) => {
  if (!rows.length) return 0;
  const { rows: columns } = await target.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`, [table]);
  const targetColumns = new Set(columns.map(row => row.column_name));
  const names = Object.keys(rows[0]).filter(name => targetColumns.has(name));
  if (!names.includes('id')) throw new Error(`Tabela inesperada: ${table}`);
  let inserted = 0;
  for (const batch of chunk(rows, Math.max(20, Math.floor(4000 / names.length)))) {
    const values = batch.flatMap(row => names.map(name => row[name]));
    const tuples = batch.map((_, index) => `(${names.map((__, column) => `$${index * names.length + column + 1}`).join(',')})`).join(',');
    const result = await target.query(`INSERT INTO ${quote(table)} (${names.map(quote).join(',')}) VALUES ${tuples} ON CONFLICT (id) DO NOTHING RETURNING id`, values);
    inserted += result.rowCount;
  }
  return inserted;
};

try {
  await source.connect();
  await source.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const identity = await source.query('SELECT current_database() AS name, current_setting(\'transaction_read_only\') AS readonly');
  if (identity.rows[0].name !== 'sistema-mastergren-web' || identity.rows[0].readonly !== 'on') throw new Error('Origem inválida ou gravável.');
  // Todas as aprovadas e pendentes de períodos diferentes para mostrar gráficos e histórico.
  const approved = (await source.query("SELECT id FROM quotations WHERE status='approved' ORDER BY created_at DESC")).rows.map(row => row.id);
  const pendingNewest = (await source.query("SELECT id FROM quotations WHERE status='pending' ORDER BY created_at DESC LIMIT 60")).rows.map(row => row.id);
  const pendingOldest = (await source.query("SELECT id FROM quotations WHERE status='pending' ORDER BY created_at ASC LIMIT 15")).rows.map(row => row.id);
  const ids = [...new Set([...approved, ...pendingNewest, ...pendingOldest])];
  const owner = await source.query(`SELECT u.id,count(q.id)::int AS total FROM users u
    JOIN quotations q ON q.user_id=u.id WHERE u.type='admin'
    GROUP BY u.id ORDER BY total DESC LIMIT 1`);
  if (!owner.rows[0] || owner.rows[0].total < 300) throw new Error('Não foi possível identificar o proprietário do histórico.');
  const sourceOwnerId = owner.rows[0].id;
  const selected = {
    users: (await source.query('SELECT id,name,type,branch,commission_percent,created_at FROM users')).rows.map(row => ({
      ...row, email:`espelho-${row.id}@example.invalid`, password:disabledPassword(),
    })),
    products: await readRows('products'),
    costs: await readRows('costs'),
    customers: await readRows('customers'),
    quotations: ids.length ? (await source.query('SELECT * FROM quotations WHERE id=ANY($1::uuid[])', [ids])).rows.map(row => ({
      ...row, admin_calculated:row.admin_calculated ? 1 : 0,
    })) : [],
    quotation_items: await readRows('quotation_items', ids),
    quotation_costs: await readRows('quotation_costs', ids),
  };
  await source.query('ROLLBACK');
  await source.end();

  const planned = Object.fromEntries(Object.entries(selected).map(([table, rows]) => [table, rows.length]));
  console.log(JSON.stringify({ sample: planned, approved: approved.length, source: 'somente leitura', destination: 'mastergreen_develop', accounts: 'sem e-mails e senhas oficiais' }));
  if (!process.argv.includes('--apply')) {
    console.log('Prévia concluída. Use --apply para copiar em uma transação.');
    process.exit(0);
  }

  await target.connect();
  await target.query('BEGIN');
  await target.query("SET LOCAL lock_timeout='5s'");
  const destination = await target.query('SELECT current_database() AS name');
  if (destination.rows[0].name !== 'mastergreen_develop') throw new Error('Destino inesperado.');
  const localOwner = await target.query("SELECT id FROM users WHERE email='admin@dev.mastergreen.local' AND type='admin'");
  if (localOwner.rowCount !== 1) throw new Error('Conta administrativa local não encontrada.');
  const localOwnerId = localOwner.rows[0].id;
  const inserted = {};
  for (const [table, rows] of Object.entries(selected)) inserted[table] = await insert(table, rows);
  const importedIds = selected.quotations.map(row => row.id);
  // Os relatórios mantêm os usuários originais em contas desativadas. O histórico
  // do proprietário é associado ao admin local para abrir /orcamentos no teste.
  await target.query(`UPDATE customers SET created_by_id=$1 WHERE id=ANY($2::uuid[]) AND created_by_id=$3`,
    [localOwnerId, selected.customers.map(row => row.id), sourceOwnerId]);
  await target.query(`UPDATE quotations SET
    user_id=CASE WHEN user_id=$3 THEN $1 ELSE user_id END,
    responsible_id=CASE WHEN responsible_id=$3 THEN $1 ELSE responsible_id END
    WHERE id=ANY($2::uuid[]) AND (user_id=$3 OR responsible_id=$3)`,
  [localOwnerId, importedIds, sourceOwnerId]);
  const count = await target.query('SELECT count(*)::int AS count,coalesce(sum(total),0)::numeric AS total FROM quotations WHERE id=ANY($1::uuid[])', [importedIds]);
  const children = await target.query(`SELECT
    (SELECT count(*)::int FROM quotation_items WHERE quotation_id=ANY($1::uuid[])) AS items,
    (SELECT count(*)::int FROM quotation_costs WHERE quotation_id=ANY($1::uuid[])) AS costs`, [importedIds]);
  const expectedTotal = selected.quotations.reduce((sum, row) => sum + Math.round(Number(row.total) * 100), 0);
  const actualTotal = Math.round(Number(count.rows[0].total) * 100);
  if (count.rows[0].count !== importedIds.length || children.rows[0].items !== selected.quotation_items.length || children.rows[0].costs !== selected.quotation_costs.length || expectedTotal !== actualTotal) {
    throw new Error('Verificação de contagens ou valores falhou; importação cancelada.');
  }
  await target.query('COMMIT');
  console.log(JSON.stringify({ inserted, verified: { quotations: count.rows[0].count, items: children.rows[0].items, costs: children.rows[0].costs, totalCents: actualTotal }, preservedLocalData: true }));
} catch (error) {
  await target.query('ROLLBACK').catch(()=>{});
  await source.query('ROLLBACK').catch(()=>{});
  console.error(`Importação interrompida e transação cancelada (${error.code || error.name}).`);
  process.exitCode = 1;
} finally {
  await source.end().catch(()=>{});
  await target.end().catch(()=>{});
}
