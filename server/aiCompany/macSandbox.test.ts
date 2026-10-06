import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { afterEach, describe, expect, it } from 'vitest';
import { macSandboxProfile } from './macSandbox';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
function fixture(base = os.tmpdir()) {
  const root = fs.mkdtempSync(path.join(base, 'factory-sandbox-test-'));
  roots.push(root);
  const control = path.join(root, 'control');
  const workspace = path.join(control, '.ai-company', 'worktrees', 'assigned');
  fs.mkdirSync(workspace, { recursive: true });
  fs.mkdirSync(path.join(control, 'node_modules'));
  fs.writeFileSync(path.join(control, 'private-fixture'), 'PRIVATE_FIXTURE_ONLY');
  fs.writeFileSync(path.join(control, 'node_modules', 'dependency-fixture'), 'DEPENDENCY_FIXTURE_ONLY');
  fs.symlinkSync(control, path.join(workspace, 'escape'));
  return { root, control, workspace };
}
const macIt = process.platform === 'darwin' ? it : it.skip;

describe('macSandboxProfile', () => {
  it('rejects equal roots, workspace ancestors and nonexistent directories', () => {
    const f = fixture();
    expect(() => macSandboxProfile(f.control, f.control)).toThrow();
    expect(() => macSandboxProfile(f.control, f.root)).toThrow();
    expect(() => macSandboxProfile(f.control, path.join(f.root, 'missing'))).toThrow();
  });

  macIt('denies signalling a separate fixture process while permitting self and child signals', async () => {
    const f = fixture('/private/tmp');
    const other = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
    await once(other, 'spawn');
    try {
      const result = spawnSync('/usr/bin/sandbox-exec', ['-p', macSandboxProfile(f.control, f.workspace), process.execPath, '-e', `
        const attempt = pid => { try { process.kill(pid, 'SIGCONT'); return true; } catch { return false; } };
        const child = require('node:child_process').spawn(process.execPath, ['-e', 'setTimeout(() => {}, 150)'], {stdio:'pipe'});
        child.on('spawn', () => {
          const permitted = attempt(child.pid);
          const result = { self: attempt(process.pid), child: permitted, other: attempt(Number(process.argv[1])) };
          child.on('exit', () => console.log(JSON.stringify(result)));
          if (permitted) child.kill('SIGKILL');
        });
      `, String(other.pid)], { encoding: 'utf8', timeout: 10_000 });
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({ self: true, child: true, other: false });
    } finally {
      const exited = once(other, 'exit'); other.kill('SIGKILL'); await exited;
    }
  });

  macIt('runs actual Vitest with native config and assigned cache/temp under the OS profile', () => {
    const f = fixture('/private/tmp');
    fs.symlinkSync(path.join(process.cwd(), 'node_modules'), path.join(f.workspace, 'node_modules'));
    const temp = path.join(f.workspace, 'tmp'), cache = path.join(f.workspace, 'cache');
    fs.mkdirSync(temp); fs.mkdirSync(cache);
    fs.writeFileSync(path.join(f.workspace, 'fixture.test.mjs'), `import {it,expect} from 'vitest';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';it('actual assigned temporary write',()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vitest-fixture-'));try{fs.writeFileSync(path.join(dir,'effect'),'FIXTURE_ONLY');expect(fs.readFileSync(path.join(dir,'effect'),'utf8')).toBe('FIXTURE_ONLY');}finally{fs.rmSync(dir,{recursive:true,force:true});}});`);
    const config = path.join(f.workspace, 'fixture.config.mjs');
    fs.writeFileSync(config, `export default {cacheDir:${JSON.stringify(cache)},test:{include:['fixture.test.mjs'],fileParallelism:false}};`);
    const result = spawnSync('/usr/bin/sandbox-exec', ['-p', macSandboxProfile(f.control, f.workspace), process.execPath, path.join(process.cwd(), 'node_modules/vitest/vitest.mjs'), 'run', '--config', config, '--configLoader', 'native'], {
      cwd: f.workspace, env: { PATH: process.env.PATH, HOME: f.workspace, TMPDIR: temp, TMP: temp, TEMP: temp }, encoding: 'utf8', timeout: 5000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('1 passed');
  });

  for (const kind of ['canonical-temp', 'aliased-temp'] as const) {
    macIt(`enforces actual OS permissions for ${kind} nested workspace`, () => {
      const f = fixture(kind === 'canonical-temp' ? '/private/tmp' : '/tmp');
      const profile = macSandboxProfile(f.control, f.workspace);
      const result = spawnSync('/usr/bin/sandbox-exec', ['-p', profile, process.execPath, '-e', `
        const fs = require('node:fs');
        const [control, workspace] = process.argv.slice(1);
        const attempt = (fn) => { try { fn(); return true; } catch { return false; } };
        console.log(JSON.stringify({
          privateRead: attempt(() => fs.readFileSync(control + '/private-fixture')),
          privateStat: attempt(() => fs.statSync(control + '/private-fixture')),
          controlEnumeration: attempt(() => fs.readdirSync(control)),
          controlWrite: attempt(() => fs.writeFileSync(control + '/forbidden', 'fixture')),
          workspaceWrite: attempt(() => fs.writeFileSync(workspace + '/allowed', 'fixture')),
          escapeRead: attempt(() => fs.readFileSync(workspace + '/escape/private-fixture')),
          escapeWrite: attempt(() => fs.writeFileSync(workspace + '/escape/forbidden-alias', 'fixture')),
          dependencyRead: attempt(() => fs.readFileSync(control + '/node_modules/dependency-fixture')),
          dependencyWrite: attempt(() => fs.writeFileSync(control + '/node_modules/forbidden', 'fixture')),
          unrelatedTempWrite: attempt(() => fs.writeFileSync(control + '/../forbidden-temp', 'fixture')),
        }));
      `, f.control, f.workspace], { encoding: 'utf8', timeout: 10_000 });
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({
        privateRead: false, privateStat: false, controlEnumeration: false, controlWrite: false, workspaceWrite: true,
        escapeRead: false, escapeWrite: false, dependencyRead: true, dependencyWrite: false, unrelatedTempWrite: false,
      });
      expect(fs.existsSync(path.join(f.control, 'forbidden'))).toBe(false);
      expect(fs.existsSync(path.join(f.workspace, 'allowed'))).toBe(true);
    });
  }
});
