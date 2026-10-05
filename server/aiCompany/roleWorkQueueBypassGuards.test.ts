import { describe, it, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { RoleWorkQueue } from './roleWorkQueue';
import type { AnyStructuredRoleOutput } from './structuredRoleOutput';
import { InMemoryEvidenceResolver } from './evidenceResolver';

describe('RoleWorkQueue Bypass Guards (Phase 1)', () => {
  async function createTestQueue() {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'queue-guards-'));
    const resolver = new InMemoryEvidenceResolver();
    const queue = new RoleWorkQueue(dir, resolver);
    return { queue, dir, resolver };
  }

  it('rejects evidence-only completion when no contract is provided', async () => {
    const { queue, dir } = await createTestQueue();
    const item = await queue.create({
      project_id: 'macro-os',
      backlog_id: 'BACKLOG-001',
      title: 'Infrastructure health check',
      role: 'sre',
    });
    const claimAuthority1 = await queue.claim(item.work_id, 'worker:sre');
    await queue.submitForReview(item.work_id, claimAuthority1.attempt_authority);

    // Attempting to complete with ONLY evidence_ids
    await expect(queue.complete(item.work_id, ['EVID:TEST-1'], undefined, undefined, undefined, undefined, undefined, claimAuthority1.attempt_authority)).rejects.toThrow(
      'evidence-only completion is forbidden'
    );
    await rm(dir, { recursive: true, force: true });
  });

  it('rejects completion when structured output is missing for structured roles', async () => {
    const { queue, dir } = await createTestQueue();
    const item = await queue.create({
      project_id: 'macro-os',
      backlog_id: 'BACKLOG-002',
      title: 'Tech lead architecture review',
      role: 'tech-lead',
    });
    const claimAuthority2 = await queue.claim(item.work_id, 'worker:tech-lead');
    await queue.submitForReview(item.work_id, claimAuthority2.attempt_authority);

    // Missing structuredOutput
    await expect(queue.complete(item.work_id, ['EVID:TECH-LEAD-1'], undefined, undefined, undefined, undefined, undefined, claimAuthority2.attempt_authority)).rejects.toThrow(
      'role tech-lead requires valid structuredOutput before marking DONE'
    );
    await rm(dir, { recursive: true, force: true });
  });

  it('rejects completion when wrong role contract is provided in structured output', async () => {
    const { queue, dir } = await createTestQueue();
    const item = await queue.create({
      project_id: 'macro-os',
      backlog_id: 'BACKLOG-003',
      title: 'Backend persistence fix',
      role: 'backend-engineer',
    });
    const claimAuthority3 = await queue.claim(item.work_id, 'worker:backend');
    await queue.submitForReview(item.work_id, claimAuthority3.attempt_authority);

    // Passing PM structured output for a backend-engineer task
    const pmOutput: AnyStructuredRoleOutput = {
      role: 'pm',
      problem: 'Macro indicators are stale',
      target_user: 'Macro Analyst',
      product_goal_objective: 'Real-time indicators',
      evidence_ids: ['EVID:PM-1'],
      facts: ['Data delayed by 2 days'],
      assumptions: ['API quota available'],
      scope: ['server/macroDataRouter.ts'],
      non_goals: ['UI redesign'],
      recommendation: 'Add streaming poll',
      confidence: 0.9,
      unknowns: [],
    };

    await expect(
      queue.complete(item.work_id, ['EVID:BACKEND-1'], undefined, undefined, pmOutput, undefined, undefined, claimAuthority3.attempt_authority)
    ).rejects.toThrow('structuredOutput role contract mismatch: declared pm, expected backend-engineer');
    await rm(dir, { recursive: true, force: true });
  });

  it('rejects completion when review role lacks ReviewVerdict or ReviewEvidenceRecord', async () => {
    const { queue, dir } = await createTestQueue();
    const item = await queue.create({
      project_id: 'macro-os',
      backlog_id: 'BACKLOG-004',
      title: 'Quality control gate',
      role: 'quality-control',
    });
    const claimAuthority4 = await queue.claim(item.work_id, 'worker:qc');
    await queue.submitForReview(item.work_id, claimAuthority4.attempt_authority);

    // Passing only evidence IDs without ReviewVerdict or ReviewEvidenceRecord
    await expect(queue.complete(item.work_id, ['EVID:QC-1'], undefined, undefined, undefined, undefined, undefined, claimAuthority4.attempt_authority)).rejects.toThrow(
      'evidence-only completion is forbidden'
    );
    await rm(dir, { recursive: true, force: true });
  });

  it('rejects completion when evidence IDs are empty, whitespace, or invalid', async () => {
    const { queue, dir } = await createTestQueue();
    const item = await queue.create({
      project_id: 'macro-os',
      backlog_id: 'BACKLOG-005',
      title: 'Task with bad evidence',
      role: 'backend-engineer',
    });
    const claimAuthority5 = await queue.claim(item.work_id, 'worker:backend');
    await queue.submitForReview(item.work_id, claimAuthority5.attempt_authority);

    const validCoderOutput: AnyStructuredRoleOutput = {
      role: 'coder',
      files_changed: ['server/index.ts'],
      files_not_changed: [],
      implementation_summary: 'Fixed probe',
      tests_run: ['npm test'],
      tests_failed: [],
      known_limitations: [],
      rollback_instruction: 'git revert',
      evidence_ids: ['EVID:VALID-1'],
    };

    // Empty array
    await expect(
      queue.complete(item.work_id, [], undefined, undefined, validCoderOutput, undefined, undefined, claimAuthority5.attempt_authority)
    ).rejects.toThrow('completion evidence is required');

    // Invalid format: whitespace or bad chars
    await expect(
      queue.complete(item.work_id, ['   '], undefined, undefined, validCoderOutput, undefined, undefined, claimAuthority5.attempt_authority)
    ).rejects.toThrow('invalid evidence ID format');

    await expect(
      queue.complete(item.work_id, ['bad/evidence#id'], undefined, undefined, validCoderOutput, undefined, undefined, claimAuthority5.attempt_authority)
    ).rejects.toThrow('invalid evidence ID format');

    await rm(dir, { recursive: true, force: true });
  });

  it('rejects product task when MetricContract is missing', async () => {
    const { queue, dir } = await createTestQueue();
    const [item] = await queue.createBatch([
      {
        work_id: 'WORK-PROD-GUARD-1',
        project_id: 'macro-os',
        backlog_id: 'BACKLOG-PROD-GUARD',
        title: 'Product Discovery Metric Check',
        role: 'pm',
        assignment: {
          assignment_id: 'ASSIGNMENT:PROD-GUARD-1',
          run_id: 'run-guard-1',
          namespace: 'test',
          product_id: 'macro-os',
          objective_id: 'BACKLOG-PROD-GUARD',
          work_id: 'WORK-PROD-GUARD-1',
          role: 'pm',
          task_type: 'product_discovery',
          objective: 'Discover user churn',
          product_goal_alignment: ['Goal alignment'],
          scope: ['docs'],
          allowed_paths: ['docs'],
          forbidden_paths: ['.env'],
          allowed_tools: ['grep_search'],
          forbidden_tools: ['deploy'],
          inputs: ['telemetry'],
          evidence_manifest: ['docs'],
          dependencies: [],
          acceptance_criteria: ['Churn metrics defined'],
          output_schema: 'pm-output-v1',
          allowed_verdicts: ['PASS', 'HOLD'],
          risk_level: 'P1',
          mutation_policy: 'read_only',
          test_policy: 'targeted',
          context_budget: { target_tokens: 1000, max_tokens: 2000 },
          token_budget: 4000,
          timeout: 60,
          retry_budget: 1,
          escalation_policy: 'bounded',
        },
      },
    ]);

    const claimAuthority6 = await queue.claim(item.work_id, 'worker:pm');
    await queue.submitForReview(item.work_id, claimAuthority6.attempt_authority);

    const pmOutput: AnyStructuredRoleOutput = {
      role: 'pm',
      problem: 'User dropoff during forecast view',
      target_user: 'Macro Analyst',
      product_goal_objective: 'Improve forecast retention',
      evidence_ids: ['EVID:PM-DISCOVERY-1'],
      facts: ['Churn is 24%'],
      assumptions: ['Forecast page is too slow'],
      scope: ['docs'],
      non_goals: ['New database'],
      recommendation: 'Cache forecast calculations',
      confidence: 0.85,
      unknowns: [],
    };

    // MetricContract is missing
    await expect(
      queue.complete(item.work_id, ['EVID:PM-DISCOVERY-1'], undefined, undefined, pmOutput, undefined, undefined, claimAuthority6.attempt_authority)
    ).rejects.toThrow('product task requires valid MetricContract');

    await rm(dir, { recursive: true, force: true });
  });

  it('allows completion when all required contracts are validly supplied', async () => {
    const { queue, dir, resolver } = await createTestQueue();
    const item = await queue.create({
      project_id: 'macro-os',
      backlog_id: 'BACKLOG-006',
      title: 'Valid coder implementation',
      role: 'coder',
    });
    const claimAuthority7 = await queue.claim(item.work_id, 'worker:coder');
    await queue.submitForReview(item.work_id, claimAuthority7.attempt_authority);

    const validOutput: AnyStructuredRoleOutput = {
      role: 'coder',
      files_changed: ['server/macroDataRouter.ts'],
      files_not_changed: [],
      implementation_summary: 'Added validated stream parser',
      tests_run: ['npm test'],
      tests_failed: [],
      known_limitations: [],
      rollback_instruction: 'git revert',
      evidence_ids: ['EVID:BACKEND-SUCCESS-1'],
    };

    const evidence = resolver.createEvidence({ evidence_id: 'EVID:BACKEND-SUCCESS-1', namespace: item.assignment!.namespace, run_id: item.assignment!.run_id, produced_by_role: 'coder', content: 'Isolated contract test fixture; no product delivery proof.' });
    resolver.register({ ...evidence, work_id: item.work_id, source_artifact: 'roleWorkQueueBypassGuards.test.ts' });
    const done = await queue.complete(
      item.work_id,
      ['EVID:BACKEND-SUCCESS-1'],
      undefined,
      undefined,
      validOutput
    , undefined, undefined, claimAuthority7.attempt_authority);

    expect(done.state).toBe('DONE');
    expect(done.structured_output).toEqual(validOutput);
    await rm(dir, { recursive: true, force: true });
  });

  it('rejects coder task when output_schema is set to none to attempt bypass', async () => {
    const { queue, dir } = await createTestQueue();
    const [item] = await queue.createBatch([
      {
        work_id: 'WORK-CODER-BYPASS',
        project_id: 'macro-os',
        backlog_id: 'BACKLOG-CODER-BYPASS',
        title: 'Coder task trying output_schema none bypass',
        role: 'coder',
        assignment: {
          assignment_id: 'ASSIGNMENT:CODER-BYPASS',
          run_id: 'run-bypass',
          namespace: 'test',
          product_id: 'macro-os',
          objective_id: 'BACKLOG-CODER-BYPASS',
          work_id: 'WORK-CODER-BYPASS',
          role: 'coder',
          task_type: 'implementation',
          objective: 'Bypass output schema',
          product_goal_alignment: ['Goal'],
          scope: ['server/index.ts'],
          allowed_paths: ['server/index.ts'],
          forbidden_paths: ['.env'],
          allowed_tools: ['edit'],
          forbidden_tools: ['deploy'],
          inputs: ['specs'],
          evidence_manifest: ['code'],
          dependencies: [],
          acceptance_criteria: ['Code written'],
          output_schema: 'none', // attempting to bypass
          allowed_verdicts: ['PASS', 'HOLD'],
          risk_level: 'P1',
          mutation_policy: 'worktree',
          test_policy: 'targeted',
          context_budget: { target_tokens: 1000, max_tokens: 2000 },
          token_budget: 4000,
          timeout: 60,
          retry_budget: 1,
          escalation_policy: 'bounded',
        },
      },
    ]);

    const claimAuthority8 = await queue.claim(item.work_id, 'worker:coder');
    await queue.submitForReview(item.work_id, claimAuthority8.attempt_authority);

    await expect(
      queue.complete(item.work_id, ['EVID:CODER-1'], undefined, undefined, undefined, undefined, undefined, claimAuthority8.attempt_authority)
    ).rejects.toThrow('role coder requires valid structuredOutput before marking DONE');

    await rm(dir, { recursive: true, force: true });
  });

  it('rejects coder task when reviewVerdict is provided but structuredOutput is missing', async () => {
    const { queue, dir } = await createTestQueue();
    const item = await queue.create({
      project_id: 'macro-os',
      backlog_id: 'BACKLOG-CODER-VERDICT-ONLY',
      title: 'Coder with verdict but no structuredOutput',
      role: 'coder',
    });
    const claimAuthority9 = await queue.claim(item.work_id, 'worker:coder');
    await queue.submitForReview(item.work_id, claimAuthority9.attempt_authority);

    const verdict = {
      verdict: 'PASS' as const,
      gate: 'implementation',
      summary: 'Sneaky pass verdict without code structure',
      evidence: ['EVID:CODER-VERDICT-1'],
      failure_class: 'NONE' as const,
      root_cause: 'none',
      recovery_required: false,
      recovery_actions: [],
      unblock_evidence: [],
      retry_budget: 0,
      next_review_trigger: 'release',
      confidence: 1.0,
    };

    // Passing reviewVerdict for a coder role without structuredOutput
    await expect(
      queue.complete(item.work_id, ['EVID:CODER-VERDICT-1'], undefined, verdict, undefined, undefined, undefined, claimAuthority9.attempt_authority)
    ).rejects.toThrow('role coder requires valid structuredOutput before marking DONE');

    await rm(dir, { recursive: true, force: true });
  });

  it('rejects backend-engineer task when only evidence is provided', async () => {
    const { queue, dir } = await createTestQueue();
    const item = await queue.create({
      project_id: 'macro-os',
      backlog_id: 'BACKLOG-BE-EVID-ONLY',
      title: 'Backend engineer evidence only',
      role: 'backend-engineer',
    });
    const claimAuthority10 = await queue.claim(item.work_id, 'worker:backend');
    await queue.submitForReview(item.work_id, claimAuthority10.attempt_authority);

    await expect(
      queue.complete(item.work_id, ['EVID:BE-1'], undefined, undefined, undefined, undefined, undefined, claimAuthority10.attempt_authority)
    ).rejects.toThrow('role backend-engineer requires valid structuredOutput before marking DONE');

    await rm(dir, { recursive: true, force: true });
  });

  it('rejects review role when structuredOutput is provided but review contract is missing', async () => {
    const { queue, dir } = await createTestQueue();
    const item = await queue.create({
      project_id: 'macro-os',
      backlog_id: 'BACKLOG-QA-NO-VERDICT',
      title: 'QA task with structured output but missing review verdict',
      role: 'functional-qa',
    });
    const claimAuthority11 = await queue.claim(item.work_id, 'worker:qa');
    await queue.submitForReview(item.work_id, claimAuthority11.attempt_authority);

    const output: AnyStructuredRoleOutput = {
      role: 'functional-qa',
      expected_result: 'Tests pass',
      actual_result: 'Tests pass',
      environment: 'local',
      test_matrix: [{ test_name: 'unit', expected: 'PASS', actual: 'PASS', status: 'PASS' }],
      verdict: 'PASS',
      unresolved_issues: [],
      evidence_ids: ['EVID:QA-OUTPUT-1'],
    };

    // Review contract (ReviewVerdict or ReviewEvidenceRecord) is missing
    await expect(
      queue.complete(item.work_id, ['EVID:QA-OUTPUT-1'], undefined, undefined, output, undefined, undefined, claimAuthority11.attempt_authority)
    ).rejects.toThrow('review role functional-qa requires valid ReviewVerdict or ReviewEvidenceRecord before marking DONE');

    await rm(dir, { recursive: true, force: true });
  });
});
