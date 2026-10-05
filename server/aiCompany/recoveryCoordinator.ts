import { createHash } from 'node:crypto';
import { open, unlink, stat, mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { RoleWorkQueue, type RoleWorkItem } from './roleWorkQueue';
import { nextRecoveryAction, validateRecoveryPlan, type RecoveryPlan } from './recoveryPlan';
import type { RoleHandoffLedger } from './roleHandoffLedger';

export type RecoveryResult = {
  status: 'CREATED' | 'DEDUPLICATED' | 'ESCALATE' | 'TERMINAL_HOLD';
  task?: RoleWorkItem;
  reason?: string;
  fingerprint?: string;
};

const activeFingerprintLocks = new Map<string, Promise<void>>();

export async function withRecoveryLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  while (activeFingerprintLocks.has(key)) {
    try {
      await activeFingerprintLocks.get(key);
    } catch {
      // ignore
    }
  }
  let resolveLock!: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    resolveLock = resolve;
  });
  activeFingerprintLocks.set(key, lockPromise);

  try {
    return await fn();
  } finally {
    activeFingerprintLocks.delete(key);
    resolveLock();
  }
}

async function acquireFileLock(lockPath: string, maxWaitMs = 5000): Promise<() => Promise<void>> {
  const start = Date.now();
  await mkdir(path.dirname(lockPath), { recursive: true });

  while (Date.now() - start < maxWaitMs) {
    try {
      const handle = await open(lockPath, 'wx');
      await handle.writeFile(JSON.stringify({ pid: process.pid, time: Date.now() }));
      await handle.close();
      return async () => {
        try {
          await unlink(lockPath);
        } catch {
          // ignore
        }
      };
    } catch (err: any) {
      if (err.code === 'EEXIST') {
        try {
          const s = await stat(lockPath);
          if (Date.now() - s.mtimeMs > 3000) {
            // Move the stale inode out of the contested path atomically. A
            // concurrent owner can recreate lockPath after this rename without
            // being deleted by the stale-lock cleanup.
            const quarantinePath = `${lockPath}.stale-${process.pid}-${Date.now()}`;
            try {
              await rename(lockPath, quarantinePath);
              await rm(quarantinePath, { force: true });
            } catch (renameError: any) {
              if (renameError.code !== 'ENOENT') throw renameError;
            }
            continue;
          }
        } catch {
          continue;
        }
        await new Promise((r) => setTimeout(r, 20));
      } else {
        throw err;
      }
    }
  }
  throw new Error(`Timeout acquiring recovery lock: ${lockPath}`);
}

export function computeRecoveryFingerprint(params: {
  source_work_id: string;
  recovery_id: string;
  attempt: number;
  failure_class: string;
  namespace: string;
  run_id: string;
}): string {
  const raw = `${params.source_work_id}::${params.recovery_id}::${params.attempt}::${params.failure_class}::${params.namespace}::${params.run_id}`;
  return createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

export async function coordinateRecovery(input: {
  queue: RoleWorkQueue;
  handoffs?: RoleHandoffLedger;
  plan: RecoveryPlan;
  projectId: string;
  runId: string;
  namespace: string;
  sourceWorkId: string;
  attempts: number;
}): Promise<RecoveryResult> {
  const errors = validateRecoveryPlan(input.plan);
  if (errors.length) throw new Error(`invalid recovery plan: ${errors.join('; ')}`);

  const action = nextRecoveryAction(input.plan, input.attempts);
  if (action !== 'CREATE_TASK') return { status: action };

  const fingerprint = computeRecoveryFingerprint({
    source_work_id: input.sourceWorkId,
    recovery_id: input.plan.recovery_id,
    attempt: input.attempts,
    failure_class: input.plan.failure_class,
    namespace: input.namespace,
    run_id: input.runId,
  });

  const recoveryId = `RECOVERY-${input.plan.recovery_id}-${fingerprint}-${input.attempts}`;
  const lockKey = `${input.namespace}::${input.runId}::${fingerprint}`;
  const lockFile = path.join(os.tmpdir(), 'macro-recovery-locks', `${fingerprint}.lock`);

  return await withRecoveryLock(lockKey, async () => {
    const releaseFileLock = await acquireFileLock(lockFile);
    try {
      const allRecords = await input.queue.records(input.projectId);

      const existingActive = allRecords.find((item) => {
        if (item.state === 'DONE') return false;
        const sameRun = item.assignment?.run_id === input.runId || item.run_id === input.runId;
        const sameNs = item.assignment?.namespace === input.namespace || item.namespace === input.namespace;
        if (!sameRun || !sameNs) return false;
        return (
          item.backlog_id === `RECOVERY:${input.plan.recovery_id}:${fingerprint}` ||
          item.work_id === recoveryId
        );
      });

      if (existingActive) {
        const reviewId = `${existingActive.work_id}-REVIEW`;
        const hasReview = allRecords.some((item) => item.work_id === reviewId);
        if (!hasReview && input.plan.re_review_role) {
          const review = (
            await input.queue.createBatch([
              {
                work_id: reviewId,
                project_id: input.projectId,
                backlog_id: `RECOVERY:${input.plan.recovery_id}:${fingerprint}`,
                title: `Re-review: ${input.plan.re_review_trigger}`,
                role: input.plan.re_review_role,
                run_id: input.runId,
                namespace: input.namespace,
                depends_on: [existingActive.work_id],
              },
            ])
          )[0];
          if (input.handoffs) {
            await input.handoffs.record({
              project_id: input.projectId,
              work_id: review.work_id,
              from_role: input.plan.accountable_role,
              to_role: review.role,
              actor: 'coordinator',
              objective: review.title,
              context: ['recovery task completed', 're-review required'],
              evidence_ids: input.plan.required_evidence,
              acceptance_criteria: input.plan.acceptance_criteria,
            });
          }
        }
        return { status: 'DEDUPLICATED', task: existingActive, fingerprint };
      }

      const existingCompleted = allRecords.find((item) => {
        const sameRun = item.assignment?.run_id === input.runId || item.run_id === input.runId;
        const sameNs = item.assignment?.namespace === input.namespace || item.namespace === input.namespace;
        if (!sameRun || !sameNs) return false;
        return (
          item.backlog_id === `RECOVERY:${input.plan.recovery_id}:${fingerprint}` ||
          item.work_id === recoveryId
        );
      });

      if (existingCompleted) {
        return { status: 'DEDUPLICATED', task: existingCompleted, fingerprint };
      }

      const specs = [
        {
          work_id: recoveryId,
          project_id: input.projectId,
          backlog_id: `RECOVERY:${input.plan.recovery_id}:${fingerprint}`,
          title: `Recover: ${input.plan.root_cause}`,
          role: input.plan.accountable_role,
          run_id: input.runId,
          namespace: input.namespace,
          depends_on: [input.sourceWorkId],
          recovery_source_work_id: input.sourceWorkId,
        },
        ...(input.plan.re_review_role
          ? [
              {
                work_id: `${recoveryId}-REVIEW`,
                project_id: input.projectId,
                backlog_id: `RECOVERY:${input.plan.recovery_id}:${fingerprint}`,
                title: `Re-review: ${input.plan.re_review_trigger}`,
                role: input.plan.re_review_role,
                run_id: input.runId,
                namespace: input.namespace,
                depends_on: [recoveryId],
              },
            ]
          : []),
      ];

      const tasks = await input.queue.createBatch(specs);
      if (input.handoffs) {
        for (const task of tasks) {
          await input.handoffs.record({
            project_id: input.projectId,
            work_id: task.work_id,
            from_role: task.work_id.endsWith('-REVIEW') ? input.plan.accountable_role : 'ceo-guild',
            to_role: task.role,
            actor: 'coordinator',
            objective: task.title,
            context: ['CEO recovery plan'],
            evidence_ids: input.plan.required_evidence,
            acceptance_criteria: input.plan.acceptance_criteria,
          });
        }
      }

      return { status: 'CREATED', task: tasks[0], fingerprint };
    } finally {
      await releaseFileLock();
    }
  });
}
