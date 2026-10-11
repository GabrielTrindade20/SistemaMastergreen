import { randomBytes } from 'node:crypto';
import { storage } from '../server/storage';
import { pool } from '../server/db';

if (new URL(process.env.DATABASE_URL ?? '').pathname !== '/mastergreen_develop') {
  throw new Error('Este bootstrap só pode usar a base mastergreen_develop.');
}

try {
  if ((await storage.getUsers()).length) {
    console.log('A base de desenvolvimento já tem usuários; nenhuma conta foi criada.');
  } else {
    const password = randomBytes(18).toString('base64url');
    const email = 'admin@dev.mastergreen.local';
    await storage.createUser({ name: 'Administrador de Desenvolvimento', email, password, type: 'admin', branch: 'Matriz' });
    console.log(`Conta de desenvolvimento criada. E-mail: ${email} | Senha temporária: ${password}`);
    console.log('Guarde a senha fora do repositório. Ela não será exibida novamente.');
  }
} finally {
  await pool.end();
}
