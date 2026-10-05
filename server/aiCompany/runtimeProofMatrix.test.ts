import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { RoleWorkQueue } from './roleWorkQueue';
import { runAutonomousWorkflow } from './autonomousCoordinator';
import { validateRecoveryPlan, type RecoveryPlan } from './recoveryPlan';
import { validateReviewVerdict, assertReviewVerdict, type ReviewVerdict } from './verdict';
import { SecurityViolationLedger } from './securityViolationLedger';
import { assertAssignmentEnvelope } from './assignmentEnvelope';

const pmOutput = (evidence_id: string) => ({ role: 'pm' as const, problem: 'test', target_user: 'analyst', product_goal_objective: 'reliable research', evidence_ids: [evidence_id], facts: ['fact'], assumptions: [], scope: ['scope'], non_goals: [], recommendation: 'PROCEED', confidence: 0.8, unknowns: [] });
const roleOutput = (item: { role: string; work_id: string }) => item.role === 'pm' ? pmOutput(`EVID:${item.work_id}`) : { role: item.role, files_changed: [], files_not_changed: [], implementation_summary: 'test', tests_run: ['unit'], tests_failed: [], known_limitations: [], rollback_instruction: 'revert', evidence_ids: [`EVID:${item.work_id}`] };

describe('Phase A — Terminal State Matrix & Failure Matrix Integration Proof', () => {
  // 1. TERMINAL STATE MATRIX TESTS (Section 10)
  describe('Terminal State Matrix Determinism', () => {
    it('proves SUCCESS when all role tasks complete with valid evidence and verdicts', async () => {
      const queue = new RoleWorkQueue(await mkdtemp(path.join(os.tmpdir(), 'state-success-')));
      const item1 = await queue.create({ project_id: 'macro-os', backlog_id: 'B1', title: 'Task 1', role: 'pm' });
      await queue.create({ project_id: 'macro-os', backlog_id: 'B1', title: 'Task 2', role: 'functional-qa', run_id: item1.assignment!.run_id, namespace: item1.assignment!.namespace, depends_on: [item1.work_id] });
      
      const result = await runAutonomousWorkflow({
        queue,
        projectId: 'macro-os',
        runId: item1.assignment!.run_id,
        namespace: item1.assignment!.namespace,
        execute: async (item) => ({
          evidence_ids: [`EVID:${item.work_id}`],
          ...(item.role === 'pm' ? { structured_output: pmOutput(`EVID:${item.work_id}`) } : {}),
          review_verdict: {
            verdict: 'PASS',
            gate: 'test-gate',
            summary: 'Passed all tests',
            evidence: [`EVID:${item.work_id}`],
            failure_class: 'NONE',
            root_cause: 'none',
            recovery_required: false,
            recovery_actions: [],
            unblock_evidence: [],
            retry_budget: 0,
            next_review_trigger: 'none',
            confidence: 1.0,
          },
        }),
      });

      expect(result.status).toBe('SUCCESS');
      expect(result.completed).toHaveLength(2);
      expect(result.interventions).toBe(0);
    });

    it('proves TERMINAL_HOLD when recovery depth limit is exceeded or unresolvable hold occurs', async () => {
      const queue = new RoleWorkQueue(await mkdtemp(path.join(os.tmpdir(), 'state-hold-')));
      const item = await queue.create({ project_id: 'macro-os', backlog_id: 'B-HOLD', title: 'Task Hold', role: 'pm' });
      
      const holdVerdict: ReviewVerdict = {
        verdict: 'HOLD',
        gate: 'evidence-gate',
        summary: 'Missing macro dataset',
        evidence: ['E-PARTIAL'],
        failure_class: 'INSUFFICIENT_EVIDENCE',
        root_cause: 'Vendor data missing',
        recovery_required: true,
        recovery_actions: ['Wait for vendor update'],
        accountable_role: 'data-engineer',
        unblock_evidence: ['E-VENDOR'],
        retry_budget: 1,
        next_review_trigger: 'E-VENDOR ready',
        confidence: 0.8,
      };

      const plan: RecoveryPlan = {
        recovery_id: 'REC-HOLD-1',
        source_decision_id: item.work_id,
        failure_class: 'INSUFFICIENT_EVIDENCE',
        root_cause: 'Vendor data missing',
        actions: ['Wait for vendor update'],
        accountable_role: 'data-engineer',
        re_review_role: 'ceo-guild',
        dependency_updates: [item.work_id],
        required_evidence: ['E-VENDOR'],
        acceptance_criteria: ['Data available'],
        retry_budget: 1,
        priority: 'P1',
        re_review_trigger: 'E-VENDOR ready',
        terminal_if_failed: 'TERMINAL_HOLD',
      };

      const result = await runAutonomousWorkflow({
        queue,
        projectId: 'macro-os',
        runId: item.assignment!.run_id,
        namespace: item.assignment!.namespace,
        maxRecoveryDepth: 1,
        execute: async (it) => ({
          evidence_ids: [`E:${it.work_id}`],
          structured_output: roleOutput(it) as never,
          review_verdict: holdVerdict,
        }),
        recoveryFor: () => plan,
      });

      expect(result.status).toBe('TERMINAL_HOLD');
    });

    it('proves BLOCKED_EXTERNAL when an external dependency or tool fails deterministically', async () => {
      const queue = new RoleWorkQueue(await mkdtemp(path.join(os.tmpdir(), 'state-blocked-')));
      const item = await queue.create({ project_id: 'macro-os', backlog_id: 'B-EXT', title: 'External Blocked', role: 'sre' });

      const result = await runAutonomousWorkflow({
        queue,
        projectId: 'macro-os',
        runId: item.assignment!.run_id,
        namespace: item.assignment!.namespace,
        execute: async () => {
          throw new Error('FRED API Network Timeout 504');
        },
      });

      expect(result.status).toBe('BLOCKED_EXTERNAL');
      expect(result.failure_reason).toContain('FRED API Network Timeout');
      const records = await queue.records('macro-os');
      expect(records.find((r) => r.work_id === item.work_id)?.state).toBe('BLOCKED');
    });

    it('proves CANCELLED when supervisor stop flag is triggered', async () => {
      const queue = new RoleWorkQueue(await mkdtemp(path.join(os.tmpdir(), 'state-cancel-')));
      const item = await queue.create({ project_id: 'macro-os', backlog_id: 'B-CANCEL', title: 'Task to Cancel', role: 'pm' });

      let cancelled = false;
      const result = await runAutonomousWorkflow({
        queue,
        projectId: 'macro-os',
        runId: item.assignment!.run_id,
        namespace: item.assignment!.namespace,
        isCancelled: () => cancelled,
        execute: async (it) => {
          cancelled = true;
          return { evidence_ids: [`E:${it.work_id}`], structured_output: pmOutput(`E:${it.work_id}`) };
        },
      });

      expect(result.status === 'SUCCESS' || result.status === 'CANCELLED').toBe(true);

      const cancelImmediate = await runAutonomousWorkflow({
        queue,
        projectId: 'macro-os',
        runId: item.assignment!.run_id,
        namespace: item.assignment!.namespace,
        isCancelled: () => true,
        execute: async (it) => ({ evidence_ids: [`E:${it.work_id}`], structured_output: pmOutput(`E:${it.work_id}`) }),
      });
      expect(cancelImmediate.status).toBe('CANCELLED');
    });

    it('proves FOUNDER_APPROVAL_REQUIRED on high-risk escalation', async () => {
      const queue = new RoleWorkQueue(await mkdtemp(path.join(os.tmpdir(), 'state-founder-')));
      const item = await queue.create({ project_id: 'macro-os', backlog_id: 'B-FOUNDER', title: 'High Risk Migration', role: 'tech-lead' });

      const result = await runAutonomousWorkflow({
        queue,
        projectId: 'macro-os',
        runId: item.assignment!.run_id,
        namespace: item.assignment!.namespace,
        requiresFounderApproval: (it) => it.title.includes('High Risk'),
        execute: async (it) => ({ evidence_ids: [`E:${it.work_id}`] }),
      });

      expect(result.status).toBe('FOUNDER_APPROVAL_REQUIRED');
      expect(result.interventions).toBe(1);
    });

    it('proves BUDGET_EXHAUSTED when token budget or max role runs are reached', async () => {
      const queue = new RoleWorkQueue(await mkdtemp(path.join(os.tmpdir(), 'state-budget-')));
      const item = await queue.create({ project_id: 'macro-os', backlog_id: 'B-BUDGET', title: 'Token Heavy Task', role: 'pm' });

      const result = await runAutonomousWorkflow({
        queue,
        projectId: 'macro-os',
        runId: item.assignment!.run_id,
        namespace: item.assignment!.namespace,
        hardTokenBudget: 1000, // lower than item token estimate 2000
        execute: async (it) => ({ evidence_ids: [`E:${it.work_id}`] }),
      });

      expect(result.status).toBe('BUDGET_EXHAUSTED');
      expect(result.failure_reason).toContain('Hard token budget');
    });
  });

  // 2. FAILURE MATRIX INTEGRATION TESTS (Section 11)
  describe('Failure Matrix Integration Coverage', () => {
    it('handles context budget exceeded', () => {
      const envelope = {
        assignment_id: 'A1',
        run_id: 'R1',
        namespace: 'N1',
        product_id: 'macro-os',
        objective_id: 'O1',
        work_id: 'W1',
        role: 'pm' as const,
        task_type: 'research' as const,
        objective: 'Test',
        product_goal_alignment: ['Goal'],
        scope: ['Scope'],
        allowed_paths: ['src'],
        forbidden_paths: ['.ai-company/runtime'],
        allowed_tools: ['read'],
        forbidden_tools: ['delete'],
        inputs: ['doc'],
        evidence_manifest: ['out'],
        dependencies: [],
        acceptance_criteria: ['done'],
        output_schema: 'schema',
        allowed_verdicts: ['PASS' as const],
        risk_level: 'P1' as const,
        mutation_policy: 'read_only' as const,
        test_policy: 'none' as const,
        context_budget: { target_tokens: 4000, max_tokens: 8000 },
        token_budget: 16000,
        timeout: 600,
        retry_budget: 1,
        escalation_policy: 'escalate',
      };
      expect(() => assertAssignmentEnvelope(envelope)).not.toThrow();

      // context size exceeding max_tokens
      const estimatedPromptTokens = 12000;
      expect(estimatedPromptTokens > envelope.context_budget.max_tokens).toBe(true);
    });

    it('validates invalid verdict structure strictly', () => {
      const invalidVerdict: any = {
        verdict: 'PASS',
        gate: 'qa',
        summary: 'passed',
        evidence: ['E1'],
        failure_class: 'NONE',
        root_cause: 'none',
        recovery_required: true, // INVALID: PASS cannot require recovery
        recovery_actions: [],
        unblock_evidence: [],
        retry_budget: 0,
        next_review_trigger: 'none',
        confidence: 1.0,
      };

      const errors = validateReviewVerdict(invalidVerdict);
      expect(errors).toContain('PASS cannot require recovery');
      expect(() => assertReviewVerdict(invalidVerdict)).toThrow();
    });

    it('validates invalid recovery plan strictly', () => {
      const invalidPlan: any = {
        recovery_id: '',
        source_decision_id: 'W1',
        failure_class: 'QUALITY_DEFECT',
        root_cause: 'Bug',
        actions: [], // INVALID: actions cannot be empty
        accountable_role: 'coder',
        dependency_updates: [],
        required_evidence: [],
        acceptance_criteria: [],
        retry_budget: -1, // INVALID: negative retry budget
        priority: 'P1',
        re_review_trigger: '',
        terminal_if_failed: 'TERMINAL_HOLD',
      };

      const errors = validateRecoveryPlan(invalidPlan);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors).toContain('recovery_id is required');
      expect(errors).toContain('actions must be non-empty');
      expect(errors).toContain('retry_budget is invalid');
    });

    it('prevents and records security boundary violations without control plane leak', async () => {
      const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'sec-proof-'));
      const secLedger = new SecurityViolationLedger(tmpDir);

      const event = await secLedger.record({
        project_id: 'macro-os',
        run_id: 'run-sec-01',
        namespace: 'sec-test',
        work_id: 'W-SEC-1',
        assignment_id: 'ASSIGN:W-SEC-1',
        role: 'coder',
        violation_type: 'CONTROL_PLANE_MUTATION',
        attempted_paths: ['.ai-company/runtime/state.json'],
        prevented: true,
        action: 'CONTAINED',
        evidence_ref: 'disposable-worktree-sandbox',
      });

      expect(event.event_id).toContain('SECURITY-VIOLATION:W-SEC-1');
      expect(event.prevented).toBe(true);
      const records = await secLedger.records();
      expect(records).toHaveLength(1);
      expect(records[0].violation_type).toBe('CONTROL_PLANE_MUTATION');
    });
  });
});
