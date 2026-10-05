import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { RoleWorkQueue } from './roleWorkQueue';
import {
  evaluateAssignmentAdmission,
  assertAssignmentAdmission,
  type AssignmentEnvelope,
} from './assignmentEnvelope';
import { runAutonomousWorkflow } from './autonomousCoordinator';
import { coordinateRecovery } from './recoveryCoordinator';
import type { RecoveryPlan } from './recoveryPlan';
import type { ReviewVerdict } from './verdict';
import { ProductMemoryLedger } from './productMemory';
import { buildContextManifest } from './contextManifest';

describe('Lean Optimization Plan — 8 Mandatory Runtime Scenarios', () => {
  // 1. Assignment invalid bị chặn trước provider
  it('Scenario 1: assignment invalid bị chặn trước khi gọi provider', async () => {
    let providerInvoked = false;
    const mockProvider = async () => {
      providerInvoked = true;
      return { output: 'result' };
    };

    const invalidEnvelope: AssignmentEnvelope = {
      assignment_id: 'ASSIGNMENT:INV-1',
      run_id: 'R1',
      namespace: 'test',
      product_id: 'macro-os',
      objective_id: 'OBJ-1',
      work_id: 'W-INV-1',
      role: 'pm',
      task_type: 'product_discovery',
      objective: 'Access environment secrets',
      product_goal_alignment: ['docs/PRODUCT_GOAL.md alignment required'],
      scope: ['secrets'],
      allowed_paths: ['.env.local'], // Unsafe path!
      forbidden_paths: ['.ai-company/runtime', '.ai-company/company-state.json', '.env'],
      allowed_tools: ['read_file'],
      forbidden_tools: ['deploy'],
      inputs: ['goal'],
      evidence_manifest: ['docs'],
      dependencies: [],
      acceptance_criteria: ['accuracy >= 95%'],
      output_schema: 'out-v1',
      allowed_verdicts: ['PASS'],
      risk_level: 'P2',
      mutation_policy: 'read_only',
      test_policy: 'none',
      context_budget: { target_tokens: 1000, max_tokens: 2000 },
      token_budget: 4000,
      timeout: 60,
      retry_budget: 1,
      escalation_policy: 'bounded',
    };

    const admission = evaluateAssignmentAdmission(invalidEnvelope);
    expect(admission.decision).toBe('REJECTED_SCOPE');
    expect(admission.reasons[0]).toContain('exposes secret');

    // Simulate dispatch guard: assert admission before calling provider
    await expect(async () => {
      assertAssignmentAdmission(invalidEnvelope);
      await mockProvider();
    }).rejects.toThrow('ASSIGNMENT_REJECTED_SCOPE');

    expect(providerInvoked).toBe(false);
  });

  // 2. QA fail → corrective task → QA retry
  it('Scenario 2: QA fail → corrective task → QA retry thành công', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'scenario2-'));
    const queue = new RoleWorkQueue(tmpDir);

    const coderTask = await queue.create({
      project_id: 'macro-os',
      backlog_id: 'B-QA-FAIL',
      title: 'Implement data filter',
      role: 'backend-engineer',
    });

    // Step 1: coder completes first attempt
    await queue.claim(coderTask.work_id, 'coder');
    await queue.submitForReview(coderTask.work_id);
    const coderV1Output: any = {
      role: 'coder',
      files_changed: ['server/filter.ts'],
      files_not_changed: [],
      implementation_summary: 'Initial data filter',
      tests_run: ['npm test'],
      tests_failed: [],
      known_limitations: [],
      rollback_instruction: 'git revert',
      evidence_ids: ['EVID:CODER-V1'],
    };
    await queue.complete(coderTask.work_id, ['EVID:CODER-V1'], undefined, undefined, coderV1Output);

    // Step 2: QA fails the initial implementation
    const qaFailVerdict: ReviewVerdict = {
      verdict: 'QUALITY_FAIL',
      gate: 'functional-test-gate',
      summary: 'Data filter fails on leap year edge case',
      evidence: ['EVID:TEST-FAIL-LEAP-YEAR'],
      failure_class: 'QUALITY_DEFECT',
      root_cause: 'Missing leap year check in date parsing',
      recovery_required: true,
      recovery_actions: ['Fix leap year boundary condition in parser'],
      accountable_role: 'backend-engineer',
      unblock_evidence: ['EVID:TEST-PASS-LEAP-YEAR'],
      retry_budget: 1,
      next_review_trigger: 'EVID:TEST-PASS-LEAP-YEAR',
      confidence: 0.95,
    };

    const qaTask = await queue.create({
      project_id: 'macro-os',
      backlog_id: 'B-QA-FAIL:qa',
      title: 'Verify data filter',
      role: 'functional-qa',
      depends_on: [coderTask.work_id],
    });

    await queue.claim(qaTask.work_id, 'qa');
    await queue.submitForReview(qaTask.work_id);
    await queue.complete(qaTask.work_id, ['EVID:TEST-FAIL-LEAP-YEAR'], undefined, qaFailVerdict);

    // Step 3: Materialize corrective task for coder
    const correctiveTask = await queue.create({
      project_id: 'macro-os',
      backlog_id: 'B-QA-FAIL:corrective',
      title: 'Fix leap year boundary condition in parser',
      role: 'backend-engineer',
      depends_on: [qaTask.work_id],
    });

    await queue.claim(correctiveTask.work_id, 'coder');
    await queue.submitForReview(correctiveTask.work_id);
    const correctiveOutput: any = {
      role: 'coder',
      files_changed: ['server/filter.ts'],
      files_not_changed: [],
      implementation_summary: 'Fixed leap year calculation',
      tests_run: ['npm test'],
      tests_failed: [],
      known_limitations: [],
      rollback_instruction: 'git revert',
      evidence_ids: ['EVID:TEST-PASS-LEAP-YEAR'],
    };
    await queue.complete(correctiveTask.work_id, ['EVID:TEST-PASS-LEAP-YEAR'], undefined, undefined, correctiveOutput);

    // Step 4: QA retries and passes
    const qaRetryTask = await queue.create({
      project_id: 'macro-os',
      backlog_id: 'B-QA-FAIL:qa-retry',
      title: 'Re-verify data filter',
      role: 'functional-qa',
      depends_on: [correctiveTask.work_id],
    });

    await queue.claim(qaRetryTask.work_id, 'qa');
    await queue.submitForReview(qaRetryTask.work_id);
    const passed = await queue.complete(qaRetryTask.work_id, ['EVID:ALL-TESTS-PASS'], undefined, {
      verdict: 'PASS',
      gate: 'functional-test-gate',
      summary: 'All edge case tests pass',
      evidence: ['EVID:ALL-TESTS-PASS'],
      failure_class: 'NONE',
      root_cause: 'none',
      recovery_required: false,
      recovery_actions: [],
      unblock_evidence: [],
      retry_budget: 0,
      next_review_trigger: 'none',
      confidence: 1.0,
    });

    expect(passed.state).toBe('DONE');
    expect(passed.review_verdict?.verdict).toBe('PASS');
  });

  // 3. CEO HOLD → recovery DAG → re-review
  it('Scenario 3: CEO HOLD → recovery DAG → re-review', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'scenario3-'));
    const queue = new RoleWorkQueue(tmpDir);

    const initialItem = await queue.create({
      project_id: 'macro-os',
      backlog_id: 'B-HOLD-3',
      title: 'Integrate new macro provider',
      role: 'data-engineer',
    });

    // Step 1: initial item completed with HOLD verdict
    await queue.claim(initialItem.work_id, 'data-engineer');
    await queue.submitForReview(initialItem.work_id);
    const ceoHoldVerdict: ReviewVerdict = {
      verdict: 'HOLD',
      gate: 'executive-gate',
      summary: 'Data schema contract missing required UTC timestamp field',
      evidence: ['EVID:SCHEMA-INCOMPLETE'],
      failure_class: 'COORDINATION_FAILURE',
      root_cause: 'Provider payload lacks timezone definition',
      recovery_required: true,
      recovery_actions: ['Add explicit UTC conversion transformer'],
      accountable_role: 'data-engineer',
      unblock_evidence: ['EVID:SCHEMA-UTC-VALIDATED'],
      retry_budget: 1,
      next_review_trigger: 'EVID:SCHEMA-UTC-VALIDATED ready',
      confidence: 0.9,
    };
    await queue.complete(
      initialItem.work_id,
      ['EVID:SCHEMA-INCOMPLETE'],
      undefined,
      ceoHoldVerdict,
      {
        role: 'data-engineer',
        files_changed: ['src/schema.ts'],
        files_not_changed: [],
        implementation_summary: 'Schema definition missing UTC timestamp',
        summary: 'Schema definition missing UTC timestamp',
        tests_run: ['test:schema'],
        tests_failed: ['utc_timestamp_test'],
        known_limitations: ['missing UTC'],
        rollback_instruction: 'git restore .',
        evidence_ids: ['EVID:SCHEMA-INCOMPLETE'],
      }
    );

    const recoveryPlan: RecoveryPlan = {
      recovery_id: 'REC-SCHEMA-01',
      source_decision_id: initialItem.work_id,
      failure_class: 'COORDINATION_FAILURE',
      root_cause: 'Provider payload lacks timezone definition',
      actions: ['Add explicit UTC conversion transformer'],
      accountable_role: 'data-engineer',
      re_review_role: 'ceo-guild',
      dependency_updates: [initialItem.work_id],
      required_evidence: ['EVID:SCHEMA-UTC-VALIDATED'],
      acceptance_criteria: ['Transformer produces ISO8601 UTC string'],
      retry_budget: 1,
      priority: 'P1',
      re_review_trigger: 'EVID:SCHEMA-UTC-VALIDATED ready',
      terminal_if_failed: 'TERMINAL_HOLD',
    };

    const recoveryCoord = await coordinateRecovery({
      queue,
      plan: recoveryPlan,
      projectId: 'macro-os',
      runId: 'run-hold-3',
      namespace: 'test-ns',
      sourceWorkId: initialItem.work_id,
      attempts: 0,
    });

    expect(recoveryCoord.status).toBe('CREATED');
    expect(recoveryCoord.task).toBeDefined();
    expect(recoveryCoord.task?.role).toBe('data-engineer');
    expect(recoveryCoord.task?.depends_on).toContain(initialItem.work_id);

    // Execute recovery task
    await queue.claim(recoveryCoord.task!.work_id, 'data-engineer');
    await queue.submitForReview(recoveryCoord.task!.work_id);
    const deRecoveryOutput: any = {
      role: 'data-engineer',
      summary: 'Added explicit UTC timestamp transformer',
      evidence_ids: ['EVID:SCHEMA-UTC-VALIDATED'],
    };
    await queue.complete(recoveryCoord.task!.work_id, ['EVID:SCHEMA-UTC-VALIDATED'], undefined, undefined, deRecoveryOutput);

    // Re-review passes
    const reReviewItem = await queue.create({
      project_id: 'macro-os',
      backlog_id: 'B-HOLD-3:ceo-re-review',
      title: 'CEO Re-review for UTC schema validation',
      role: 'ceo-guild',
      depends_on: [recoveryCoord.task!.work_id],
    });

    await queue.claim(reReviewItem.work_id, 'ceo');
    await queue.submitForReview(reReviewItem.work_id);
    const reReviewDone = await queue.complete(
      reReviewItem.work_id,
      ['EVID:SCHEMA-UTC-VALIDATED', 'EVID:CEO-PASS'],
      undefined,
      {
        verdict: 'PASS',
        gate: 'executive-gate',
        summary: 'Schema adheres to UTC invariant',
        evidence: ['EVID:SCHEMA-UTC-VALIDATED'],
        failure_class: 'NONE',
        root_cause: 'none',
        recovery_required: false,
        recovery_actions: [],
        unblock_evidence: [],
        retry_budget: 0,
        next_review_trigger: 'none',
        confidence: 1.0,
      },
      {
        role: 'ceo-guild',
        decision: 'ACCEPT',
        reason: 'Schema adheres to UTC invariant',
        evidence_ids: ['EVID:SCHEMA-UTC-VALIDATED', 'EVID:CEO-PASS'],
        dissent: [],
        next_workflow: 'release_gate',
        owner: 'ceo',
        retest_condition: 'none',
      }
    );

    expect(reReviewDone.state).toBe('DONE');
    expect(reReviewDone.review_verdict?.verdict).toBe('PASS');
  });

  // 4. Retry limit → terminal hold
  it('Scenario 4: retry limit → terminal hold', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'scenario4-'));
    const queue = new RoleWorkQueue(tmpDir);

    const item = await queue.create({
      project_id: 'macro-os',
      backlog_id: 'RECOVERY:EXHAUSTED',
      title: 'Exhausted Retry Task',
      role: 'backend-engineer',
    });

    const persistentFailVerdict: ReviewVerdict = {
      verdict: 'HOLD',
      gate: 'build-gate',
      summary: 'Upstream vendor service completely unreachable',
      evidence: ['EVID:NETWORK-500'],
      failure_class: 'INSUFFICIENT_EVIDENCE',
      root_cause: 'Provider downtime',
      recovery_required: true,
      recovery_actions: ['Retry connection'],
      accountable_role: 'backend-engineer',
      unblock_evidence: ['EVID:PROVIDER-ONLINE'],
      retry_budget: 1,
      next_review_trigger: 'EVID:PROVIDER-ONLINE',
      confidence: 0.8,
    };

    const recoveryPlan: RecoveryPlan = {
      recovery_id: 'REC-OUTAGE-1',
      source_decision_id: item.work_id,
      failure_class: 'INSUFFICIENT_EVIDENCE',
      root_cause: 'Provider downtime',
      actions: ['Retry connection'],
      accountable_role: 'backend-engineer',
      re_review_role: 'ceo-guild',
      dependency_updates: [item.work_id],
      required_evidence: ['EVID:PROVIDER-ONLINE'],
      acceptance_criteria: ['Online'],
      retry_budget: 1,
      priority: 'P1',
      re_review_trigger: 'online',
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
        structured_output: it.role === 'pm' ? { role: 'pm' as const, problem: 'test', target_user: 'analyst', product_goal_objective: 'reliable research', evidence_ids: [`E:${it.work_id}`], facts: ['fact'], assumptions: [], scope: ['scope'], non_goals: [], recommendation: 'PROCEED', confidence: 0.8, unknowns: [] } : it.role === 'backend-engineer' ? { role: 'backend-engineer' as const, files_changed: [], files_not_changed: [], implementation_summary: 'test', tests_run: ['unit'], tests_failed: [], known_limitations: [], rollback_instruction: 'revert', evidence_ids: [`E:${it.work_id}`] } : undefined,
        review_verdict: persistentFailVerdict,
      }),
      recoveryFor: () => recoveryPlan,
    });

    expect(result.status, JSON.stringify(result)).toBe('TERMINAL_HOLD');
    expect(result.failure_reason).toContain('Max recovery depth');
  });

  // 5. Context overflow → reject
  it('Scenario 5: context budget overflow → reject', async () => {
    // Attempting to build context with max_tokens smaller than mandatory items
    expect(() =>
      buildContextManifest({
        assignment_id: 'ASSIGN-1',
        level: 'L0',
        max_tokens: 5, // Unreasonably small budget
        target_tokens: 5,
        enforce_hard_limit: true,
        items: [
          {
            name: 'mandatory_assignment',
            category: 'assignment',
            content: 'This assignment description is much longer than five tokens and must trigger overflow rejection.',
          },
        ],
      })
    ).toThrow('CONTEXT_BUDGET_OVERFLOW');
  });

  // 6. Duplicate recovery → không tạo task mới
  it('Scenario 6: duplicate recovery → không tạo task mới (DEDUPLICATED)', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'scenario6-'));
    const queue = new RoleWorkQueue(tmpDir);

    const sourceTask = await queue.create({
      project_id: 'macro-os',
      backlog_id: 'B-DEDUP',
      title: 'Initial Failing Task',
      role: 'data-engineer',
    });

    const plan: RecoveryPlan = {
      recovery_id: 'REC-DEDUP-001',
      source_decision_id: sourceTask.work_id,
      failure_class: 'INSUFFICIENT_EVIDENCE',
      root_cause: 'Missing data source',
      actions: ['Fetch source'],
      accountable_role: 'data-engineer',
      re_review_role: 'ceo-guild',
      dependency_updates: [sourceTask.work_id],
      required_evidence: ['EVID:SOURCE-READY'],
      acceptance_criteria: ['Source ready'],
      retry_budget: 1,
      priority: 'P1',
      re_review_trigger: 'ready',
      terminal_if_failed: 'TERMINAL_HOLD',
    };

    // 1st recovery attempt -> CREATED
    const first = await coordinateRecovery({
      queue,
      plan,
      projectId: 'macro-os',
      runId: 'run-dedup',
      namespace: 'test',
      sourceWorkId: sourceTask.work_id,
      attempts: 0,
    });
    expect(first.status).toBe('CREATED');
    expect(first.task).toBeDefined();

    // 2nd recovery attempt with same plan & source -> DEDUPLICATED
    const second = await coordinateRecovery({
      queue,
      plan,
      projectId: 'macro-os',
      runId: 'run-dedup',
      namespace: 'test',
      sourceWorkId: sourceTask.work_id,
      attempts: 0,
    });
    expect(second.status).toBe('DEDUPLICATED');
    expect(second.task?.work_id).toBe(first.task?.work_id);

    // Check queue: only 3 tasks total (source + single recovery task + single re-review task)
    const records = await queue.records('macro-os');
    expect(records).toHaveLength(3);
  });

  // 7. Product task thiếu metric → không được DONE
  it('Scenario 7: product task thiếu metric contract → không được DONE', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'scenario7-'));
    const queue = new RoleWorkQueue(tmpDir);

    const [item] = await queue.createBatch([
      {
        work_id: 'WORK-PM-007',
        project_id: 'macro-os',
        backlog_id: 'B-PROD-007',
        title: 'Macro Dashboard Funnel Discovery',
        role: 'pm',
        assignment: {
          assignment_id: 'ASSIGN:PROD-007',
          run_id: 'run-7',
          namespace: 'test',
          product_id: 'macro-os',
          objective_id: 'B-PROD-007',
          work_id: 'WORK-PM-007',
          role: 'pm',
          task_type: 'product_discovery',
          objective: 'Discover user dropoff factors in Macro Dashboard',
          product_goal_alignment: ['docs/PRODUCT_GOAL.md alignment required'],
          scope: ['docs'],
          allowed_paths: ['docs'],
          forbidden_paths: ['.ai-company/runtime', '.ai-company/company-state.json', '.env'],
          allowed_tools: ['grep_search'],
          forbidden_tools: ['deploy'],
          inputs: ['goal'],
          evidence_manifest: ['docs'],
          dependencies: [],
          acceptance_criteria: ['baseline established'],
          output_schema: 'pm-output-v1',
          allowed_verdicts: ['PASS'],
          risk_level: 'P2',
          mutation_policy: 'read_only',
          test_policy: 'none',
          context_budget: { target_tokens: 1000, max_tokens: 2000 },
          token_budget: 4000,
          timeout: 60,
          retry_budget: 1,
          escalation_policy: 'bounded',
        },
      },
    ]);

    await queue.claim(item.work_id, 'pm-agent');
    await queue.submitForReview(item.work_id);

    // Attempting complete without metric contract rejects
    await expect(queue.complete(item.work_id, ['EVID:DISCOVERY-NOTE'])).rejects.toThrow(
      'product task requires valid MetricContract with baseline and target before marking DONE'
    );

    // Succeeds when valid metric contract is provided
    const validPmOutput: any = {
      role: 'pm',
      problem: 'Dashboard funnel dropoff',
      target_user: 'Macro Analyst',
      product_goal_objective: 'Reduce funnel churn',
      evidence_ids: ['EVID:DISCOVERY-NOTE'],
      facts: ['Churn rate is 45%'],
      assumptions: ['Fast insights reduce dropoff'],
      scope: ['docs'],
      non_goals: ['New database'],
      recommendation: 'PROCEED',
      confidence: 0.85,
      unknowns: [],
    };
    const done = await queue.complete(
      item.work_id,
      ['EVID:DISCOVERY-NOTE'],
      undefined,
      undefined,
      validPmOutput,
      {
        metric_name: 'funnel_step_dropoff_pct',
        baseline: 45,
        target: 20,
        measurement_window: '14d',
        minimum_sample_size: 100,
        failure_condition: 'dropoff > 30%',
        data_source: 'live_user_funnel_telemetry',
      }
    );

    expect(done.state).toBe('DONE');
    expect(done.metric_contract?.metric_name).toBe('funnel_step_dropoff_pct');
  });

  // 8. Rejected memory ngăn proposal lặp lại (anti-regression)
  it('Scenario 8: rejected memory ngăn proposal lặp lại (anti-regression)', async () => {
    const memory = new ProductMemoryLedger(process.cwd());

    // Proposal matches previously rejected REJ-001
    const badProposal = {
      title: 'Automate autonomous deploy to production without human verification',
      problem: 'Human verification adds latency to release cycle',
      action: 'Bypass human gate for direct production autonomy',
      keywords: ['autonomous deploy', 'un-gated production autonomy'],
    };

    const memoryCheck = await memory.checkProposalAgainstRejected(badProposal);
    expect(memoryCheck.is_rejected).toBe(true);
    expect(memoryCheck.matched_memory?.id).toBe('REJ-001');

    // Trying to admit an assignment matching rejected memory is blocked
    const envelope: AssignmentEnvelope = {
      assignment_id: 'ASSIGN:REJ-TEST',
      run_id: 'run-rej',
      namespace: 'test',
      product_id: 'macro-os',
      objective_id: 'OBJ-REJ',
      work_id: 'WORK-REJ',
      role: 'sre',
      task_type: 'production_operation',
      objective: 'Bypass human gate for direct production autonomy',
      product_goal_alignment: ['docs/PRODUCT_GOAL.md alignment required'],
      scope: ['production'],
      allowed_paths: ['server'],
      forbidden_paths: ['.ai-company/runtime', '.ai-company/company-state.json', '.env'],
      allowed_tools: ['deploy'],
      forbidden_tools: ['cat_passwd'],
      inputs: ['goal'],
      evidence_manifest: ['docs'],
      dependencies: [],
      acceptance_criteria: ['deploy success'],
      output_schema: 'out-v1',
      allowed_verdicts: ['PASS'],
      risk_level: 'P0',
      mutation_policy: 'worktree',
      test_policy: 'full_suite',
      context_budget: { target_tokens: 1000, max_tokens: 2000 },
      token_budget: 4000,
      timeout: 60,
      retry_budget: 1,
      escalation_policy: 'bounded',
    };

    const admissionResult = evaluateAssignmentAdmission(envelope, {
      hasHumanApproval: true,
      rejectedMemories: [
        {
          id: memoryCheck.matched_memory!.id,
          title: memoryCheck.matched_memory!.title,
          keywords: memoryCheck.matched_memory!.keywords,
          rejection_reason: memoryCheck.matched_memory!.rejection_reason,
        },
      ],
    });

    expect(admissionResult.decision).toBe('REJECTED_POLICY');
    expect(admissionResult.reasons[0]).toContain('previously rejected direction (REJ-001)');
  });

  // 9. Negative test: Local harness outcome cannot claim WIN
  it('Negative test: local harness outcome is explicitly prevented from claiming WIN', async () => {
    const { evaluateMetricOutcome } = await import('./productOutcomeValidator');
    const contract = {
      metric_name: 'query_p95_latency_ms',
      baseline: 500,
      target: 200,
      measurement_window: '14d',
      minimum_sample_size: 200,
      failure_condition: 'p95 > 250ms',
      data_source: 'live_user_funnel_telemetry',
    };

    const localPassResult = evaluateMetricOutcome(contract, {
      is_production: false, // Local harness only!
      sample_size: 500,
      measured_value: 150, // Exceeds target
    });

    expect(localPassResult.state).toBe('AWAITING_PRODUCTION_TELEMETRY');
    expect(localPassResult.is_win_eligible).toBe(false);
    expect(localPassResult.reasons[0]).toContain('not live production traffic');
  });

  // 10. Negative test: Provider timeout triggers CIRCUIT_OPEN and blocks execution
  it('Negative test: provider timeout triggers circuit breaker and prevents unbounded retry', async () => {
    const { ProviderCircuitBreaker } = await import('./providerCircuitBreaker');
    const breaker = new ProviderCircuitBreaker(2, 60_000);

    breaker.failure();
    breaker.failure();

    expect(breaker.allow()).toBe(false);
    expect(breaker.state()).toBe('OPEN');
  });
});
