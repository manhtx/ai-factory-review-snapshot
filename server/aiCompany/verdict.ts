import type { Verdict } from './assignmentEnvelope';

export type FailureClass =
  | 'NONE'
  | 'INSUFFICIENT_EVIDENCE'
  | 'QUALITY_DEFECT'
  | 'EXTERNAL_BLOCKER'
  | 'CONTRACT_CONFLICT'
  | 'RUNTIME_FAILURE'
  | 'MISSING_DEPENDENCY'
  | 'STALE_CONTEXT'
  | 'INVALID_ASSIGNMENT'
  | 'PROVIDER_TIMEOUT'
  | 'MALFORMED_OUTPUT'
  | 'TOKEN_BUDGET_EXCEEDED'
  | 'TOOL_POLICY_DENIED'
  | 'WORKTREE_DIRTY'
  | 'TEST_FAILURE'
  | 'QUALITY_FAIL'
  | 'SCOPE_DRIFT'
  | 'COORDINATION_FAILURE';
export interface ReviewVerdict {
  verdict: Verdict; gate: string; summary: string; evidence: string[]; failure_class: FailureClass; root_cause: string;
  recovery_required: boolean; recovery_actions: string[]; accountable_role?: string; unblock_evidence: string[];
  retry_budget: number; next_review_trigger: string; confidence: number;
}

export function validateReviewVerdict(input: ReviewVerdict): string[] {
  const errors: string[] = [];
  if (!['PASS', 'REVISE', 'QUALITY_FAIL', 'HOLD', 'BLOCKED'].includes(input.verdict)) errors.push('invalid verdict');
  for (const key of ['gate', 'summary', 'root_cause', 'next_review_trigger'] as const) if (!input[key]?.trim()) errors.push(`${key} is required`);
  if (!Array.isArray(input.evidence)) errors.push('evidence must be an array');
  if (!Number.isInteger(input.retry_budget) || input.retry_budget < 0) errors.push('retry_budget is invalid');
  if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) errors.push('confidence must be between 0 and 1');
  if (input.verdict === 'PASS' && input.recovery_required) errors.push('PASS cannot require recovery');
  if (input.verdict !== 'PASS' && input.recovery_required && (!input.recovery_actions.length || !input.unblock_evidence.length || !input.accountable_role)) errors.push('recoverable non-PASS verdict requires actions, owner and unblock evidence');
  const HOLD_CLASSES: FailureClass[] = ['INSUFFICIENT_EVIDENCE', 'STALE_CONTEXT', 'MISSING_DEPENDENCY', 'COORDINATION_FAILURE'];
  const BLOCKED_CLASSES: FailureClass[] = ['EXTERNAL_BLOCKER', 'TOOL_POLICY_DENIED', 'TOKEN_BUDGET_EXCEEDED', 'SCOPE_DRIFT'];
  if (input.verdict === 'HOLD' && !HOLD_CLASSES.includes(input.failure_class)) {
    errors.push('HOLD requires INSUFFICIENT_EVIDENCE');
  }
  if (input.verdict === 'BLOCKED' && !BLOCKED_CLASSES.includes(input.failure_class)) {
    errors.push('BLOCKED requires EXTERNAL_BLOCKER');
  }
  return errors;
}

export function assertReviewVerdict(input: ReviewVerdict): ReviewVerdict { const errors = validateReviewVerdict(input); if (errors.length) throw new Error(`invalid review verdict: ${errors.join('; ')}`); return input; }

export function detectReviewConflict(verdicts: ReviewVerdict[]): { conflict: boolean; recovery_required: boolean; reason: string } {
  const values = new Set(verdicts.map((item) => item.verdict));
  const conflict = values.has('PASS') && (values.has('QUALITY_FAIL') || values.has('REVISE') || values.has('HOLD'));
  return { conflict, recovery_required: conflict, reason: conflict ? `review disagreement: ${[...values].join(', ')}` : 'no contradictory review verdicts' };
}
