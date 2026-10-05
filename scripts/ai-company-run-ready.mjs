#!/usr/bin/env node
import { roleAttemptArtifactName } from '../server/aiCompany/roleAttemptArtifact.ts';
/** Run the currently dispatchable role work in dependency waves. */
import { access, cp, lstat, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { WorktreeManager } from '../server/aiCompany/worktreeManager.ts';
import { RoleWorkQueue } from '../server/aiCompany/roleWorkQueue.ts';
import { canRunTestPolicy } from '../server/aiCompany/harnessHealth.ts';
import { SecurityViolationLedger } from '../server/aiCompany/securityViolationLedger.ts';
import { RoleEvidenceResolver } from '../server/aiCompany/roleEvidenceResolver.ts';
import { WaitWakeLedger } from '../server/aiCompany/waitWake.ts';
import { ExecutionLeaseManager } from '../server/aiCompany/executionLease.ts';

const root = process.cwd();
const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) if (process.argv[i].startsWith('--')) args.set(process.argv[i].slice(2), process.argv[i + 1] ?? '');
const projectId = args.get('project-id') || 'macro-os';
const backlogPrefix = args.get('backlog-prefix') || '';
const runId = args.get('run-id') || '';
const namespace = args.get('namespace') || '';
if ((runId && !namespace) || (!runId && namespace)) { console.error('--run-id and --namespace must be provided together'); process.exit(2); }

const leaseManager = new ExecutionLeaseManager(root);
const activeLease = await leaseManager.loadActiveLease();

let rawRunner = args.get('runner');
let rawModel = args.get('model');
if (!rawRunner && activeLease && activeLease.status === 'ACTIVE') {
  rawRunner = activeLease.runner;
}
if (!rawModel && activeLease && activeLease.status === 'ACTIVE') {
  rawModel = activeLease.runtime_model_id;
}

const defaultRunner = (process.env.ANTIGRAVITY_AGENT || process.env.ANTIGRAVITY_CONVERSATION_ID || process.env.RUNNER === 'antigravity' || process.env.RUNNER === 'agy') ? 'agy' : 'codex';
rawRunner = rawRunner || process.env.RUNNER || defaultRunner;
const runner = rawRunner === 'antigravity' ? 'agy' : rawRunner;
const defaultModel = runner === 'agy' ? (process.env.AI_COMPANY_MODEL || 'gemini-3.8-flash-high') : (process.env.AI_COMPANY_MODEL || 'gpt-5.6-sol');
const model = rawModel || process.env.AI_COMPANY_MODEL || defaultModel;
if (runner !== 'codex' && runner !== 'agy') { console.error(`Runner disabled: ${runner}; this installation permits agy or codex only`); process.exit(2); }
const maxConcurrent = Math.max(1, Math.min(8, Number(args.get('max-concurrent') || process.env.AI_COMPANY_ROLE_MAX_CONCURRENCY || 2)));
const runtimeRoot = path.join(root, '.ai-company', 'runtime', 'projects', projectId);
const coordinatorLock = path.join(runtimeRoot, runId ? `coordinator-${runId}.lock` : 'coordinator.lock');
async function acquireCoordinatorLock() {
  await mkdir(runtimeRoot, { recursive: true });
  try {
    await mkdir(coordinatorLock);
    await writeFile(path.join(coordinatorLock, 'owner.json'), JSON.stringify({ pid: process.pid, run_id: runId, namespace, started_at: new Date().toISOString() }));
    return;
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    try {
      const owner = JSON.parse(await readFile(path.join(coordinatorLock, 'owner.json'), 'utf8'));
      let alive = true;
      try { process.kill(owner.pid, 0); } catch { alive = false; }
      if (alive) throw new Error(`coordinator already active for ${runId || projectId} (pid ${owner.pid})`, { cause: error });
    } catch (ownerError) {
      if (ownerError instanceof Error && ownerError.message.startsWith('coordinator already active')) throw ownerError;
    }
    await rm(coordinatorLock, { recursive: true, force: true });
    await mkdir(coordinatorLock);
    await writeFile(path.join(coordinatorLock, 'owner.json'), JSON.stringify({ pid: process.pid, run_id: runId, namespace, started_at: new Date().toISOString() }));
  }
}
async function releaseCoordinatorLock() { await rm(coordinatorLock, { recursive: true, force: true }).catch(() => null); }
await acquireCoordinatorLock();
process.once('SIGINT', async () => { await releaseCoordinatorLock(); process.exit(130); });
process.once('SIGTERM', async () => { await releaseCoordinatorLock(); process.exit(143); });
const lockHoldMs = Number(process.env.AI_COMPANY_COORDINATOR_LOCK_HOLD_MS || 0);
if (lockHoldMs > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(lockHoldMs, 60_000)));
const phaseTimeoutMs = Math.max(5_000, Math.min(600_000, Number(process.env.AI_COMPANY_COORDINATOR_PHASE_TIMEOUT_MS || 600_000)));
const withPhaseTimeout = (promise, phase) => {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`COORDINATION_FAILURE: ${phase} exceeded ${phaseTimeoutMs}ms`)), phaseTimeoutMs);
      timer.unref?.();
    }),
  ]);
};
const worktreeManager = new WorktreeManager(root, projectId);
const queue = new RoleWorkQueue(runtimeRoot, new RoleEvidenceResolver(runtimeRoot));
const waitWake = new WaitWakeLedger(runtimeRoot);
const securityLedger = new SecurityViolationLedger(runtimeRoot);
const harnessHealth = (process.env.AI_COMPANY_HARNESS_HEALTH || 'HEALTHY').toUpperCase();
const readRows = async (file) => { try { return (await readFile(file, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line)); } catch (error) { if (error?.code === 'ENOENT') return []; throw error; } };
const latest = (rows) => new Map(rows.map((row) => [row.work_id, row]));
// Product-first admission: downstream roles are not a substitute for PM
// qualification. Once PM has produced a terminal HOLD/REVISE/REJECT decision,
// stop the dependency wave before spending provider tokens on roles that have
// no authorization to advance the work. Missing/unparseable PM output remains
// fail-closed for this optimization: the normal dependency/evidence guards
// still decide whether the work can proceed.
const upstreamPmDecision = async (item, work) => {
  const visited = new Set();
  const walk = async (workId) => {
    if (!workId || visited.has(workId)) return null;
    visited.add(workId);
    const ancestor = work.get(workId);
    if (!ancestor) return null;
    if (ancestor.role === 'pm' && await queue.currentSuccess(ancestor)) {
      const recommendation = ancestor.structured_output?.recommendation;
      return ['PROCEED', 'REVISE', 'HOLD', 'REJECT'].includes(recommendation) ? recommendation : null;
    }
    for (const dependency of ancestor.depends_on ?? []) {
      const decision = await walk(dependency);
      if (decision) return decision;
    }
    return null;
  };
  return walk(item.work_id);
};
// The coordinator needs to await filesystem setup before resolving each child.
// eslint-disable-next-line no-async-promise-executor
const runOne = async (work) => new Promise(async (resolve) => {
  let workspace = '';
  const worktreeRequired = process.env.AI_COMPANY_DISABLE_EXECUTION_PLANNER !== 'true'
    ? (work.assignment?.worktree_required !== false && process.env.AI_COMPANY_WORKTREE_REQUIRED !== 'false')
    : true;
  // Non-engineering or read-only roles do not require disposable git worktrees
  if (worktreeRequired) {
    const existing = await withPhaseTimeout(worktreeManager.get(work.work_id), `worktree lookup ${work.work_id}`);
    const record = existing ?? await withPhaseTimeout(worktreeManager.create(work.work_id), `worktree creation ${work.work_id}`);
    workspace = record.worktree;
    // A disposable worker must never inherit or create a writable copy of the
    // control-plane runtime ledgers. Queue/evidence state is dispatcher-owned;
    // the worker may return only its bounded role artifact.
    const workerRuntime = path.join(workspace, '.ai-company', 'runtime');
    await rm(workerRuntime, { recursive: true, force: true });
    // Keep the path occupied by a non-directory sentinel. This makes any
    // worker attempt to create `.ai-company/runtime/**` fail at the OS layer;
    // security diff detection remains a second containment boundary.
    await writeFile(workerRuntime, 'CONTROL_PLANE_RUNTIME_DENIED\n', { flag: 'wx' }).catch((error) => {
      if (error?.code !== 'EEXIST') throw error;
    });
    // A detached worktree does not contain ignored node_modules. Make the
    // already-installed control-plane dependency tree visible read-only via a
    // symlink, while keeping Vite's writable cache outside the repository.
    // Without this, npm exec may resolve inconsistently or fail dependency
    // discovery inside the disposable worktree.
    const workerNodeModules = path.join(workspace, 'node_modules');
    try {
      await lstat(workerNodeModules);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      try {
        await access(path.join(root, 'node_modules'));
        await symlink(path.join(root, 'node_modules'), workerNodeModules, 'dir');
      } catch (linkError) {
        if (linkError?.code !== 'EEXIST') throw linkError;
      }
    }
    for (const dependencyId of work.depends_on ?? []) {
      let source;
      const target = path.join(workspace, '.ai-company', 'reports', 'dependencies', dependencyId);
      await withPhaseTimeout(mkdir(path.dirname(target), { recursive: true }), `dependency directory ${dependencyId}`);
      try {
        source = await dependencyArtifactPath(dependencyId);
        const artifact = await readFile(source, 'utf8');
        if (!artifact.trim()) throw new Error('dependency artifact is empty');
        await withPhaseTimeout(cp(source, target, { force: true }), `dependency artifact copy ${dependencyId}`);
      } catch (error) {
        await queue.block(work.work_id, `dependency artifact unavailable: ${dependencyId} (${error instanceof Error ? error.message : String(error)})`, work);
        resolve({ work_id: work.work_id, role: work.role, code: 1 });
        return;
      }
      try {
        await withPhaseTimeout(worktreeManager.propagateProductChanges(dependencyId, work.work_id, work.assignment?.allowed_paths ?? []), `dependency propagation ${dependencyId} -> ${work.work_id}`);
      } catch (error) {
        await queue.block(work.work_id, `dependency product changes unavailable: ${dependencyId} (${error instanceof Error ? error.message : String(error)})`, work);
        resolve({ work_id: work.work_id, role: work.role, code: 1 });
        return;
      }
    }
  } else {
    // Non-code / read-only role: workspace is empty, dependency artifacts copied to control-plane reports dir
    for (const dependencyId of work.depends_on ?? []) {
      let source;
      const target = path.join(root, '.ai-company', 'reports', 'dependencies', dependencyId);
      await withPhaseTimeout(mkdir(path.dirname(target), { recursive: true }), `dependency directory ${dependencyId}`);
      try {
        source = await dependencyArtifactPath(dependencyId);
        const artifact = await readFile(source, 'utf8');
        if (!artifact.trim()) throw new Error('dependency artifact is empty');
        await withPhaseTimeout(cp(source, target, { force: true }), `dependency artifact copy ${dependencyId}`);
      } catch (error) {
        await queue.block(work.work_id, `dependency artifact unavailable: ${dependencyId} (${error instanceof Error ? error.message : String(error)})`, work);
        resolve({ work_id: work.work_id, role: work.role, code: 1 });
        return;
      }
    }
  }
  const args = ['--import', 'tsx', 'scripts/ai-company-role-dispatch.mjs', '--role', work.role, '--work-id', work.work_id, '--project-id', projectId, '--runner', runner, '--model', model];
  if (activeLease?.lease_id) args.push('--lease-id', activeLease.lease_id);
  if (workspace) args.push('--workspace', workspace);
  args.push('--control-root', root);
  const child = spawn(process.execPath, args, {
    cwd: root,
    env: {
      ...process.env,
      AI_COMPANY_REQUIRE_WORKTREE: worktreeRequired ? 'true' : 'false',
      AI_COMPANY_CODEX_SANDBOX: worktreeRequired ? 'workspace-write' : 'read-only',
      AI_COMPANY_VITEST_CACHE_DIR: path.join('/tmp', `ai-company-vitest-${work.work_id}`),
    },
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
  });
  let launchedAttempt;
  child.on('message', message => {
    if (launchedAttempt || message?.type !== 'ROLE_ATTEMPT_CLAIMED' || message.work_id !== work.work_id) return;
    try {
      if (message.output_name !== roleAttemptArtifactName(work.work_id, message.attempt_id)) return;
      launchedAttempt = { attempt_id: message.attempt_id, output_name: message.output_name };
    } catch { /* malformed ACK grants no parent authority */ }
  });
  const timeout = setTimeout(() => {
    child.kill('SIGTERM');
    setTimeout(() => {
      // `child.killed` only reports whether a signal was sent; it does not
      // prove that the process exited. Use exitCode/signalCode so a stuck
      // provider process is actually reaped fail-closed.
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }, 5_000).unref();
  }, phaseTimeoutMs);
  child.on('close', async (code) => {
    clearTimeout(timeout);
    try {
    if (workspace) {
      if (launchedAttempt) await worktreeManager.collectArtifacts(work.work_id, '.ai-company/reports', launchedAttempt.attempt_id).catch(() => null);
      // Exclude the coordinator's approved baseline overlay; only mutations
      // created by this role are security-relevant.
      const changed = await worktreeManager.changedFiles(work.work_id, false).catch(() => []);
      const forbidden = changed.filter((file) => file === '.ai-company/runtime' || file.startsWith('.ai-company/runtime/'));
      if (forbidden.length) {
        await securityLedger.record({ project_id: projectId, run_id: work.assignment?.run_id ?? work.run_id ?? '', namespace: work.assignment?.namespace ?? work.namespace ?? '', work_id: work.work_id, assignment_id: work.assignment?.assignment_id ?? '', role: work.role, violation_type: 'CONTROL_PLANE_MUTATION', attempted_paths: forbidden, prevented: true, action: 'CONTAINED' });
        // These paths are inside the disposable worker only. Remove the local
        // mutation after recording it; the real control-plane runtime remains
        // outside the worker and is writable only by this coordinator.
        await rm(path.join(workspace, '.ai-company', 'runtime'), { recursive: true, force: true });
      }
    } else if (launchedAttempt) {
      // Direct artifact collection for non-worktree roles
      const directSource = path.join(root, '.ai-company', 'reports', launchedAttempt.output_name);
      const directDest = path.join(runtimeRoot, 'worker-artifacts', work.work_id, launchedAttempt.output_name);
      try {
        await mkdir(path.dirname(directDest), { recursive: true });
        await cp(directSource, directDest, { force: true });
      } catch { /* no current-attempt artifact collected */ }
    }
    if ((code ?? 1) !== 0 && launchedAttempt) {
      const record = (await queue.records(projectId)).find(candidate => candidate.work_id === work.work_id);
      if (record?.attempt_id === launchedAttempt.attempt_id && ['CLAIMED', 'IN_REVIEW'].includes(record.state)) {
        const stopped = await queue.block(work.work_id, code === null ? `COORDINATION_FAILURE: launched attempt exceeded ${phaseTimeoutMs}ms; child terminated` : `provider/role dispatch failed with exit=${code ?? 1}`, record);
        if ((stopped.retry_count ?? 0) < (stopped.assignment?.retry_budget ?? 0)) await queue.requeueBlocked(work.work_id, 'bounded retry of the acknowledged stopped attempt', stopped);
      }
    }
    resolve({ work_id: work.work_id, role: work.role, code: code ?? 1 });
    } catch (error) {
      console.error(`Attempt-bound dispatch reconciliation failed; inspect state: ${error instanceof Error ? error.message : String(error)}`);
      resolve({ work_id: work.work_id, role: work.role, code: 1 });
    }
  });
});

const dependencyArtifactPath = async (id) => {
  const producer = (await queue.records(projectId)).find(row => row.work_id === id);
  return path.join(runtimeRoot, 'worker-artifacts', id, roleAttemptArtifactName(id, producer?.attempt_id));
};

let dispatched = 0;
let waveNumber = 0;
while (true) {
  waveNumber += 1;
  await queue.reconcileOrphanedReady(projectId).catch(() => []);
  const work = latest(await queue.records());
  const handoffs = await readRows(path.join(runtimeRoot, 'role-handoffs.jsonl'));
  const recoveryItems = [...work.values()].filter((item) => item.assignment?.run_id === runId && item.assignment?.namespace === namespace && item.backlog_id?.startsWith('RECOVERY:'));
  if (recoveryItems.length > 2) {
    for (const item of recoveryItems.filter((candidate) => candidate.state === 'READY')) await queue.block(item.work_id, 'maximum live recovery task count reached; bounded terminal hold requires operator review', item);
    break;
  }
  // Evaluate the PM gate before dependency readiness so every descendant of a
  // terminal PM decision is closed, including deeper descendants whose direct
  // parent is now BLOCKED rather than DONE. Otherwise a rejected wave leaves
  // READY work stranded and the integrity audit correctly fails the run.
  const readyCandidates = [...work.values()].filter((item) => item.state === 'READY' && (!backlogPrefix || item.backlog_id?.startsWith(backlogPrefix) || (runId && item.assignment?.run_id === runId && item.assignment?.namespace === namespace && item.backlog_id?.startsWith('RECOVERY:'))) && (!runId || item.run_id === runId || item.assignment?.run_id === runId) && (!namespace || item.namespace === namespace || item.assignment?.namespace === namespace) && handoffs.some((handoff) => handoff.work_id === item.work_id && handoff.to_role === item.role) && canRunTestPolicy(harnessHealth, item.assignment?.test_policy ?? 'targeted'));
  const eligible = [];
  for (const item of readyCandidates) {
    const pmDecision = await upstreamPmDecision(item, work);
    if (pmDecision && pmDecision !== 'PROCEED') {
      await queue.block(item.work_id, `UPSTREAM_PM_GATE: PM recommendation=${pmDecision}; downstream role dispatch suppressed until a new PM-qualified assignment is created`, item);
      console.log(`[COORDINATOR] blocked ${item.role} ${item.work_id}: upstream PM recommendation=${pmDecision}`);
      continue;
    }
    const dependencies = await Promise.all((item.depends_on ?? []).map(id => queue.currentDependencySatisfied(item, work.get(id))));
    if (!dependencies.every(Boolean)) continue;
    eligible.push(item);
  }
  if (!eligible.length) {
    // An empty dispatch set is a healthy operational state, not a terminal
    // dead-end. Persist one bounded wake condition so the next coordinator /
    // supervisor tick has an explicit next action without manufacturing work
    // or spending provider tokens on a synthetic task.
    const workflowId = `coordinator:${projectId}:${runId || 'default'}:${namespace || 'default'}`;
    const activeWait = (await waitWake.records()).find((item) => item.workflow_id === workflowId && !item.resumed_at);
    if (!activeWait) {
      const earliest = new Date(Date.now() + 15 * 60_000).toISOString();
      await waitWake.wait({
        project_id: projectId,
        workflow_id: workflowId,
        state: 'AWAITING_SCHEDULE',
        wake_type: 'TIMER',
        wake_condition: 're-evaluate dispatchable work',
        earliest_time: earliest,
        deadline: null,
        evidence_required: [],
        next_action: 're-read current queue and backlog; dispatch only newly eligible work',
      });
      console.log(`[COORDINATOR] no dispatchable work; persisted bounded wake at ${earliest}`);
    } else {
      console.log(`[COORDINATOR] no dispatchable work; waiting on ${activeWait.wait_id} until ${activeWait.earliest_time ?? 'next supervisor tick'}`);
    }
    break;
  }
  console.log(`[COORDINATOR] wave=${waveNumber} dispatchable=${eligible.length} concurrency=${maxConcurrent}`);
  for (let i = 0; i < eligible.length; i += maxConcurrent) {
    const results = await Promise.all(eligible.slice(i, i + maxConcurrent).map(async (item) => {
      try {
        return await withPhaseTimeout(runOne(item), `role coordination ${item.work_id}`);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        await queue.block(item.work_id, `COORDINATION_FAILURE: ${reason}`, item);
        return { work_id: item.work_id, role: item.role, code: 1 };
      }
    }));
    for (const result of results) { dispatched += 1; console.log(`[COORDINATOR] ${result.role} ${result.work_id} exit=${result.code}`); }
    // A failed admission/provider attempt must produce a terminal queue state.
    // Otherwise a READY item can be redispatched forever when the child exits
    // before it reaches queue.block or queue.complete.
    const afterWave = latest(await queue.records());
    const stuckReady = eligible.slice(i, i + maxConcurrent).filter((item) => afterWave.get(item.work_id)?.state === 'READY');
    if (stuckReady.length) {
      for (const item of stuckReady) await queue.block(item.work_id, `COORDINATION_FAILURE: dispatch produced no queue state transition (exit code ${results.find((result) => result.work_id === item.work_id)?.code ?? 1})`, item);
      break;
    }
  }
}
console.log(`[COORDINATOR] dispatch cycle complete project=${projectId} dispatched=${dispatched}`);
if (runId) {
  const audit = spawn(process.execPath, ['scripts/audit-codex-product-cycle-integrity.mjs', '--run-id', runId, '--project-id', projectId], { cwd: root, stdio: 'inherit' });
  const auditCode = await new Promise((resolve) => audit.on('close', resolve));
  if ((auditCode ?? 1) !== 0) {
    console.error(`[COORDINATOR] cycle integrity audit failed run=${runId}; cycle is rejected`);
    await releaseCoordinatorLock();
    process.exit(3);
  }
}
await releaseCoordinatorLock();
process.exit(0);
