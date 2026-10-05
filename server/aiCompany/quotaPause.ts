/**
 * quotaPause.ts — Minimal quota pause / wait / resume continuation checkpoint.
 *
 * When the host AI (Antigravity or Codex) exhausts its quota during an AI Company
 * marathon run, this module records the smallest durable state needed to:
 *   1. Avoid fake FAILED/DONE/WIN terminal states
 *   2. Allow safe reconstruction from canonical AI Company state (cross-host)
 *   3. Resume from the correct next_safe_action after a retry delay
 *   4. Detect already-completed mutations before rerunning them
 *
 * Design constraints:
 *   - No new external dependencies
 *   - Does NOT duplicate marathon state — references canonical IDs only
 *   - Does NOT auto-select a different provider
 *   - Does NOT build infrastructure for hypothetical future features
 */

import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/** Which host AI was running when quota was detected. */
export type QuotaHost = 'ANTIGRAVITY' | 'CODEX' | 'UNKNOWN';

/**
 * Source/confidence of the retry_not_before timestamp.
 * NEVER use ESTIMATED unless no other source is available; never fabricate precision.
 */
export type RetryTimeSource = 'PROVIDER_REPORTED' | 'PARSED_MESSAGE' | 'ESTIMATED' | 'UNKNOWN';

/**
 * The single durable continuation checkpoint for a quota pause event.
 * Reuses canonical IDs from marathon state; does not copy their content.
 */
export interface QuotaPauseCheckpoint {
  /** Always 'WAITING_RESOURCE' — hard invariant; never FAILED/DONE/WIN/LOSS */
  status: 'WAITING_RESOURCE';
  reason: 'HOST_AI_QUOTA';
  host: QuotaHost;
  detected_at: string;

  /** ISO timestamp before which retrying is not useful. Null if unknown. */
  retry_not_before: string | null;
  retry_time_source: RetryTimeSource;

  /** Canonical IDs from AI_COMPANY_EVOLUTION_MARATHON_STATE.json / company-state.json.
   *  Null if the quota occurred outside a marathon cycle context. */
  sprint_id: string | null;
  backlog_item_id: string | null;
  cycle_id: string | null;
  task_id: string | null;
  stage_id: string | null;

  /** Where the runtime was when quota hit, mirroring DurableSupervisor checkpoint time. */
  last_safe_checkpoint: string | null;

  /**
   * What to do on resume. Deterministic and concise.
   * Examples: 'RECONCILE_IMPLEMENTATION', 'RUN_QA', 'RUN_INDEPENDENT_EVALUATION',
   *           'CONTINUE_EPOCH_M2_DEEP_LEARNING', 'PM_ACCEPTANCE'
   */
  next_safe_action: string;

  /** Bounded — max MAX_RESUME_ATTEMPTS; prevents unbounded retry loops. */
  resume_attempt_count: number;

  updated_at: string;
}

const MAX_RESUME_ATTEMPTS = 5;

/**
 * Bounded wait intervals for quota recovery when retry_not_before is unknown.
 * Units: milliseconds. Steps: 15min -> 30min -> 60min -> 60min (ceiling).
 */
const WAIT_STEPS_MS = [
  15 * 60_000,  // attempt 1
  30 * 60_000,  // attempt 2
  60 * 60_000,  // attempt 3+
] as const;

/**
 * Return the recommended wait delay for the given resume attempt count.
 * attempt 0 (first retry) -> 15min, 1 -> 30min, 2+ -> 60min.
 * Small jitter (up to 60 seconds) reduces thundering-herd if multiple runners exist.
 */
export function computeRetryDelayMs(attempt: number, jitterMs = Math.random() * 60_000): number {
  const index = Math.max(0, Math.min(attempt, WAIT_STEPS_MS.length - 1));
  return WAIT_STEPS_MS[index] + Math.floor(jitterMs);
}

/**
 * Returns true if enough time has passed that retrying is reasonable.
 * retry_not_before is treated as a HINT, not proof of quota recovery.
 */
export function isReadyToRetry(checkpoint: QuotaPauseCheckpoint, now = new Date()): boolean {
  if (checkpoint.retry_not_before) {
    return now >= new Date(checkpoint.retry_not_before);
  }
  // No timestamp: derive from detected_at + bounded backoff
  const detected = new Date(checkpoint.detected_at).getTime();
  const delay = computeRetryDelayMs(checkpoint.resume_attempt_count, 0);
  return now.getTime() >= detected + delay;
}

export class QuotaPauseLedger {
  private readonly checkpointPath: string;

  constructor(private readonly stateDir: string) {
    this.checkpointPath = join(stateDir, 'quota-pause.json');
  }

  private async atomicWrite(value: unknown): Promise<void> {
    await mkdir(dirname(this.checkpointPath), { recursive: true });
    const tmp = `${this.checkpointPath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    await rename(tmp, this.checkpointPath);
  }

  /**
   * Record a quota pause checkpoint.
   * INVARIANT: status is always 'WAITING_RESOURCE'. Never sets FAILED/DONE/WIN/LOSS.
   * If a checkpoint already exists, increments resume_attempt_count (bounded at MAX_RESUME_ATTEMPTS).
   */
  async recordQuotaPause(params: {
    host: QuotaHost;
    sprint_id?: string | null;
    backlog_item_id?: string | null;
    cycle_id?: string | null;
    task_id?: string | null;
    stage_id?: string | null;
    last_safe_checkpoint?: string | null;
    next_safe_action: string;
    retry_not_before?: string | null;
    retry_time_source?: RetryTimeSource;
  }): Promise<QuotaPauseCheckpoint> {
    const existing = await this.loadQuotaPause();
    const attemptCount = existing
      ? Math.min(MAX_RESUME_ATTEMPTS, existing.resume_attempt_count + 1)
      : 0;

    const checkpoint: QuotaPauseCheckpoint = {
      status: 'WAITING_RESOURCE',
      reason: 'HOST_AI_QUOTA',
      host: params.host,
      detected_at: existing?.detected_at ?? new Date().toISOString(),
      retry_not_before: params.retry_not_before ?? null,
      retry_time_source: params.retry_time_source ?? 'UNKNOWN',
      sprint_id: params.sprint_id ?? null,
      backlog_item_id: params.backlog_item_id ?? null,
      cycle_id: params.cycle_id ?? null,
      task_id: params.task_id ?? null,
      stage_id: params.stage_id ?? null,
      last_safe_checkpoint: params.last_safe_checkpoint ?? null,
      next_safe_action: params.next_safe_action,
      resume_attempt_count: attemptCount,
      updated_at: new Date().toISOString(),
    };

    await this.atomicWrite(checkpoint);
    return checkpoint;
  }

  /**
   * Load the current quota pause checkpoint, if any.
   * Returns null when no pause is active.
   * Works for cross-host reconstruction: any host can read this file.
   */
  async loadQuotaPause(): Promise<QuotaPauseCheckpoint | null> {
    try {
      const raw = await readFile(this.checkpointPath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<QuotaPauseCheckpoint>;
      // Validate the hard invariant before returning
      if (parsed.status !== 'WAITING_RESOURCE' || parsed.reason !== 'HOST_AI_QUOTA') {
        return null; // corrupt or mismatched; treat as absent
      }
      return parsed as QuotaPauseCheckpoint;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  /**
   * Remove the quota pause checkpoint after a successful resume.
   * Idempotent: safe to call even if no checkpoint exists.
   */
  async clearQuotaPause(): Promise<void> {
    try {
      await rm(this.checkpointPath, { force: true });
    } catch {
      // Already absent -- treat as success
    }
  }

  /**
   * Reconcile workspace/task state on resume.
   *
   * Returns:
   *   - 'ADVANCE' if the stage is already materially complete -> move to next_safe_action
   *   - 'RESUME' if the stage appears incomplete -> resume from next_safe_action
   *   - 'RECONCILE' if ambiguous -> inspect before running
   *
   * Callers supply the evidence of what is actually in the workspace.
   */
  static reconcileOnResume(params: {
    checkpoint: QuotaPauseCheckpoint;
    /** IDs of work items that are confirmed DONE in the canonical queue. */
    confirmedDoneWorkIds: string[];
    /** File paths that exist in the workspace (e.g. from git status). */
    existingArtifactPaths?: string[];
  }): 'ADVANCE' | 'RESUME' | 'RECONCILE' {
    const { checkpoint, confirmedDoneWorkIds } = params;

    if (checkpoint.task_id && confirmedDoneWorkIds.includes(checkpoint.task_id)) {
      return 'ADVANCE';
    }

    if (checkpoint.stage_id) {
      // If the stage ID appears in confirmed done work, advance
      if (confirmedDoneWorkIds.includes(checkpoint.stage_id)) return 'ADVANCE';
      // Stage was interrupted -- need reconciliation before resuming
      return 'RECONCILE';
    }

    // No specific task/stage to check -- default to RESUME from next_safe_action
    return 'RESUME';
  }
}
