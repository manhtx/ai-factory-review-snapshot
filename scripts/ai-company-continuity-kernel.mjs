#!/usr/bin/env -S node --import tsx
/**
 * AI COMPANY CONTINUITY KERNEL
 *
 * Minimal, deterministic OS-supervised durability owner.
 * Launched directly by macOS launchd via /usr/local/bin/node (no bash wrapper).
 *
 * Responsibilities:
 * 1. Maintain supervisor lease & process heartbeat.
 * 2. Reconcile dead worker PIDs and unclaimable dependency orphans.
 * 3. Evaluate durable wait-wake timers and resume due operations.
 * 4. Observe resource recovery without expensive model tokens.
 * 5. Revalidate execution lease authority before dispatch.
 * 6. Spawn authorized runner when work is due.
 * 7. Respect COMPANY_STOP sentinel.
 *
 * Governance:
 * - Does NOT alter product goals or strategy.
 * - Does NOT deploy to production (HUMAN_GATED_NO_GO).
 * - Zero LLM tokens in the keepalive loop.
 */

import { spawn } from 'node:child_process';
import { access, mkdir, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { DurableSupervisorState } from '../server/aiCompany/durableSupervisor.ts';
import { DurableOperationLedger } from '../server/aiCompany/durableOperation.ts';
import { RoleWorkQueue } from '../server/aiCompany/roleWorkQueue.ts';
import { WaitWakeLedger } from '../server/aiCompany/waitWake.ts';
import { ExecutionLeaseManager } from '../server/aiCompany/executionLease.ts';
import { evaluateAntigravityAdmission } from '../server/aiCompany/resourceGovernor.ts';

const root = process.cwd();
const stateDir = path.join(root, '.ai-company', 'runtime');
const projectStateDir = path.join(stateDir, 'projects', 'macro-os');
const stopSentinel = path.join(root, '.ai-company', 'COMPANY_STOP');

const supervisor = new DurableSupervisorState(stateDir);
const opLedger = new DurableOperationLedger(projectStateDir);
const queue = new RoleWorkQueue(projectStateDir);
const waitWake = new WaitWakeLedger(projectStateDir);
const leaseManager = new ExecutionLeaseManager(root);

function logEvent(event, details = {}) {
  const ts = new Date().toISOString();
  console.log(JSON.stringify({
    timestamp: ts,
    pid: process.pid,
    ppid: process.ppid,
    event,
    ...details,
  }));
}

async function fileExists(filePath) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

let runningChild = null;

function runRunner(scriptPath, args = [], env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--import', 'tsx', scriptPath, ...args], {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    runningChild = child;
    child.on('close', (code) => {
      runningChild = null;
      resolve(code ?? 1);
    });
    child.on('error', (err) => {
      runningChild = null;
      logEvent('RUNNER_ERROR', { error: err.message });
      resolve(1);
    });
  });
}

async function stepContinuityCycle() {
  if (await fileExists(stopSentinel)) {
    logEvent('COMPANY_STOP_DETECTED', { path: stopSentinel });
    return { shouldWaitMs: 30_000, stopped: true };
  }

  // 1. Maintain Supervisor Lease
  const ownerId = `kernel-pid-${process.pid}`;
  try {
    await supervisor.acquire(ownerId, 60_000);
  } catch (err) {
    logEvent('SUPERVISOR_LEASE_BUSY', { error: err instanceof Error ? err.message : String(err) });
    return { shouldWaitMs: 10_000 };
  }

  // 2. Reconcile Stale Work Leases and Orphans
  const recoveredStale = await queue.recoverStaleLeases('macro-os', 30_000).catch(() => []);
  if (recoveredStale.length > 0) {
    logEvent('STALE_LEASES_RECOVERED', {
      count: recoveredStale.length,
      items: recoveredStale.map((r) => r.work_id),
    });
  }

  const quarantinedOrphans = await queue.reconcileOrphanedReady('macro-os').catch(() => []);
  if (quarantinedOrphans.length > 0) {
    logEvent('ORPHAN_QUEUE_RECONCILED', {
      count: quarantinedOrphans.length,
      items: quarantinedOrphans.map((r) => r.work_id),
    });
  }

  const isOwnerAlive = (ownerId) => {
    if (!ownerId) return false;
    const match = String(ownerId).match(/-pid-(\d+)/);
    if (!match) return false;
    try {
      process.kill(Number(match[1]), 0);
      return true;
    } catch {
      return false;
    }
  };
  const opRecon = await opLedger.reconcileOrphans({ isOwnerAlive }).catch(() => ({ orphaned_count: 0, reconciled: [] }));
  if (opRecon.orphaned_count > 0) {
    logEvent('ORPHAN_OPERATIONS_RECONCILED', {
      count: opRecon.orphaned_count,
      reconciled: opRecon.reconciled,
    });
  }

  // 3. Evaluate Due Wait/Wake Timers
  const resumedWaits = await waitWake.resumeDue().catch(() => []);
  if (resumedWaits.length > 0) {
    logEvent('WAIT_DUE_RESUMED', {
      count: resumedWaits.length,
      waits: resumedWaits.map((w) => w.wait_id),
    });
  }

  // 4. Revalidate Authority Lease
  const auth = await leaseManager.resolveExecutionAuthority();
  if (auth.status === 'RESOURCE_WAIT') {
    logEvent('RESOURCE_WAIT_ACTIVE', { reason: auth.reason });
    return { shouldWaitMs: 30_000 };
  }
  if (auth.status !== 'RESOLVED' || !auth.lease) {
    logEvent('AUTHORITY_UNRESOLVED', { status: auth.status, reason: auth.reason });
    return { shouldWaitMs: 30_000 };
  }

  // 5. Check Resource Admission
  const admission = await evaluateAntigravityAdmission({
    root,
    model: auth.lease.runtime_model_id,
  });
  if (admission.decision !== 'ALLOW') {
    logEvent('ADMISSION_HELD', { reason: admission.reason, reset_at: admission.reset_at });
    return { shouldWaitMs: 30_000 };
  }

  // 6. Check for Actionable Work
  // If an active marathon controller is running, it owns dispatch and cycle orchestration.
  // The kernel must not run a concurrent untargeted run-ready that races with the marathon.
  let marathonActive = false;
  try {
    const marathonLock = path.join(root, '.ai-company', 'marathon.lock');
    const owner = JSON.parse(await readFile(path.join(marathonLock, 'owner.json'), 'utf8'));
    if (owner?.pid) {
      process.kill(Number(owner.pid), 0);
      marathonActive = true;
    }
  } catch {
    marathonActive = false;
  }

  const queueSummary = await queue.summary('macro-os').catch(() => ({ total: 0, byState: {} }));
  const readyCount = queueSummary.byState?.READY ?? 0;

  if (readyCount > 0 && !runningChild && !marathonActive) {
    logEvent('RUNNER_REENTERED', {
      target: 'ai-company-run-ready',
      readyCount,
      leaseId: auth.lease.lease_id,
      runner: auth.lease.runner,
      model: auth.lease.runtime_model_id,
    });
    const exitCode = await runRunner(path.join(root, 'scripts', 'ai-company-run-ready.mjs'), [
      '--project-id', 'macro-os',
    ]);
    logEvent('RUNNER_COMPLETED', { target: 'ai-company-run-ready', exitCode });
  } else if (marathonActive && readyCount > 0) {
    logEvent('MARATHON_ACTIVE_SUPERSEDED', { readyCount });
  }

  return { shouldWaitMs: 10_000 };
}

async function main() {
  logEvent('CONTINUITY_OWNER_STARTED', {
    nodePath: process.execPath,
    cwd: root,
  });

  const shutdown = async () => {
    logEvent('CONTINUITY_OWNER_SHUTDOWN', { signal: 'EXIT' });
    if (runningChild) {
      runningChild.kill('SIGTERM');
    }
    await supervisor.release(`kernel-pid-${process.pid}`).catch(() => null);
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  while (true) {
    try {
      const result = await stepContinuityCycle();
      const waitMs = result?.shouldWaitMs ?? 10_000;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    } catch (err) {
      logEvent('CONTINUITY_CYCLE_ERROR', { error: err instanceof Error ? err.message : String(err) });
      await new Promise((resolve) => setTimeout(resolve, 10_000));
    }
  }
}

main().catch((err) => {
  console.error('[FATAL CONTINUITY KERNEL ERROR]', err);
  process.exit(1);
});
