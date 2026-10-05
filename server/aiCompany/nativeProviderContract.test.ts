import { recordNativeFixture } from './nativeReceiptTestFixture';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { RoleWorkQueue } from './roleWorkQueue';
import { RoleEvidenceLedger, nativeProviderReceiptId } from './roleEvidenceLedger';
import { evidenceProducingRoleWorkExecutor, executeReadyRoleWork } from './roleWorkExecutor';
import { createConfiguredRoleModelAdapter } from './openaiCompatibleRoleAdapter';
import { ProviderDeadLetterLedger } from './providerResilience';
import type { CompanyTask } from './orchestrator';

const env = { MACRO_LLM_ENDPOINT: 'https://unit.invalid/v1/chat/completions', MACRO_LLM_MODEL: 'unit-stub', AI_COMPANY_ROLE_MAX_RETRIES: '3' };
const usage = { input_tokens: 1, output_tokens: 1, estimated_cost_usd: 0 };
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'native-contract-'));
  const ledger = new RoleEvidenceLedger(root), queue = new RoleWorkQueue(root, ledger);
  const template = await queue.create({ project_id: 'template', backlog_id: 'TEMPLATE', title: 'Unit fixture only', role: 'ux-research' });
  const assignment = { ...template.assignment!, product_id: 'unit', assignment_id: 'ASSIGNMENT:UNIT', work_id: 'UNIT', objective_id: 'EXACT', objective: 'Inspect only explicit packet', namespace: 'UNIT-NS', run_id: 'UNIT-RUN', risk_level: 'P2' as const, scope: ['only packet fixture'], allowed_paths: ['docs/PRODUCT_GOAL.md'], forbidden_paths: [...template.assignment!.forbidden_paths, 'private-unit-path'], acceptance_criteria: ['preserve exact supplied acceptance'], token_budget: 100, timeout: 17, retry_budget: 0 };
  const [item] = await queue.createBatch([{ work_id: 'UNIT', project_id: 'unit', backlog_id: 'EXACT', title: assignment.objective, role: 'ux-research', assignment, namespace: assignment.namespace, run_id: assignment.run_id }]);
  return { root, ledger, queue, item, assignment };
}
function research(task: CompanyTask, overrides = {}) { return { research_question: 'Actual provider question', source_reference: task.role_execution!.receipt_evidence_id, finding: 'Actual provider finding; transcript only, no observed product effect', confidence: 0.27, ...overrides }; }
function provider(content: string) { return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }), { status: 200 }); }

describe('native provider actual contract boundary', () => {
  it('sends exact assignment and advisory receipt without raw capability; preserves actual research fields', async () => {
    const { queue, ledger, item, assignment } = await fixture();
    let body: Record<string, any> = {};
    const fetchImpl = vi.fn(async (_url, init) => { body = JSON.parse(init.body); return provider(JSON.stringify(research(JSON.parse(body.messages[1].content)))); });
    const adapter = createConfiguredRoleModelAdapter(env, fetchImpl)!;
    const claim = await queue.claim(item.work_id, 'fixture');
    const output = await evidenceProducingRoleWorkExecutor(adapter, ledger, queue)(claim, claim.attempt_authority);
    const packet = JSON.parse(body.messages[1].content);
    expect(packet).toEqual({ task_id: item.work_id, project_id: 'unit', risk_level: 'P2', acceptance_criteria: assignment.acceptance_criteria, budget: { max_attempts: 1, timeout_seconds: 17 }, role_execution: { assignment, attempt_id: claim.attempt_id, receipt_evidence_id: nativeProviderReceiptId(item.work_id, claim.attempt_id!) } });
    expect(body.max_tokens).toBe(100);
    expect(body.messages[0].content).toContain('research_question');
    expect(body.messages[0].content).toContain('no repository input bytes');
    expect(JSON.stringify(body)).not.toContain(claim.attempt_authority.token);
    expect(output.research_result).toEqual(research(packet));
    await queue.submitForReview(item.work_id, claim.attempt_authority);
    expect((await queue.complete(item.work_id, output.evidence_ids, output.research_result, undefined, undefined, undefined, undefined, claim.attempt_authority)).state).toBe('DONE');
    expect((await ledger.records()).map(row => row.protocol_status)).toEqual(['RECEIVED']);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('refuses sequential replay after a receipt before another provider request', async () => {
    const { queue, ledger, item } = await fixture();
    const claim = await queue.claim(item.work_id, 'fixture');
    const complete = vi.fn(async ({ task }) => ({ ok: true, text: JSON.stringify(research(task)), evidence_ids: [], usage }));
    const execute = evidenceProducingRoleWorkExecutor({ id: 'stub', complete }, ledger, queue);
    await execute(claim, claim.attempt_authority);
    await expect(execute(claim, claim.attempt_authority)).rejects.toThrow('repeated dispatch');
    expect(complete).toHaveBeenCalledTimes(1);
    expect(await ledger.records()).toHaveLength(1);
  });

  it.each(['missing assignment', 'wrong work', 'wrong project', 'wrong role', 'wrong run', 'wrong namespace'])('rejects %s before provider dispatch', async (caseName) => {
    const { queue, ledger, item } = await fixture();
    const claim = await queue.claim(item.work_id, 'fixture');
    const tampered = structuredClone(claim);
    if (caseName === 'missing assignment') delete tampered.assignment;
    else {
      const key = { 'wrong work': 'work_id', 'wrong project': 'product_id', 'wrong role': 'role', 'wrong run': 'run_id', 'wrong namespace': 'namespace' }[caseName]!;
      (tampered.assignment as any)[key] = key === 'role' ? 'domain-expert' : 'DIFFERENT';
    }
    const complete = vi.fn();
    await expect(evidenceProducingRoleWorkExecutor({ id: 'stub', complete }, ledger, queue)(tampered, claim.attempt_authority)).rejects.toThrow(/assignment/);
    expect(complete).not.toHaveBeenCalled();
    expect(await ledger.records()).toEqual([]);
  });

  it.each(['prose', 'missing confidence', 'invalid confidence', 'unknown reference'])('blocks %s without converting it into successful research', async caseName => {
    const { queue, ledger } = await fixture();
    const result = await executeReadyRoleWork({ projectId: 'unit', queue, execute: evidenceProducingRoleWorkExecutor({ id: 'stub', complete: async ({ task }) => {
      const parsed: any = research(task);
      if (caseName === 'missing confidence') delete parsed.confidence;
      if (caseName === 'invalid confidence') parsed.confidence = 2;
      if (caseName === 'unknown reference') parsed.source_reference = 'UNRESOLVED';
      return { ok: true, text: caseName === 'prose' ? 'Unstructured unit prose' : JSON.stringify(parsed), evidence_ids: [], usage };
    } }, ledger, queue) });
    expect(result.completed).toEqual([]);
    expect(result.blocked).toHaveLength(1);
    expect(result.blocked[0].blocked_reason).toContain(caseName === 'unknown reference' ? 'cannot be resolved' : 'invalid research result');
    expect((await ledger.records()).every(row => row.protocol_status === 'RECEIVED')).toBe(true);
  });

  it('rejects malformed research at terminal queue admission without changing bytes', async () => {
    const { queue, ledger, root, item } = await fixture();
    const claim = await queue.claim(item.work_id, 'fixture');
    const receipt = await recordNativeFixture(queue, ledger, { receipt_id: nativeProviderReceiptId(item.work_id, claim.attempt_id!), project_id: 'unit', work_id: item.work_id, attempt_id: claim.attempt_id!, namespace: 'UNIT-NS', run_id: 'UNIT-RUN', role: 'ux-research', provider_id: 'stub', model: 'stub', output: 'advisory', limitation: 'unit only', usage }, claim.attempt_authority);
    await queue.submitForReview(item.work_id, claim.attempt_authority);
    const before = await readFile(path.join(root, 'role-work-queue.jsonl'));
    for (const malformed of [undefined, { research_question: 'q', source_reference: receipt.evidence_id, finding: 'f', confidence: 2 }, { research_question: 'q', source_reference: receipt.evidence_id, confidence: 0.3 }]) {
      await expect(queue.complete(item.work_id, [receipt.evidence_id], malformed as any, undefined, undefined, undefined, undefined, claim.attempt_authority)).rejects.toThrow(/research|contract/);
      expect(await readFile(path.join(root, 'role-work-queue.jsonl'))).toEqual(before);
    }
  });

  it('rejects reservation mismatches and same-attempt output or project reuse without overwriting receipt bytes', async () => {
    const { queue, ledger, item, root } = await fixture();
    const claim = await queue.claim(item.work_id, 'fixture');
    const input = { receipt_id: nativeProviderReceiptId(item.work_id, claim.attempt_id!), project_id: 'unit', work_id: item.work_id, attempt_id: claim.attempt_id!, namespace: 'UNIT-NS', run_id: 'UNIT-RUN', role: item.role, provider_id: 'stub', model: 'stub', output: 'advisory', limitation: 'unit only', usage };
    await expect(ledger.record({ ...input, receipt_id: 'WRONG' })).rejects.toThrow('reservation');
    const first = await recordNativeFixture(queue, ledger, input, claim.attempt_authority);
    const before = await readFile(path.join(root, 'role-evidence.jsonl'));
    expect(await recordNativeFixture(queue, ledger, input, claim.attempt_authority)).toEqual(first);
    await expect(ledger.record({ ...input, output: 'different output' }, claim.attempt_authority)).rejects.toThrow('reused');
    await expect(ledger.record({ ...input, project_id: 'different project' }, claim.attempt_authority)).rejects.toThrow('current producer');
    expect(await readFile(path.join(root, 'role-evidence.jsonl'))).toEqual(before);
  });

  it('does not stack configured retries over a one-request task; dead letter counts actual request', async () => {
    const { root } = await fixture();
    const dead = new ProviderDeadLetterLedger(root);
    const fetchImpl = vi.fn(async () => new Response('busy', { status: 503 }));
    const adapter = createConfiguredRoleModelAdapter(env, fetchImpl, undefined, dead)!;
    expect((await adapter.complete({ worker_id: 'coder', task: { task_id: 'ONE', project_id: 'unit', risk_level: 'P1', acceptance_criteria: ['bounded'], budget: { max_attempts: 1, timeout_seconds: 1 } } })).ok).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(await dead.records()).toMatchObject([{ attempt: 1, failure_class: 'PROVIDER_UNAVAILABLE' }]);
  });

  it('task deadline aborts actual request and prevents another retry', async () => {
    const { root } = await fixture();
    const dead = new ProviderDeadLetterLedger(root);
    const fetchImpl = vi.fn(async (_url, init) => new Promise<Response>((_resolve, reject) => { init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }); }));
    const adapter = createConfiguredRoleModelAdapter(env, fetchImpl, undefined, dead)!;
    const start = Date.now();
    const result = await adapter.complete({ worker_id: 'coder', task: { task_id: 'TIME', project_id: 'unit', risk_level: 'P1', acceptance_criteria: ['bounded'], budget: { max_attempts: 2, timeout_seconds: 0.05 } } });
    expect(result.ok).toBe(false);
    expect(Date.now() - start).toBeLessThan(1000);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(await dead.records()).toMatchObject([{ attempt: 1, failure_class: 'PROVIDER_TIMEOUT' }]);
  });

  it.each([0, -1, 1.5, NaN])('rejects invalid attempt budget %s without request', async max_attempts => {
    const fetchImpl = vi.fn();
    const adapter = createConfiguredRoleModelAdapter(env, fetchImpl)!;
    await expect(adapter.complete({ worker_id: 'coder', task: { task_id: 'BAD', project_id: 'unit', risk_level: 'P1', acceptance_criteria: ['bounded'], budget: { max_attempts, timeout_seconds: 1 } } })).rejects.toThrow('budget');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
