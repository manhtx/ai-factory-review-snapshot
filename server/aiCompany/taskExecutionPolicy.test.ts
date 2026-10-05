import { describe, expect, it } from 'vitest';
import { assertTaskExecutionPolicy, deriveTaskExecutionPolicy } from './taskExecutionPolicy';
import type { AssignmentEnvelope } from './assignmentEnvelope';

const assignment = { assignment_id:'A-1', run_id:'R-1', namespace:'N', product_id:'macro-os', objective_id:'O', work_id:'W', role:'coder', task_type:'code_change', objective:'fix', product_goal_alignment:['Product Goal'], scope:['server'], allowed_paths:['server'], forbidden_paths:['.env','.ai-company/runtime','.ai-company/company-state.json'], allowed_tools:['filesystem','shell'], forbidden_tools:[], inputs:['x'], evidence_manifest:['e'], dependencies:[], acceptance_criteria:['test passes'], output_schema:'json', allowed_verdicts:['PASS'], risk_level:'P2', mutation_policy:'assigned_artifacts', test_policy:'targeted', context_budget:{max_tokens:1000,target_tokens:500}, token_budget:2000, timeout:120000, retry_budget:1, escalation_policy:'hold' } as unknown as AssignmentEnvelope;

describe('TaskExecutionPolicy', () => {
  it('derives bounded, deduplicated capabilities from an assignment', () => {
    const p = deriveTaskExecutionPolicy(assignment, 0);
    expect(p.allowed_tools).toEqual(['filesystem','shell']);
    expect(p.max_tokens).toBe(2000);
    expect(p.expires_at).toBe(new Date(120000).toISOString());
  });
  it('fails closed for expiry and revocation', () => {
    const p = deriveTaskExecutionPolicy(assignment, 0);
    expect(() => assertTaskExecutionPolicy(p, 120000)).toThrow('expired');
    expect(() => assertTaskExecutionPolicy({...p, revoked:true}, 1)).toThrow('revoked');
  });
});
