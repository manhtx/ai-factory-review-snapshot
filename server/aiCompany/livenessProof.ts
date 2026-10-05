/**
 * AI Company Liveness Proof — Continuation Contracts
 *
 * For every legitimate non-terminal company state, this module records
 * the deterministic continuation contract answering the 8 required questions:
 *
 *   1. WHY is the company currently not progressing?
 *   2. WHAT event or condition can make progress possible?
 *   3. WHO or WHAT observes that condition?
 *   4. WHEN is it checked?
 *   5. HOW does the company wake?
 *   6. FROM WHICH durable state does it resume?
 *   7. WHAT reconciliation happens before another side effect?
 *   8. WHAT is the next legitimate action?
 *
 * Intentional design constraint: no product logic here. This module is
 * purely descriptive — it maps known company states to their continuation
 * contracts. It cannot start processes, write checkpoints, or query the backlog.
 */

export type CompanyState =
  | 'QUOTA_EXHAUSTED'
  | 'PROCESS_DEATH'
  | 'CRASH'
  | 'MAC_SLEEP'
  | 'EMPTY_QUEUE'
  | 'MANUAL_STOP'
  | 'CONSECUTIVE_ERRORS';

export type Terminality = 'TERMINAL' | 'RESUMABLE';

export type ContinuationContract = {
  state: CompanyState;
  terminality: Terminality;
  /** 1. WHY is the company not progressing? */
  why_not_progressing: string;
  /** 2. WHAT event/condition makes progress possible? */
  wake_condition: string;
  /** 3. WHO or WHAT observes that condition? */
  observer: string;
  /** 4. WHEN is it checked? */
  check_interval: string;
  /** 5. HOW does the company wake? */
  wake_mechanism: string;
  /** 6. FROM WHICH durable state does it resume? */
  resume_from: string;
  /** 7. WHAT reconciliation happens before next side effect? */
  reconciliation: string;
  /** 8. WHAT is the next legitimate action? */
  next_action: string;
};

/** All continuation contracts. Only RESUMABLE states have full contracts. */
export const LIVENESS_CONTRACTS: Record<CompanyState, ContinuationContract> = {
  QUOTA_EXHAUSTED: {
    state: 'QUOTA_EXHAUSTED',
    terminality: 'RESUMABLE',
    why_not_progressing: 'Host AI provider quota exhausted; loop exited with code 4 after circuit breaker tripped.',
    wake_condition: 'retry_not_before timestamp in quota-pause.json has passed (provider quota window reset).',
    observer: 'ai-company-loop-supervisor.sh reads quota-pause.json and sleeps until retry_not_before.',
    check_interval: 'Computed once at loop exit; supervisor sleeps the exact wait_ms, then restarts.',
    wake_mechanism: 'launchd KeepAlive keeps ai-company-loop-supervisor.sh alive; supervisor sleeps wait_ms then execs ai-company-loop.sh.',
    resume_from: '.ai-company/runtime/projects/macro-os/quota-pause.json (WAITING_RESOURCE checkpoint) + .ai-company/company-state.json.',
    reconciliation: 'Loop startup reads quota-pause.json, calls reconcileOnResume(), checks workspace git state and existing evidence before first side effect.',
    next_action: 'next_safe_action field from quota-pause.json checkpoint (e.g., CONTINUE_NEXT_EPOCH).',
  },

  PROCESS_DEATH: {
    state: 'PROCESS_DEATH',
    terminality: 'RESUMABLE',
    why_not_progressing: 'Supervisor process died unexpectedly (OOM, kernel kill, etc.).',
    wake_condition: 'launchd KeepAlive detects process exit.',
    observer: 'launchd — com.macrolens.ai-company-loop LaunchAgent.',
    check_interval: 'Immediate: launchd detects exit within seconds; ThrottleInterval=10s prevents storms.',
    wake_mechanism: 'launchd re-spawns ai-company-loop-supervisor.sh automatically.',
    resume_from: '.ai-company/company-state.json + last checkpoint in .ai-company/runtime (coordinator lock is stale-recovered).',
    reconciliation: 'Stale controller lock (.ai-company/.controller.lock) is recovered on startup: checks owner PID liveness, removes if dead. Coordinator lock recovered similarly.',
    next_action: 'Resume normal epoch loop from last durable company-state.json.',
  },

  CRASH: {
    state: 'CRASH',
    terminality: 'RESUMABLE',
    why_not_progressing: 'Unhandled exception or signal caused abrupt process termination.',
    wake_condition: 'launchd KeepAlive detects process exit.',
    observer: 'launchd — com.macrolens.ai-company-loop LaunchAgent.',
    check_interval: 'Immediate: launchd detects exit within seconds; ThrottleInterval=10s.',
    wake_mechanism: 'launchd re-spawns ai-company-loop-supervisor.sh automatically.',
    resume_from: '.ai-company/company-state.json + last epoch log. Stale lock recovery on startup.',
    reconciliation: 'Stale controller lock recovered. Supervisor reads last-exit-code; if crash produced no code, assumes resumable. Doctor check on startup validates workspace.',
    next_action: 'Resume normal epoch loop from last durable company-state.json.',
  },

  MAC_SLEEP: {
    state: 'MAC_SLEEP',
    terminality: 'RESUMABLE',
    why_not_progressing: 'Host Mac went to sleep; all processes suspended.',
    wake_condition: 'Mac wakes from sleep (user login, lid open, scheduled wake).',
    observer: 'launchd — automatically re-evaluates KeepAlive jobs after system wake.',
    check_interval: 'On system wake event.',
    wake_mechanism: 'launchd re-spawns supervisor if it exited before sleep, or supervisor continues from sleep if it was merely suspended.',
    resume_from: '.ai-company/company-state.json. Stale lock recovery: controller lock owner PID checked; if process not alive (was killed pre-sleep), lock removed.',
    reconciliation: 'Stale lock recovery. Doctor check validates workspace. Codex CLI session may have been interrupted — next epoch starts fresh with epoch prompt.',
    next_action: 'Resume normal epoch loop from last durable company-state.json.',
  },

  EMPTY_QUEUE: {
    state: 'EMPTY_QUEUE',
    terminality: 'RESUMABLE',
    why_not_progressing: 'Role work queue has no READY items (all DONE, BLOCKED, or not yet created).',
    wake_condition: 'The epoch AI agent produces new authorized work items or the next epoch runs.',
    observer: 'The epoch loop itself: run-ready.mjs exits cleanly when queue is empty; loop continues to next epoch.',
    check_interval: 'Each epoch cycle (~10 min per Codex invocation).',
    wake_mechanism: 'Epoch loop continues naturally; next epoch prompt instructs AI to evaluate product state and produce next action.',
    resume_from: '.ai-company/company-state.json + epoch prompt file (.ai-company/prompts/run-next-epoch.md).',
    reconciliation: 'None special — epoch prompt includes instructions to read current state first.',
    next_action: 'Execute next epoch: AI evaluates state and produces COMPANY_EPOCH_COMPLETE with next product action.',
  },

  MANUAL_STOP: {
    state: 'MANUAL_STOP',
    terminality: 'TERMINAL',
    why_not_progressing: 'Founder intentionally stopped the company via STOP_FILE or COMPANY_STOP sentinel.',
    wake_condition: 'Founder removes COMPANY_STOP sentinel and kickstarts the agent.',
    observer: 'Human (Founder). No automatic observer.',
    check_interval: 'N/A — terminal state requires Founder action.',
    wake_mechanism: 'rm .ai-company/COMPANY_STOP && launchctl kickstart -k gui/$(id -u)/com.macrolens.ai-company-loop',
    resume_from: '.ai-company/company-state.json',
    reconciliation: 'Doctor check on startup.',
    next_action: 'Normal epoch loop resumes from company-state.json.',
  },

  CONSECUTIVE_ERRORS: {
    state: 'CONSECUTIVE_ERRORS',
    terminality: 'TERMINAL',
    why_not_progressing: '3 consecutive epoch errors hit the circuit breaker (exit 3). Automatic restart halted to prevent runaway failures.',
    wake_condition: 'Founder reviews error logs and resolves root cause, then removes COMPANY_STOP.',
    observer: 'Human (Founder). Supervisor writes COMPANY_STOP on exit 3.',
    check_interval: 'N/A — terminal state requires Founder review.',
    wake_mechanism: 'Founder resolves issue, removes COMPANY_STOP, kickstarts agent.',
    resume_from: 'Epoch logs in .ai-company/logs/ and .ai-company/company-state.json.',
    reconciliation: 'Doctor check on startup.',
    next_action: 'Depends on root cause identified by Founder.',
  },
};

/** Returns the continuation contract for a given company state. */
export function getContinuationContract(state: CompanyState): ContinuationContract {
  return LIVENESS_CONTRACTS[state];
}

/** Returns all RESUMABLE contracts. */
export function resumableContracts(): ContinuationContract[] {
  return Object.values(LIVENESS_CONTRACTS).filter((c) => c.terminality === 'RESUMABLE');
}

/** Returns all TERMINAL contracts. */
export function terminalContracts(): ContinuationContract[] {
  return Object.values(LIVENESS_CONTRACTS).filter((c) => c.terminality === 'TERMINAL');
}

/** Validates that a contract has all 8 required fields non-empty. */
export function validateContract(contract: ContinuationContract): { valid: boolean; missing: string[] } {
  const required: Array<keyof ContinuationContract> = [
    'why_not_progressing',
    'wake_condition',
    'observer',
    'check_interval',
    'wake_mechanism',
    'resume_from',
    'reconciliation',
    'next_action',
  ];
  const missing = required.filter((field) => !String(contract[field]).trim());
  return { valid: missing.length === 0, missing };
}
