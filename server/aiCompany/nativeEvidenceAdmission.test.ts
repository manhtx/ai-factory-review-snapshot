import { recordNativeFixture } from './nativeReceiptTestFixture';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RoleEvidenceLedger } from './roleEvidenceLedger';
import { RoleWorkQueue } from './roleWorkQueue';
import { evidenceProducingRoleWorkExecutor, executeReadyRoleWork } from './roleWorkExecutor';
import { validateEvidenceResolution } from './evidenceResolver';

describe('native evidence admission', () => {
  it('resolves actual assignment scope and original output hash through the native ledger', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'native-admission-'));
    const ledger = new RoleEvidenceLedger(root);
    const queue = new RoleWorkQueue(root, ledger);
    const item = await queue.create({ project_id: 'macro-os', backlog_id: 'B', title: 'bounded finding', role: 'user-persona' });
    const claimed = await queue.claim(item.work_id, 'fixture');
    const result = await evidenceProducingRoleWorkExecutor({ id: 'isolated', complete: async ({task}) => ({ ok: true, text: JSON.stringify({research_question: 'Explicit fixture question', source_reference: task.role_execution!.receipt_evidence_id!, finding: 'bounded advisory finding', confidence: 0.5}), evidence_ids: [], usage: { input_tokens: 1, output_tokens: 1, estimated_cost_usd: 0 } }) }, ledger, queue)(claimed, claimed.attempt_authority);
    const resolved = await ledger.resolve(result.evidence_ids[0]);
    expect(resolved).toMatchObject({ evidence_id: result.evidence_ids[0], namespace: item.assignment!.namespace, run_id: item.assignment!.run_id, work_id: item.work_id, content: expect.stringContaining('bounded advisory finding') });
    expect(result.review_verdict).toBeUndefined();
    expect((await ledger.records())[0].protocol_status).toBe('RECEIVED');
    await queue.submitForReview(item.work_id, claimed.attempt_authority);
    expect((await queue.complete(item.work_id, result.evidence_ids, result.research_result, undefined, undefined, undefined, undefined, claimed.attempt_authority)).state).toBe('DONE');
  });

  it('rejects missing resolver before dispatch or any queue write', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'native-preflight-'));
    const queue = new RoleWorkQueue(root);
    await queue.create({ project_id: 'macro-os', backlog_id: 'B', title: 'bounded code work', role: 'coder' });
    const before = await readFile(path.join(root, 'role-work-queue.jsonl'), 'utf8');
    let dispatched = false;
    await expect(executeReadyRoleWork({ projectId: 'macro-os', queue, execute: async () => { dispatched = true; return { evidence_ids: [] }; } })).rejects.toThrow('explicitly configured');
    expect(dispatched).toBe(false);
    expect(await readFile(path.join(root, 'role-work-queue.jsonl'), 'utf8')).toBe(before);
  });

  it('preserves legacy receipt history without fabricating its missing lineage', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'native-legacy-'));
    const row = { evidence_id: 'LEGACY', project_id: 'macro-os', work_id: 'W', role: 'coder', provider_id: 'local', model: 'local', output: 'historical', limitation: 'advisory', protocol_status: 'PASS', usage: { input_tokens: 1, output_tokens: 1, estimated_cost_usd: 0 }, created_at: new Date().toISOString() };
    const bytes = JSON.stringify(row) + '\n';
    const file = path.join(root, 'role-evidence.jsonl');
    await writeFile(file, bytes);
    const ledger = new RoleEvidenceLedger(root);
    expect(await ledger.records()).toEqual([row]);
    expect(await ledger.resolve('LEGACY')).toBeNull();
    expect(await readFile(file, 'utf8')).toBe(bytes);
  });

  it('retains original content hash so changed receipt bytes fail admission', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'native-hash-'));
    const ledger = new RoleEvidenceLedger(root);
    const queue = new RoleWorkQueue(root, ledger);
    const item = await queue.create({project_id:'macro-os',backlog_id:'B',title:'Isolated corruption fixture',role:'coder',namespace:'fixture',run_id:'R'});
    const claimed = await queue.claim(item.work_id,'fixture');
    const row = await recordNativeFixture(queue, ledger, { project_id: 'macro-os', work_id: item.work_id, attempt_id: claimed.attempt_id!, role: 'coder', namespace: 'fixture', run_id: 'R', provider_id: 'local', model: 'local', output: 'original fixture', limitation: 'advisory', usage: { input_tokens: 1, output_tokens: 1, estimated_cost_usd: 0 } }, claimed.attempt_authority);
    await writeFile(path.join(root, 'role-evidence.jsonl'), JSON.stringify({ ...row, output: 'changed bytes' }) + '\n');
    expect(validateEvidenceResolution(await ledger.resolve(row.evidence_id), row.evidence_id, { expected_namespace: 'fixture', expected_run_id: 'R', reviewer_role: '' }).join(';')).toContain('hash');
  });

  it('rejects corrupt and duplicate native records without salvaging a requested receipt', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'native-corrupt-'));
    const ledger = new RoleEvidenceLedger(root);
    const queue = new RoleWorkQueue(root, ledger);
    const item = await queue.create({project_id:'macro-os',backlog_id:'B',title:'Isolated corruption fixture',role:'coder',namespace:'fixture',run_id:'R'});
    const claimed = await queue.claim(item.work_id,'fixture');
    const row = await recordNativeFixture(queue, ledger, { project_id: 'macro-os', work_id: item.work_id, attempt_id: claimed.attempt_id!, role: 'coder', namespace: 'fixture', run_id: 'R', provider_id: 'local', model: 'local', output: 'fixture', limitation: 'advisory', usage: { input_tokens: 1, output_tokens: 1, estimated_cost_usd: 0 } }, claimed.attempt_authority);
    const file = path.join(root, 'role-evidence.jsonl');
    await writeFile(file, JSON.stringify(row) + '\n{bad\n');
    await expect(ledger.resolve(row.evidence_id)).rejects.toThrow('corrupt native evidence');
    await writeFile(file, JSON.stringify(row) + '\n' + JSON.stringify(row) + '\n');
    await expect(ledger.resolve(row.evidence_id)).rejects.toThrow('duplicate evidence identity');
  });

  it('does not manufacture a coder contract from unstructured provider prose', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'native-prose-'));
    const ledger = new RoleEvidenceLedger(root);
    const queue = new RoleWorkQueue(root, ledger);
    const item = await queue.create({ project_id: 'macro-os', backlog_id: 'B', title: 'bounded code work', role: 'coder' });
    const claimed = await queue.claim(item.work_id,'fixture');
    await expect(evidenceProducingRoleWorkExecutor({ id: 'isolated', complete: async () => ({ ok: true, text: 'I did it; all tests passed', evidence_ids: [], usage: { input_tokens: 1, output_tokens: 1, estimated_cost_usd: 0 } }) }, ledger, queue)(claimed, claimed.attempt_authority)).rejects.toThrow('invalid structured role output');
  });

  it('does not manufacture independent QA PASS from an own-role receipt', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'native-review-'));
    const ledger = new RoleEvidenceLedger(root);
    const queue = new RoleWorkQueue(root, ledger);
    const item = await queue.create({ project_id: 'macro-os', backlog_id: 'B', title: 'bounded review', role: 'functional-qa' });
    const claimed = await queue.claim(item.work_id,'fixture');
    await expect(evidenceProducingRoleWorkExecutor({ id: 'isolated', complete: async () => ({ ok: true, text: 'Looks good', evidence_ids: [], usage: { input_tokens: 1, output_tokens: 1, estimated_cost_usd: 0 } }) }, ledger, queue)(claimed, claimed.attempt_authority)).rejects.toThrow('invalid review verdict');
  });

  it('preserves unresolved citations from structured output instead of replacing them with a receipt', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'native-citation-'));
    const ledger = new RoleEvidenceLedger(root);
    const queue = new RoleWorkQueue(root, ledger);
    await queue.create({ project_id: 'macro-os', backlog_id: 'B', title: 'bounded code work', role: 'coder' });
    const output = { role: 'coder', files_changed: [], files_not_changed: [], implementation_summary: 'fixture', tests_run: [], tests_failed: [], known_limitations: [], rollback_instruction: 'none', evidence_ids: ['UNRESOLVED'] };
    const result = await executeReadyRoleWork({ projectId: 'macro-os', queue, execute: evidenceProducingRoleWorkExecutor({ id: 'isolated', complete: async () => ({ ok: true, text: JSON.stringify(output), evidence_ids: [], usage: { input_tokens: 1, output_tokens: 1, estimated_cost_usd: 0 } }) }, ledger, queue) });
    expect(result.completed).toHaveLength(0);
    expect(result.blocked[0].blocked_reason).toContain('cannot be resolved');
  });

  it('preserves unresolved top-level adapter evidence instead of replacing it with a receipt', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'native-adapter-citation-'));
    const ledger = new RoleEvidenceLedger(root);
    const queue = new RoleWorkQueue(root, ledger);
    await queue.create({ project_id: 'macro-os', backlog_id: 'B', title: 'bounded finding', role: 'user-persona' });
    const result = await executeReadyRoleWork({ projectId: 'macro-os', queue, execute: evidenceProducingRoleWorkExecutor({ id: 'isolated', complete: async ({task}) => ({ ok: true, text: JSON.stringify({research_question: 'Explicit fixture question', source_reference: task.role_execution!.receipt_evidence_id!, finding: 'advisory fixture', confidence: 0.5}), evidence_ids: ['UNRESOLVED'], usage: { input_tokens: 1, output_tokens: 1, estimated_cost_usd: 0 } }) }, ledger, queue) });
    expect(result.completed).toHaveLength(0);
    expect(result.blocked[0].blocked_reason).toContain('cannot be resolved');
  });

  it('rejects own-role evidence for review work named by suffix even outside the review-role list', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'native-named-review-'));
    const ledger = new RoleEvidenceLedger(root);
    const queue = new RoleWorkQueue(root, ledger);
    await queue.createBatch([{ work_id: 'FIXTURE-REVIEW', project_id: 'macro-os', backlog_id: 'B', title: 'named review fixture', role: 'user-persona' }]);
    const result = await executeReadyRoleWork({ projectId: 'macro-os', queue, execute: async (claimed, authority) => {
      return evidenceProducingRoleWorkExecutor({ id: 'isolated', complete: async ({task}) => {
        const verdict = { verdict: 'PASS', gate: 'fixture', summary: 'self review', evidence: [task.role_execution!.receipt_evidence_id!], failure_class: 'NONE', root_cause: 'none', recovery_required: false, recovery_actions: [], unblock_evidence: [], retry_budget: 0, next_review_trigger: 'fixture', confidence: 0.5 };
        return { ok: true, text: JSON.stringify(verdict), evidence_ids: [], usage: { input_tokens: 1, output_tokens: 1, estimated_cost_usd: 0 } };
      } }, ledger, queue)(claimed, authority);
    } });
    expect(result.completed).toHaveLength(0);
    expect(result.blocked[0].blocked_reason).toContain('self');
  });

  it('accepts a real review contract citing a same-scope explicit dependency rather than its own receipt', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'native-review-valid-'));
    const ledger = new RoleEvidenceLedger(root);
    const queue = new RoleWorkQueue(root, ledger);
    const source = await queue.create({ project_id: 'macro-os', backlog_id: 'B', title: 'advisory fixture', role: 'user-persona', namespace: 'fixture', run_id: 'shared-review-run' });
    const claimed = await queue.claim(source.work_id, 'fixture');
    const receipt = await recordNativeFixture(queue, ledger, { project_id: source.project_id, work_id: source.work_id, attempt_id: claimed.attempt_id!, role: source.role, namespace: source.assignment!.namespace, run_id: source.assignment!.run_id, provider_id: 'fixture', model: 'fixture', output: 'Isolated dependency fixture; no product result', limitation: 'Advisory', usage: { input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0 } }, claimed.attempt_authority);
    await queue.submitForReview(source.work_id, claimed.attempt_authority);
    await queue.complete(source.work_id, [receipt.evidence_id], { research_question: 'fixture', source_reference: receipt.evidence_id, finding: 'fixture', confidence: 0.5 }, undefined, undefined, undefined, undefined, claimed.attempt_authority);
    const review = await queue.create({ project_id: 'macro-os', backlog_id: 'B-review', title: 'fixture review', role: 'functional-qa', namespace: 'fixture', run_id: 'shared-review-run', depends_on: [source.work_id] });
    const verdict = { verdict: 'PASS', gate: 'isolated contract fixture', summary: 'dependency fixture inspected', evidence: [receipt.evidence_id], failure_class: 'NONE', root_cause: 'none', recovery_required: false, recovery_actions: [], unblock_evidence: [], retry_budget: 0, next_review_trigger: 'fixture only', confidence: 0.5 };
    const result = await executeReadyRoleWork({ projectId: 'macro-os', queue, execute: evidenceProducingRoleWorkExecutor({ id: 'isolated', complete: async () => ({ ok: true, text: JSON.stringify(verdict), evidence_ids: [], usage: { input_tokens: 1, output_tokens: 1, estimated_cost_usd: 0 } }) }, ledger, queue) });
    expect(result.completed).toHaveLength(1);
    expect(result.completed[0]).toMatchObject({ work_id: review.work_id, evidence_ids: [receipt.evidence_id], review_verdict: verdict });
    expect((await ledger.records()).every(row => row.protocol_status === 'RECEIVED')).toBe(true);
  });
});
