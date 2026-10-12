import assert from 'node:assert/strict';
import { mkdtemp, copyFile, cp, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';

assert.equal(new URL(process.env.DATABASE_URL || '').pathname, '/mastergreen_develop', 'Only the development database is allowed.');
const root = path.resolve(import.meta.dirname, '..');
const stage = await mkdtemp(path.join(tmpdir(), 'mastergreen-runtime-'));
for (const file of ['package.json', 'package-lock.json']) await copyFile(path.join(root, file), path.join(stage, file));
await cp(path.join(root, 'dist'), path.join(stage, 'dist'), { recursive: true });
const install = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci', '--omit=dev', '--no-audit', '--no-fund'], {
  cwd: stage, shell: process.platform === 'win32', stdio: 'inherit',
});
assert.equal((await once(install, 'exit'))[0], 0, 'Production installation failed');
for (const dependency of ['vite', 'vercel', 'tailwindcss', 'tsx', '@vercel/node']) {
  await assert.rejects(access(path.join(stage, 'node_modules', dependency)), `${dependency} must not be shipped`);
}
const probe = createServer();
probe.listen(0, '127.0.0.1');
await once(probe, 'listening');
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const child = spawn(process.execPath, ['dist/index.js'], {
  cwd: stage, env: { ...process.env, NODE_ENV: 'production', PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
child.stdout.on('data', chunk => { output += chunk; });
child.stderr.on('data', chunk => { output += chunk; });
try {
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw new Error(`Runtime exited: ${output.replaceAll(process.env.DATABASE_URL, '[database]')}`);
    try { ready = (await fetch(`${base}/health`, { signal: AbortSignal.timeout(1000) })).ok; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, 'Runtime did not start');
  assert.equal((await fetch(`${base}/`)).status, 200);
  assert.equal((await fetch(`${base}/api/mobile/data`)).status, 401);
  assert.equal((await fetch(`${base}/api/quotations`)).status, 401);
  console.log('PASS: production-only install, no build tools, health/SPA and protected APIs.');
  console.log(`Generated runtime staging retained at: ${stage}`);
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    const stopped = once(child, 'exit');
    child.kill();
    await stopped;
  }
}
