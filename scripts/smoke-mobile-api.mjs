import assert from 'node:assert/strict';

const origin = 'http://127.0.0.1:5001';
const unauthorized = await fetch(`${origin}/api/mobile/bootstrap`);
assert.equal(unauthorized.status, 401);

const login = await fetch(`${origin}/api/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: process.env.DEV_ADMIN_EMAIL, password: process.env.DEV_ADMIN_PASSWORD }),
});
assert.equal(login.status, 200, 'A conta de desenvolvimento deve entrar pelo mesmo endpoint usado pelo web.');
const loginBody = await login.json();
assert.equal('password' in loginBody.user, false);

const cookie = login.headers.get('set-cookie')?.split(';', 1)[0];
assert.ok(cookie?.startsWith('connect.sid='));
const response = await fetch(`${origin}/api/mobile/bootstrap`, { headers: { cookie } });
assert.equal(response.status, 200);
const bootstrap = await response.json();
assert.equal(bootstrap.user.type, 'admin');
assert.equal('password' in bootstrap.user, false);
assert.equal(Array.isArray(bootstrap.products), true);
assert.equal(Array.isArray(bootstrap.customers), true);
assert.equal(bootstrap.customers.length, 0, 'A base nova não deve conter clientes oficiais.');
assert.equal(bootstrap.settings.invoicePercent, 5);

console.log(JSON.stringify({ login: 'ok', bootstrap: 'ok', products: bootstrap.products.length, customers: bootstrap.customers.length, invoicePercent: bootstrap.settings.invoicePercent }));
