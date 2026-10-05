import { afterEach, expect, it } from 'vitest';
import { fork, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const children: ChildProcess[] = [], roots: string[] = [], providerGroups: number[] = [];
afterEach(async () => {
  for (const pid of providerGroups.splice(0)) { try { process.kill(-pid, 'SIGKILL'); } catch { /* group already stopped */ } }
  for (const child of children.splice(0)) await stop(child);
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
async function stop(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const closed = once(child, 'close'); child.kill('SIGKILL'); await closed;
}
interface Message { type: string; accepted?: boolean; decision?: string; leaseId?: string; pid?: number; error?: string }
function waitMessage(child: ChildProcess, type: string): Promise<Message> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.off('message', listener); reject(new Error(`bounded resource IPC timeout: ${type}`)); }, 2500);
    const listener = (message: Message) => { if (message.type === type) { clearTimeout(timer); child.off('message', listener); resolve(message); } };
    child.on('message', listener);
  });
}
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'resource-admission-os-')); roots.push(root);
  const script = path.join(root, 'actor.mts');
  await writeFile(script, `
import fs from 'node:fs'; import {syncBuiltinESMExports} from 'node:module';
const rename = fs.renameSync;
if (process.argv[3] === 'pause-before-owner') {
  fs.renameSync = function(file, target) {
    if (String(target).endsWith('antigravity-admission.lock/decision.json')) {
      process.send({type:'before-owner'}); process.kill(process.pid,'SIGSTOP');
    }
    return rename.call(fs,file,target);
  };
  syncBuiltinESMExports();
}
const {spawn}=await import('node:child_process');
const {acquireAntigravityAdmission}=await import(${JSON.stringify(path.join(process.cwd(), 'server/aiCompany/resourceGovernor.ts'))});
let handle;
process.on('message',async request=>{
  try {
    if(request.type==='claim'){
      process.send({type:'claim-started'});
      handle=await acquireAntigravityAdmission({root:process.argv[2],model:'no-provider',...(request.now?{now:new Date(request.now)}:{})});
      process.send({type:'claimed',accepted:handle.decision.decision==='ALLOW',decision:handle.decision.decision,leaseId:handle.decision.lease_id,pid:process.pid});
    } else if(request.type==='launch'){
      await handle.beginProviderLaunch();
      if(request.pending){process.send({type:'launched',accepted:true});return;}
      const provider=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{detached:true,stdio:'ignore'});
      await handle.bindProviderProcess(provider);
      process.send({type:'launched',accepted:true,pid:provider.pid});
    } else {await handle.release();process.send({type:'released',accepted:true});}
  }catch(error){process.send({type:request.type==='claim'?'claimed':request.type==='launch'?'launched':'released',accepted:false,error:error.message});}
});
process.send({type:'ready'});
`, { mode: 0o600 });
  const runtime = path.join(root, '.ai-company/runtime/projects/macro-os'), lock = path.join(runtime, 'antigravity-admission.lock'), owner = path.join(lock, 'decision.json');
  const launch = async (mode = '') => {
    const child = fork(script, [root, mode], { execArgv: ['--import', createRequire(import.meta.url).resolve('tsx')], stdio: ['ignore', 'ignore', 'pipe', 'ipc'] }); children.push(child); await waitMessage(child, 'ready'); return child;
  };
  return { root, runtime, lock, owner, launch };
}
function request(child: ChildProcess, type: 'claim' | 'release' | 'launch', extra = {}) { const result = waitMessage(child, type === 'claim' ? 'claimed' : type === 'launch' ? 'launched' : 'released'); child.send({ type, ...extra }); return result; }

it('real stale OS A cannot release B or admit C while B is alive', async () => {
  const f = await fixture(); const a = await f.launch(), b = await f.launch(), c = await f.launch();
  expect((await request(a, 'claim')).accepted).toBe(true); expect((await request(a, 'release')).accepted).toBe(true); expect((await request(b, 'claim')).accepted).toBe(true);
  const before = await readFile(f.owner); const late = await request(a, 'release'); expect(late.accepted).toBe(false); expect(late.error).toContain('RESOURCE_ADMISSION_STALE_RELEASE'); expect(await readFile(f.owner)).toEqual(before);
  const third = await request(c, 'claim'); expect(third.accepted).toBe(false); expect(third.error).toContain('RESOURCE_ADMISSION_BUSY');
});

it('real live owner survives a clock expiry fault from another OS actor', async () => {
  const f = await fixture(); const a = await f.launch(), b = await f.launch(); expect((await request(a, 'claim')).accepted).toBe(true); const before = await readFile(f.owner);
  const other = await request(b, 'claim', { now: new Date(Date.now() + 16 * 60000).toISOString() }); expect(other.accepted).toBe(false); expect(other.error).toContain('RESOURCE_ADMISSION_BUSY'); expect(await readFile(f.owner)).toEqual(before);
});

it('two real recoverers of a proven dead owner admit only one successor', async () => {
  const f = await fixture(); const a = await f.launch(); const old = await request(a, 'claim'); expect(old.accepted).toBe(true); await stop(a);
  const b = await f.launch(), c = await f.launch(); const results = await Promise.all([request(b, 'claim'), request(c, 'claim')]); expect(results.filter(result => result.accepted)).toHaveLength(1); expect(results.find(result => !result.accepted)?.error).toContain('RESOURCE_ADMISSION_BUSY');
  const row = JSON.parse(await readFile(f.owner, 'utf8')); expect(row.lease_id).toBe(results.find(result => result.accepted)?.leaseId); expect(row.lease_id).not.toBe(old.leaseId);
});

it('SIGKILL before owner publication releases exclusion but preserves unknown partial slot', async () => {
  const f = await fixture(); const a = await f.launch('pause-before-owner'); const paused = waitMessage(a, 'before-owner'); a.send({ type: 'claim' }); await paused; const names = await readdir(f.lock); expect(names).not.toContain('decision.json'); const bytes = await readFile(path.join(f.lock, names[0])); await stop(a);
  const b = await f.launch(); const result = await request(b, 'claim'); expect(result.accepted).toBe(false); expect(result.decision).toBe('UNKNOWN'); expect(await readdir(f.lock)).toEqual(names); expect(await readFile(path.join(f.lock, names[0]))).toEqual(bytes);
});

it('a slow initialization under the OS gate cannot be replaced before owner publication', async () => {
  const f = await fixture(); const a = await f.launch('pause-before-owner'), b = await f.launch(); const paused = waitMessage(a, 'before-owner'), claimed = waitMessage(a, 'claimed'); a.send({ type: 'claim' }); await paused;
  const started = waitMessage(b, 'claim-started'); const other = request(b, 'claim'); await started; a.kill('SIGCONT'); const first = await claimed; expect(first.accepted).toBe(true); const second = await other; expect(second.accepted).toBe(false); expect(second.error).toContain('RESOURCE_ADMISSION_BUSY');
  const row = JSON.parse(await readFile(f.owner, 'utf8')); expect(row.lease_id).toBe(first.leaseId); expect(row.owner_pid).toBe(a.pid);
});

it('dispatcher death preserves an actual live provider group and recovery waits for group absence', async () => {
  const f = await fixture(); const a = await f.launch(), b = await f.launch();
  expect((await request(a, 'claim')).accepted).toBe(true);
  const provider = await request(a, 'launch'); expect(provider.accepted).toBe(true); expect(provider.pid).toBeGreaterThan(0); providerGroups.push(provider.pid!);
  const before = await readFile(f.owner); await stop(a);
  const held = await request(b, 'claim'); expect(held.accepted).toBe(false); expect(held.error).toContain('RESOURCE_ADMISSION_BUSY'); expect(await readFile(f.owner)).toEqual(before);
  process.kill(-provider.pid!, 'SIGKILL');
  const deadline = Date.now() + 2000;
  while (true) {
    try { process.kill(-provider.pid!, 0); } catch (error) { expect((error as NodeJS.ErrnoException).code).toBe('ESRCH'); break; }
    if (Date.now() >= deadline) throw new Error('provider group absence not observed');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  const recovered = await request(b, 'claim'); expect(recovered.accepted).toBe(true); expect(JSON.parse(await readFile(f.owner, 'utf8')).lease_id).toBe(recovered.leaseId);
});

it('SIGKILL in a marked but unbound launch window preserves UNKNOWN rather than replacement', async () => {
  const f = await fixture(); const a = await f.launch(), b = await f.launch();
  expect((await request(a, 'claim')).accepted).toBe(true); expect((await request(a, 'launch', { pending: true })).accepted).toBe(true);
  const before = await readFile(f.owner); expect(JSON.parse(before.toString()).provider_launch_phase).toBe('LAUNCH_UNCERTAIN'); await stop(a);
  const held = await request(b, 'claim'); expect(held.accepted).toBe(false); expect(held.decision).toBe('UNKNOWN'); expect(await readFile(f.owner)).toEqual(before);
});
