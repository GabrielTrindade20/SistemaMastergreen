import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { hashPassword, isLegacyPassword, verifyPassword } from './passwords';

test('uma nova senha é salva com salt e nunca em texto puro', async () => {
  const a = await hashPassword('senha-longa-de-teste');
  const b = await hashPassword('senha-longa-de-teste');
  assert.notEqual(a, b);
  assert.equal(a.includes('senha-longa-de-teste'), false);
  assert.equal(isLegacyPassword(a), false);
  assert.equal(await verifyPassword('senha-longa-de-teste', a), true);
  assert.equal(await verifyPassword('outra-senha', a), false);
});

test('senha legada pode ser validada para migração progressiva', async () => {
  assert.equal(isLegacyPassword('senha-antiga'), true);
  assert.equal(await verifyPassword('senha-antiga', 'senha-antiga'), true);
  assert.equal(await verifyPassword('errada', 'senha-antiga'), false);
  assert.equal(await verifyPassword('x', 'scrypt$malformado'), false);
});
