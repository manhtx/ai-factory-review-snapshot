import { describe, expect, it } from 'vitest';
import {
  assertAssignmentEnvelope,
  validateAssignmentEnvelope,
  evaluateAssignmentAdmission,
  assertAssignmentAdmission,
  type AssignmentEnvelope,
} from './assignmentEnvelope';

const valid: AssignmentEnvelope = {
  assignment_id: 'ASSIGNMENT:W1',
  run_id: 'R1',
  namespace: 'test',
  product_id: 'macro-os',
  objective_id: 'O1',
  work_id: 'W1',
  role: 'pm',
  task_type: 'product_discovery',
  objective: 'review product opportunity',
  product_goal_alignment: ['docs/PRODUCT_GOAL.md alignment required'],
  scope: ['read documentation'],
  allowed_paths: ['docs'],
  forbidden_paths: ['.ai-company/runtime', '.ai-company/company-state.json', '.env'],
  allowed_tools: ['grep_search'],
  forbidden_tools: ['deploy'],
  inputs: ['goal'],
  evidence_manifest: ['docs/PRODUCT_GOAL.md'],
  dependencies: [],
  acceptance_criteria: ['report generated with metric accuracy >= 95%'],
  output_schema: 'review-v1',
  allowed_verdicts: ['PASS', 'HOLD'],
  risk_level: 'P1',
  mutation_policy: 'read_only',
  test_policy: 'none',
  context_budget: { max_tokens: 2000, target_tokens: 1000 },
  token_budget: 5000,
  timeout: 60,
  retry_budget: 1,
  escalation_policy: 'escalate',
};

describe('AssignmentEnvelope Admission Contract', () => {
  it('validates a typed assignment and rejects unsafe policy combinations', () => {
    expect(validateAssignmentEnvelope(valid)).toEqual([]);
    expect(() => assertAssignmentEnvelope({ ...valid, test_policy: 'full_suite' })).toThrow('read-only');
  });

  it('admits a completely valid assignment with correct admission context', () => {
    const result = evaluateAssignmentAdmission(valid, {
      activeRunId: 'R1',
      namespace: 'test',
      projectId: 'macro-os',
    });
    expect(result.decision).toBe('ADMITTED');
    expect(result.reasons).toEqual([]);
    expect(assertAssignmentAdmission(valid)).toBe(valid);
  });

  it('rejects stale run context or namespace mismatch (REJECTED_STALE_CONTEXT)', () => {
    const runMismatch = evaluateAssignmentAdmission(valid, {
      activeRunId: 'R2',
      namespace: 'test',
    });
    expect(runMismatch.decision).toBe('REJECTED_STALE_CONTEXT');
    expect(runMismatch.reasons[0]).toContain('belongs to run R1 but active run is R2');

    const flaggedStale = evaluateAssignmentAdmission(valid, {
      isStaleContext: true,
    });
    expect(flaggedStale.decision).toBe('REJECTED_STALE_CONTEXT');
  });

  it('rejects missing or non-compliant Product Goal mapping (REJECTED_POLICY)', () => {
    const unaligned = { ...valid, product_goal_alignment: ['random feature'] };
    const result = evaluateAssignmentAdmission(unaligned);
    expect(result.decision).toBe('REJECTED_POLICY');
    expect(result.reasons[0]).toContain('PRODUCT_GOAL.md');
  });

  it('rejects forbidden scope and missing mandatory forbidden paths (REJECTED_SCOPE)', () => {
    const pathEscape = { ...valid, allowed_paths: ['../outside'] };
    expect(evaluateAssignmentAdmission(pathEscape).decision).toBe('REJECTED_SCOPE');

    const envExposed = { ...valid, allowed_paths: ['.env.local'] };
    expect(evaluateAssignmentAdmission(envExposed).decision).toBe('REJECTED_SCOPE');

    const missingMandatoryForbidden = { ...valid, forbidden_paths: [] };
    const missingFpRes = evaluateAssignmentAdmission(missingMandatoryForbidden);
    expect(missingFpRes.decision).toBe('REJECTED_SCOPE');
    expect(missingFpRes.reasons[0]).toContain('forbidden_paths must');
  });

  it('rejects read-only roles with write tools or non-read_only mutation policy (REJECTED_POLICY)', () => {
    const writeToolRole = { ...valid, role: 'pm' as const, allowed_tools: ['replace_file_content'] };
    const res1 = evaluateAssignmentAdmission(writeToolRole);
    expect(res1.decision).toBe('REJECTED_POLICY');
    expect(res1.reasons[0]).toContain("cannot be granted write/deploy tool 'replace_file_content'");

    const mutatingPm = { ...valid, role: 'pm' as const, mutation_policy: 'worktree' as const };
    const res2 = evaluateAssignmentAdmission(mutatingPm);
    expect(res2.decision).toBe('REJECTED_POLICY');
    expect(res2.reasons[0]).toContain("cannot have mutation_policy 'worktree'");
  });

  it('rejects production operations lacking human approval (REJECTED_POLICY)', () => {
    const prodTask = { ...valid, task_type: 'production_operation' as const, role: 'sre' as const, risk_level: 'P0' as const, mutation_policy: 'worktree' as const };
    const resWithoutApproval = evaluateAssignmentAdmission(prodTask, { hasHumanApproval: false });
    expect(resWithoutApproval.decision).toBe('REJECTED_POLICY');
    expect(resWithoutApproval.reasons[0]).toContain('production operation requires explicit human approval');

    const resWithApproval = evaluateAssignmentAdmission(prodTask, { hasHumanApproval: true });
    expect(resWithApproval.decision).toBe('ADMITTED');
  });

  it('rejects task when risk_level is incompatible with task_type (REJECTED_POLICY)', () => {
    const incompatibleRisk = {
      ...valid,
      task_type: 'production_operation' as const,
      risk_level: 'P3' as const,
    };
    const res = evaluateAssignmentAdmission(incompatibleRisk, { hasHumanApproval: true });
    expect(res.decision).toBe('REJECTED_POLICY');
    expect(res.reasons[0]).toContain("is incompatible with task_type 'production_operation'");
  });

  it('rejects assignment matching previously rejected direction (anti-regression)', () => {
    const rejectedDirectionTask = {
      ...valid,
      objective: 'Deploy autonomous agent directly to production without human gate',
    };
    const res = evaluateAssignmentAdmission(rejectedDirectionTask, {
      rejectedMemories: [
        {
          id: 'REJ-001',
          title: 'Direct un-gated production autonomy',
          keywords: ['autonomous agent directly to production', 'un-gated'],
          rejection_reason: 'Violates production human gate invariant',
        },
      ],
    });
    expect(res.decision).toBe('REJECTED_POLICY');
    expect(res.reasons[0]).toContain('previously rejected direction (REJ-001)');
  });

  it('rejects vague non-measurable acceptance criteria (REJECTED_POLICY)', () => {
    const vagueCriteria = { ...valid, acceptance_criteria: ['improve quality'] };
    const res = evaluateAssignmentAdmission(vagueCriteria);
    expect(res.decision).toBe('REJECTED_POLICY');
    expect(res.reasons[0]).toContain("is vague and lacks measurable condition");
  });

  it('rejects external or self-certified evidence (REJECTED_EVIDENCE)', () => {
    const externalEv = { ...valid, evidence_manifest: ['/etc/passwd'] };
    expect(evaluateAssignmentAdmission(externalEv).decision).toBe('REJECTED_EVIDENCE');

    const selfCertEv = { ...valid, role: 'pm' as const, evidence_manifest: ['self-certified:pm'] };
    const selfCertRes = evaluateAssignmentAdmission(selfCertEv);
    expect(selfCertRes.decision).toBe('REJECTED_EVIDENCE');
    expect(selfCertRes.reasons[0]).toContain('self-generated by role');

    const unresolvedEv = evaluateAssignmentAdmission(valid, {
      resolvedEvidenceIds: ['some-other-id'],
    });
    expect(unresolvedEv.decision).toBe('REJECTED_EVIDENCE');
  });

  it('rejects unsatisfied dependencies (REJECTED_DEPENDENCY)', () => {
    const withDeps = { ...valid, dependencies: ['W0', 'W_PREV'] };
    const res = evaluateAssignmentAdmission(withDeps, {
      completedWorkIds: ['W0'],
    });
    expect(res.decision).toBe('REJECTED_DEPENDENCY');
    expect(res.reasons[0]).toContain('dependencies not completed: W_PREV');

    expect(() => assertAssignmentAdmission(withDeps, { completedWorkIds: ['W0'] })).toThrow(
      'ASSIGNMENT_REJECTED_DEPENDENCY'
    );
  });
});
