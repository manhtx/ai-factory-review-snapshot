import { describe, expect, it } from 'vitest';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { evaluatePreReleaseReviewGate, preReleaseReviewRoles } from './preReleaseReviewGate';
import { faultReadinessWork, readinessAuthorityFixture } from './readinessAuthorityTestFixture';
import type { CurrentRoleAuthority } from './roleWorkQueue';

describe('pre-release review gate', () => {
  it('fails closed until every independent review has evidence', async () => {
    const f = await readinessAuthorityFixture(preReleaseReviewRoles.filter(role => role !== 'domain-expert'));
    const result = evaluatePreReleaseReviewGate(f.authority, 'B-1');
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('domain-expert review missing');
    expect(result.approvedRoles).toHaveLength(5);
  });
  it('opens only for completed evidence-backed quorum', async () => {
    const f = await readinessAuthorityFixture(preReleaseReviewRoles);
    expect(evaluatePreReleaseReviewGate(f.authority, 'B-1')).toMatchObject({ ready: true, blockers: [] });
  });
});

it.each(['withdrawn', 'missing', 'nonpass', 'missing-verdict'])('denies %s current review authority', async kind => {
  const f = await readinessAuthorityFixture(preReleaseReviewRoles);
  let authority = f.authority;
  if (kind === 'withdrawn') { await f.queue.quarantine(f.source.work_id, 'Unit withdrawal'); authority = await f.queue.currentAuthority('unit'); }
  if (kind === 'missing') authority = await faultReadinessWork(f, 'functional-qa', { depends_on: ['MISSING-SOURCE'] });
  if (kind === 'nonpass') authority = await faultReadinessWork(f, 'functional-qa', { review_verdict: { ...f.rows.find(row => row.role === 'functional-qa')!.review_verdict!, verdict: 'QUALITY_FAIL' } });
  if (kind === 'missing-verdict') authority = await faultReadinessWork(f, 'functional-qa', { review_verdict: undefined });
  const gate = evaluatePreReleaseReviewGate(authority, 'B-1');
  expect(gate.ready).toBe(false);
  expect(gate.approvedRoles).not.toContain('functional-qa');
  expect(gate.blockers).toContain('functional-qa review current authority is invalid');
});
it('uses full dependency snapshot before selecting review backlog', async () => {
  const f = await readinessAuthorityFixture(preReleaseReviewRoles);
  expect(f.source.backlog_id).toBe('SOURCE');
  expect(evaluatePreReleaseReviewGate(f.authority, 'B-1').ready).toBe(true);
});
it('revokes receiptless history and rejects a stale view without erasing DONE', async () => {
  const f = await readinessAuthorityFixture(preReleaseReviewRoles);
  await unlink(path.join(f.root, 'role-evidence.jsonl'));
  expect(() => evaluatePreReleaseReviewGate(f.authority, 'B-1')).toThrow('snapshot changed');
  expect(evaluatePreReleaseReviewGate(await f.queue.currentAuthority('unit'), 'B-1')).toMatchObject({ ready: false, approvedRoles: [] });
  expect((await f.queue.records('unit')).every(row => row.state === 'DONE')).toBe(true);
});
it('plain rows and copied views cannot certify prerelease', async () => {
  const f = await readinessAuthorityFixture(preReleaseReviewRoles);
  for (const fake of [undefined, f.rows, { ...f.authority }]) expect(evaluatePreReleaseReviewGate(fake as CurrentRoleAuthority, 'B-1')).toMatchObject({ ready: false, approvedRoles: [] });
});
it('cannot approve an empty target project using healthy foreign work', async () => {
  const f = await readinessAuthorityFixture(preReleaseReviewRoles), target = await f.queue.currentAuthority('EMPTY-TARGET');
  expect(target.currentRows()).toEqual([]);
  expect(target.isSuccessful(f.rows[0])).toBe(false);
  expect(target.dependencySatisfied(f.rows[1], f.rows[0])).toBe(false);
  expect(evaluatePreReleaseReviewGate(target, 'B-1')).toMatchObject({ ready: false, approvedRoles: [] });
});
