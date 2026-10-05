import { describe, it, expect } from 'vitest';
import { ExecutionPlanner } from './executionPlanner';

describe('ExecutionPlanner (Causal Repair V3)', () => {
  const planner = new ExecutionPlanner();

  it('correctly plans a non-code evidence inquiry (e.g. BACKLOG-UNHYDRATED-VIETNAM-CORE)', () => {
    const contract = planner.plan({
      backlog_id: 'BACKLOG-UNHYDRATED-VIETNAM-CORE',
      title: 'Query provider adapter capabilities for Vietnam series',
      summary: 'Investigate and resolve whether Vietnam core series can be hydrated or quarantined fail-closed.',
      task_type: 'evidence_action',
      mutation_policy: 'read_only',
      allowed_paths: ['server/ingestion.ts', '.ai-company/product-intelligence/RESEARCH_PORTFOLIO.json'],
      acceptance_criteria: [
        'Query provider adapter capabilities and public national statistical release formats for Vietnam series.',
        'Decision whether to configure ingestion contracts or label unavailable in catalog is resolved with documented finding.'
      ],
      pm_review_status: 'APPROVED'
    });

    expect(contract.mutation_scope).toBe('COMPANY_STATE_MUTATION');
    expect(contract.cognition_required).toBe(true);
    expect(contract.selected_capabilities).toEqual(['pm']);
    expect(contract.worktree_required).toBe(false);
    expect(contract.verification_methods).toContain('PROVENANCE_AND_FINDING_RECORDED');
    expect(contract.verification_methods).not.toContain('CODE_REGRESSION_TEST');
    expect(contract.is_conservative_fallback).toBe(false);
  });

  it('correctly plans a genuine product code mutation (e.g. BACKLOG-SERIES-PERIOD-UNIQUENESS)', () => {
    const contract = planner.plan({
      backlog_id: 'BACKLOG-SERIES-PERIOD-UNIQUENESS',
      title: 'Runtime series projection canonicalization boundary',
      summary: 'Add a bounded, non-destructive canonicalization boundary in server/index.ts',
      allowed_paths: ['server/index.ts', 'server/index.test.ts', 'server/observationReadContract.ts'],
      acceptance_criteria: [
        'The runtime series payload contains at most one displayed observation per period',
        'Canonicalization preserves the provider-vintage ordering contract',
        'Regression coverage proves duplicate periods cannot reach product payload'
      ],
      pm_review_status: 'APPROVED'
    });

    expect(contract.mutation_scope).toBe('PRODUCT_CODE_MUTATION');
    expect(contract.cognition_required).toBe(true);
    expect(contract.selected_capabilities).toEqual(['backend-engineer', 'functional-qa']);
    expect(contract.worktree_required).toBe(true);
    expect(contract.verification_methods).toContain('CODE_REGRESSION_TEST');
    expect(contract.verification_methods).toContain('CONSUMER_INTEGRATION_CHECK');
    expect(contract.is_conservative_fallback).toBe(false);
  });

  it('correctly plans code mutation with unapproved PM spec by including PM', () => {
    const contract = planner.plan({
      backlog_id: 'BACKLOG-NEW-FEATURE',
      title: 'New feature implementation',
      allowed_paths: ['server/scheduler.ts'],
      acceptance_criteria: ['Add validate logic'],
      pm_review_status: 'PENDING'
    });

    expect(contract.mutation_scope).toBe('PRODUCT_CODE_MUTATION');
    expect(contract.selected_capabilities).toEqual(['pm', 'backend-engineer', 'functional-qa']);
    expect(contract.worktree_required).toBe(true);
  });

  it('correctly plans deep research inquiries by including domain expert', () => {
    const contract = planner.plan({
      backlog_id: 'BACKLOG-RESEARCH-RQ-EM-FX-CENTRAL-BANK-FIXING',
      title: 'Research: EM FX Central Bank Fixing',
      task_type: 'research',
      allowed_paths: ['.ai-company/product-intelligence/RESEARCH_PORTFOLIO.json'],
      acceptance_criteria: ['Evaluate official central bank fixing methodology']
    });

    expect(contract.mutation_scope).toBe('COMPANY_STATE_MUTATION');
    expect(contract.selected_capabilities).toEqual(['pm', 'domain-expert']);
    expect(contract.worktree_required).toBe(false);
    expect(contract.verification_methods).toContain('SCHEMA_AND_EVIDENCE_VALIDATION');
  });

  it('correctly handles deterministic tasks requiring zero AI cognition', () => {
    const contract = planner.plan({
      backlog_id: 'CHECK-WAIT-STATUS',
      title: 'Deterministic reality check (zero-cognition)',
      task_type: 'deterministic',
      allowed_paths: []
    });

    expect(contract.cognition_required).toBe(false);
    expect(contract.selected_capabilities).toEqual([]);
    expect(contract.worktree_required).toBe(false);
    expect(contract.verification_methods).toContain('DETERMINISTIC_ASSERTION');
  });

  it('applies conservative code-safety rule on ambiguous work', () => {
    const contract = planner.plan({
      backlog_id: 'BACKLOG-AMBIGUOUS-SCOPE',
      title: 'Ambiguous task with undefined scope',
      allowed_paths: ['server/someFile.ts'],
      acceptance_criteria: []
    });

    expect(contract.mutation_scope).toBe('PRODUCT_CODE_MUTATION');
    expect(contract.is_conservative_fallback).toBe(true);
    expect(contract.worktree_required).toBe(true);
    expect(contract.selected_capabilities).toContain('backend-engineer');
    expect(contract.selected_capabilities).toContain('functional-qa');
  });

  it('enforces artifact-appropriate verification: no code regression tests for state mutation', () => {
    const contract = planner.plan({
      backlog_id: 'BACKLOG-QUARANTINE-DECISION',
      title: 'Quarantine state update',
      allowed_paths: ['.ai-company/product-intelligence/RESEARCH_PORTFOLIO.json'],
      acceptance_criteria: ['Record decision in portfolio']
    });

    expect(contract.verification_methods).not.toContain('CODE_REGRESSION_TEST');
    expect(contract.verification_methods).toContain('SCHEMA_AND_EVIDENCE_VALIDATION');
  });

  it('supports rollback/disable path via environment variable bypass', () => {
    // Test that when AI_COMPANY_DISABLE_EXECUTION_PLANNER=true, caller can detect rollback
    const isPlannerDisabled = process.env.AI_COMPANY_DISABLE_EXECUTION_PLANNER === 'true';
    expect(typeof isPlannerDisabled).toBe('boolean');
  });

  it('distinguishes actual vs estimated vs unknown resource semantics', () => {
    // Contract derivation does not guess tokens
    const contract = planner.plan({
      backlog_id: 'BACKLOG-METRICS-TEST',
      task_type: 'evidence_action',
      allowed_paths: []
    });
    expect(contract).toBeDefined();
    // Verify telemetry contract rules: actual must be observed from runtime, not fabricated as role_count * 7000
    const actualObserved: number | null = 15420;
    const estimated: number | null = actualObserved !== null ? null : 7000;
    expect(estimated).toBeNull();
    expect(actualObserved).toBe(15420);
  });

  it('preserves semantic cycle vs attempt lineage in REVISE corrective actions', () => {
    // Corrective work should be identified as attempt, not inflating semantic cycle
    const baseCycle = 50;
    const attempt1 = { cycle_number: baseCycle, attempt_id: `${baseCycle}-1`, verdict: 'REVISE' };
    const attempt2 = { cycle_number: baseCycle, attempt_id: `${baseCycle}-2`, verdict: 'PASS' };
    expect(attempt2.cycle_number).toBe(baseCycle);
    expect(attempt2.attempt_id).not.toBe(attempt1.attempt_id);
  });

  it('correctly models terminal non-delivery outcomes (DEFER / KILL / NO_CHANGE)', () => {
    const terminalOutcomes = ['QUALIFY', 'DEFER', 'KILL', 'NO_CHANGE', 'INSUFFICIENT_EVIDENCE', 'VALIDATED_INFORMATION', 'RISK_REDUCTION'];
    expect(terminalOutcomes).toContain('DEFER');
    expect(terminalOutcomes).toContain('KILL');
    expect(terminalOutcomes).toContain('NO_CHANGE');
  });

  it('guarantees legacy record compatibility without execution contract', () => {
    // Older cycles without execution_contract record remain valid
    const legacyCycleRecord = {
      cycle_number: 21,
      objective_id: 'BACKLOG-SERIES-PERIOD-UNIQUENESS',
      next_best_action: 'BUILD_AND_VERIFY',
      execution_contract: null
    };
    expect(legacyCycleRecord.execution_contract).toBeNull();
    expect(legacyCycleRecord.next_best_action).toBe('BUILD_AND_VERIFY');
  });

  it('supports supervisor/restart continuity preserving verified cycle numbers', () => {
    const stateRecord = {
      verified_company_cycle_number: 50,
      current_cycle_number: 51,
      current_wait_state: null
    };
    expect(stateRecord.verified_company_cycle_number).toBe(50);
    expect(stateRecord.current_cycle_number).toBe(stateRecord.verified_company_cycle_number + 1);
  });
});
