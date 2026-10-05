import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RoleWorkQueue } from './roleWorkQueue';
import { InMemoryEvidenceResolver } from './evidenceResolver';

function registerFixtureEvidence(resolver: InMemoryEvidenceResolver, item: Awaited<ReturnType<RoleWorkQueue['create']>>, id: string) {
  const evidence = resolver.createEvidence({ evidence_id: id, namespace: item.assignment!.namespace, run_id: item.assignment!.run_id, produced_by_role: item.role, content: 'Isolated queue lifecycle test fixture; no product outcome.' });
  resolver.register({ ...evidence, work_id: item.work_id, source_artifact: 'roleWorkQueue.test.ts' });
}

describe('role work queue', () => {
  it('puts mandatory secret and control-plane paths in default assignments', async () => {
    const queue = new RoleWorkQueue(await mkdtemp(path.join(os.tmpdir(), 'role-work-assignment-')));
    const item = await queue.create({ project_id: 'macro-os', backlog_id: 'B-ASSIGN', title: 'assignment defaults', role: 'pm' });
    expect(item.assignment?.forbidden_paths).toEqual(expect.arrayContaining(['.env', '.ai-company/runtime', '.ai-company/company-state.json']));
  });

  it('enforces role ownership lifecycle and evidence-backed completion', async () => {
    const resolver = new InMemoryEvidenceResolver();
    const queue = new RoleWorkQueue(await mkdtemp(path.join(os.tmpdir(), 'role-work-')), resolver);
    const item = await queue.create({ project_id: 'macro-os', backlog_id: 'BACKLOG-051', title: 'Repair provider contract', role: 'data-engineer' });
    await expect(queue.complete(item.work_id, [])).rejects.toThrow('not in review');
    const claimAuthority1 = await queue.claim(item.work_id, 'data-team');
    await queue.submitForReview(item.work_id, claimAuthority1.attempt_authority);
    const dataOutput: any = { role: 'data-engineer', summary: 'Repaired provider schema', evidence_ids: ['FRED-AUDIT-1'] };
    registerFixtureEvidence(resolver, item, 'FRED-AUDIT-1');
    const done = await queue.complete(item.work_id, ['FRED-AUDIT-1'], undefined, undefined, dataOutput, undefined, undefined, claimAuthority1.attempt_authority);
    expect(done).toMatchObject({ state: 'DONE', evidence_ids: ['FRED-AUDIT-1'] });
    await expect(queue.claim(item.work_id, 'another-team')).rejects.toThrow('not ready');
    await expect(queue.summary('macro-os')).resolves.toMatchObject({ total: 1, byState: { DONE: 1, READY: 0 } });
  });

  it('recovers stale claimed and in-review work for restart', async () => {
    const queue = new RoleWorkQueue(await mkdtemp(path.join(os.tmpdir(), 'role-work-recovery-')));
    const item = await queue.create({ project_id: 'macro-os', backlog_id: 'BACKLOG-RECOVERY', title: 'recover me', role: 'backend-engineer' });
    await queue.claim(item.work_id, 'worker:backend-engineer');
    const recovered = await queue.recoverStaleLeases('macro-os', 1_000, new Date(Date.now() + 2_000));
    expect(recovered[0]).toMatchObject({ state: 'READY', owner: undefined });
    expect(recovered[0].blocked_reason).toContain('stale lease recovered');
  });

  it('quarantines blocked work with provenance and preserves the append-only record', async () => {
    const queue = new RoleWorkQueue(await mkdtemp(path.join(os.tmpdir(), 'role-work-quarantine-')));
    const old = await queue.create({ project_id: 'macro-os', backlog_id: 'OLD', title: 'old blocked', role: 'pm' });
    await queue.block(old.work_id, 'historical provider failure');
    const result = await queue.quarantineBlocked('macro-os', new Date(Date.now() + 1), 'maintenance quarantine');
    expect(result.map((item) => item.work_id)).toEqual([old.work_id]);
    await expect(queue.records('macro-os')).resolves.toEqual([expect.objectContaining({ work_id: old.work_id, state: 'QUARANTINED', blocked_reason: expect.stringContaining('maintenance quarantine') })]);
  });

  it('quarantines stale READY work without touching current READY work', async () => {
    const queue = new RoleWorkQueue(await mkdtemp(path.join(os.tmpdir(), 'role-work-ready-quarantine-')));
    const item = await queue.create({ project_id: 'macro-os', backlog_id: 'READY-OLD', title: 'old ready', role: 'pm' });
    const result = await queue.quarantineStaleReady('macro-os', new Date(Date.now() + 1), 'stale ready quarantine');
    expect(result).toHaveLength(1);
    await expect(queue.records('macro-os')).resolves.toEqual([expect.objectContaining({ work_id: item.work_id, state: 'QUARANTINED', blocked_reason: 'stale ready quarantine' })]);
  });

  it('does not let downstream roles claim before upstream evidence is complete', async () => {
    const resolver = new InMemoryEvidenceResolver();
    const queue = new RoleWorkQueue(await mkdtemp(path.join(os.tmpdir(), 'role-work-deps-')), resolver);
    const implementation = await queue.create({ project_id: 'macro-os', backlog_id: 'BACKLOG-DEPS', title: 'implement slice', role: 'backend-engineer' });
    const qa = await queue.create({ project_id: 'macro-os', backlog_id: 'BACKLOG-DEPS:qa', title: 'functional verification', role: 'functional-qa', depends_on: [implementation.work_id] });
    await expect(queue.claim(qa.work_id, 'qa-agent')).rejects.toThrow(`work dependencies are not complete: ${implementation.work_id}`);
    const claimAuthority3 = await queue.claim(implementation.work_id, 'backend-agent');
    await queue.submitForReview(implementation.work_id, claimAuthority3.attempt_authority);
    const backendOutput: any = { role: 'backend-engineer', summary: 'Implemented slice', evidence_ids: ['IMPLEMENTATION-EVIDENCE'] };
    registerFixtureEvidence(resolver, implementation, 'IMPLEMENTATION-EVIDENCE');
    await queue.complete(implementation.work_id, ['IMPLEMENTATION-EVIDENCE'], undefined, undefined, backendOutput, undefined, undefined, claimAuthority3.attempt_authority);
    await expect(queue.claim(qa.work_id, 'qa-agent')).resolves.toMatchObject({ state: 'CLAIMED', depends_on: [implementation.work_id] });
  });

  it('rejects completion if structured output validation fails', async () => {
    const queue = new RoleWorkQueue(await mkdtemp(path.join(os.tmpdir(), 'role-work-structured-')));
    const item = await queue.create({ project_id: 'macro-os', backlog_id: 'BACKLOG-STRUCT', title: 'PM task', role: 'pm' });
    const claimAuthority4 = await queue.claim(item.work_id, 'pm-agent');
    await queue.submitForReview(item.work_id, claimAuthority4.attempt_authority);

    // Invalid structured output: missing required fields
    const invalidOutput: any = { role: 'pm', problem: '' };
    await expect(queue.complete(item.work_id, ['EVID-1'], undefined, undefined, invalidOutput, undefined, undefined, claimAuthority4.attempt_authority)).rejects.toThrow(
      'structured output validation failed'
    );
  });

  it('rejects completing product task when MetricContract is missing or invalid', async () => {
    const resolver = new InMemoryEvidenceResolver();
    const queue = new RoleWorkQueue(await mkdtemp(path.join(os.tmpdir(), 'role-work-metric-')), resolver);
    const [item] = await queue.createBatch([
      {
        work_id: 'WORK-PROD-1',
        project_id: 'macro-os',
        backlog_id: 'BACKLOG-PROD',
        title: 'Product Discovery Investigation',
        role: 'pm',
        assignment: {
          assignment_id: 'ASSIGNMENT:PROD-1',
          run_id: 'run-1',
          namespace: 'test',
          product_id: 'macro-os',
          objective_id: 'BACKLOG-PROD',
          work_id: 'WORK-PROD-1',
          role: 'pm',
          task_type: 'product_discovery',
          objective: 'Product discovery for macro signals',
          product_goal_alignment: ['docs/PRODUCT_GOAL.md alignment'],
          scope: ['docs'],
          allowed_paths: ['docs'],
          forbidden_paths: ['.ai-company/runtime', '.ai-company/company-state.json', '.env'],
          allowed_tools: ['grep_search'],
          forbidden_tools: ['deploy'],
          inputs: ['goal'],
          evidence_manifest: ['docs'],
          dependencies: [],
          acceptance_criteria: ['metric baseline documented'],
          output_schema: 'pm-v1',
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

    const claimAuthority5 = await queue.claim(item.work_id, 'pm-agent');
    await queue.submitForReview(item.work_id, claimAuthority5.attempt_authority);

    // 1. Fails when metric contract is omitted entirely
    await expect(queue.complete(item.work_id, ['EVID-DISCOVERY-1'], undefined, undefined, undefined, undefined, undefined, claimAuthority5.attempt_authority)).rejects.toThrow(
      'product task requires valid MetricContract with baseline and target before marking DONE'
    );

    // 2. Fails when metric contract has invalid/missing baseline
    const invalidMetricContract: any = {
      metric_name: 'query_latency',
      baseline: 'not-a-number',
      target: 100,
      measurement_window: '7d',
      minimum_sample_size: 50,
      failure_condition: '> 200ms',
      data_source: 'local_events',
    };
    await expect(
      queue.complete(item.work_id, ['EVID-DISCOVERY-1'], undefined, undefined, undefined, invalidMetricContract, undefined, claimAuthority5.attempt_authority)
    ).rejects.toThrow('invalid metric contract: baseline must be a finite number');

    // 3. Succeeds when valid metric contract is provided
    const validMetricContract = {
      metric_name: 'query_latency_ms',
      baseline: 350,
      target: 150,
      measurement_window: '7d',
      minimum_sample_size: 100,
      failure_condition: 'p95 > 200ms',
      data_source: 'production_access_logs',
    };
    const validPmOutput: any = {
      role: 'pm',
      problem: 'Query latency exceeds user expectations',
      target_user: 'Macro Analyst',
      product_goal_objective: 'Optimize macro signals latency',
      evidence_ids: ['EVID-DISCOVERY-1'],
      facts: ['Baseline p95 is 350ms'],
      assumptions: ['Caching improves latency'],
      scope: ['docs'],
      non_goals: ['Rewriting DB'],
      recommendation: 'PROCEED',
      confidence: 0.9,
      unknowns: [],
    };
    registerFixtureEvidence(resolver, item, 'EVID-DISCOVERY-1');
    const completed = await queue.complete(
      item.work_id,
      ['EVID-DISCOVERY-1'],
      undefined,
      undefined,
      validPmOutput,
      validMetricContract
    , undefined, claimAuthority5.attempt_authority);
    expect(completed.state).toBe('DONE');
    expect(completed.metric_contract).toMatchObject(validMetricContract);
  });

  it('reconciles unclaimable orphans whose dependencies are quarantined or blocked', async () => {
    const queue = new RoleWorkQueue(await mkdtemp(path.join(os.tmpdir(), 'role-work-orphan-')));
    const parent = await queue.create({
      project_id: 'proj',
      backlog_id: 'PARENT',
      title: 'Parent work item',
      role: 'pm',
    });
    const child = await queue.create({
      project_id: 'proj',
      backlog_id: 'CHILD',
      title: 'Child work item',
      role: 'coder',
      depends_on: [parent.work_id],
    });

    expect(child.state).toBe('READY');

    // Quarantine the parent work item
    await queue.quarantine(parent.work_id, 'failed security review');

    // Child is currently stuck in READY as an unclaimable orphan
    await expect(queue.claim(child.work_id, 'coder-agent')).rejects.toThrow('work dependencies are not complete');

    // Run reconcileOrphanedReady
    const reconciled = await queue.reconcileOrphanedReady('proj');
    expect(reconciled).toHaveLength(1);
    expect(reconciled[0].work_id).toBe(child.work_id);
    expect(reconciled[0].state).toBe('QUARANTINED');
    expect(reconciled[0].blocked_reason).toContain('UPSTREAM_DEPENDENCY_TERMINATED');

    const updatedChild = (await queue.records('proj')).find((r) => r.work_id === child.work_id);
    expect(updatedChild?.state).toBe('QUARANTINED');
  });
});
