import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { captureSurface, compareSurface } from './execution-surface.mjs';

function fixture(run) {
  const root = mkdtempSync(path.join(tmpdir(), 'surface-registry-'));
  mkdirSync(path.join(root, 'server'));
  writeFileSync(path.join(root, 'server/runtime.ts'), 'import { appendFile as append } from "node:fs/promises"; throw new Error("MUST_NOT_EXECUTE"); append("queue", "x");');
  try { return run(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

test('captures without executing modules; detects aliases through whole-file identity', () => fixture(root => {
  const first = captureSurface(root);
  assert.equal(first.files.length, 1);
  assert.deepEqual(first.files[0].imports, ['node:fs/promises']);
  assert.equal(compareSurface(first, captureSurface(root)).matches, true);
  writeFileSync(path.join(root, 'server/runtime.ts'), 'const hidden = globalThis["fetch"]; hidden("https://invalid.example");');
  assert.deepEqual(compareSurface(first, captureSurface(root)).changed, ['server/runtime.ts']);
}));

test('opaque new executable and removed file both invalidate the denominator', () => fixture(root => {
  const first = captureSurface(root);
  writeFileSync(path.join(root, 'server/writer.py'), 'print("not executed")');
  rmSync(path.join(root, 'server/runtime.ts'));
  const next = captureSurface(root);
  assert.equal(next.files[0].syntax, 'OPAQUE_REVIEW_REQUIRED');
  assert.deepEqual(compareSurface(first, next), { matches: false, added: ['server/writer.py'], removed: ['server/runtime.ts'], changed: [] });
}));

test('rejects symlinks rather than silently expanding or skipping scope', () => fixture(root => {
  symlinkSync('/tmp', path.join(root, 'server/external'));
  assert.throws(() => captureSurface(root), /SURFACE_SYMLINK_REQUIRES_REVIEW/);
}));

test('scope changes cannot reuse prior evidence', () => fixture(root => {
  const first = captureSurface(root);
  assert.throws(() => compareSurface({ ...first, scope: ['server'] }, captureSurface(root)), /SURFACE_DENOMINATOR_CHANGED/);
}));

test('CLI refuses new output inside source scope', () => fixture(root => {
  const cli = fileURLToPath(new URL('./execution-surface.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [cli, 'capture', path.join(root, 'server/new.json'), root], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Output overlaps inventoried source/);
}));
