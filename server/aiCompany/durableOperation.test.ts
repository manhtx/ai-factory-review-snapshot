import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DurableOperationLedger,
  classifyFailure,
  isNonTerminal,
} from './durableOperation';

describe('DurableOperationLedger and Failure Taxonomy', () => {
  let tmpDir: string;
  let ledger: DurableOperationLedger;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'durable-op-test-'));
    ledger = new DurableOperationLedger(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('Failure Taxonomy (Section 17)', () => {
    it('classifies quota exhaustion as AUTO_RECOVERABLE with backoff', () => {
      const res1 = classifyFailure(new Error('Error Individual quota reached.'));
      expect(res1.failure_class).toBe('RESOURCE_QUOTA_EXHAUSTED');
      expect(res1.disposition).toBe('AUTO_RECOVERABLE');
      expect(res1.retry_delay_ms).toBeGreaterThan(0);

      const res2 = classifyFailure(new Error('HTTP 429: resource_exhausted'));
      expect(res2.failure_class).toBe('RESOURCE_QUOTA_EXHAUSTED');
      expect(res2.disposition).toBe('AUTO_RECOVERABLE');
    });

    it('classifies runner crashes and phase timeouts as AUTO_RECOVERABLE', () => {
      const res1 = classifyFailure(new Error('role phase exceeded 120000ms; child terminated'));
      expect(res1.failure_class).toBe('RUNNER_CRASH');
      expect(res1.disposition).toBe('AUTO_RECOVERABLE');

      const res2 = classifyFailure(new Error('provider/role dispatch failed with exit=1'));
      expect(res2.failure_class).toBe('RUNNER_CRASH');
      expect(res2.disposition).toBe('AUTO_RECOVERABLE');
    });

    it('classifies authentication/permission failures as AUTHORITY_REQUIRED', () => {
      const resAuth = classifyFailure(new Error('Unauthenticated: invalid_grant'));
      expect(resAuth.failure_class).toBe('AUTHENTICATION_FAILURE');
      expect(resAuth.disposition).toBe('AUTHORITY_REQUIRED');

      const resPerm = classifyFailure(new Error('Operation not permitted (exit 126)'));
      expect(resPerm.failure_class).toBe('PERMISSION_FAILURE');
      expect(resPerm.disposition).toBe('AUTHORITY_REQUIRED');
    });

    it('classifies invalid requests as TERMINAL_OR_DEFECT', () => {
      const res = classifyFailure(new Error('invalid_request: bad schema payload'));
      expect(res.failure_class).toBe('INVALID_REQUEST');
      expect(res.disposition).toBe('TERMINAL_OR_DEFECT');
    });
  });

  describe('Durable Operation Lifecycle & Invariants (Section 16, 29, 31)', () => {
    it('creates a durable operation with proper initial invariants', async () => {
      const op = await ledger.createOperation({
        semantic_cycle_id: 'CYCLE-58',
        action_id: 'ACT-001',
        operation_semantic: 'Groom and groom backlog for Cycle 58',
      });

      expect(op.operation_id).toMatch(/^OP-/);
      expect(op.operation_state).toBe('SUBMITTED');
      expect(op.attempt_id).toMatch(/^ATT-/);
      expect(op.idempotency_key).toBeDefined();
      expect(op.recovery_attempt).toBe(0);
      expect(isNonTerminal(op.operation_state)).toBe(true);

      const fetched = await ledger.getById(op.operation_id);
      expect(fetched).toEqual(op);
    });

    it('transitions states cleanly and records last_committed_transition', async () => {
      const op = await ledger.createOperation({
        semantic_cycle_id: 'CYCLE-58',
        action_id: 'ACT-001',
        operation_semantic: 'Task dispatch',
      });

      const claimed = await ledger.transition(op.operation_id, 'CLAIMED', {
        owner: 'worker-pid-123',
      });
      expect(claimed.operation_state).toBe('CLAIMED');
      expect(claimed.owner).toBe('worker-pid-123');
      expect(claimed.last_committed_transition).toBe('SUBMITTED_TO_CLAIMED');

      const running = await ledger.transition(op.operation_id, 'RUNNING');
      expect(running.operation_state).toBe('RUNNING');
      expect(running.last_committed_transition).toBe('CLAIMED_TO_RUNNING');
    });

    it('records quota wait with WAITING_RESOURCE and zero cognition expectation', async () => {
      const op = await ledger.createOperation({
        semantic_cycle_id: 'CYCLE-58',
        action_id: 'ACT-001',
        operation_semantic: 'Task dispatch',
      });

      await ledger.transition(op.operation_id, 'RUNNING', { owner: 'worker-pid-123' });

      const waiting = await ledger.recordResourceWait(
        op.operation_id,
        new Error('Individual quota reached'),
        'checkpoint:step-4'
      );

      expect(waiting.operation_state).toBe('WAITING_RESOURCE');
      expect(waiting.failure_class).toBe('RESOURCE_QUOTA_EXHAUSTED');
      expect(waiting.recovery_attempt).toBe(1);
      expect(waiting.owner).toBeNull(); // Ephemeral owner released
      expect(waiting.checkpoint_reference).toBe('checkpoint:step-4');
      expect(waiting.next_wake_at).toBeDefined();
      expect(new Date(waiting.next_wake_at!).getTime()).toBeGreaterThan(Date.now());
    });

    it('enforces idempotency on DONE: at-most-one commit effect', async () => {
      const op = await ledger.createOperation({
        semantic_cycle_id: 'CYCLE-58',
        action_id: 'ACT-001',
        operation_semantic: 'Task dispatch',
      });

      const done1 = await ledger.transition(op.operation_id, 'DONE');
      expect(done1.operation_state).toBe('DONE');

      // Attempting to mark DONE again returns same state without duplicating commit
      const done2 = await ledger.transition(op.operation_id, 'DONE');
      expect(done2.operation_state).toBe('DONE');
      expect(done2.updated_at).toBe(done1.updated_at);
    });

    it('fences out stale executor attempts (Section 42 Negative Control N6)', async () => {
      const op = await ledger.createOperation({
        semantic_cycle_id: 'CYCLE-58',
        action_id: 'ACT-001',
        operation_semantic: 'Task dispatch',
      });

      const initialAttemptId = op.attempt_id;

      // Quota wait increments attempt_id
      const waiting = await ledger.recordResourceWait(
        op.operation_id,
        new Error('Individual quota reached')
      );
      expect(waiting.attempt_id).not.toBe(initialAttemptId);

      // A zombie/stale worker with initialAttemptId tries to transition
      await expect(
        ledger.transition(
          op.operation_id,
          'DONE',
          {},
          { expectedAttemptId: initialAttemptId }
        )
      ).rejects.toThrow(/STALE_EXECUTOR_FENCED/);
    });

    it('fences out stale lease revisions', async () => {
      const op = await ledger.createOperation({
        semantic_cycle_id: 'CYCLE-58',
        action_id: 'ACT-001',
        operation_semantic: 'Task dispatch',
        lease_revision: 2,
      });

      // Attempting to transition with stale expected lease revision 1
      await expect(
        ledger.transition(
          op.operation_id,
          'RUNNING',
          {},
          { expectedLeaseRevision: 1 }
        )
      ).rejects.toThrow(/STALE_LEASE_REVISION_FENCED/);
    });
  });

  describe('Boot Reconciliation & Orphan Invariant (Section 29, 31)', () => {
    it('detects and reconciles dead worker in RUNNING state for SAFE_RETRY operations', async () => {
      const op = await ledger.createOperation({
        semantic_cycle_id: 'CYCLE-58',
        action_id: 'ACT-001',
        operation_semantic: 'Dead worker scenario with SAFE_RETRY',
        recovery_contract: {
          effect_class: 'READ_ONLY',
          recovery_policy: 'SAFE_RETRY',
          retry_budget: 2,
        },
      });

      await ledger.transition(op.operation_id, 'RUNNING', { owner: 'dead-worker-pid-99999' });

      // Simulate boot reconciliation where isOwnerAlive returns false
      const report = await ledger.reconcileOrphans({
        now: new Date(),
        isOwnerAlive: () => false,
      });

      expect(report.orphaned_count).toBe(1);
      expect(report.reconciled[0].operation_id).toBe(op.operation_id);
      expect(report.reconciled[0].previous_state).toBe('RUNNING');
      expect(report.reconciled[0].new_state).toBe('RESUME_DUE');

      const updated = await ledger.getById(op.operation_id);
      expect(updated?.operation_state).toBe('RESUME_DUE');
      expect(updated?.owner).toBeNull();
    });

    it('fails closed to QUARANTINED when dead worker was running DO_NOT_AUTORETRY operation', async () => {
      const op = await ledger.createOperation({
        semantic_cycle_id: 'CYCLE-58',
        action_id: 'ACT-MUTATION',
        operation_semantic: 'Default unclassified mutation',
        // defaults to DO_NOT_AUTORETRY
      });

      await ledger.transition(op.operation_id, 'RUNNING', { owner: 'dead-worker-pid-99999' });

      const report = await ledger.reconcileOrphans({
        now: new Date(),
        isOwnerAlive: () => false,
      });

      expect(report.orphaned_count).toBe(1);
      expect(report.reconciled[0].new_state).toBe('QUARANTINED');

      const updated = await ledger.getById(op.operation_id);
      expect(updated?.operation_state).toBe('QUARANTINED');
      expect(updated?.wait_reason).toContain('worker_died_non_retryable_operation');
    });

    it('holds dead worker in OUTCOME_UNKNOWN when RECONCILE_BEFORE_RETRY is required', async () => {
      const op = await ledger.createOperation({
        semantic_cycle_id: 'CYCLE-58',
        action_id: 'ACT-MUTATION-RECONCILE',
        operation_semantic: 'Filesystem write needing reconciliation',
        recovery_contract: {
          effect_class: 'FILESYSTEM',
          recovery_policy: 'RECONCILE_BEFORE_RETRY',
          unknown_outcome_policy: 'RECONCILE',
          retry_budget: 1,
        },
      });

      await ledger.transition(op.operation_id, 'RUNNING', { owner: 'dead-worker-pid-99999' });

      const report = await ledger.reconcileOrphans({
        now: new Date(),
        isOwnerAlive: () => false,
      });

      expect(report.orphaned_count).toBe(1);
      expect(report.reconciled[0].new_state).toBe('OUTCOME_UNKNOWN');

      const updated = await ledger.getById(op.operation_id);
      expect(updated?.operation_state).toBe('OUTCOME_UNKNOWN');
    });

    it('reconciles WAITING_RESOURCE when wake timestamp has elapsed', async () => {
      const op = await ledger.createOperation({
        semantic_cycle_id: 'CYCLE-58',
        action_id: 'ACT-002',
        operation_semantic: 'Quota wake elapsed',
      });

      await ledger.recordResourceWait(op.operation_id, new Error('Individual quota reached'));

      // Forward time past wake
      const future = new Date(Date.now() + 20 * 60_000);
      const report = await ledger.reconcileOrphans({ now: future });

      expect(report.orphaned_count).toBe(1);
      expect(report.reconciled[0].new_state).toBe('RESUME_DUE');

      const updated = await ledger.getById(op.operation_id);
      expect(updated?.operation_state).toBe('RESUME_DUE');
    });

    it('does not touch WAITING_RESOURCE before wake time has elapsed', async () => {
      const op = await ledger.createOperation({
        semantic_cycle_id: 'CYCLE-58',
        action_id: 'ACT-003',
        operation_semantic: 'Quota wait pending',
      });

      await ledger.recordResourceWait(op.operation_id, new Error('Individual quota reached'));

      // Present time (not yet elapsed)
      const report = await ledger.reconcileOrphans({ now: new Date() });
      expect(report.orphaned_count).toBe(0);

      const current = await ledger.getById(op.operation_id);
      expect(current?.operation_state).toBe('WAITING_RESOURCE');
    });

    it('leaves terminal states (DONE, BLOCKED, QUARANTINED) alone', async () => {
      const opDone = await ledger.createOperation({
        semantic_cycle_id: 'CYCLE-58',
        action_id: 'ACT-004',
        operation_semantic: 'Done task',
      });
      await ledger.transition(opDone.operation_id, 'DONE');

      const opBlocked = await ledger.createOperation({
        semantic_cycle_id: 'CYCLE-58',
        action_id: 'ACT-005',
        operation_semantic: 'Authority blocked task',
      });
      await ledger.transition(opBlocked.operation_id, 'BLOCKED', {
        wait_reason: 'Requires Founder sign-off',
      });

      const report = await ledger.reconcileOrphans({
        now: new Date(Date.now() + 100_000),
        isOwnerAlive: () => false,
      });
      expect(report.orphaned_count).toBe(0);
    });

    it('does not reset OUTCOME_UNKNOWN during orphan reconciliation', async () => {
      const op = await ledger.createOperation({
        semantic_cycle_id: 'CYCLE-58',
        action_id: 'ACT-OUTCOME',
        operation_semantic: 'Ambiguous mutation state',
      });
      await ledger.recordOutcomeUnknown(op.operation_id, new Error('Crash during file write'));

      const report = await ledger.reconcileOrphans({
        now: new Date(Date.now() + 100_000),
        isOwnerAlive: () => false,
      });

      expect(report.orphaned_count).toBe(0);
      const fetched = await ledger.getById(op.operation_id);
      expect(fetched?.operation_state).toBe('OUTCOME_UNKNOWN');
    });
  });

  describe('Outcome Unknown Reconciliation Protocol', () => {
    it('transitions to DONE when EFFECT_CONFIRMED without duplicate mutation', async () => {
      const op = await ledger.createOperation({
        semantic_cycle_id: 'CYCLE-58',
        action_id: 'ACT-EFF-CONFIRM',
        operation_semantic: 'Git commit with crash before ack',
      });
      await ledger.recordOutcomeUnknown(op.operation_id, new Error('Connection reset before response'));

      const reconciled = await ledger.reconcileOutcomeUnknown(
        op.operation_id,
        'EFFECT_CONFIRMED',
        { checkpointRef: 'commit:abc1234', reason: 'git log confirmed commit exists' }
      );

      expect(reconciled.operation_state).toBe('DONE');
      expect(reconciled.checkpoint_reference).toBe('commit:abc1234');
      expect(reconciled.next_safe_transition).toBe('NONE');
    });

    it('transitions to RESUME_DUE when EFFECT_NOT_OBSERVED and retry budget remains', async () => {
      const op = await ledger.createOperation({
        semantic_cycle_id: 'CYCLE-58',
        action_id: 'ACT-EFF-NOT-OBS',
        operation_semantic: 'Filesystem write with crash before effect',
        recovery_contract: {
          effect_class: 'FILESYSTEM',
          recovery_policy: 'RECONCILE_BEFORE_RETRY',
          retry_budget: 1,
        },
      });
      await ledger.recordOutcomeUnknown(op.operation_id, new Error('Process killed'));

      const reconciled = await ledger.reconcileOutcomeUnknown(
        op.operation_id,
        'EFFECT_NOT_OBSERVED',
        { reason: 'Target file not present on disk' }
      );

      expect(reconciled.operation_state).toBe('RESUME_DUE');
      expect(reconciled.recovery_attempt).toBe(1);
      expect(reconciled.next_safe_transition).toBe('CLAIM');
    });

    it('fails closed to QUARANTINED when STILL_UNKNOWN', async () => {
      const op = await ledger.createOperation({
        semantic_cycle_id: 'CYCLE-58',
        action_id: 'ACT-STILL-UNK',
        operation_semantic: 'External API call timeout',
      });
      await ledger.recordOutcomeUnknown(op.operation_id, new Error('Timeout'));

      const reconciled = await ledger.reconcileOutcomeUnknown(
        op.operation_id,
        'STILL_UNKNOWN',
        { reason: 'External endpoint unreachable to verify receipt' }
      );

      expect(reconciled.operation_state).toBe('QUARANTINED');
      expect(reconciled.next_safe_transition).toBe('HUMAN_AUDIT');
    });
  });
});
