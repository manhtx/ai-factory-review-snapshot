import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';

// Imported application must never read/write the real company's state.
const originalCwd = process.cwd();
const root = fileURLToPath(new URL('../../../', import.meta.url));
const temporary = await mkdtemp(resolve(tmpdir(), 'macro-security-'));
process.env.NODE_ENV = 'test';
process.env.MACRO_DB_PATH = ':memory:';
process.env.AI_COMPANY_STATE_DIR = resolve(temporary, 'runtime');
process.env.MACRO_ADMIN_KEY = 'isolated-boundary-test';
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SECRET_KEY;
delete process.env.VERCEL;
process.chdir(temporary);
try {
  const { app } = await import(new URL('../../../server/index.ts', import.meta.url));
  const { adminTokenBucketLimiter } = await import(new URL('../../../server/rateLimit.ts', import.meta.url));
  const routes = app.router.stack.filter(layer => layer.route?.path?.startsWith('/api/admin'))
    .flatMap(layer => Object.keys(layer.route.methods).map(method => ({ method, path: layer.route.path })));
  assert(routes.length > 20, 'admin enumeration unexpectedly empty');
  const failures = [];
  for (const { method, path } of routes) {
    const url = path.replace(/:[A-Za-z0-9_]+/g, 'security-nonexistent');
    for (const token of [undefined, 'wrong-token']) {
      adminTokenBucketLimiter.reset();
      const call = request(app)[method](url);
      if (token) call.set('Authorization', `Bearer ${token}`);
      const result = await call.send({});
      if (result.status !== 401) failures.push({ method, path, token: token ? 'wrong' : 'missing', actual: result.status });
    }
  }
  adminTokenBucketLimiter.reset();
  const control = await request(app).post('/api/admin/company/escalations')
    .set('Authorization', 'Bearer isolated-boundary-test').send({ status: 'INVALID' });
  assert.equal(control.status, 400, 'valid token should reach input validation without effects');
  delete process.env.MACRO_ADMIN_KEY;
  adminTokenBucketLimiter.reset();
  const disabled = await request(app).post('/api/admin/company/escalations').send({ status: 'INVALID' });
  if (disabled.status !== 503) failures.push({ control: 'disabled', actual: disabled.status });
  const source = await readFile(resolve(root, 'server/index.ts'), 'utf8');
  if (!source.includes('app.listen(port, "127.0.0.1",')) failures.push({ control: 'explicit-loopback', actual: 'absent' });
  console.log(JSON.stringify({ schema: 'security-boundary.probe.v1', adminRoutes: routes.length,
    unauthorizedRequests: routes.length * 2, authorizedInvalidControl: control.status,
    disabledControl: disabled.status, isolatedState: true, failures }, null, 2));
  assert.equal(failures.length, 0, 'security boundary counterexamples reproduced');
} finally {
  process.chdir(originalCwd);
  await rm(temporary, { recursive: true, force: true });
}
