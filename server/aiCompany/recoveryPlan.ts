import type { CompanyRoleId } from './roleContracts';
import type { FailureClass } from './verdict';

export const CANONICAL_FAILURE_CLASSES: FailureClass[] = [
  'MISSING_DEPENDENCY',
  'STALE_CONTEXT',
  'INVALID_ASSIGNMENT',
  'PROVIDER_TIMEOUT',
  'MALFORMED_OUTPUT',
  'TOKEN_BUDGET_EXCEEDED',
  'TOOL_POLICY_DENIED',
  'WORKTREE_DIRTY',
  'TEST_FAILURE',
  'QUALITY_FAIL',
  'SCOPE_DRIFT',
  'COORDINATION_FAILURE',
  'INSUFFICIENT_EVIDENCE',
  'QUALITY_DEFECT',
  'EXTERNAL_BLOCKER',
  'CONTRACT_CONFLICT',
  'RUNTIME_FAILURE',
];

export interface RecoveryPlan {
  recovery_id: string;
  source_decision_id: string;
  failure_class: FailureClass;
  root_cause: string;
  actions: string[];
  accountable_role: CompanyRoleId;
  re_review_role?: CompanyRoleId;
  dependency_updates: string[];
  required_evidence: string[];
  acceptance_criteria: string[];
  retry_budget: number;
  max_depth?: number;
  current_depth?: number;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  re_review_trigger: string;
  terminal_if_failed: 'ESCALATE' | 'TERMINAL_HOLD';
}

export function validateRecoveryPlan(plan: RecoveryPlan): string[] {
  const e: string[] = [];
  for (const k of ['recovery_id', 'source_decision_id', 'root_cause', 're_review_trigger'] as const) {
    if (!plan[k]?.trim()) e.push(`${k} is required`);
  }
  for (const k of ['actions', 'dependency_updates', 'required_evidence', 'acceptance_criteria'] as const) {
    if (!Array.isArray(plan[k]) || !plan[k].length) e.push(`${k} must be non-empty`);
  }
  if (!Number.isInteger(plan.retry_budget) || plan.retry_budget < 0) {
    e.push('retry_budget is invalid');
  }
  if (plan.max_depth !== undefined && (!Number.isInteger(plan.max_depth) || plan.max_depth <= 0)) {
    e.push('max_depth must be a positive integer');
  }
  if (plan.current_depth !== undefined && (!Number.isInteger(plan.current_depth) || plan.current_depth < 0)) {
    e.push('current_depth must be a non-negative integer');
  }
  if (!CANONICAL_FAILURE_CLASSES.includes(plan.failure_class)) {
    e.push(`invalid failure_class: ${plan.failure_class}`);
  }
  return e;
}

export function nextRecoveryAction(
  plan: RecoveryPlan,
  attempts: number
): 'CREATE_TASK' | 'ESCALATE' | 'TERMINAL_HOLD' {
  const maxDepth = plan.max_depth ?? 3;
  const currentDepth = plan.current_depth ?? 0;
  if (currentDepth >= maxDepth) {
    return 'TERMINAL_HOLD';
  }
  if (attempts >= plan.retry_budget) {
    return plan.terminal_if_failed === 'ESCALATE' ? 'ESCALATE' : 'TERMINAL_HOLD';
  }
  return 'CREATE_TASK';
}
