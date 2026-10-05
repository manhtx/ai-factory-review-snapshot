import { describe, it, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { RoleWorkQueue } from './roleWorkQueue';
import { coordinateRecovery, computeRecoveryFingerprint } from './recoveryCoordinator';
import type { RecoveryPlan } from './recoveryPlan';

describe('Recovery Fingerprint Deduplication (Phase 5)', () => {
  async function createTestEnv() {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'recovery-dedup-'));
    const queue = new RoleWorkQueue(dir);
    return { queue, dir };
  }

  it('proves recovery fingerprint is deterministic across identical recovery parameters', () => {
    const p1 = {
      source_work_id: 'WORK-1',
      recovery_id: 'REC-1',
      attempt: 0,
      failure_class: 'INSUFFICIENT_EVIDENCE',
      namespace: 'ns-macro',
      run_id: 'run-100',
    };
    const fp1 = computeRecoveryFingerprint(p1);
    const fp2 = computeRecoveryFingerprint(p1);
    expect(fp1).toBe(fp2);
    expect(fp1).toHaveLength(16);
  });

  it('deduplicates when wording in root_cause / title differs but recovery parameters match', async () => {
    const { queue, dir } = await createTestEnv();
    const runId = 'run-wording-1';
    const namespace = 'ns-wording-1';
    const sourceWorkId = 'WORK-SOURCE-1';

    await queue.createBatch([
      {
        work_id: sourceWorkId,
        project_id: 'macro-os',
        backlog_id: 'BACKLOG-SRC-1',
        title: 'Source task',
        role: 'backend-engineer',
        run_id: runId,
        namespace,
      },
    ]);

    const planA: RecoveryPlan = {
      recovery_id: 'REC-WORDING-1',
      source_decision_id: sourceWorkId,
      failure_class: 'INSUFFICIENT_EVIDENCE',
      root_cause: 'Wording A: missing provenance signature format marker',
      actions: ['Re-generate signature'],
      accountable_role: 'backend-engineer',
      re_review_role: 'quality-control',
      dependency_updates: [sourceWorkId],
      required_evidence: ['EVID:RETRY-A'],
      acceptance_criteria: ['Valid marker present'],
      retry_budget: 1,
      max_depth: 2,
      priority: 'P1',
      re_review_trigger: 'EVID:RETRY-A',
      terminal_if_failed: 'TERMINAL_HOLD',
    };

    const resA = await coordinateRecovery({
      queue,
      plan: planA,
      projectId: 'macro-os',
      runId,
      namespace,
      sourceWorkId,
      attempts: 0,
    });
    expect(resA.status).toBe('CREATED');

    // Second call with different root cause wording but SAME recovery parameters
    const planB: RecoveryPlan = {
      ...planA,
      root_cause: 'Wording B: entirely different phrasing for the exact same defect',
    };

    const resB = await coordinateRecovery({
      queue,
      plan: planB,
      projectId: 'macro-os',
      runId,
      namespace,
      sourceWorkId,
      attempts: 0,
    });
    expect(resB.status).toBe('DEDUPLICATED');
    expect(resB.task?.work_id).toBe(resA.task?.work_id);

    await rm(dir, { recursive: true, force: true });
  });

  it('does NOT deduplicate when failure_class differs even if title is identical', async () => {
    const { queue, dir } = await createTestEnv();
    const runId = 'run-diff-fail-1';
    const namespace = 'ns-diff-fail-1';
    const sourceWorkId = 'WORK-SRC-DIFF-1';

    await queue.createBatch([
      {
        work_id: sourceWorkId,
        project_id: 'macro-os',
        backlog_id: 'BACKLOG-SRC-DIFF-1',
        title: 'Source task',
        role: 'backend-engineer',
        run_id: runId,
        namespace,
      },
    ]);

    const basePlan: RecoveryPlan = {
      recovery_id: 'REC-DIFF-FAIL',
      source_decision_id: sourceWorkId,
      failure_class: 'INSUFFICIENT_EVIDENCE',
      root_cause: 'Identical root cause title',
      actions: ['Action 1'],
      accountable_role: 'backend-engineer',
      dependency_updates: [sourceWorkId],
      required_evidence: ['EVID:1'],
      acceptance_criteria: ['OK'],
      retry_budget: 1,
      priority: 'P1',
      re_review_trigger: 'EVID:1',
      terminal_if_failed: 'TERMINAL_HOLD',
    };

    const res1 = await coordinateRecovery({
      queue,
      plan: basePlan,
      projectId: 'macro-os',
      runId,
      namespace,
      sourceWorkId,
      attempts: 0,
    });
    expect(res1.status).toBe('CREATED');

    // Same title, but different failure_class
    const diffFailurePlan: RecoveryPlan = {
      ...basePlan,
      recovery_id: 'REC-DIFF-FAIL-2',
      failure_class: 'PROVIDER_TIMEOUT',
    };

    const res2 = await coordinateRecovery({
      queue,
      plan: diffFailurePlan,
      projectId: 'macro-os',
      runId,
      namespace,
      sourceWorkId,
      attempts: 0,
    });
    expect(res2.status).toBe('CREATED'); // Not deduplicated!

    await rm(dir, { recursive: true, force: true });
  });

  it('does NOT deduplicate when retry attempt differs', async () => {
    const { queue, dir } = await createTestEnv();
    const runId = 'run-retry-1';
    const namespace = 'ns-retry-1';
    const sourceWorkId = 'WORK-SRC-RETRY';

    await queue.createBatch([
      {
        work_id: sourceWorkId,
        project_id: 'macro-os',
        backlog_id: 'BACKLOG-RETRY',
        title: 'Source task',
        role: 'backend-engineer',
        run_id: runId,
        namespace,
      },
    ]);

    const plan: RecoveryPlan = {
      recovery_id: 'REC-RETRY-TEST',
      source_decision_id: sourceWorkId,
      failure_class: 'INSUFFICIENT_EVIDENCE',
      root_cause: 'Root cause',
      actions: ['Fix it'],
      accountable_role: 'backend-engineer',
      dependency_updates: [sourceWorkId],
      required_evidence: ['EVID:RETRY'],
      acceptance_criteria: ['OK'],
      retry_budget: 2,
      priority: 'P1',
      re_review_trigger: 'EVID:RETRY',
      terminal_if_failed: 'TERMINAL_HOLD',
    };

    const coderOutput: any = {
      role: 'backend-engineer',
      summary: 'Source attempt completed',
      evidence_ids: ['EVID:RETRY'],
    };

    // Complete source task first to resolve dependencies
    await queue.claim(sourceWorkId, 'worker:backend');
    await queue.submitForReview(sourceWorkId);
    await queue.complete(sourceWorkId, ['EVID:SRC-DONE'], undefined, undefined, coderOutput);

    const resAttempt0 = await coordinateRecovery({
      queue,
      plan,
      projectId: 'macro-os',
      runId,
      namespace,
      sourceWorkId,
      attempts: 0,
    });
    expect(resAttempt0.status).toBe('CREATED');

    // Mark attempt 0 as done to allow attempt 1
    await queue.claim(resAttempt0.task!.work_id, 'worker:backend');
    await queue.submitForReview(resAttempt0.task!.work_id);
    await queue.complete(
      resAttempt0.task!.work_id,
      ['EVID:DONE-0'],
      undefined,
      undefined,
      coderOutput
    );

    // Attempt 1 creates a new recovery task
    const resAttempt1 = await coordinateRecovery({
      queue,
      plan,
      projectId: 'macro-os',
      runId,
      namespace,
      sourceWorkId,
      attempts: 1,
    });
    expect(resAttempt1.status).toBe('CREATED');
    expect(resAttempt1.task?.work_id).toContain('-1');

    await rm(dir, { recursive: true, force: true });
  });

  it('does NOT deduplicate when namespace or run_id differs', async () => {
    const { queue, dir } = await createTestEnv();
    const sourceWorkId = 'WORK-SRC-ISO';

    await queue.createBatch([
      {
        work_id: sourceWorkId,
        project_id: 'macro-os',
        backlog_id: 'BACKLOG-ISO',
        title: 'Source task',
        role: 'backend-engineer',
        run_id: 'run-A',
        namespace: 'ns-A',
      },
    ]);

    const plan: RecoveryPlan = {
      recovery_id: 'REC-ISO-TEST',
      source_decision_id: sourceWorkId,
      failure_class: 'INSUFFICIENT_EVIDENCE',
      root_cause: 'Root cause',
      actions: ['Fix it'],
      accountable_role: 'backend-engineer',
      dependency_updates: [sourceWorkId],
      required_evidence: ['EVID:ISO'],
      acceptance_criteria: ['OK'],
      retry_budget: 1,
      priority: 'P1',
      re_review_trigger: 'EVID:ISO',
      terminal_if_failed: 'TERMINAL_HOLD',
    };

    const resA = await coordinateRecovery({
      queue,
      plan,
      projectId: 'macro-os',
      runId: 'run-A',
      namespace: 'ns-A',
      sourceWorkId,
      attempts: 0,
    });
    expect(resA.status).toBe('CREATED');

    // Different namespace
    const resDiffNs = await coordinateRecovery({
      queue,
      plan,
      projectId: 'macro-os',
      runId: 'run-A',
      namespace: 'ns-B',
      sourceWorkId,
      attempts: 0,
    });
    expect(resDiffNs.status).toBe('CREATED');

    // Different run_id
    const resDiffRun = await coordinateRecovery({
      queue,
      plan,
      projectId: 'macro-os',
      runId: 'run-B',
      namespace: 'ns-A',
      sourceWorkId,
      attempts: 0,
    });
    expect(resDiffRun.status).toBe('CREATED');

    await rm(dir, { recursive: true, force: true });
  });

  it('creates exactly one task under concurrent coordinateRecovery() race condition', async () => {
    const { queue, dir } = await createTestEnv();
    const runId = 'run-race-1';
    const namespace = 'ns-race-1';
    const sourceWorkId = 'WORK-SRC-RACE';

    await queue.createBatch([
      {
        work_id: sourceWorkId,
        project_id: 'macro-os',
        backlog_id: 'BACKLOG-RACE',
        title: 'Race source task',
        role: 'backend-engineer',
        run_id: runId,
        namespace,
      },
    ]);

    const plan: RecoveryPlan = {
      recovery_id: 'REC-RACE-TEST',
      source_decision_id: sourceWorkId,
      failure_class: 'INSUFFICIENT_EVIDENCE',
      root_cause: 'Concurrent race failure',
      actions: ['Fix concurrently'],
      accountable_role: 'backend-engineer',
      re_review_role: 'quality-control',
      dependency_updates: [sourceWorkId],
      required_evidence: ['EVID:RACE'],
      acceptance_criteria: ['OK'],
      retry_budget: 1,
      priority: 'P1',
      re_review_trigger: 'EVID:RACE',
      terminal_if_failed: 'TERMINAL_HOLD',
    };

    // Run 5 simultaneous coordinateRecovery calls with identical parameters
    const promises = Array.from({ length: 5 }, () =>
      coordinateRecovery({
        queue,
        plan,
        projectId: 'macro-os',
        runId,
        namespace,
        sourceWorkId,
        attempts: 0,
      })
    );

    const results = await Promise.all(promises);

    const created = results.filter((r) => r.status === 'CREATED');
    const deduplicated = results.filter((r) => r.status === 'DEDUPLICATED');

    // Exactly one call created the task, the other 4 deduplicated atomically
    expect(created).toHaveLength(1);
    expect(deduplicated).toHaveLength(4);

    const allTasks = await queue.records('macro-os');
    const recoveryTasks = allTasks.filter((t) => t.backlog_id.startsWith('RECOVERY:REC-RACE-TEST:'));
    // 1 implementation task + 1 re-review task
    expect(recoveryTasks).toHaveLength(2);

    await rm(dir, { recursive: true, force: true });
  });

  it('recovers from stale lockfile left by crashed process', async () => {
    const { queue, dir } = await createTestEnv();
    const runId = 'run-crash-1';
    const namespace = 'ns-crash-1';
    const sourceWorkId = 'WORK-SRC-CRASH';

    await queue.createBatch([
      {
        work_id: sourceWorkId,
        project_id: 'macro-os',
        backlog_id: 'BACKLOG-CRASH',
        title: 'Crash source task',
        role: 'backend-engineer',
        run_id: runId,
        namespace,
      },
    ]);

    const plan: RecoveryPlan = {
      recovery_id: 'REC-CRASH-TEST',
      source_decision_id: sourceWorkId,
      failure_class: 'PROVIDER_TIMEOUT',
      root_cause: 'Crash failure',
      actions: ['Recover from crash'],
      accountable_role: 'backend-engineer',
      dependency_updates: [sourceWorkId],
      required_evidence: ['EVID:CRASH'],
      acceptance_criteria: ['OK'],
      retry_budget: 1,
      priority: 'P1',
      re_review_trigger: 'EVID:CRASH',
      terminal_if_failed: 'TERMINAL_HOLD',
    };

    const fingerprint = computeRecoveryFingerprint({
      source_work_id: sourceWorkId,
      recovery_id: plan.recovery_id,
      attempt: 0,
      failure_class: plan.failure_class,
      namespace,
      run_id: runId,
    });

    // Simulate stale lockfile from crashed process (mtime 5 seconds in the past)
    const { mkdir, writeFile, utimes } = await import('node:fs/promises');
    const lockDir = path.join(os.tmpdir(), 'macro-recovery-locks');
    await mkdir(lockDir, { recursive: true });
    const lockFile = path.join(lockDir, `${fingerprint}.lock`);
    await writeFile(lockFile, JSON.stringify({ pid: 999999, time: Date.now() - 5000 }));
    const past = (Date.now() - 5000) / 1000;
    await utimes(lockFile, past, past);

    // Call coordinateRecovery - it should detect stale lock, break it, and successfully create task
    const res = await coordinateRecovery({
      queue,
      plan,
      projectId: 'macro-os',
      runId,
      namespace,
      sourceWorkId,
      attempts: 0,
    });

    expect(res.status).toBe('CREATED');
    expect(res.task).toBeDefined();

    await rm(dir, { recursive: true, force: true });
  });
});
