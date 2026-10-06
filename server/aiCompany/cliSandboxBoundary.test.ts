import { afterEach, beforeEach, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { access, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { RoleWorkQueue } from './roleWorkQueue';
import { RoleHandoffLedger } from './roleHandoffLedger';

class FixtureScope {
  readonly roots: string[] = [];
  private closing = false;
  private jobs = new Set<Promise<unknown>>();
  private children = new Map<ChildProcess, Promise<void>>();
  assertOpen() { if (this.closing) throw new Error('Fixture scope is closed'); }
  track<T>(operation: () => Promise<T>): Promise<T> {
    this.assertOpen();
    const job = operation().then(value => { this.assertOpen(); return value; });
    this.jobs.add(job);
    void job.then(() => this.jobs.delete(job), () => this.jobs.delete(job));
    return job;
  }
  register(child: ChildProcess): Promise<void> {
    this.assertOpen();
    const closed = new Promise<void>(resolve => child.once('close', () => resolve()));
    this.children.set(child, closed);
    return closed;
  }
  async close() {
    this.closing = true;
    for (const child of this.children.keys()) if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    await Promise.all([...this.children.values()]);
    while (this.jobs.size) await Promise.allSettled([...this.jobs]);
    for (const root of this.roots.splice(0)) await rm(root, {recursive:true,force:true});
  }
}
let scope: FixtureScope;
beforeEach(() => { scope = new FixtureScope(); });
afterEach(() => scope.close());
const macIt = process.platform === 'darwin' ? it : it.skip;
function fixture(runner: 'agy' | 'codex' = 'agy') {
  const owner = scope;
  return owner.track(() => initializeFixture(owner, runner));
}
async function initializeFixture(owner: FixtureScope, runner: 'agy' | 'codex') {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cli-sandbox-')); owner.roots.push(root);
  const control = path.join(root, 'control'), workspace = path.join(root, 'worker');
  const runtime = path.join(control, '.ai-company/runtime/projects/isolated');
  const queue = new RoleWorkQueue(runtime);
  const work = await queue.create({ project_id: 'isolated', backlog_id: 'TEMP-SANDBOX', title: 'OS sandbox fixture; product outcome UNKNOWN', role: 'ux-research', run_id: 'temporary', namespace: 'temporary' });
  await new RoleHandoffLedger(runtime).record({ project_id: 'isolated', work_id: work.work_id, from_role: 'ceo', to_role: work.role, actor: 'fixture', objective: work.title, context: ['temporary filesystem boundary'], evidence_ids: ['fixture'], acceptance_criteria: ['OS boundary only'] });
  const bin = path.join(workspace, 'bin'); await mkdir(bin, { recursive: true });
  await writeFile(path.join(control, 'private-fixture'), 'PRIVATE_FIXTURE_ONLY');
  await writeFile(path.join(bin, runner), `#!${process.execPath}
const fs = require('node:fs');
const attempt = (fn) => { try { fn(); return true; } catch { return false; } };
fs.writeFileSync('boundary-result.json', JSON.stringify({
  privateRead: attempt(() => fs.readFileSync(${JSON.stringify(path.join(control, 'private-fixture'))})),
  controlWrite: attempt(() => fs.writeFileSync(${JSON.stringify(path.join(control, 'forbidden'))}, 'fixture')),
  workspaceWrite: attempt(() => fs.writeFileSync('allowed', 'fixture')),
  privilegedEnvironmentPresent: ['MACRO_ADMIN_KEY','CRON_SECRET','SUPABASE_SECRET_KEY','SSH_AUTH_SOCK','ARBITRARY_CONTROLLER_SECRET'].some(key => Object.hasOwn(process.env, key)),
  loaderEnvironmentPresent: ['NODE_PATH','NODE_OPTIONS','DYLD_INSERT_LIBRARIES','LD_PRELOAD'].some(key => Object.hasOwn(process.env,key)),
  configAssigned: attempt(() => { const config = JSON.parse(process.argv.at(-1).match(/--config=("[^"]+") --configLoader=native/)[1]); if (!config.startsWith(process.cwd() + require('node:path').sep)) throw Error('outside workspace'); fs.readFileSync(config); }),
  cacheAndTempAssigned: [process.env.AI_COMPANY_VITEST_CACHE_DIR, require('node:os').tmpdir()].every(value => value.startsWith(process.cwd() + require('node:path').sep)),
  namedPolicyPresent: process.argv.includes('default_permissions="factory-worker"'),
  legacySandboxPresent: process.argv.includes('--sandbox'),
  cacheWrite: attempt(() => { fs.mkdirSync(process.env.AI_COMPANY_VITEST_CACHE_DIR, {recursive:true}); fs.writeFileSync(process.env.AI_COMPANY_VITEST_CACHE_DIR + '/fixture', 'fixture'); }),
  tempWrite: attempt(() => { const temporary = fs.mkdtempSync(require('node:path').join(require('node:os').tmpdir(), 'cli-sandbox-temp-')); try { fs.writeFileSync(temporary + '/fixture', 'fixture'); } finally { fs.rmSync(temporary, {recursive:true,force:true}); } }),
}));
const evidence = process.argv.at(-1).match(/RECEIPT EVIDENCE ID: ([A-Za-z0-9_:-]+)/)[1];
const response = 'ROLE_RESEARCH_RESULT_JSON ' + JSON.stringify({ research_question:'OS fixture', source_reference:evidence, finding:'Fixture only; product outcome UNKNOWN', confidence:0.5 }) + '\\nROLE_WORK_COMPLETE';
const finalIndex = process.argv.indexOf('--output-last-message');
if (finalIndex >= 0) { const destination = process.argv[finalIndex + 1]; fs.mkdirSync(require('node:path').dirname(destination), {recursive:true}); fs.writeFileSync(destination, response); }
if (${JSON.stringify(runner)} === 'agy') console.log(JSON.stringify({event:'result',result:{response,usage:{input_tokens:1,output_tokens:1}}}));
else { console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:response}})); console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:1,output_tokens:1}})); }
`, { mode: 0o700 });
  const dispatch = (assigned: string, mode = 'workspace-write') => owner.track(async () => {
    const child = spawn(process.execPath, ['--import', createRequire(import.meta.url).resolve('tsx'), path.join(process.cwd(), 'scripts/ai-company-role-dispatch.mjs'), '--role', work.role, '--work-id', work.work_id, '--project-id', 'isolated', '--runner', runner, '--model', 'no-real-provider', '--control-root', control, '--workspace', assigned, '--sandbox', mode], {
      cwd: process.cwd(), env: { ...process.env, PATH: bin, AI_COMPANY_MAC_SANDBOX: 'true', AI_COMPANY_REQUIRE_WORKTREE: 'false', MACRO_ADMIN_KEY:'DUMMY_FIXTURE_ONLY', CRON_SECRET:'DUMMY_FIXTURE_ONLY', SUPABASE_SECRET_KEY:'DUMMY_FIXTURE_ONLY', SSH_AUTH_SOCK:path.join(root, 'nonexistent-fixture-socket'), ARBITRARY_CONTROLLER_SECRET:'DUMMY_FIXTURE_ONLY', NODE_PATH:root, NODE_OPTIONS:'--no-warnings' }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    const closed = owner.register(child);
    child.stdout.resume(); let stderr = ''; child.stderr.on('data', bytes => stderr += bytes);
    const deadline = setTimeout(() => child.kill('SIGKILL'), 6000);
    try {
      const code = await new Promise<number | null>((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
      return { code, stderr };
    } finally { await closed; clearTimeout(deadline); }
  });
  return { control, workspace, queue, dispatch };
}

it('cleanup drains an actual delayed fixture write before deleting its root', async () => {
  const owner = new FixtureScope();
  const root = await mkdtemp(path.join(os.tmpdir(), 'fixture-drain-')); owner.roots.push(root);
  let resume!: () => void;
  const barrier = new Promise<void>(resolve => { resume = resolve; });
  const initialization = owner.track(async () => { await barrier; await writeFile(path.join(root,'late-effect'),'FIXTURE_ONLY'); return root; });
  const rejected = expect(initialization).rejects.toThrow('scope is closed');
  const cleanup = owner.close();
  await expect(access(root)).resolves.toBeUndefined();
  resume(); await rejected; await cleanup;
  await expect(access(root)).rejects.toMatchObject({code:'ENOENT'});
  expect(() => owner.track(async () => root)).toThrow('scope is closed');
});

it('cleanup waits for actual child close before removing its filesystem', async () => {
  const owner = new FixtureScope();
  const root = await mkdtemp(path.join(os.tmpdir(), 'fixture-child-close-')); owner.roots.push(root);
  const ready = path.join(root,'ready'), terminating = path.join(root,'terminating');
  const child = spawn(process.execPath,['-e',`const fs=require('node:fs');process.on('SIGTERM',()=>{fs.writeFileSync(${JSON.stringify(terminating)},'FIXTURE_ONLY');setTimeout(()=>process.exit(0),150);});fs.writeFileSync(${JSON.stringify(ready)},'FIXTURE_ONLY');setInterval(()=>{},1000);`],{stdio:'ignore'});
  const closed = owner.register(child);
  const deadline = setTimeout(() => child.kill('SIGKILL'), 2000);
  try {
    for (let i=0;i<100;i++) { try { await access(ready); break; } catch { await new Promise(resolve=>setTimeout(resolve,10)); } }
    await access(ready);
    const cleanup = owner.close();
    await expect(access(root)).resolves.toBeUndefined();
    await cleanup; await closed;
    expect(child.exitCode).toBe(0);
    await expect(access(root)).rejects.toMatchObject({code:'ENOENT'});
  } finally { clearTimeout(deadline); if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL'); await closed; await owner.close(); }
});

macIt('actual dispatcher protects the supplied control root distinct from its checkout', async () => {
  const f = await fixture();
  const result = await f.dispatch(f.workspace);
  expect(result.code, result.stderr).toBe(0);
  expect(JSON.parse(await readFile(path.join(f.workspace, 'boundary-result.json'), 'utf8'))).toEqual({ privateRead: false, controlWrite: false, workspaceWrite: true, privilegedEnvironmentPresent:false, loaderEnvironmentPresent:false, cacheWrite:true, tempWrite:true, configAssigned:true, cacheAndTempAssigned:true, namedPolicyPresent:false, legacySandboxPresent:false });
  expect((await f.queue.records())[0].state).toBe('DONE'); // Transport only; no product outcome claim.
});

it('actual Codex transport excludes controller privileges and loader overrides', async () => {
  const f = await fixture('codex');
  const result = await f.dispatch(f.workspace);
  expect(result.code, result.stderr).toBe(0);
  expect(JSON.parse(await readFile(path.join(f.workspace, 'boundary-result.json'), 'utf8'))).toMatchObject({privilegedEnvironmentPresent:false, loaderEnvironmentPresent:false, cacheWrite:true, tempWrite:true, configAssigned:true, cacheAndTempAssigned:true, namedPolicyPresent:true, legacySandboxPresent:false});
});

it('Codex refuses missing workspace before claim and preserves READY state', async () => {
  const f = await fixture('codex'); const before = await f.queue.records();
  const result = await f.dispatch('');
  expect(result.code).toBe(4); expect(result.stderr).toContain('CODEX_ISOLATED_WORKSPACE_REQUIRED');
  expect(await f.queue.records()).toEqual(before);
});

it('readonly Codex transport records its trusted final message as the attempt artifact', async () => {
  const f = await fixture('codex'); const result = await f.dispatch(f.workspace, 'read-only');
  expect(result.code,result.stderr).toBe(0);
  const row=(await f.queue.records())[0];
  const {roleAttemptArtifactName}=await import('./roleAttemptArtifact');
  expect(await readFile(path.join(f.workspace,'.ai-company/reports',roleAttemptArtifactName(row.work_id,row.attempt_id!)),'utf8')).toContain('ROLE_RESEARCH_RESULT_JSON');
});

macIt('actual dispatcher rejects nonexistent workspace before changing a queued attempt', async () => {
  const f = await fixture(); const before = await f.queue.records();
  const result = await f.dispatch(path.join(f.workspace, 'missing'));
  expect(result.code).not.toBe(0);
  expect(result.stderr).toContain('ENOENT');
  expect(await f.queue.records()).toEqual(before);
});

for (const runner of ['agy','codex'] as const) {
  it(`actual ${runner} dispatcher rejects an aliased control root as workspace before claim`, async () => {
    const f = await fixture(runner); const before = await f.queue.records();
    const alias = path.join(f.workspace, 'control-alias'); await symlink(f.control, alias);
    const result = await f.dispatch(alias);
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('must not contain the control root');
    expect(await f.queue.records()).toEqual(before);
  });
}
