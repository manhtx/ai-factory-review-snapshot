import { afterEach, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { RoleWorkQueue } from './roleWorkQueue';
import { RoleHandoffLedger } from './roleHandoffLedger';
import { acquireAntigravityAdmission } from './resourceGovernor';

const roots: string[] = [], children: ChildProcess[] = [], groups: number[] = [];
afterEach(async () => {
  for (const pid of groups.splice(0)) { try { process.kill(-pid, 'SIGKILL'); } catch { /* absent group */ } }
  for (const child of children.splice(0)) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    const exited = once(child, 'exit'); child.kill('SIGKILL'); await exited;
  }
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function waitFile(file: string) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    try { await access(file); return; } catch { /* bounded fixture observation */ }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`bounded fixture file timeout: ${file}`);
}
async function groupAbsent(pid: number) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    try { process.kill(-pid, 0); } catch (error) { expect((error as NodeJS.ErrnoException).code).toBe('ESRCH'); return; }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('provider group absence not observed');
}
async function fixture(mode: 'success' | 'waiting' | 'descendant' | 'missing') {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cli-resource-')); roots.push(root);
  const runtime = path.join(root, '.ai-company/runtime/projects/isolated'), queue = new RoleWorkQueue(runtime);
  const work = await queue.create({ project_id: 'isolated', backlog_id: 'TEMP-RESOURCE', title: 'Isolated transport fixture; no actual product outcome', role: 'ux-research', run_id: 'temporary', namespace: 'temporary' });
  await new RoleHandoffLedger(runtime).record({ project_id: 'isolated', work_id: work.work_id, from_role: 'ceo', to_role: work.role, actor: 'fixture', objective: work.title, context: ['temporary provider lifecycle'], evidence_ids: ['fixture'], acceptance_criteria: ['actual OS transport only'] });
  const bin = path.join(root, 'bin'); await mkdir(bin);
  const descendant = "const fs=require('node:fs');fs.writeFileSync('descendant-ready',String(process.pid));setInterval(()=>{},1000);";
  if (mode !== 'missing') await writeFile(path.join(bin, 'agy'), `#!${process.execPath}
const fs=require('node:fs');fs.writeFileSync('provider-ready',JSON.stringify({pid:process.pid,parent:process.ppid}));
function emit(){const response='ROLE_RESEARCH_RESULT_JSON '+JSON.stringify({research_question:'Temporary transport',source_reference:process.argv.at(-1).match(/RECEIPT EVIDENCE ID: ([A-Za-z0-9_:-]+)/)[1],finding:'Isolated fixture; product outcome UNKNOWN',confidence:0.5})+'\\nROLE_WORK_COMPLETE';console.log(JSON.stringify({event:'result',result:{response,usage:{input_tokens:1,output_tokens:1}}}));}
if(${JSON.stringify(mode)}==='waiting'){const tick=setInterval(()=>{if(!fs.existsSync('resume-provider'))return;clearInterval(tick);fs.writeFileSync('late-effect','temporary only');process.exit(0)},10);}
else if(${JSON.stringify(mode)}==='descendant'){require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(descendant)}],{stdio:'ignore'});const tick=setInterval(()=>{if(!fs.existsSync('resume-provider'))return;clearInterval(tick);emit();process.exit(0)},10);}
else setTimeout(emit,250);
setTimeout(()=>process.exit(7),8000).unref();
`, { mode: 0o700 });
  const child = spawn(process.execPath, ['--import', createRequire(import.meta.url).resolve('tsx'), path.join(process.cwd(), 'scripts/ai-company-role-dispatch.mjs'), '--role', work.role, '--work-id', work.work_id, '--project-id', 'isolated', '--runner', 'agy', '--model', 'no-real-provider', '--control-root', root], { cwd: root, env: { ...process.env, PATH: bin, AI_COMPANY_REQUIRE_WORKTREE: 'false' }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  children.push(child); let stderr = ''; child.stderr!.on('data', bytes => stderr += bytes); child.stdout!.resume();
  const exit = new Promise<number | null>((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  const owner = path.join(root, '.ai-company/runtime/projects/macro-os/antigravity-admission.lock/decision.json');
  const ready = async () => {
    await waitFile(path.join(root, 'provider-ready')); const row = JSON.parse(await readFile(path.join(root, 'provider-ready'), 'utf8')); groups.push(row.pid);
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      if (JSON.parse(await readFile(owner, 'utf8')).provider_launch_phase === 'GROUP_BOUND') return row as { pid: number; parent: number };
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error(`binding not observed: ${stderr}`);
  };
  return { root, runtime, queue, work, child, exit, owner, ready, stderr: () => stderr };
}

it('actual agy dispatcher admits a current stub result only after its bound group exits', async () => {
  const f = await fixture('success'); const provider = await f.ready(); expect(provider.parent).toBe(f.child.pid);
  expect(await f.exit, f.stderr()).toBe(0); expect((await f.queue.records())[0]).toMatchObject({ state: 'DONE', provider_dispatch: { provider_id: 'cli:agy:no-real-provider' } });
  await expect(access(f.owner)).rejects.toMatchObject({ code: 'ENOENT' }); await groupAbsent(provider.pid);
});

it('actual SIGKILL leaves the provider alive and preserves admission until its entire group disappears', async () => {
  const f = await fixture('waiting'); const provider = await f.ready(); const before = await readFile(f.owner);
  f.child.kill('SIGKILL'); await f.exit; expect(() => process.kill(-provider.pid, 0)).not.toThrow();
  await expect(acquireAntigravityAdmission({ root: f.root, model: 'replacement' })).rejects.toThrow('RESOURCE_ADMISSION_BUSY'); expect(await readFile(f.owner)).toEqual(before);
  await writeFile(path.join(f.root, 'resume-provider'), 'resume'); await waitFile(path.join(f.root, 'late-effect')); await groupAbsent(provider.pid);
  const replacement = await acquireAntigravityAdmission({ root: f.root, model: 'replacement' }); expect(replacement.decision.decision).toBe('ALLOW'); expect(replacement.decision.lease_id).not.toBe(JSON.parse(before.toString()).lease_id); await replacement.release();
  expect((await f.queue.records())[0].state).toBe('CLAIMED'); expect(await readdir(f.runtime)).not.toContain('role-dispatch-evidence.jsonl');
});

it('leader completion with a surviving actual descendant withholds release and terminal receipts', async () => {
  const f = await fixture('descendant'); const provider = await f.ready(); await waitFile(path.join(f.root, 'descendant-ready')); const before = await readFile(f.owner);
  await writeFile(path.join(f.root, 'resume-provider'), 'resume'); expect(await f.exit).not.toBe(0); expect(f.stderr()).toContain('RESOURCE_ADMISSION_BUSY'); expect(() => process.kill(-provider.pid, 0)).not.toThrow(); expect(await readFile(f.owner)).toEqual(before);
  expect((await f.queue.records())[0].state).toBe('CLAIMED'); expect(await readdir(f.runtime)).not.toContain('role-dispatch-evidence.jsonl');
});

it('an actual spawn error preserves marked UNKNOWN ownership and never grants terminal success', async () => {
  const f = await fixture('missing'); expect(await f.exit).not.toBe(0); expect(f.stderr()).toContain('RESOURCE_PROVIDER_BINDING_REQUIRED');
  const before = await readFile(f.owner); expect(JSON.parse(before.toString()).provider_launch_phase).toBe('LAUNCH_UNCERTAIN');
  const next = await acquireAntigravityAdmission({ root: f.root, model: 'replacement' }); expect(next.decision.decision).toBe('UNKNOWN'); expect(await readFile(f.owner)).toEqual(before);
  expect((await f.queue.records())[0].state).toBe('BLOCKED'); expect(await readdir(f.runtime)).not.toContain('role-dispatch-evidence.jsonl');
});
