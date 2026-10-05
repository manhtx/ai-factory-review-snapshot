/**
 * quotaPause.test.ts — Tests B through G + runtime drill (Section 21)
 *
 * All tests use fake clock / injected state / simulated quota conditions.
 * No real 5-hour wait. No real AI provider calls.
 */

import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  computeRetryDelayMs,
  isReadyToRetry,
  QuotaPauseLedger,
  type QuotaPauseCheckpoint,
} from './quotaPause';

async function tmpLedger(): Promise<QuotaPauseLedger> {
  const dir = await mkdtemp(join(tmpdir(), 'ai-company-quota-'));
  return new QuotaPauseLedger(dir);
}

// ─── TEST B — quota does not create fake terminal state ───────────────────────
describe('TEST B: quota exhaustion does not create fake terminal state', () => {
  it('recordQuotaPause always sets status=WAITING_RESOURCE, never FAILED/DONE/WIN/LOSS', async () => {
    const ledger = await tmpLedger();
    const checkpoint = await ledger.recordQuotaPause({
      host: 'ANTIGRAVITY',
      next_safe_action: 'CONTINUE_EPOCH_M2_DEEP_LEARNING',
      sprint_id: 'SPRINT:MARATHON-M1-S1',
      cycle_id: 'codex-product-cycle-1789454520740',
    });

    expect(checkpoint.status).toBe('WAITING_RESOURCE');
    expect(checkpoint.reason).toBe('HOST_AI_QUOTA');
    // Hard invariants — none of the fake terminal states
    expect((checkpoint as unknown as Record<string, unknown>).status).not.toBe('FAILED');
    expect((checkpoint as unknown as Record<string, unknown>).status).not.toBe('DONE');
    expect((checkpoint as unknown as Record<string, unknown>).status).not.toBe('WIN');
    expect((checkpoint as unknown as Record<string, unknown>).status).not.toBe('LOSS');
  });

  it('loadQuotaPause returns null for a corrupt file with wrong status', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-company-quota-bad-'));
    const { writeFile } = await import('node:fs/promises');
    await writeFile(
      join(dir, 'quota-pause.json'),
      JSON.stringify({ status: 'FAILED', reason: 'HOST_AI_QUOTA' }),
      'utf8',
    );
    const ledger = new QuotaPauseLedger(dir);
    const result = await ledger.loadQuotaPause();
    expect(result).toBeNull();
  });
});

// ─── TEST C — checkpoint ──────────────────────────────────────────────────────
describe('TEST C: checkpoint contains required continuation information', () => {
  it('checkpoint written to disk contains all fields needed for continuation', async () => {
    const ledger = await tmpLedger();
    const retryAt = new Date(Date.now() + 30 * 60_000).toISOString();
    const checkpoint = await ledger.recordQuotaPause({
      host: 'CODEX',
      sprint_id: 'SPRINT:MARATHON-M2-S1',
      backlog_item_id: 'BACKLOG-VN-MARKET-REAL-ESTATE-FRESHNESS',
      cycle_id: 'codex-product-cycle-1789454520740',
      task_id: 'TASK-QA-001',
      stage_id: 'STAGE-IMPLEMENTATION',
      last_safe_checkpoint: '2026-09-15T06:20:00.000Z',
      next_safe_action: 'RECONCILE_IMPLEMENTATION',
      retry_not_before: retryAt,
      retry_time_source: 'PARSED_MESSAGE',
    });

    // Must contain enough information to identify current work
    expect(checkpoint.sprint_id).toBe('SPRINT:MARATHON-M2-S1');
    expect(checkpoint.backlog_item_id).toBe('BACKLOG-VN-MARKET-REAL-ESTATE-FRESHNESS');
    expect(checkpoint.cycle_id).toBe('codex-product-cycle-1789454520740');
    expect(checkpoint.task_id).toBe('TASK-QA-001');
    expect(checkpoint.stage_id).toBe('STAGE-IMPLEMENTATION');
    expect(checkpoint.next_safe_action).toBe('RECONCILE_IMPLEMENTATION');
    expect(checkpoint.retry_not_before).toBe(retryAt);
    expect(checkpoint.retry_time_source).toBe('PARSED_MESSAGE');
    expect(checkpoint.last_safe_checkpoint).toBe('2026-09-15T06:20:00.000Z');
    expect(checkpoint.host).toBe('CODEX');
    expect(checkpoint.resume_attempt_count).toBe(0);
    expect(checkpoint.detected_at).toBeTruthy();
    expect(checkpoint.updated_at).toBeTruthy();
  });

  it('checkpoint file is readable (cross-host state reconstruction works)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-company-quota-xhost-'));
    const ledger = new QuotaPauseLedger(dir);
    await ledger.recordQuotaPause({
      host: 'ANTIGRAVITY',
      next_safe_action: 'CONTINUE_EPOCH_M2_DEEP_LEARNING',
    });

    // Any host can read the file without Antigravity session state
    const raw = await readFile(join(dir, 'quota-pause.json'), 'utf8');
    const parsed = JSON.parse(raw) as QuotaPauseCheckpoint;
    expect(parsed.status).toBe('WAITING_RESOURCE');
    expect(parsed.next_safe_action).toBe('CONTINUE_EPOCH_M2_DEEP_LEARNING');
  });
});

// ─── TEST D — resume same host ────────────────────────────────────────────────
describe('TEST D: resume on same host — reconciliation occurs, no repeated work', () => {
  it('reconcileOnResume returns ADVANCE when task is already DONE', async () => {
    const ledger = await tmpLedger();
    const checkpoint = await ledger.recordQuotaPause({
      host: 'ANTIGRAVITY',
      task_id: 'TASK-IMPL-001',
      next_safe_action: 'RUN_QA',
    });

    // Simulate: quota returns, task was already completed before checkpoint was saved
    const decision = QuotaPauseLedger.reconcileOnResume({
      checkpoint,
      confirmedDoneWorkIds: ['TASK-IMPL-001'],
    });
    expect(decision).toBe('ADVANCE');
  });

  it('reconcileOnResume returns RECONCILE when interrupted mid-stage', async () => {
    const ledger = await tmpLedger();
    const checkpoint = await ledger.recordQuotaPause({
      host: 'ANTIGRAVITY',
      task_id: 'TASK-IMPL-001',
      stage_id: 'STAGE-IMPLEMENTATION',
      next_safe_action: 'RECONCILE_IMPLEMENTATION',
    });

    // task not done, stage not done
    const decision = QuotaPauseLedger.reconcileOnResume({
      checkpoint,
      confirmedDoneWorkIds: [],
    });
    expect(decision).toBe('RECONCILE');
  });

  it('clearQuotaPause removes checkpoint after successful resume', async () => {
    const ledger = await tmpLedger();
    await ledger.recordQuotaPause({ host: 'ANTIGRAVITY', next_safe_action: 'RUN_QA' });
    expect(await ledger.loadQuotaPause()).not.toBeNull();

    await ledger.clearQuotaPause();
    expect(await ledger.loadQuotaPause()).toBeNull();
  });

  it('clearQuotaPause is idempotent when no checkpoint exists', async () => {
    const ledger = await tmpLedger();
    await expect(ledger.clearQuotaPause()).resolves.not.toThrow();
    await expect(ledger.clearQuotaPause()).resolves.not.toThrow();
  });
});

// ─── TEST E — cross-host state reconstruction ─────────────────────────────────
describe('TEST E: cross-host canonical state reconstruction', () => {
  it('checkpoint written by ANTIGRAVITY is loadable by CODEX context without session history', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-company-quota-antigravity-'));
    const antigravityLedger = new QuotaPauseLedger(dir);
    await antigravityLedger.recordQuotaPause({
      host: 'ANTIGRAVITY',
      sprint_id: 'SPRINT:MARATHON-M2-S1',
      cycle_id: 'codex-product-cycle-1789454520740',
      task_id: 'TASK-WATCHLIST-UI',
      next_safe_action: 'CONTINUE_EPOCH_M2_DEEP_LEARNING',
      last_safe_checkpoint: '2026-09-15T06:45:08.351Z',
    });

    // Simulate: new Codex session opens the same state dir
    const codexLedger = new QuotaPauseLedger(dir);
    const checkpoint = await codexLedger.loadQuotaPause();

    expect(checkpoint).not.toBeNull();
    expect(checkpoint!.status).toBe('WAITING_RESOURCE');
    expect(checkpoint!.host).toBe('ANTIGRAVITY'); // preserves original host
    expect(checkpoint!.sprint_id).toBe('SPRINT:MARATHON-M2-S1');
    expect(checkpoint!.next_safe_action).toBe('CONTINUE_EPOCH_M2_DEEP_LEARNING');
    // Codex can reconstruct without needing Antigravity conversation history
  });

  it('checkpoint written by CODEX is loadable by ANTIGRAVITY context', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-company-quota-codex-'));
    const codexLedger = new QuotaPauseLedger(dir);
    await codexLedger.recordQuotaPause({
      host: 'CODEX',
      task_id: 'TASK-BACKEND-API',
      next_safe_action: 'RUN_QA',
    });

    const antigravityLedger = new QuotaPauseLedger(dir);
    const checkpoint = await antigravityLedger.loadQuotaPause();
    expect(checkpoint).not.toBeNull();
    expect(checkpoint!.host).toBe('CODEX');
    expect(checkpoint!.task_id).toBe('TASK-BACKEND-API');
    expect(checkpoint!.next_safe_action).toBe('RUN_QA');
  });
});

// ─── TEST F — premature retry ─────────────────────────────────────────────────
describe('TEST F: premature retry returns to WAITING_RESOURCE with bounded attempt count', () => {
  it('isReadyToRetry returns false before retry_not_before', () => {
    const checkpoint: QuotaPauseCheckpoint = {
      status: 'WAITING_RESOURCE',
      reason: 'HOST_AI_QUOTA',
      host: 'ANTIGRAVITY',
      detected_at: new Date().toISOString(),
      retry_not_before: new Date(Date.now() + 2 * 60 * 60_000).toISOString(), // 2 hours from now
      retry_time_source: 'PROVIDER_REPORTED',
      sprint_id: null,
      backlog_item_id: null,
      cycle_id: null,
      task_id: null,
      stage_id: null,
      last_safe_checkpoint: null,
      next_safe_action: 'CONTINUE_EPOCH_M2_DEEP_LEARNING',
      resume_attempt_count: 0,
      updated_at: new Date().toISOString(),
    };

    expect(isReadyToRetry(checkpoint, new Date())).toBe(false);
    // Even 1 hour later — still not ready
    expect(isReadyToRetry(checkpoint, new Date(Date.now() + 60 * 60_000))).toBe(false);
  });

  it('isReadyToRetry returns true after retry_not_before', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const checkpoint: QuotaPauseCheckpoint = {
      status: 'WAITING_RESOURCE',
      reason: 'HOST_AI_QUOTA',
      host: 'ANTIGRAVITY',
      detected_at: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
      retry_not_before: past,
      retry_time_source: 'PROVIDER_REPORTED',
      sprint_id: null,
      backlog_item_id: null,
      cycle_id: null,
      task_id: null,
      stage_id: null,
      last_safe_checkpoint: null,
      next_safe_action: 'CONTINUE_EPOCH_M2_DEEP_LEARNING',
      resume_attempt_count: 1,
      updated_at: new Date().toISOString(),
    };
    expect(isReadyToRetry(checkpoint, new Date())).toBe(true);
  });

  it('resume_attempt_count increments on repeated recordQuotaPause (bounded)', async () => {
    const ledger = await tmpLedger();
    // Initial quota pause
    let cp = await ledger.recordQuotaPause({ host: 'ANTIGRAVITY', next_safe_action: 'RUN_QA' });
    expect(cp.resume_attempt_count).toBe(0);

    // Retry still fails — quota still unavailable
    cp = await ledger.recordQuotaPause({ host: 'ANTIGRAVITY', next_safe_action: 'RUN_QA' });
    expect(cp.resume_attempt_count).toBe(1);

    cp = await ledger.recordQuotaPause({ host: 'ANTIGRAVITY', next_safe_action: 'RUN_QA' });
    expect(cp.resume_attempt_count).toBe(2);
  });

  it('resume_attempt_count is bounded at MAX_RESUME_ATTEMPTS (5)', async () => {
    const ledger = await tmpLedger();
    // Call 7 times; count must be capped at 5
    for (let i = 0; i < 7; i++) {
      await ledger.recordQuotaPause({ host: 'ANTIGRAVITY', next_safe_action: 'RUN_QA' });
    }
    const checkpoint = await ledger.loadQuotaPause();
    expect(checkpoint!.resume_attempt_count).toBeLessThanOrEqual(5);
  });

  it('detected_at is preserved across multiple recordQuotaPause calls', async () => {
    const ledger = await tmpLedger();
    const first = await ledger.recordQuotaPause({ host: 'ANTIGRAVITY', next_safe_action: 'RUN_QA' });
    await new Promise((resolve) => setTimeout(resolve, 20)); // brief pause
    const second = await ledger.recordQuotaPause({ host: 'ANTIGRAVITY', next_safe_action: 'RUN_QA' });
    // detected_at must be stable (original detection time preserved)
    expect(second.detected_at).toBe(first.detected_at);
  });

  it('computeRetryDelayMs is bounded and follows 15/30/60 min steps', () => {
    // No jitter for deterministic test
    expect(computeRetryDelayMs(0, 0)).toBe(15 * 60_000);
    expect(computeRetryDelayMs(1, 0)).toBe(30 * 60_000);
    expect(computeRetryDelayMs(2, 0)).toBe(60 * 60_000);
    // Ceiling: never exceeds 60 minutes (ignoring jitter)
    expect(computeRetryDelayMs(10, 0)).toBe(60 * 60_000);
    expect(computeRetryDelayMs(100, 0)).toBe(60 * 60_000);
  });
});

// ─── TEST G — duplicate mutation protection ───────────────────────────────────
describe('TEST G: duplicate mutation protection on resume', () => {
  it('reconcileOnResume returns ADVANCE (not RESUME) when task_id is in confirmedDoneWorkIds', async () => {
    const ledger = await tmpLedger();
    const checkpoint = await ledger.recordQuotaPause({
      host: 'ANTIGRAVITY',
      task_id: 'TASK-IMPL-WATCHLIST',
      stage_id: 'STAGE-IMPLEMENTATION',
      next_safe_action: 'RUN_QA',
    });

    // Simulate: implementation files were already changed and task completed
    // before the quota error was captured in state
    const decision = QuotaPauseLedger.reconcileOnResume({
      checkpoint,
      confirmedDoneWorkIds: ['TASK-IMPL-WATCHLIST'],
    });
    // Must NOT repeat the implementation
    expect(decision).toBe('ADVANCE');
  });

  it('reconcileOnResume returns RESUME when neither task nor stage is done', async () => {
    const ledger = await tmpLedger();
    const checkpoint = await ledger.recordQuotaPause({
      host: 'CODEX',
      next_safe_action: 'CONTINUE_EPOCH_M2_DEEP_LEARNING',
    });

    const decision = QuotaPauseLedger.reconcileOnResume({
      checkpoint,
      confirmedDoneWorkIds: [],
    });
    expect(decision).toBe('RESUME');
  });

  it('reconcileOnResume returns RECONCILE when stage_id is present but not done', async () => {
    const ledger = await tmpLedger();
    const checkpoint = await ledger.recordQuotaPause({
      host: 'ANTIGRAVITY',
      stage_id: 'STAGE-QA-RUN',
      task_id: 'TASK-IMPL-PROVENANCE',
      next_safe_action: 'RECONCILE_QA',
    });

    const decision = QuotaPauseLedger.reconcileOnResume({
      checkpoint,
      confirmedDoneWorkIds: [], // nothing confirmed done
    });
    // Stage is present but unknown state — must reconcile before acting
    expect(decision).toBe('RECONCILE');
  });
});

// ─── SECTION 21: BOUNDED RUNTIME DRILL ───────────────────────────────────────
describe('SECTION 21: Bounded runtime drill (simulated quota flow)', () => {
  it('complete quota pause -> WAITING_RESOURCE -> retry window -> reconcile -> clear flow', async () => {
    const ledger = await tmpLedger();

    // Step 1: Active AI Company work — inject quota exhaustion
    const pausedAt = new Date();
    const retryWindow = new Date(pausedAt.getTime() + 100); // 100ms for test speed

    const checkpoint = await ledger.recordQuotaPause({
      host: 'ANTIGRAVITY',
      sprint_id: 'SPRINT:MARATHON-M2-S1',
      cycle_id: 'codex-product-cycle-1789454520740',
      task_id: 'TASK-DRILL-001',
      stage_id: 'STAGE-IMPLEMENTATION',
      last_safe_checkpoint: pausedAt.toISOString(),
      next_safe_action: 'RECONCILE_IMPLEMENTATION',
      retry_not_before: retryWindow.toISOString(),
      retry_time_source: 'PARSED_MESSAGE',
    });

    // Verify: WAITING_RESOURCE written, not FAILED/DONE/WIN
    expect(checkpoint.status).toBe('WAITING_RESOURCE');
    expect(checkpoint.resume_attempt_count).toBe(0);

    // Step 2: Before retry window — not ready
    expect(isReadyToRetry(checkpoint, new Date(pausedAt.getTime() - 1))).toBe(false);

    // Step 3: Simulate retry window reached
    await new Promise((resolve) => setTimeout(resolve, 110)); // wait past retry window
    expect(isReadyToRetry(checkpoint, new Date())).toBe(true);

    // Step 4: Reconcile — simulate quota still unavailable (premature retry)
    const afterPrematureRetry = await ledger.recordQuotaPause({
      host: 'ANTIGRAVITY',
      sprint_id: checkpoint.sprint_id,
      cycle_id: checkpoint.cycle_id,
      task_id: checkpoint.task_id,
      stage_id: checkpoint.stage_id,
      next_safe_action: checkpoint.next_safe_action,
      retry_not_before: new Date(Date.now() + 60_000).toISOString(), // push window forward
      retry_time_source: 'ESTIMATED',
    });
    expect(afterPrematureRetry.status).toBe('WAITING_RESOURCE'); // still WAITING_RESOURCE
    expect(afterPrematureRetry.resume_attempt_count).toBe(1); // incremented
    expect(afterPrematureRetry.detected_at).toBe(checkpoint.detected_at); // preserved

    // Step 5: Quota returns — reconcile workspace state
    // Simulate: the implementation completed before quota hit (files exist)
    const reconcileDecision = QuotaPauseLedger.reconcileOnResume({
      checkpoint: afterPrematureRetry,
      confirmedDoneWorkIds: ['TASK-DRILL-001'], // task was already done
    });
    expect(reconcileDecision).toBe('ADVANCE'); // no duplicate work

    // Step 6: Continue from next_safe_action — load checkpoint for continuation context
    const loaded = await ledger.loadQuotaPause();
    expect(loaded!.next_safe_action).toBe('RECONCILE_IMPLEMENTATION');

    // Step 7: Clear checkpoint after successful resume
    await ledger.clearQuotaPause();
    expect(await ledger.loadQuotaPause()).toBeNull();

    // VERIFICATION:
    // lost state: 0 (all state was in quota-pause.json)
    // duplicate work: 0 (reconcileOnResume returned ADVANCE)
    // fake WIN/DONE: 0 (status was always WAITING_RESOURCE)
    // fake FAILED: 0 (status was always WAITING_RESOURCE)
    // unbounded retry: 0 (computeRetryDelayMs is bounded 15/30/60 min)
    // Founder recovery: 0 (entire flow is automatic from canonical state)
  });
});
