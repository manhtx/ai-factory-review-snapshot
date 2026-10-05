import { appendFile, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { InMemoryEvidenceResolver } from './evidenceResolver';
import { RoleWorkQueue } from './roleWorkQueue';
import type { ReviewVerdict } from './verdict';
import { evaluateAssignmentAdmission } from './assignmentEnvelope';

async function reviewFixture(verdict: ReviewVerdict['verdict']) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'review-terminal-'));
  const resolver = new InMemoryEvidenceResolver();
  const queue = new RoleWorkQueue(root, resolver);
  const source = await queue.create({ project_id: 'fixture', backlog_id: 'B', title: 'isolated source', role: 'user-persona', namespace: 'fixture', run_id: 'R' });
  const evidence = resolver.createEvidence({ evidence_id: 'SOURCE', namespace: 'fixture', run_id: 'R', produced_by_role: source.role, content: 'Isolated fixture, no product outcome.' });
  resolver.register({ ...evidence, work_id: source.work_id, source_artifact: 'reviewTerminalAdmission.test.ts' });
  const claimAuthority1 = await queue.claim(source.work_id, 'fixture');
  await queue.submitForReview(source.work_id, claimAuthority1.attempt_authority);
  await queue.complete(source.work_id, ['SOURCE'], { research_question: 'fixture', source_reference: 'SOURCE', finding: 'fixture', confidence: 0.5 }, undefined, undefined, undefined, undefined, claimAuthority1.attempt_authority);
  const review = await queue.create({ project_id: 'fixture', backlog_id: 'BR', title: 'isolated review', role: 'functional-qa', namespace: 'fixture', run_id: 'R', depends_on: [source.work_id] });
  const claimAuthority2 = await queue.claim(review.work_id, 'fixture');
  await queue.submitForReview(review.work_id, claimAuthority2.attempt_authority);
  const contract: ReviewVerdict = { verdict, gate: 'fixture', summary: 'fixture', evidence: ['SOURCE'], failure_class: verdict === 'HOLD' ? 'INSUFFICIENT_EVIDENCE' : verdict === 'BLOCKED' ? 'EXTERNAL_BLOCKER' : verdict === 'PASS' ? 'NONE' : 'QUALITY_DEFECT', root_cause: 'fixture', recovery_required: false, recovery_actions: [], unblock_evidence: [], retry_budget: 0, next_review_trigger: 'fixture', confidence: 0.5 };
  const admitted = await queue.complete(review.work_id, ['SOURCE'], undefined, contract, undefined, undefined, undefined, claimAuthority2.attempt_authority);
  return { root, queue, source, review, contract, admitted };
}

describe('review terminal admission', () => {
  it.each(['HOLD', 'REVISE', 'QUALITY_FAIL', 'BLOCKED'] as const)('retains %s as blocked and denies ordinary downstream authority', async verdict => {
    const { queue, review, contract, admitted } = await reviewFixture(verdict);
    expect(admitted).toMatchObject({ state: 'BLOCKED', review_verdict: contract, evidence_ids: ['SOURCE'] });
    const child = await queue.create({ project_id: 'fixture', backlog_id: 'BC', title: 'ordinary downstream', role: 'sre', namespace: 'fixture', run_id: 'R', depends_on: [review.work_id] });
    await expect(queue.claim(child.work_id, 'fixture')).rejects.toThrow('dependencies are not complete');
  });

  it('preserves PASS as successful ordinary dependency', async () => {
    const { queue, review, admitted } = await reviewFixture('PASS');
    expect(admitted.state).toBe('DONE');
    const child = await queue.create({ project_id: 'fixture', backlog_id: 'BC', title: 'ordinary downstream', role: 'sre', namespace: 'fixture', run_id: 'R', depends_on: [review.work_id] });
    await expect(queue.claim(child.work_id, 'fixture')).resolves.toMatchObject({ state: 'CLAIMED' });
  });

  it('allows an explicit same-scope corrective dependency without granting source success', async () => {
    const { queue, review } = await reviewFixture('HOLD');
    const correction = await queue.create({ project_id: 'fixture', backlog_id: 'BC', title: 'corrective work', role: 'sre', namespace: 'fixture', run_id: 'R', depends_on: [review.work_id], recovery_source_work_id: review.work_id });
    expect(await queue.reconcileOrphanedReady('fixture')).toEqual([]);
    expect(evaluateAssignmentAdmission(correction.assignment!, { satisfiedDependencyIds: [review.work_id] }).decision).toBe('ADMITTED');
    expect(evaluateAssignmentAdmission(correction.assignment!, { satisfiedDependencyIds: [] }).decision).toBe('REJECTED_DEPENDENCY');
    await expect(queue.claim(correction.work_id, 'fixture')).resolves.toMatchObject({ state: 'CLAIMED' });
    expect((await queue.records()).find(row => row.work_id === review.work_id)?.state).toBe('BLOCKED');
  });

  it('keeps explicit corrective dependency admissible through dispatch, review and terminal without promoting failed source', async () => {
    const { queue, review, source } = await reviewFixture('HOLD');
    const correction = await queue.create({ project_id: 'fixture', backlog_id: 'BC', title: 'unit corrective admission only', role: 'sre', namespace: 'fixture', run_id: 'R', depends_on: [review.work_id, source.work_id], recovery_source_work_id: review.work_id });
    const claim = await queue.claim(correction.work_id, 'fixture');
    await expect(queue.reserveProviderDispatch(correction.work_id, 'unit-stub', claim.attempt_authority, claim)).resolves.toMatchObject({ state: 'CLAIMED' });
    await queue.submitForReview(correction.work_id, claim.attempt_authority);
    expect((await queue.complete(correction.work_id, ['SOURCE'], { research_question: 'Unit correction', source_reference: 'SOURCE', finding: 'Unit advisory only', confidence: 0.2 }, undefined, undefined, undefined, undefined, claim.attempt_authority)).state).toBe('DONE');
    expect((await queue.records()).find(row => row.work_id === review.work_id)?.state).toBe('BLOCKED');
    const failedReview = (await queue.records()).find(row => row.work_id === review.work_id)!;
    const originalCorrection = (await queue.records()).find(row => row.work_id === correction.work_id)!;
    expect(await queue.currentDependencySatisfied(originalCorrection, failedReview)).toBe(true);
    const corrected = (await queue.records()).find(row => row.work_id === correction.work_id)!;
    expect(await queue.currentSuccess(corrected)).toBe(true);
    expect(await queue.currentSuccess((await queue.records()).find(row => row.work_id === review.work_id)!)).toBe(false);
  });

  it('rejects a corrective dependency from another run', async () => {
    const { queue, review } = await reviewFixture('HOLD');
    const correction = await queue.create({ project_id: 'fixture', backlog_id: 'BC', title: 'corrective work', role: 'sre', namespace: 'fixture', run_id: 'FOREIGN', depends_on: [review.work_id], recovery_source_work_id: review.work_id });
    await expect(queue.claim(correction.work_id, 'fixture')).rejects.toThrow('dependencies are not complete');
  });

  it('does not let historical DONE with a retained HOLD unlock ordinary work', async () => {
    const { root, queue, review, admitted } = await reviewFixture('HOLD');
    await appendFile(path.join(root, 'role-work-queue.jsonl'), JSON.stringify({ ...admitted, state: 'DONE' }) + '\n');
    const child = await queue.create({ project_id: 'fixture', backlog_id: 'BC', title: 'ordinary downstream', role: 'sre', namespace: 'fixture', run_id: 'R', depends_on: [review.work_id] });
    await expect(queue.claim(child.work_id, 'fixture')).rejects.toThrow('dependencies are not complete');
  });

  it('rejects a recovery marker that does not name a declared dependency', async () => {
    const { queue, review } = await reviewFixture('HOLD');
    await expect(queue.create({ project_id: 'fixture', backlog_id: 'BC', title: 'bad corrective contract', role: 'sre', namespace: 'fixture', run_id: 'R', recovery_source_work_id: review.work_id })).rejects.toThrow('explicit work dependency');
  });
});
