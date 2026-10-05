import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const audit = fileURLToPath(new URL('./audit-ai-company-secrets.mjs', import.meta.url));
function fixture(run) {
  const cwd = mkdtempSync(resolve(tmpdir(), 'macro-private-guard-'));
  try { mkdirSync(resolve(cwd, '.ai-company')); run(cwd); }
  finally { rmSync(cwd, { recursive: true, force: true }); }
}
function probe(cwd) { return spawnSync(process.execPath, [audit], { cwd, encoding: 'utf8' }); }
test('clean source inventory passes with a bounded claim', () => fixture(cwd => {
  execFileSync('git', ['init', '-q'], { cwd });
  const result = probe(cwd);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /historical exposure is not certified/);
}));
test('tracked browser profile fails without reading or printing contents', () => fixture(cwd => {
  execFileSync('git', ['init', '-q'], { cwd });
  mkdirSync(resolve(cwd, '.chrome-tmp'));
  writeFileSync(resolve(cwd, '.chrome-tmp/Cookies'), 'PRIVATE_CONTENT_SENTINEL');
  execFileSync('git', ['add', '.chrome-tmp'], { cwd });
  const result = probe(cwd);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /private browser host state is tracked/);
  assert.doesNotMatch(result.stderr + result.stdout, /PRIVATE_CONTENT_SENTINEL/);
}));
test('missing Git inventory fails closed', () => fixture(cwd => {
  const result = probe(cwd);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /security census unavailable/);
}));
for (const file of ['ChromeProfile/Default/Preferences', 'profiles/firefox/logins.json', 'profiles/firefox/cookies.sqlite']) {
  test(`independent-review private path is rejected: ${file}`, () => fixture(cwd => {
    execFileSync('git', ['init', '-q'], { cwd });
    mkdirSync(resolve(cwd, file, '..'), { recursive: true });
    writeFileSync(resolve(cwd, file), 'PRIVATE_CONTENT_SENTINEL');
    execFileSync('git', ['add', file], { cwd });
    const result = probe(cwd);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /private browser host state is tracked/);
    assert.doesNotMatch(result.stderr + result.stdout, /PRIVATE_CONTENT_SENTINEL/);
  }));
}
test('tracked live lease identity is rejected without deleting its working file', () => fixture(cwd => {
  execFileSync('git', ['init', '-q'], { cwd });
  const file = '.ai-company/runtime/EXECUTION_LEASE.json';
  mkdirSync(resolve(cwd, file, '..'), { recursive: true });
  writeFileSync(resolve(cwd, file), '{"status":"ACTIVE"}');
  execFileSync('git', ['add', file], { cwd });
  const result = probe(cwd);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /live host identity is tracked/);
  execFileSync('git', ['rm', '--cached', file], { cwd });
  assert.equal(readFileSync(resolve(cwd, file), 'utf8'), '{"status":"ACTIVE"}');
  assert.equal(probe(cwd).status, 0);
}));
test('unreadable scope must not produce a clean audit', () => fixture(cwd => {
  execFileSync('git', ['init', '-q'], { cwd });
  symlinkSync(resolve(cwd, 'missing-source'), resolve(cwd, '.ai-company/state.jsonl'));
  const result = probe(cwd);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /security inspection unavailable/);
  assert.doesNotMatch(result.stdout, /no tracked/);
}));
