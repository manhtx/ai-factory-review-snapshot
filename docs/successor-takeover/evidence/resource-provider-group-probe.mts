import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { RoleWorkQueue } from '/Users/manhtx/Documents/Macro Research Platform/server/aiCompany/roleWorkQueue.ts';
import { RoleHandoffLedger } from '/Users/manhtx/Documents/Macro Research Platform/server/aiCompany/roleHandoffLedger.ts';
import { acquireAntigravityAdmission } from '/Users/manhtx/Documents/Macro Research Platform/server/aiCompany/resourceGovernor.ts';

const sourceRoot = '/Users/manhtx/Documents/Macro Research Platform';
const root = await mkdtemp(path.join(os.tmpdir(), 'resource-provider-orphan-'));
const runtime = path.join(root, '.ai-company/runtime/projects/isolated');
const queue = new RoleWorkQueue(runtime);
const work = await queue.create({ project_id: 'isolated', backlog_id: 'TEMPORARY-ORPHAN', title: 'Temporary OS lifecycle fixture; no actual product outcome', role: 'ux-research', run_id: 'temporary-run', namespace: 'temporary' });
await new RoleHandoffLedger(runtime).record({ project_id: 'isolated', work_id: work.work_id, from_role: 'ceo', to_role: work.role, actor: 'bounded-fixture', objective: work.title, context: ['OS lifecycle only'], evidence_ids: ['temporary-fixture'], acceptance_criteria: ['No real provider/model calls'] });
const bin = path.join(root, 'stub-bin'); await mkdir(bin);
await writeFile(path.join(bin, 'agy'), `#!${process.execPath}
const fs=require('node:fs');fs.writeFileSync('provider-ready.json',JSON.stringify({pid:process.pid,parent:process.ppid}));
const timer=setInterval(()=>{if(!fs.existsSync('resume-provider'))return;clearInterval(timer);fs.writeFileSync('provider-late-effect','Temporary isolated effect only');process.exit(0)},10);
setTimeout(()=>process.exit(7),6000).unref();
`, { mode: 0o700 });
const dispatcher = spawn(process.execPath, ['--import', path.join(sourceRoot, 'node_modules/tsx/dist/loader.mjs'), path.join(sourceRoot, 'scripts/ai-company-role-dispatch.mjs'), '--role', work.role, '--work-id', work.work_id, '--project-id', 'isolated', '--runner', 'agy', '--model', 'no-real-provider', '--control-root', root], { cwd: root, env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`, AI_COMPANY_REQUIRE_WORKTREE: 'false' }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
let stderr = ''; dispatcher.stderr.on('data', bytes => stderr += bytes); dispatcher.stdout.resume();
let providerPid;
let newer;
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
const waitFile = async name => { const file = path.join(root, name); const deadline = Date.now() + 4000; while (Date.now() < deadline) { try { await access(file); return file; } catch {} await new Promise(resolve => setTimeout(resolve, 10)); } throw new Error(`bounded fixture timeout ${name}: ${stderr}`); };
try {
  const provider = JSON.parse(await readFile(await waitFile('provider-ready.json'), 'utf8')); providerPid = provider.pid;
  const lockFile = path.join(root, '.ai-company/runtime/projects/macro-os/antigravity-admission.lock/decision.json');
  const originalOwner = JSON.parse(await readFile(lockFile, 'utf8'));
  const originalQueue = (await queue.records())[0];
  const exited = once(dispatcher, 'exit'); dispatcher.kill('SIGKILL'); const exit = await exited;
  const providerAliveAfterDispatcherExit = alive(providerPid);
  let newerAdmission; try { newer = await acquireAntigravityAdmission({ root, model: 'second-no-provider' }); newerAdmission = { decision: newer.decision.decision }; } catch (error) { newerAdmission = { decision: 'WITHHELD', error: String(error.message) }; }
  const newerOwner = JSON.parse(await readFile(lockFile, 'utf8'));
  await writeFile(path.join(root, 'resume-provider'), 'bounded resume'); await waitFile('provider-late-effect');
  const deadline = Date.now() + 2000;
  while (alive(-providerPid)) { if (Date.now() >= deadline) throw new Error('group absence not observed'); await new Promise(resolve => setTimeout(resolve, 10)); }
  newer = await acquireAntigravityAdmission({ root, model: 'post-quiescence-no-provider' });
  console.log(JSON.stringify({ observedAt: new Date().toISOString(), sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: sourceRoot, encoding: 'utf8' }).trim(), sourceTreeClean: execFileSync('git', ['status', '--porcelain'], { cwd: sourceRoot, encoding: 'utf8' }).trim() === '', resourceSourceHash: createHash('sha256').update(await readFile(path.join(sourceRoot, 'server/aiCompany/resourceGovernor.ts'))).digest('hex'), scope: 'Actual agy role-dispatch entrypoint and real detached OS stub provider; temporary queue/governor stores; zero real providers/model calls/product effects', dispatcherPid: dispatcher.pid, originalOwnerPid: originalOwner.owner_pid, providerPid, dispatcherExit: exit, providerAliveAfterDispatcherExit, attempt: originalQueue.attempt_id, durableProviderIssuance: Boolean(originalQueue.provider_dispatch), newerAdmission, newerOwnerPid: newerOwner.owner_pid, originalLeasePreservedWhileProviderAlive: originalOwner.lease_id === newerOwner.lease_id, lateStubEffectAfterDispatcherDeath: true, groupAbsentBeforeRecovery: true, postQuiescenceAdmission: newer.decision.decision, postQuiescenceNewLease: newer.decision.lease_id !== originalOwner.lease_id, conclusion: 'Bound original provider group survives dispatcher death; replacement withheld until observed group absence; original stub effect is not a product or terminal success', limitations: ['No actual agy service or model call','Unbound launch/legacy ownership still needs explicit reconciliation','No controller or queue administrative authority closure','No process-birth certificate or full OS filesystem fencing'], independent: false }, null, 2));
} finally {
  if (dispatcher.exitCode === null && dispatcher.signalCode === null) dispatcher.kill('SIGKILL');
  if (providerPid) { try { process.kill(-providerPid, 'SIGKILL'); } catch {} }
  if (newer) await newer.release();
}
