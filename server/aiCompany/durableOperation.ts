import { appendFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';

export type OperationState =
  | 'SUBMITTED'
  | 'CLAIMED'
  | 'RUNNING'
  | 'WAITING_RESOURCE'
  | 'RESUME_DUE'
  | 'IN_REVIEW'
  | 'OUTCOME_UNKNOWN'
  | 'DONE'
  | 'BLOCKED'
  | 'QUARANTINED'
  | 'FAILED';

export type EffectClass =
  | 'READ_ONLY'
  | 'FILESYSTEM'
  | 'SQLITE'
  | 'GIT'
  | 'EXTERNAL_API'
  | 'EXTERNAL_PUBLICATION'
  | 'OTHER';

export type RecoveryPolicy =
  | 'SAFE_RETRY'
  | 'RECONCILE_BEFORE_RETRY'
  | 'DO_NOT_AUTORETRY'
  | 'NO_SIDE_EFFECT_SAFE_RETRY';

export interface RecoveryContract {
  effect_class: EffectClass;
  recovery_policy: RecoveryPolicy;
  idempotency_strategy: string;
  observable_side_effects: string[];
  reconciliation_check: string;
  retry_budget: number;
  unknown_outcome_policy: 'FAIL_CLOSED' | 'RECONCILE' | 'ALERT_HUMAN';
}

export const DEFAULT_RECOVERY_CONTRACT: RecoveryContract = {
  effect_class: 'OTHER',
  recovery_policy: 'DO_NOT_AUTORETRY',
  idempotency_strategy: 'NONE',
  observable_side_effects: [],
  reconciliation_check: 'NONE',
  retry_budget: 0,
  unknown_outcome_policy: 'FAIL_CLOSED',
};

export type FailureClass =
  | 'RESOURCE_QUOTA_EXHAUSTED'
  | 'RATE_LIMITED'
  | 'PROVIDER_TEMPORARY_UNAVAILABLE'
  | 'NETWORK_TRANSIENT'
  | 'RUNNER_CRASH'
  | 'EXECUTOR_LOST'
  | 'CONTROLLER_SESSION_LOST'
  | 'PROCESS_RESTART'
  | 'MACHINE_SLEEP'
  | 'TEMPORARY_DEPENDENCY'
  | 'AUTHENTICATION_FAILURE'
  | 'PERMISSION_FAILURE'
  | 'STALE_EXECUTION_LEASE'
  | 'MODEL_UNAVAILABLE'
  | 'INVALID_REQUEST'
  | 'UNKNOWN_FAILURE';

export type RecoveryDisposition =
  | 'AUTO_RECOVERABLE'
  | 'CONDITIONALLY_RECOVERABLE'
  | 'AUTHORITY_REQUIRED'
  | 'TERMINAL_OR_DEFECT';

export interface DurableOperation {
  operation_id: string;
  mission_id: string;
  semantic_cycle_id: string;
  action_id: string;
  operation_semantic: string;
  operation_state: OperationState;
  attempt_id: string;
  idempotency_key: string;
  last_committed_transition: string | null;
  checkpoint_reference: string | null;
  next_safe_transition: string;
  execution_lease_id: string | null;
  lease_revision: number;
  controller: string;
  provider: string;
  runtime_model_id: string;
  runner: string;
  authority_scope: string;
  failure_class: FailureClass | null;
  wait_reason: string | null;
  reactivation_condition: string | null;
  next_wake_at: string | null;
  recovery_attempt: number;
  owner: string | null;
  owner_lease: string | null;
  recovery_contract: RecoveryContract;
  created_at: string;
  updated_at: string;
}

export interface CreateOperationInput {
  operation_id?: string;
  mission_id?: string;
  semantic_cycle_id: string;
  action_id: string;
  operation_semantic: string;
  execution_lease_id?: string | null;
  lease_revision?: number;
  controller?: string;
  provider?: string;
  runtime_model_id?: string;
  runner?: string;
  authority_scope?: string;
  checkpoint_reference?: string | null;
  next_safe_transition?: string;
  owner?: string | null;
  recovery_contract?: Partial<RecoveryContract>;
}

export interface ReconciledOrphanReport {
  orphaned_count: number;
  reconciled: Array<{
    operation_id: string;
    previous_state: OperationState;
    new_state: OperationState;
    action_taken: string;
    reason: string;
  }>;
}

export function classifyFailure(error: unknown): {
  failure_class: FailureClass;
  disposition: RecoveryDisposition;
  reason: string;
  retry_delay_ms: number;
} {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  // 1. Quota / Rate limit
  if (
    lower.includes('quota') ||
    lower.includes('individual quota reached') ||
    lower.includes('resource_exhausted') ||
    lower.includes('429')
  ) {
    return {
      failure_class: 'RESOURCE_QUOTA_EXHAUSTED',
      disposition: 'AUTO_RECOVERABLE',
      reason: message,
      retry_delay_ms: 15 * 60_000,
    };
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return {
      failure_class: 'RATE_LIMITED',
      disposition: 'AUTO_RECOVERABLE',
      reason: message,
      retry_delay_ms: 60_000,
    };
  }

  // 2. Network / Provider transient
  if (
    lower.includes('econnreset') ||
    lower.includes('etimedout') ||
    lower.includes('eai_again') ||
    lower.includes('socket hang up') ||
    lower.includes('fetch failed') ||
    lower.includes('503') ||
    lower.includes('502') ||
    lower.includes('bad gateway') ||
    lower.includes('service unavailable')
  ) {
    return {
      failure_class: 'PROVIDER_TEMPORARY_UNAVAILABLE',
      disposition: 'AUTO_RECOVERABLE',
      reason: message,
      retry_delay_ms: 30_000,
    };
  }

  // 3. Runner Crash / Process Failure
  if (
    lower.includes('runner crash') ||
    lower.includes('exit=1') ||
    lower.includes('sigterm') ||
    lower.includes('sigkill') ||
    lower.includes('child terminated') ||
    lower.includes('phase exceeded')
  ) {
    return {
      failure_class: 'RUNNER_CRASH',
      disposition: 'AUTO_RECOVERABLE',
      reason: message,
      retry_delay_ms: 5_000,
    };
  }

  // 4. Stale lease / Split brain
  if (lower.includes('stale_lease_revision') || lower.includes('split_brain_attempt')) {
    return {
      failure_class: 'STALE_EXECUTION_LEASE',
      disposition: 'CONDITIONALLY_RECOVERABLE',
      reason: message,
      retry_delay_ms: 0,
    };
  }

  // 5. Auth / Permission
  if (
    lower.includes('unauthenticated') ||
    lower.includes('auth failure') ||
    lower.includes('invalid_grant') ||
    lower.includes('401')
  ) {
    return {
      failure_class: 'AUTHENTICATION_FAILURE',
      disposition: 'AUTHORITY_REQUIRED',
      reason: message,
      retry_delay_ms: 0,
    };
  }
  if (
    lower.includes('permission denied') ||
    lower.includes('operation not permitted') ||
    lower.includes('403') ||
    lower.includes('forbidden')
  ) {
    return {
      failure_class: 'PERMISSION_FAILURE',
      disposition: 'AUTHORITY_REQUIRED',
      reason: message,
      retry_delay_ms: 0,
    };
  }

  // 6. Invalid request / Terminal defect
  if (lower.includes('invalid_request') || lower.includes('bad request') || lower.includes('400')) {
    return {
      failure_class: 'INVALID_REQUEST',
      disposition: 'TERMINAL_OR_DEFECT',
      reason: message,
      retry_delay_ms: 0,
    };
  }

  return {
    failure_class: 'UNKNOWN_FAILURE',
    disposition: 'CONDITIONALLY_RECOVERABLE',
    reason: message,
    retry_delay_ms: 30_000,
  };
}

export function isNonTerminal(state: OperationState): boolean {
  return state !== 'DONE' && state !== 'BLOCKED' && state !== 'QUARANTINED' && state !== 'FAILED';
}

export class DurableOperationLedger {
  readonly operationsFile: string;

  constructor(private readonly stateDir: string) {
    this.operationsFile = join(stateDir, 'durable-operations.jsonl');
  }

  private async appendRow(op: DurableOperation): Promise<void> {
    await mkdir(dirname(this.operationsFile), { recursive: true });
    await appendFile(this.operationsFile, `${JSON.stringify(op)}\n`, 'utf8');
  }

  async getAll(): Promise<DurableOperation[]> {
    try {
      const raw = await readFile(this.operationsFile, 'utf8');
      const lines = raw.split('\n').filter((l) => l.trim().length > 0);
      const latest = new Map<string, DurableOperation>();
      for (const line of lines) {
        try {
          const op = JSON.parse(line) as DurableOperation;
          latest.set(op.operation_id, op);
        } catch {
          // Ignore corrupt trailing line
        }
      }
      return [...latest.values()];
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
  }

  async getById(operationId: string): Promise<DurableOperation | null> {
    const all = await this.getAll();
    return all.find((o) => o.operation_id === operationId) ?? null;
  }

  private async withOperationLock<T>(operationId: string, fn: () => Promise<T>, maxRetries = 25, delayMs = 20): Promise<T> {
    await mkdir(this.stateDir, { recursive: true });
    const lockDir = join(this.stateDir, `${operationId}.lock`);
    let acquired = false;
    for (let i = 0; i < maxRetries; i++) {
      try {
        await mkdir(lockDir);
        acquired = true;
        break;
      } catch (err: any) {
        if (err?.code === 'EEXIST') {
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        throw err;
      }
    }
    if (!acquired) {
      throw new Error(`DURABLE_OPERATION_LOCKED: could not acquire lock for operation ${operationId} within timeout`);
    }
    try {
      return await fn();
    } finally {
      await rm(lockDir, { recursive: true, force: true }).catch(() => null);
    }
  }

  async createOperation(input: CreateOperationInput): Promise<DurableOperation> {
    const now = new Date().toISOString();
    const opId = input.operation_id || `OP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const attemptId = `ATT-${Date.now()}-1`;
    const idempotencyKey = createHash('sha256')
      .update(`${input.semantic_cycle_id}:${input.action_id}:${input.operation_semantic}:1`)
      .digest('hex');

    const recoveryContract: RecoveryContract = {
      ...DEFAULT_RECOVERY_CONTRACT,
      ...(input.recovery_contract ?? {}),
    };

    const op: DurableOperation = {
      operation_id: opId,
      mission_id: input.mission_id || 'FOUNDER_ABSENCE_PROTOCOL',
      semantic_cycle_id: input.semantic_cycle_id,
      action_id: input.action_id,
      operation_semantic: input.operation_semantic,
      operation_state: 'SUBMITTED',
      attempt_id: attemptId,
      idempotency_key: idempotencyKey,
      last_committed_transition: null,
      checkpoint_reference: input.checkpoint_reference ?? null,
      next_safe_transition: input.next_safe_transition || 'CLAIM',
      execution_lease_id: input.execution_lease_id ?? null,
      lease_revision: input.lease_revision ?? 1,
      controller: input.controller ?? 'unassigned',
      provider: input.provider ?? 'unassigned',
      runtime_model_id: input.runtime_model_id ?? 'unassigned',
      runner: input.runner ?? 'unassigned',
      authority_scope: input.authority_scope || 'PERPETUAL_AUTONOMY',
      failure_class: null,
      wait_reason: null,
      reactivation_condition: null,
      next_wake_at: null,
      recovery_attempt: 0,
      owner: input.owner ?? null,
      owner_lease: null,
      recovery_contract: recoveryContract,
      created_at: now,
      updated_at: now,
    };

    await this.appendRow(op);
    return op;
  }

  /**
   * Safe state transition with fencing and idempotency guards.
   */
  async transition(
    operationId: string,
    targetState: OperationState,
    updates: Partial<Omit<DurableOperation, 'operation_id' | 'created_at'>> = {},
    fencingOptions?: {
      expectedAttemptId?: string;
      expectedLeaseRevision?: number;
    }
  ): Promise<DurableOperation> {
    return this.withOperationLock(operationId, async () => {
      const current = await this.getById(operationId);
      if (!current) {
        throw new Error(`DURABLE_OPERATION_NOT_FOUND: operation ${operationId} does not exist`);
      }

      // Fencing check 1: Stale executor attempt ID
      if (
        fencingOptions?.expectedAttemptId &&
        current.attempt_id !== fencingOptions.expectedAttemptId
      ) {
        throw new Error(
          `STALE_EXECUTOR_FENCED: attempt ${fencingOptions.expectedAttemptId} was superseded by ${current.attempt_id}`
        );
      }

      // Fencing check 2: Stale lease revision
      if (
        fencingOptions?.expectedLeaseRevision !== undefined &&
        current.lease_revision > fencingOptions.expectedLeaseRevision
      ) {
        throw new Error(
          `STALE_LEASE_REVISION_FENCED: expected lease revision ${fencingOptions.expectedLeaseRevision} but current is ${current.lease_revision}`
        );
      }

      // Duplicate claim guard: prevent multiple contenders from claiming an already claimed operation
      if (targetState === 'CLAIMED' && current.operation_state === 'CLAIMED' && current.owner && updates.owner !== current.owner) {
        throw new Error(
          `STALE_EXECUTOR_FENCED: operation ${operationId} is already claimed by owner ${current.owner}`
        );
      }

      // At-most-once commit idempotency check:
      // If targetState is DONE, ensure we are not already DONE.
      if (targetState === 'DONE' && current.operation_state === 'DONE') {
        return current; // Idempotent return; zero duplicate commit
      }

      const now = new Date().toISOString();
      const transitionName = `${current.operation_state}_TO_${targetState}`;

      const next: DurableOperation = {
        ...current,
        ...updates,
        operation_state: targetState,
        last_committed_transition: transitionName,
        updated_at: now,
      };

      await this.appendRow(next);
      return next;
    });
  }

  /**
   * Transition to WAITING_RESOURCE upon recoverable failure.
   * Ensures zero cognition during wait and preserves checkpoint.
   */
  async recordResourceWait(
    operationId: string,
    error: unknown,
    checkpointRef?: string
  ): Promise<DurableOperation> {
    const classified = classifyFailure(error);
    const now = Date.now();
    const nextWakeAt = new Date(now + classified.retry_delay_ms).toISOString();
    const current = await this.getById(operationId);
    if (!current) {
      throw new Error(`DURABLE_OPERATION_NOT_FOUND: operation ${operationId} does not exist`);
    }

    const nextAttempt = current.recovery_attempt + 1;
    const nextAttemptId = `ATT-${now}-${nextAttempt + 1}`;

    return this.transition(operationId, 'WAITING_RESOURCE', {
      failure_class: classified.failure_class,
      wait_reason: classified.reason,
      reactivation_condition: 'RESOURCE_AVAILABLE_AND_WAKE_ELAPSED',
      next_wake_at: nextWakeAt,
      recovery_attempt: nextAttempt,
      attempt_id: nextAttemptId,
      owner: null, // Release ephemeral worker owner
      owner_lease: null,
      checkpoint_reference: checkpointRef || current.checkpoint_reference,
      next_safe_transition: 'RESUME_DUE',
    });
  }

  /**
   * Mark RESUME_DUE when wake condition is met and resource probe passes.
   */
  async markResumeDue(operationId: string): Promise<DurableOperation> {
    const current = await this.getById(operationId);
    if (!current) {
      throw new Error(`DURABLE_OPERATION_NOT_FOUND: operation ${operationId} does not exist`);
    }
    return this.transition(operationId, 'RESUME_DUE', {
      next_safe_transition: 'CLAIM',
      wait_reason: null,
      reactivation_condition: null,
    });
  }

  /**
   * Transition to OUTCOME_UNKNOWN when a crash or failure occurs during an active mutation,
   * preserving observable references and requiring explicit reconciliation before any retry.
   */
  async recordOutcomeUnknown(
    operationId: string,
    error: unknown,
    checkpointRef?: string
  ): Promise<DurableOperation> {
    const current = await this.getById(operationId);
    if (!current) {
      throw new Error(`DURABLE_OPERATION_NOT_FOUND: operation ${operationId} does not exist`);
    }
    const message = error instanceof Error ? error.message : String(error);
    return this.transition(operationId, 'OUTCOME_UNKNOWN', {
      owner: null,
      owner_lease: null,
      wait_reason: `outcome_unknown: ${message}`,
      checkpoint_reference: checkpointRef || current.checkpoint_reference,
      next_safe_transition: 'RECONCILE',
    });
  }

  /**
   * Reconcile an OUTCOME_UNKNOWN operation based on verified observable evidence:
   * - EFFECT_CONFIRMED: mutation occurred; transition to DONE without duplicating side effect.
   * - EFFECT_NOT_OBSERVED: mutation was absent; transition to RESUME_DUE if retry_budget permits, else QUARANTINED.
   * - STILL_UNKNOWN: unable to prove effect presence/absence; fail closed to QUARANTINED for audit.
   */
  async reconcileOutcomeUnknown(
    operationId: string,
    verdict: 'EFFECT_CONFIRMED' | 'EFFECT_NOT_OBSERVED' | 'STILL_UNKNOWN',
    details?: { checkpointRef?: string; reason?: string }
  ): Promise<DurableOperation> {
    const current = await this.getById(operationId);
    if (!current) {
      throw new Error(`DURABLE_OPERATION_NOT_FOUND: operation ${operationId} does not exist`);
    }
    if (current.operation_state !== 'OUTCOME_UNKNOWN') {
      throw new Error(
        `INVALID_STATE_TRANSITION: operation ${operationId} is in state ${current.operation_state}, expected OUTCOME_UNKNOWN`
      );
    }

    if (verdict === 'EFFECT_CONFIRMED') {
      return this.transition(operationId, 'DONE', {
        wait_reason: details?.reason || 'reconciled_effect_confirmed',
        checkpoint_reference: details?.checkpointRef || current.checkpoint_reference,
        next_safe_transition: 'NONE',
      });
    }

    if (verdict === 'EFFECT_NOT_OBSERVED') {
      const budget = current.recovery_contract?.retry_budget ?? 0;
      if (current.recovery_attempt < budget) {
        const nextAttempt = current.recovery_attempt + 1;
        const nextAttemptId = `ATT-${Date.now()}-${nextAttempt + 1}`;
        return this.transition(operationId, 'RESUME_DUE', {
          recovery_attempt: nextAttempt,
          attempt_id: nextAttemptId,
          wait_reason: details?.reason || 'reconciled_effect_not_observed_retry_admitted',
          next_safe_transition: 'CLAIM',
        });
      } else {
        return this.transition(operationId, 'QUARANTINED', {
          wait_reason: details?.reason || 'reconciled_effect_not_observed_retry_budget_exhausted',
          next_safe_transition: 'AUDIT',
        });
      }
    }

    // STILL_UNKNOWN: fail closed
    return this.transition(operationId, 'QUARANTINED', {
      wait_reason: details?.reason || 'reconcile_still_unknown_fail_closed',
      next_safe_transition: 'HUMAN_AUDIT',
    });
  }

  /**
   * Reconcile orphans according to Section 29 & Section 31:
   * NON_TERMINAL + NO_VALID_OWNER + NO_DURABLE_WAKE + NO_AUTHORITY_BLOCKER = ORPHANED_OPERATION.
   */
  async reconcileOrphans(options?: {
    now?: Date;
    isOwnerAlive?: (ownerId: string) => boolean;
  }): Promise<ReconciledOrphanReport> {
    const now = options?.now ?? new Date();
    const nowMs = now.getTime();
    const isOwnerAlive = options?.isOwnerAlive ?? (() => false);

    const operations = await this.getAll();
    const report: ReconciledOrphanReport = {
      orphaned_count: 0,
      reconciled: [],
    };

    for (const op of operations) {
      if (!isNonTerminal(op.operation_state)) continue;

      const hasValidOwner = Boolean(op.owner && isOwnerAlive(op.owner));
      const hasDurableWake = Boolean(op.next_wake_at && new Date(op.next_wake_at).getTime() > nowMs);
      const isDueWake = Boolean(op.next_wake_at && new Date(op.next_wake_at).getTime() <= nowMs);
      const isAuthorityBlocker = op.operation_state === 'BLOCKED' || op.operation_state === 'QUARANTINED';

      // 1. Due wake transition to RESUME_DUE
      if (op.operation_state === 'WAITING_RESOURCE' && isDueWake) {
        report.orphaned_count++;
        const next = await this.markResumeDue(op.operation_id);
        report.reconciled.push({
          operation_id: op.operation_id,
          previous_state: op.operation_state,
          new_state: next.operation_state,
          action_taken: 'MARKED_RESUME_DUE',
          reason: `Wake time ${op.next_wake_at} elapsed`,
        });
        continue;
      }

      // 2. Dead worker held in RUNNING / CLAIMED -> Orphan
      if ((op.operation_state === 'RUNNING' || op.operation_state === 'CLAIMED') && !hasValidOwner) {
        report.orphaned_count++;
        const contract = op.recovery_contract || DEFAULT_RECOVERY_CONTRACT;

        if (
          contract.recovery_policy === 'RECONCILE_BEFORE_RETRY' ||
          contract.unknown_outcome_policy === 'RECONCILE'
        ) {
          const next = await this.transition(op.operation_id, 'OUTCOME_UNKNOWN', {
            owner: null,
            owner_lease: null,
            wait_reason: 'worker_died_during_execution_reconciliation_required',
            next_safe_transition: 'RECONCILE',
          });
          report.reconciled.push({
            operation_id: op.operation_id,
            previous_state: op.operation_state,
            new_state: next.operation_state,
            action_taken: 'HELD_IN_OUTCOME_UNKNOWN',
            reason: 'Worker died during execution requiring reconciliation before retry',
          });
          continue;
        }

        if (contract.recovery_policy === 'DO_NOT_AUTORETRY') {
          const next = await this.transition(op.operation_id, 'QUARANTINED', {
            owner: null,
            owner_lease: null,
            wait_reason: 'worker_died_non_retryable_operation',
            next_safe_transition: 'HUMAN_AUDIT',
          });
          report.reconciled.push({
            operation_id: op.operation_id,
            previous_state: op.operation_state,
            new_state: next.operation_state,
            action_taken: 'QUARANTINED_DO_NOT_AUTORETRY',
            reason: 'Worker died on DO_NOT_AUTORETRY operation',
          });
          continue;
        }

        // SAFE_RETRY or NO_SIDE_EFFECT_SAFE_RETRY: check retry budget
        if (op.recovery_attempt < (contract.retry_budget ?? 1)) {
          const next = await this.transition(op.operation_id, 'RESUME_DUE', {
            owner: null,
            owner_lease: null,
            wait_reason: 'worker_died_without_terminal_commit_safe_retry',
            next_safe_transition: 'CLAIM',
          });
          report.reconciled.push({
            operation_id: op.operation_id,
            previous_state: op.operation_state,
            new_state: next.operation_state,
            action_taken: 'RESET_TO_RESUME_DUE',
            reason: 'Worker died without committing terminal state; operation permits safe retry',
          });
        } else {
          const next = await this.transition(op.operation_id, 'QUARANTINED', {
            owner: null,
            owner_lease: null,
            wait_reason: 'worker_died_retry_budget_exhausted',
            next_safe_transition: 'AUDIT',
          });
          report.reconciled.push({
            operation_id: op.operation_id,
            previous_state: op.operation_state,
            new_state: next.operation_state,
            action_taken: 'QUARANTINED_BUDGET_EXHAUSTED',
            reason: 'Worker died and retry budget was exhausted',
          });
        }
        continue;
      }

      // 3. Stalled in SUBMITTED with no wake and no owner
      if (op.operation_state === 'SUBMITTED' && !hasValidOwner && !hasDurableWake) {
        report.orphaned_count++;
        const next = await this.transition(op.operation_id, 'RESUME_DUE', {
          next_safe_transition: 'CLAIM',
        });
        report.reconciled.push({
          operation_id: op.operation_id,
          previous_state: op.operation_state,
          new_state: next.operation_state,
          action_taken: 'ADVANCED_TO_RESUME_DUE',
          reason: 'Submitted operation was unowned without wake',
        });
        continue;
      }

      // 4. Stuck without wake or owner and not blocked / not awaiting reconciliation
      if (
        !hasValidOwner &&
        !hasDurableWake &&
        !isAuthorityBlocker &&
        op.operation_state !== 'RESUME_DUE' &&
        op.operation_state !== 'OUTCOME_UNKNOWN'
      ) {
        report.orphaned_count++;
        const next = await this.transition(op.operation_id, 'RESUME_DUE', {
          owner: null,
          wait_reason: 'orphaned_unowned_state_reconciled',
          next_safe_transition: 'CLAIM',
        });
        report.reconciled.push({
          operation_id: op.operation_id,
          previous_state: op.operation_state,
          new_state: next.operation_state,
          action_taken: 'RECONCILED_TO_RESUME_DUE',
          reason: 'Non-terminal operation had neither active owner nor future wake',
        });
      }
    }

    return report;
  }
}
