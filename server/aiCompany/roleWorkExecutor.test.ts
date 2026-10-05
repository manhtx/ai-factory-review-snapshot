import { recordNativeFixture } from './nativeReceiptTestFixture';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RoleWorkQueue } from './roleWorkQueue';
import { executeReadyRoleWork, modelRoleWorkExecutor } from './roleWorkExecutor';
import { evidenceProducingRoleWorkExecutor } from './roleWorkExecutor';
import { RoleEvidenceLedger } from './roleEvidenceLedger';
import { RoleHandoffLedger } from './roleHandoffLedger';
import { InMemoryEvidenceResolver } from './evidenceResolver';

async function fixtureQueue(prefix: string) {
  const resolver = new InMemoryEvidenceResolver();
  const queue = new RoleWorkQueue(await mkdtemp(path.join(os.tmpdir(), prefix)), resolver);
  const register = (item: Awaited<ReturnType<RoleWorkQueue['create']>>, id: string) => {
    const row = resolver.createEvidence({ evidence_id: id, namespace: item.assignment!.namespace, run_id: item.assignment!.run_id, produced_by_role: item.role, content: 'isolated execution test fixture' });
    resolver.register({ ...row, source_artifact: 'roleWorkExecutor.test.ts', work_id: item.work_id });
    return [id];
  };
  return { queue, register };
}

const structured = (role: string, evidence = ['E']) => ({
  role,
  files_changed: [],
  files_not_changed: [],
  implementation_summary: 'test implementation',
  summary: 'test implementation',
  tests_run: ['unit'],
  tests_failed: [],
  known_limitations: [],
  rollback_instruction: 'revert test change',
  evidence_ids: evidence,
});

describe('role work execution loop', () => {
  it('completes with evidence and blocks failed workers', async () => {
    const { queue, register } = await fixtureQueue('role-exec-');
    const good = await queue.create({ project_id: 'macro-os', backlog_id: 'B-1', title: 'data', role: 'data-engineer' });
    const bad = await queue.create({ project_id: 'macro-os', backlog_id: 'B-2', title: 'api', role: 'backend-engineer' });
    register(good, 'E-1');
    const result = await executeReadyRoleWork({ projectId: 'macro-os', queue, execute: async (item) => { if (item.work_id === bad.work_id) throw new Error('provider unavailable'); return { evidence_ids: ['E-1'], structured_output: structured(item.role, ['E-1']) as never }; } });
    expect(result.completed).toHaveLength(1);
    expect(result.completed[0].work_id).toBe(good.work_id);
    expect(result.blocked[0]).toMatchObject({ work_id: bad.work_id, state: 'BLOCKED', blocked_reason: 'provider unavailable' });
  });

  it('bridges a configured model only when it returns server-owned evidence', async () => {
    const { queue, register } = await fixtureQueue('role-model-');
    const item = await queue.create({ project_id: 'macro-os', backlog_id: 'B-1', title: 'model task', role: 'backend-engineer' });
    register(item, 'BUNDLE-1');
    const result = await executeReadyRoleWork({ projectId: 'macro-os', queue, execute: modelRoleWorkExecutor({ id: 'model', complete: async () => ({ ok: true, text: JSON.stringify(structured('backend-engineer', ['BUNDLE-1'])), evidence_ids: ['BUNDLE-1'], usage: { input_tokens: 1, output_tokens: 1, estimated_cost_usd: 0 } }) }, queue) });
    expect(result.completed).toHaveLength(1);
    expect(result.completed[0].evidence_ids).toEqual(['BUNDLE-1']);
  });

  it('blocks model output that has no evidence', async () => {
    const { queue } = await fixtureQueue('role-model-empty-');
    await queue.create({ project_id: 'macro-os', backlog_id: 'B-1', title: 'model task', role: 'backend-engineer' });
    const result = await executeReadyRoleWork({ projectId: 'macro-os', queue, execute: modelRoleWorkExecutor({ id: 'model', complete: async () => ({ ok: true, evidence_ids: [], usage: { input_tokens: 1, output_tokens: 1, estimated_cost_usd: 0 } }) }, queue) });
    expect(result.blocked[0]).toMatchObject({ state: 'BLOCKED', blocked_reason: 'model worker returned no server-owned evidence' });
  });

  it('blocks execution when the coordinator has not recorded a handoff', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'role-exec-handoff-'));
    const queue = new RoleWorkQueue(root, new InMemoryEvidenceResolver());
    const handoffs = new RoleHandoffLedger(root);
    await queue.create({ project_id: 'macro-os', backlog_id: 'B-HANDOFF', title: 'must be coordinated', role: 'backend-engineer' });
    const result = await executeReadyRoleWork({ projectId: 'macro-os', queue, handoffs, execute: async () => ({ evidence_ids: ['E'] }) });
    expect(result.completed).toHaveLength(0);
    expect(result.blocked[0]?.blocked_reason).toContain('role handoff is missing');
  });

  it('creates server-owned evidence from bounded provider output', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'role-evidence-queue-'));
    const ledger = new RoleEvidenceLedger(root);
    const queue = new RoleWorkQueue(root, ledger);
    const producer = await queue.create({ project_id:'macro-os',backlog_id:'INPUT',title:'Isolated source receipt producer; no product outcome',role:'ux-research',namespace:'fixture',run_id:'fixture-run' });
    const claimed = await queue.claim(producer.work_id,'input-producer');
    const source = await recordNativeFixture(queue, ledger, { project_id: producer.project_id, work_id: producer.work_id, attempt_id: claimed.attempt_id!, namespace: producer.assignment!.namespace, run_id: producer.assignment!.run_id, role: producer.role, provider_id: 'fixture', model: 'fixture', output: 'Isolated source fixture', limitation: 'No product effect proof', usage: { input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0 } }, claimed.attempt_authority);
    await queue.submitForReview(producer.work_id,claimed.attempt_authority);
    await queue.complete(producer.work_id,[source.evidence_id],{research_question:producer.title,source_reference:source.evidence_id,finding:'Unit fixture only',confidence:.5},undefined,undefined,undefined,undefined,claimed.attempt_authority);
    await queue.create({ project_id: 'macro-os', backlog_id: 'B-1', title: 'model task', role: 'backend-engineer',namespace:'fixture',run_id:'fixture-run',depends_on:[producer.work_id] });
    const result = await executeReadyRoleWork({ projectId: 'macro-os', queue, execute: evidenceProducingRoleWorkExecutor({ id: 'local', complete: async () => ({ ok: true, text: JSON.stringify(structured('backend-engineer', [source.evidence_id])), evidence_ids: [], usage: { input_tokens: 1, output_tokens: 1, estimated_cost_usd: 0 } }) }, ledger, queue) });
    expect(result.completed[0].evidence_ids[0]).toMatch(/^ROLE-EVIDENCE-/);
    expect(await ledger.records('macro-os')).toHaveLength(2);
  });

  it('returns a lineage-linked research result for user and review roles', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'role-research-queue-'));
    const ledger = new RoleEvidenceLedger(root);
    const queue = new RoleWorkQueue(root, ledger);
    await queue.create({ project_id: 'macro-os', backlog_id: 'B-1', title: 'UJ-001 daily intelligence task', role: 'user-persona' });
    const result = await executeReadyRoleWork({ projectId: 'macro-os', queue, execute: evidenceProducingRoleWorkExecutor({ id: 'local', complete: async ({task}) => ({ ok: true, text: JSON.stringify({research_question: 'UJ-001 daily intelligence task', source_reference: task.role_execution!.receipt_evidence_id!, finding: 'bounded finding', confidence: 0.5}), evidence_ids: [], usage: { input_tokens: 1, output_tokens: 1, estimated_cost_usd: 0 } }) }, ledger, queue) });
    expect(result.completed[0].research_result).toMatchObject({ research_question: 'UJ-001 daily intelligence task', finding: 'bounded finding', confidence: 0.5 });
    expect(result.completed[0].research_result?.source_reference).toBe(result.completed[0].evidence_ids[0]);
  });

  it('runs ready work with bounded concurrency', async () => {
    const { queue, register } = await fixtureQueue('role-exec-concurrency-');
    await Promise.all(['data-engineer', 'backend-engineer', 'frontend-engineer'].map((role) => queue.create({ project_id: 'macro-os', backlog_id: role, title: 'parallel work', role: role as never })));
    let active = 0; let peak = 0;
    const result = await executeReadyRoleWork({ projectId: 'macro-os', queue, maxConcurrent: 2, execute: async (item) => { active += 1; peak = Math.max(peak, active); await new Promise((resolve) => setTimeout(resolve, 5)); active -= 1; const ids = register(item, `E:${item.work_id}`); return { evidence_ids: ids, structured_output: structured(item.role, ids) as never }; } });
    expect(result.completed).toHaveLength(3);
    expect(peak).toBe(2);
  });

  it('blocks work that has not started when the batch budget is exhausted', async () => {
    const { queue, register } = await fixtureQueue('role-exec-budget-');
    await queue.create({ project_id: 'macro-os', backlog_id: 'B-1', title: 'budgeted work', role: 'backend-engineer' });
    const result = await executeReadyRoleWork({ projectId: 'macro-os', queue, maxDurationMs: 1_000, execute: async (item) => ({ evidence_ids: register(item, 'E'), structured_output: structured(item.role) as never }) });
    expect(result.completed).toHaveLength(1);
  });
});
