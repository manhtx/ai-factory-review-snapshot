import { expect, it } from 'vitest';
import { mkdtemp, readFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { RoleWorkQueue, type AttemptAuthority } from './roleWorkQueue';
import { InMemoryEvidenceResolver } from './evidenceResolver';
import { executeReadyRoleWork } from './roleWorkExecutor';

const result = { research_question: 'Attempt admission fixture', source_reference: 'E-ATTEMPT', finding: 'Isolated fixture; actual product outcome UNKNOWN', confidence: 0.5 };
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'attempt-authority-'));
  const resolver = new InMemoryEvidenceResolver(); const queue = new RoleWorkQueue(root, resolver);
  const item = await queue.create({ project_id: 'isolated', backlog_id: 'B', title: 'Unit-only attempt authority fixture', role: 'ux-research' });
  const evidence = resolver.createEvidence({ evidence_id: 'E-ATTEMPT', namespace: item.assignment!.namespace, run_id: item.assignment!.run_id, produced_by_role: item.role, content: 'Unit-only input bytes; no product effect' });
  resolver.register({ ...evidence, work_id: item.work_id, source_artifact: 'attemptAuthority.test.ts' });
  const claim = await queue.claim(item.work_id, 'owner');
  const complete = (q = queue, authority: AttemptAuthority | undefined = claim.attempt_authority) => q.complete(item.work_id, ['E-ATTEMPT'], result, undefined, undefined, undefined, undefined, authority);
  return { root, resolver, queue, item, claim, complete };
}

it('requires explicit authority for submit and never appends on absence', async () => {
  const { root, queue, item } = await fixture(); const file = path.join(root, 'role-work-queue.jsonl'); const before = await readFile(file);
  await expect(queue.submitForReview(item.work_id)).rejects.toThrow('attempt authority');
  expect(await readFile(file)).toEqual(before);
});

it.each(['missing', 'token', 'owner', 'attempt'] as const)('rejects %s completion capability without append', async kind => {
  const { root, queue, item, claim } = await fixture(); await queue.submitForReview(item.work_id, claim.attempt_authority);
  const authority = kind === 'missing' ? undefined : { ...claim.attempt_authority, ...(kind === 'token' ? { token: '0'.repeat(64) } : kind === 'owner' ? { owner: 'other-owner' } : { attempt_id: 'other-attempt' }) };
  const file = path.join(root, 'role-work-queue.jsonl'); const before = await readFile(file);
  await expect(queue.complete(item.work_id, ['E-ATTEMPT'], result, undefined, undefined, undefined, undefined, authority)).rejects.toThrow('attempt authority');
  expect(await readFile(file)).toEqual(before);
});

it.each(['owner', 'different-owner'])('rejects stale attempt after %s reclaim, including stale failure', async owner => {
  const { queue, item, claim, complete, root } = await fixture(); await queue.submitForReview(item.work_id, claim.attempt_authority);
  await queue.blockAttempt(item.work_id, 'attempt invalidated', claim.attempt_authority); await queue.requeueBlocked(item.work_id);
  const newer = await queue.claim(item.work_id, owner); await queue.submitForReview(item.work_id, newer.attempt_authority);
  const before = await readFile(path.join(root, 'role-work-queue.jsonl'));
  await expect(complete()).rejects.toThrow('attempt authority');
  await expect(queue.blockAttempt(item.work_id, 'stale error handler', claim.attempt_authority)).rejects.toThrow('attempt authority');
  expect(await readFile(path.join(root, 'role-work-queue.jsonl'))).toEqual(before);
  expect(newer.attempt_id).not.toBe(claim.attempt_id);
});

it('accepts legitimate capability across queue instances without storing the raw token', async () => {
  const { queue, item, claim, root, resolver, complete } = await fixture();
  await queue.submitForReview(item.work_id, claim.attempt_authority);
  expect((await complete(new RoleWorkQueue(root, resolver))).state).toBe('DONE');
  const history = await readFile(path.join(root, 'role-work-queue.jsonl'), 'utf8');
  expect(history).not.toContain(claim.attempt_authority.token);
  expect(history).not.toContain('attempt_authority');
  expect((await queue.records())[0].attempt_id).toBe(claim.attempt_id);
});

it('runtime executes the actual claim without disclosing its capability', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'attempt-runtime-'));
  const resolver = new InMemoryEvidenceResolver(); const queue = new RoleWorkQueue(root, resolver);
  await queue.create({ project_id: 'isolated', backlog_id: 'B', title: 'Unit-only execution', role: 'ux-research' });
  let observedAttempt: string | undefined;
  const execution = await executeReadyRoleWork({ projectId: 'isolated', queue, execute: async item => {
    expect(item).not.toHaveProperty('attempt_authority'); expect(item.state).toBe('CLAIMED'); expect(item.queue_revision).toBe(2);
    expect(item.attempt_id).toBeTruthy(); observedAttempt = item.attempt_id;
    const evidence = resolver.createEvidence({ evidence_id: 'E-ATTEMPT', namespace: item.assignment!.namespace, run_id: item.assignment!.run_id, produced_by_role: item.role, content: 'Unit fixture only' });
    resolver.register({ ...evidence, work_id: item.work_id, source_artifact: 'attemptAuthority.test.ts' });
    return { evidence_ids: ['E-ATTEMPT'], research_result: result };
  } });
  expect(execution.completed).toHaveLength(1); expect(execution.completed[0].attempt_id).toBe(observedAttempt);
});

it('does not transfer active capability to a copied queue root', async () => {
  const { root, resolver, queue, claim, item } = await fixture();
  await queue.submitForReview(item.work_id, claim.attempt_authority);
  const copied = await mkdtemp(path.join(os.tmpdir(), 'attempt-copied-'));
  await copyFile(path.join(root, 'role-work-queue.jsonl'), path.join(copied, 'role-work-queue.jsonl'));
  const before = await readFile(path.join(copied, 'role-work-queue.jsonl'));
  await expect(new RoleWorkQueue(copied, resolver).complete(item.work_id, ['E-ATTEMPT'], result, undefined, undefined, undefined, undefined, claim.attempt_authority)).rejects.toThrow('attempt authority');
  expect(await readFile(path.join(copied, 'role-work-queue.jsonl'))).toEqual(before);
});
