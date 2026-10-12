import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLoginLimiter} from '../server/login-limiter';
test('login limiter isolates addresses, resets on success and expires',()=>{
  const limiter=createLoginLimiter(2,1000);
  assert.ok(limiter.take('a',0));assert.ok(limiter.take('a',1));assert.equal(limiter.take('a',2),false);
  assert.ok(limiter.take('b',2));limiter.clear('a');assert.ok(limiter.take('a',3));
  assert.ok(limiter.take('a',1004));assert.ok(limiter.take('a',1005));assert.equal(limiter.take('a',1006),false);
});
