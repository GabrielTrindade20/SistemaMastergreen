import pg from 'pg';

const { Client } = pg;
const sourceUrl = new URL(process.env.DATABASE_URL ?? '');
const sourceDatabase = decodeURIComponent(sourceUrl.pathname.slice(1));
const developmentDatabase = 'mastergreen_develop';

if (sourceDatabase !== 'sistema-mastergren-web') {
  throw new Error('Esta ferramenta só aceita a conexão oficial como origem para criar a base de desenvolvimento.');
}

const source = new Client({ connectionString: sourceUrl.toString() });
await source.connect();
try {
  const { rows: [role] } = await source.query('select rolsuper, rolcreatedb from pg_roles where rolname = current_user');
  const { rows: [database] } = await source.query('select exists(select 1 from pg_database where datname = $1) as exists', [developmentDatabase]);
  console.log(JSON.stringify({ canCreateDatabase: role.rolsuper || role.rolcreatedb, developmentDatabaseExists: database.exists }));

  if (process.argv.includes('--create')) {
    if (!role.rolsuper && !role.rolcreatedb) throw new Error('Este usuário PostgreSQL não tem permissão para criar uma base.');
    if (database.exists) {
      console.log('A base de desenvolvimento já existe; nenhuma criação foi feita.');
    } else {
      await source.query(`CREATE DATABASE ${developmentDatabase}`);
      console.log('Base de desenvolvimento vazia criada. Nenhum dado do banco oficial foi copiado.');
    }
  }
} finally {
  await source.end();
}
