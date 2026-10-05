import { describe, expect, it } from 'vitest';
import { validateStructuredRoleOutput } from './structuredRoleOutput';

describe('Structured Role Output Contracts', () => {
  it('rejects pure narrative text or non-object output', () => {
    const res = validateStructuredRoleOutput('pm', 'Everything looks great and works!');
    expect(res.valid).toBe(false);
    expect(res.verdict).toBe('QUALITY_FAIL');
    expect(res.errors[0]).toContain('pure narrative rejected');
  });

  it('rejects outputs missing evidence_ids', () => {
    const res = validateStructuredRoleOutput('pm', {
      role: 'pm',
      problem: 'Slow query',
      target_user: 'Macro Analyst',
      product_goal_objective: 'Reliable research workflow',
      evidence_ids: [],
      facts: ['latency is 5s'],
      assumptions: [],
      scope: ['server/index.ts'],
      non_goals: [],
      recommendation: 'Add index',
      confidence: 0.9,
      unknowns: [],
    });
    expect(res.valid).toBe(false);
    expect(res.verdict).toBe('QUALITY_FAIL');
    expect(res.unsupported_claims[0]).toContain('evidence_ids is empty');
  });

  it('validates a complete PM structured output', () => {
    const pmValid = {
      role: 'pm' as const,
      problem: 'Data freshness ambiguous',
      target_user: 'Macro Analyst',
      product_goal_objective: 'docs/PRODUCT_GOAL.md freshness visibility',
      evidence_ids: ['audit-freshness-001'],
      facts: ['freshness calculation lacks timezone test'],
      assumptions: ['analysts need UTC boundary'],
      scope: ['server/freshness.ts'],
      non_goals: ['UI redesign'],
      recommendation: 'PROCEED',
      confidence: 0.85,
      unknowns: ['upstream holidays'],
    };
    const res = validateStructuredRoleOutput('pm', pmValid);
    expect(res.valid).toBe(true);
    expect(res.verdict).toBe('PASS');
    expect(res.structured).toEqual(pmValid);
  });

  it('validates Tech Lead and rejects invalid recommendation', () => {
    const techLead = {
      role: 'tech-lead' as const,
      architecture_impact: 'Minimal, encapsulated in freshness module',
      affected_modules: ['server/freshness.ts'],
      risk: 'P1 low blast radius',
      rollback: 'Revert single commit',
      migration_requirement: 'None',
      test_strategy: 'Unit tests with edge dates',
      security_boundary: 'No secrets or external network calls',
      evidence_ids: ['EVID-1'],
      recommendation: 'SOMETHING_ELSE',
    };
    const res = validateStructuredRoleOutput('tech-lead', techLead);
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toContain('BUILD|REVISE|HOLD|REJECT');
  });

  it('validates Coder and flags failing tests as quality fail', () => {
    const coderWithFailures = {
      role: 'coder' as const,
      files_changed: ['server/freshness.ts'],
      files_not_changed: ['server/index.ts'],
      implementation_summary: 'Fixed date boundary logic',
      tests_run: ['server/freshness.test.ts'],
      tests_failed: ['server/freshness.test.ts > edge case 2'],
      known_limitations: ['Leap year not tested'],
      rollback_instruction: 'git revert HEAD',
      evidence_ids: ['EVID-CODER-1'],
    };
    const res = validateStructuredRoleOutput('coder', coderWithFailures);
    expect(res.verdict).toBe('QUALITY_FAIL');
    expect(res.unsupported_claims[0]).toContain('Coder reported failing tests');
  });

  it('validates Functional QA output matrix and requires verdict', () => {
    const qaValid = {
      role: 'functional-qa' as const,
      test_matrix: [
        { test_name: 'date boundary test', expected: 'STALE', actual: 'STALE', status: 'PASS' as const },
      ],
      expected_result: 'All freshness tests pass',
      actual_result: 'All freshness tests pass',
      environment: 'vitest local Node v20',
      unresolved_issues: [],
      evidence_ids: ['EVID-QA-1'],
      verdict: 'PASS' as const,
    };
    const res = validateStructuredRoleOutput('functional-qa', qaValid);
    expect(res.valid).toBe(true);
    expect(res.verdict).toBe('PASS');
  });

  it('validates Quality Control output and checks reproducibility', () => {
    const qcValid = {
      role: 'quality-control' as const,
      evidence_independently_checked: ['EVID-QA-1'],
      contradictory_evidence: [],
      unsupported_claims: [],
      scope_drift: [],
      reproducibility: 'REPRODUCIBLE' as const,
      evidence_ids: ['EVID-QC-1'],
      verdict: 'PASS' as const,
    };
    const res = validateStructuredRoleOutput('quality-control', qcValid);
    expect(res.valid).toBe(true);
    expect(res.verdict).toBe('PASS');
  });

  it('enforces recovery_plan when CEO decision is HOLD', () => {
    const ceoHoldNoPlan = {
      role: 'ceo-guild' as const,
      decision: 'HOLD' as const,
      reason: 'QA failed due to timezone edge case',
      evidence_ids: ['EVID-QA-1'],
      dissent: [],
      next_workflow: 'recovery-loop',
      owner: 'coder',
      retest_condition: 'QA passes',
    };
    const res1 = validateStructuredRoleOutput('ceo-guild', ceoHoldNoPlan);
    expect(res1.valid).toBe(false);
    expect(res1.errors[0]).toContain('decision HOLD requires a concrete recovery_plan');

    const ceoHoldWithPlan = {
      ...ceoHoldNoPlan,
      recovery_plan: {
        failure_class: 'TEST_FAILURE',
        root_cause: 'Timezone boundary offset',
        corrective_assignment: 'ASSIGN-FIX-TZ',
        role_owner: 'coder' as const,
        max_retry: 2,
        retest_condition: 'freshness.test.ts passes',
      },
    };
    const res2 = validateStructuredRoleOutput('ceo-guild', ceoHoldWithPlan);
    expect(res2.valid).toBe(true);
    expect(res2.verdict).toBe('PASS');
  });
});
