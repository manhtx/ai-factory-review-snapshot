import { describe, expect, it } from 'vitest';
import { evaluatePromotion } from './releasePromotion';
import { preReleaseReviewRoles } from './preReleaseReviewGate';
import { readinessAuthorityFixture } from './readinessAuthorityTestFixture';

describe('release promotion', () => {
  it('holds promotion and requests escalation when quorum is incomplete', async () => {
    const f = await readinessAuthorityFixture(preReleaseReviewRoles.slice(0, 2));
    expect(evaluatePromotion(f.authority, 'B-1')).toMatchObject({ action: 'HOLD_AND_ESCALATE', rollback_required: true, ready: false });
  });
  it('promotes only after full independent quorum', async () => {
    const f = await readinessAuthorityFixture(preReleaseReviewRoles);
    expect(evaluatePromotion(f.authority, 'B-1')).toMatchObject({ action: 'PROMOTE', rollback_required: false, ready: true });
  });
});
it('holds promotion when completed reviews depend on withdrawn inputs', async () => {
  const f = await readinessAuthorityFixture(preReleaseReviewRoles); await f.queue.quarantine(f.source.work_id, 'Unit withdrawal');
  expect(evaluatePromotion(await f.queue.currentAuthority('unit'), 'B-1')).toMatchObject({ action: 'HOLD_AND_ESCALATE', ready: false, approvedRoles: [] });
});
