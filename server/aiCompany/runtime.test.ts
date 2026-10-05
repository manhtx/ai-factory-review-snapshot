import { describe, expect, it, vi } from 'vitest';
import { startCeoBriefRuntime } from './runtime';
import { createProductCompanyRuntime } from './runtime';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { InMemoryEvidenceResolver } from './evidenceResolver';

const health = async () => ({ total_events: 0, released_tasks: 0, revised_tasks: 0, blocked_tasks: 0, agent_failure_rate: 0, rework_rate: 0, cost_per_validated_outcome_usd: 0, evidence_coverage: 0, recovery_success_rate: 0 });
const roleContract = (item: { role: string; work_id: string }) => {
  const evidence_ids = [`E-${item.work_id}`];
  if (item.role === 'pm') return { role: 'pm' as const, problem: 'test', target_user: 'analyst', product_goal_objective: 'reliable research', evidence_ids, facts: ['fact'], assumptions: [], scope: ['scope'], non_goals: [], recommendation: 'PROCEED', confidence: 0.8, unknowns: [] };
  if (item.role === 'tech-lead') return { role: 'tech-lead' as const, architecture_impact: 'none', affected_modules: ['test'], risk: 'low', rollback: 'revert', migration_requirement: 'none', test_strategy: 'unit', security_boundary: 'local', evidence_ids, recommendation: 'BUILD' as const };
  if (['coder', 'backend-engineer', 'frontend-engineer', 'data-engineer'].includes(item.role)) return { role: item.role as any, files_changed: [], files_not_changed: [], implementation_summary: 'test', tests_run: ['unit'], tests_failed: [], known_limitations: [], rollback_instruction: 'revert', evidence_ids };
  if (item.role === 'functional-qa') return { role: 'functional-qa' as const, test_matrix: [{ test_name: 'unit', expected: 'pass', actual: 'pass', status: 'PASS' as const }], expected_result: 'pass', actual_result: 'pass', environment: 'test', unresolved_issues: [], evidence_ids, verdict: 'PASS' as const };
  if (item.role === 'quality-control') return { role: 'quality-control' as const, evidence_independently_checked: evidence_ids, contradictory_evidence: [], unsupported_claims: [], scope_drift: [], reproducibility: 'REPRODUCIBLE' as const, evidence_ids, verdict: 'PASS' as const };
  if (item.role === 'ceo' || item.role === 'ceo-guild') return { role: item.role as any, decision: 'ACCEPT' as const, reason: 'test', evidence_ids, dissent: [], next_workflow: 'none', owner: 'test', retest_condition: 'none' };
  return undefined;
};

describe('CEO brief runtime', () => {
  it('is disabled unless explicitly enabled', () => {
    const runtime = startCeoBriefRuntime({ health, env: {} });
    expect(runtime.enabled).toBe(false);
    runtime.stop();
  });

  it('starts a stoppable unref interval when configured', () => {
    vi.useFakeTimers();
    const runtime = startCeoBriefRuntime({ health, intervalMs: 60_000, env: { AI_COMPANY_TELEGRAM_ENABLED: 'true', AI_COMPANY_TELEGRAM_BOT_TOKEN: 'token', AI_COMPANY_TELEGRAM_WEBHOOK_SECRET: 'secret', AI_COMPANY_TELEGRAM_CHAT_ID: '42', AI_COMPANY_STATE_DIR: '/tmp/ai-company-test-runtime' }, transport: { fetch: vi.fn().mockResolvedValue({ ok: true, status: 200 }) } });
    expect(runtime.enabled).toBe(true);
    runtime.stop();
    vi.useRealTimers();
  });

  it('composes product scheduler and company supervisor for one project', async () => {
    const periods: string[] = [];
    const runtime = createProductCompanyRuntime({ projectId: 'macro-os', stateDir: await mkdtemp(path.join(os.tmpdir(), 'ai-company-')), now: () => new Date('2026-09-04T08:00:00Z'), onCycle: (period) => { periods.push(period); } });
    const result = await runtime.tick();
    expect(result).toHaveLength(1);
    expect(result[0].ok).toBe(true);
    expect(periods).toEqual(['daily']);
    expect((await runtime.cycleAttemptLedger.records('macro-os'))[0].cadence_policy).toMatchObject({ cadence: 'daily', accountable_roles: expect.arrayContaining(['ceo', 'pm']) });
    runtime.stop();
  });

  it('does not run product work when the readiness gate is blocked', async () => {
    let called = false;
    const runtime = createProductCompanyRuntime({ projectId: 'macro-os', stateDir: await mkdtemp(path.join(os.tmpdir(), 'ai-company-')), now: () => new Date('2026-09-04T08:00:00Z'), readinessGate: async () => ({ ready: false, blockers: ['durable production store missing'] }), onCycle: () => { called = true; } });
    const result = await runtime.tick();
    expect(result[0]).toMatchObject({ ok: false, error: 'product cycle blocked by readiness gate: durable production store missing' });
    expect(called).toBe(false);
    expect(runtime.readiness()).toMatchObject({ ready: false, blockers: ['durable production store missing'] });
    expect(await runtime.cycleAttemptLedger.records('macro-os')).toEqual([expect.objectContaining({ period: 'daily', status: 'BLOCKED', blockers: ['durable production store missing'] })]);
    expect((await runtime.workQueue.records('macro-os')).filter((item) => item.backlog_id === 'CADENCE:daily:ceo' && item.role === 'ceo')).toHaveLength(1);
    runtime.stop();
  });

  it('records readiness probe exceptions as an explicit blocker', async () => {
    const runtime = createProductCompanyRuntime({ projectId: 'macro-os', stateDir: await mkdtemp(path.join(os.tmpdir(), 'ai-company-readiness-error-')), now: () => new Date('2026-09-04T08:00:00Z'), readinessGate: async () => { throw new Error('storage timeout'); } });
    const result = await runtime.tick();
    expect(result[0]).toMatchObject({ ok: false, error: 'product cycle blocked by readiness gate: readiness probe failed: storage timeout' });
    expect(runtime.readiness()).toMatchObject({ ready: false, blockers: ['readiness probe failed: storage timeout'], checkedAt: expect.any(String) });
    runtime.stop();
  });

  it('requires an explicit readiness gate in production', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try { expect(() => createProductCompanyRuntime({ projectId: 'macro-os' })).toThrow('requires readiness gate'); }
    finally { process.env.NODE_ENV = previous; }
  });

  it('runs an injected role executor after planning work', async () => {
    const executed: string[] = [];
    const resolver = new InMemoryEvidenceResolver();
    const runtime = createProductCompanyRuntime({ projectId: 'macro-os', evidenceResolver: resolver, stateDir: await mkdtemp(path.join(os.tmpdir(), 'ai-company-exec-')), now: () => new Date('2026-09-04T08:00:00Z'), onCycle: async () => undefined, roleWorkExecutor: async (item) => { executed.push(item.role); const receipt = resolver.createEvidence({ evidence_id: `E-${item.work_id}`, namespace: item.assignment!.namespace, run_id: item.assignment!.run_id, produced_by_role: item.role, content: 'Isolated injected executor fixture; no actual product effect.' }); resolver.register({ ...receipt, work_id: item.work_id, source_artifact: 'runtime.test.ts' }); return { evidence_ids: [`E-${item.work_id}`], structured_output: roleContract(item) as never, ...(roleContract(item) ? {} : { research_result: { research_question: item.title, source_reference: `E-${item.work_id}`, finding: 'bounded test evidence', confidence: 0.7 } }) }; } });
    await runtime.backlogLedger.add([{ backlog_id: 'B-EXEC', project_id: 'macro-os', task_id: 'T-EXEC', title: 'execute this work', priority: 'P1', rationale: 'test', source_feedback_ids: ['F-1'], acceptance_criteria: ['done'], status: 'PROPOSED' }]);
    await runtime.tick();
    expect(executed.length).toBeGreaterThan(0);
    expect((await runtime.workQueue.records('macro-os')).every((item) => item.state === 'DONE')).toBe(true);
    runtime.stop();
  });

  it('does not mark a cycle done when role execution is blocked', async () => {
    const runtime = createProductCompanyRuntime({ projectId: 'macro-os', stateDir: await mkdtemp(path.join(os.tmpdir(), 'ai-company-blocked-cycle-')), now: () => new Date('2026-09-04T08:00:00Z'), evidenceResolver: new InMemoryEvidenceResolver(), roleWorkExecutor: async () => { throw new Error('provider unavailable'); } });
    await runtime.backlogLedger.add([{ backlog_id: 'B-BLOCKED-CYCLE', project_id: 'macro-os', task_id: 'T-BLOCKED-CYCLE', title: 'blocked work', priority: 'P1', rationale: 'test', source_feedback_ids: ['F'], acceptance_criteria: ['done'], status: 'PROPOSED' }]);
    const result = await runtime.tick();
    expect(result[0]).toMatchObject({ ok: false, error: expect.stringContaining('role execution blocked') });
    expect(await runtime.cycleAttemptLedger.records('macro-os')).toEqual([expect.objectContaining({ status: 'FAILED' })]);
  });

  it('fails closed when verified cycle value is required but no outcome is evidenced', async () => {
    const runtime = createProductCompanyRuntime({ projectId: 'macro-os', stateDir: await mkdtemp(path.join(os.tmpdir(), 'ai-company-value-gate-')), now: () => new Date('2026-09-04T08:00:00Z'), readinessGate: async () => ({ ready: true, blockers: [] }), requireVerifiedCycleValue: true });
    const result = await runtime.tick();
    expect(result[0]).toMatchObject({ ok: false, error: 'cycle has no verified product improvement or evidence-backed learning' });
    expect((await runtime.cycleAttemptLedger.records('macro-os'))[0].status).toBe('FAILED');
    runtime.stop();
  });

  it.each([false, true])('isolated weekly contract admission with reviewer own receipt = %s', async (reviewerOwnReceipt) => {
    const resolver = new InMemoryEvidenceResolver();
    const stateDir = await mkdtemp(path.join(os.tmpdir(), 'ai-company-multi-cadence-'));
    const inputFile = path.join(stateDir, 'isolated-cadence-input.json');
    await writeFile(inputFile, JSON.stringify({ kind: 'ISOLATED_UNIT_TEST_INPUT', observations: [], real_product_outcome: 'UNKNOWN' }));
    let current = new Date('2026-09-04T08:00:00Z');
    const runtime = createProductCompanyRuntime({ projectId: 'macro-os', stateDir, evidenceResolver: resolver, now: () => current, readinessGate: async () => ({ ready: true, blockers: [] }), roleWorkExecutor: async (item) => {
      const isReview = ['functional-qa', 'quality-control', 'critic', 'security', 'release-security-gate'].includes(item.role);
      const separateInput = isReview && !(reviewerOwnReceipt && item.backlog_id.startsWith('CADENCE:weekly:'));
      const content = separateInput ? await readFile(inputFile, 'utf8') : `Isolated ${item.role} output fixture; no product effect proof.`;
      const evidence = resolver.createEvidence({ evidence_id: `E-${item.work_id}`, namespace: item.assignment!.namespace, run_id: item.assignment!.run_id, produced_by_role: separateInput ? 'isolated-fixture-input-loader' : item.role, content });
      resolver.register({ ...evidence, work_id: item.work_id, source_artifact: separateInput ? inputFile : 'runtime.test.ts' });
      return ({ evidence_ids: [`E-${item.work_id}`], structured_output: roleContract(item) as never, ...(['functional-qa', 'quality-control', 'critic', 'security', 'adversarial-reviewer', 'release-security-gate'].includes(item.role) ? { review_verdict: { verdict: 'PASS' as const, gate: 'test', summary: 'pass', evidence: [`E-${item.work_id}`], failure_class: 'NONE' as const, root_cause: 'none', recovery_required: false, recovery_actions: [], unblock_evidence: [], retry_budget: 0, next_review_trigger: 'none', confidence: 1 } } : {}), ...(roleContract(item) ? {} : { research_result: { research_question: 'Does this workflow serve the research job?', source_reference: `E-${item.work_id}`, finding: 'bounded evidence recorded', confidence: 0.7 } }) });
    } });
    expect((await runtime.tick())[0].ok).toBe(true);
    current = new Date('2026-09-07T08:00:00Z');
    const weekly = await runtime.tick();
    if (reviewerOwnReceipt) {
      expect(weekly[0]).toMatchObject({ ok: false, error: expect.stringContaining('role execution blocked') });
      const reviewers = (await runtime.workQueue.records('macro-os')).filter((item) => item.backlog_id.startsWith('CADENCE:weekly:') && ['functional-qa', 'quality-control', 'critic', 'security', 'release-security-gate'].includes(item.role));
      expect(reviewers).toHaveLength(5);
      expect(reviewers.every((item) => item.state === 'BLOCKED')).toBe(true);
      expect((await runtime.cycleAttemptLedger.records('macro-os')).find((item) => item.period === 'weekly')).toMatchObject({ status: 'FAILED' });
      runtime.stop();
      return;
    }
    expect(weekly[0].ok, JSON.stringify(weekly[0])).toBe(true);
    expect((await runtime.cycleAttemptLedger.records('macro-os')).map((item) => item.period)).toEqual(['daily', 'daily', 'weekly']);
    expect((await runtime.workQueue.records('macro-os')).filter((item) => item.backlog_id.startsWith('CADENCE:weekly:') && item.state === 'DONE')).toHaveLength(18);
    runtime.stop();
  });

  it('audits discovery evidence-supplier failures instead of hiding them', async () => {
    const runtime = createProductCompanyRuntime({ projectId: 'macro-os', stateDir: await mkdtemp(path.join(os.tmpdir(), 'ai-company-discovery-failure-')), now: () => new Date('2026-09-04T08:00:00Z'), readinessGate: async () => ({ ready: true, blockers: [] }), discovery: { config: { endpoint: 'http://127.0.0.1:11434/api/chat', model: 'qwen3:8b' }, productGoal: 'truth', evidence: async () => { throw new Error('evidence store unavailable'); } } });
    const result = await runtime.tick();
    expect(result[0]).toMatchObject({ ok: false, error: 'evidence store unavailable' });
    expect(await runtime.discoveryAttemptLedger.records('macro-os')).toEqual([expect.objectContaining({ status: 'FAILED', evidence_count: 0, error: 'evidence store unavailable' })]);
    runtime.stop();
  });

  it('persists one explicit wake when the runtime has no executable work', async () => {
    const runtime = createProductCompanyRuntime({ projectId: 'macro-os', stateDir: await mkdtemp(path.join(os.tmpdir(), 'ai-company-idle-wake-')), now: () => new Date('2026-09-04T07:00:00Z') });
    await runtime.tick();
    await runtime.tick();
    const waits = await runtime.waitWake.records();
    expect(waits).toHaveLength(1);
    expect(waits[0]).toMatchObject({ project_id: 'macro-os', workflow_id: 'product-runtime:macro-os', state: 'AWAITING_SCHEDULE', wake_type: 'TIMER', next_action: expect.stringContaining('PM-approved backlog') });
    runtime.stop();
  });

});
