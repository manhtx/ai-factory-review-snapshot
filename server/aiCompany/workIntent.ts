export type WorkIntent = 'PRODUCT_CHANGE' | 'BUG_FIX' | 'PRODUCT_EXPERIMENT' | 'PRODUCT_DISCOVERY' | 'VALIDATION_ONLY' | 'TEST_ONLY' | 'DOCUMENTATION_ONLY' | 'MEASUREMENT_ONLY' | 'MAINTENANCE' | 'RECOVERY' | 'UNKNOWN';
export type ExpectedChangeType = 'SOURCE_CHANGE' | 'TEST_CHANGE' | 'CONFIG_CHANGE' | 'DATA_CHANGE' | 'DOCUMENTATION_CHANGE' | 'NO_CHANGE_EXPECTED' | 'UNKNOWN';
export type RoutingClass = 'R0' | 'R1' | 'R2' | 'R3';

export interface WorkIntentDecision {
  intent: WorkIntent;
  expected_change_type: ExpectedChangeType;
  expected_product_behavior_change: 'YES' | 'NO' | 'UNKNOWN';
  expected_product_learning: 'YES' | 'NO' | 'UNKNOWN';
  product_value_expectation: 'PRODUCT_BEHAVIOR_CHANGE' | 'PRODUCT_QUALITY_CHANGE' | 'PRODUCT_LEARNING' | 'ENGINEERING_GUARD' | 'OPERATIONAL_MAINTENANCE' | 'NO_PRODUCT_VALUE_EXPECTED';
  routing_class: RoutingClass;
  reason: string;
}

type WorkLike = { objective?: string; title?: string; task_type?: string; workflow_id?: string; mutation_policy?: string; allowed_paths?: string[]; acceptance_criteria?: string[]; };

export function classifyWorkIntent(work: WorkLike): WorkIntentDecision {
  const text = [work.objective, work.title, work.task_type, work.workflow_id, ...(work.acceptance_criteria ?? [])].filter(Boolean).join(' ').toLowerCase();
  const paths = work.allowed_paths ?? [];
  const testOnly = /test[- ]only|regression guard|validate current behavior|validation[- ]only/.test(text) || (paths.length > 0 && paths.every((p) => /\.test\.(ts|tsx|mjs|js)$/.test(p)));
  if (testOnly) return { intent: /validation[- ]only|validate current behavior/.test(text) ? 'VALIDATION_ONLY' : 'TEST_ONLY', expected_change_type: 'TEST_CHANGE', expected_product_behavior_change: 'NO', expected_product_learning: 'NO', product_value_expectation: 'ENGINEERING_GUARD', routing_class: 'R0', reason: 'deterministic test/validation signals and no product behavior expected' };
  if (/recovery|incident/.test(text)) return { intent: 'RECOVERY', expected_change_type: 'UNKNOWN', expected_product_behavior_change: 'UNKNOWN', expected_product_learning: 'NO', product_value_expectation: 'OPERATIONAL_MAINTENANCE', routing_class: 'R3', reason: 'recovery or incident signal' };
  if (/discover|research question|identify candidate/.test(text)) return { intent: 'PRODUCT_DISCOVERY', expected_change_type: 'UNKNOWN', expected_product_behavior_change: 'UNKNOWN', expected_product_learning: 'YES', product_value_expectation: 'PRODUCT_LEARNING', routing_class: 'R2', reason: 'product discovery signal' };
  if (work.task_type === 'code_review' || work.mutation_policy === 'read_only') return { intent: 'VALIDATION_ONLY', expected_change_type: 'NO_CHANGE_EXPECTED', expected_product_behavior_change: 'NO', expected_product_learning: 'NO', product_value_expectation: 'ENGINEERING_GUARD', routing_class: 'R0', reason: 'read-only or code-review boundary' };
  if (/bug|fix|correct/.test(text)) return { intent: 'BUG_FIX', expected_change_type: 'SOURCE_CHANGE', expected_product_behavior_change: 'YES', expected_product_learning: 'UNKNOWN', product_value_expectation: 'PRODUCT_QUALITY_CHANGE', routing_class: 'R1', reason: 'bug-fix signal with source scope' };
  if (work.allowed_paths?.some((p) => !/\.test\.(ts|tsx|mjs|js)$/.test(p))) return { intent: 'PRODUCT_CHANGE', expected_change_type: 'SOURCE_CHANGE', expected_product_behavior_change: 'YES', expected_product_learning: 'UNKNOWN', product_value_expectation: 'PRODUCT_BEHAVIOR_CHANGE', routing_class: 'R2', reason: 'product-capable source scope' };
  return { intent: 'UNKNOWN', expected_change_type: 'UNKNOWN', expected_product_behavior_change: 'UNKNOWN', expected_product_learning: 'UNKNOWN', product_value_expectation: 'NO_PRODUCT_VALUE_EXPECTED', routing_class: 'R0', reason: 'insufficient deterministic signals; safe bounded route' };
}
