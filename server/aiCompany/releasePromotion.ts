import { evaluatePreReleaseReviewGate, type PreReleaseReviewGateResult } from './preReleaseReviewGate';
import type { CurrentRoleAuthority } from './roleWorkQueue';

export interface PromotionResult extends PreReleaseReviewGateResult { action: 'PROMOTE' | 'HOLD_AND_ESCALATE'; rollback_required: boolean; }
export function evaluatePromotion(authority: CurrentRoleAuthority | undefined, backlogId: string): PromotionResult {
  const gate = evaluatePreReleaseReviewGate(authority, backlogId);
  return { ...gate, action: gate.ready ? 'PROMOTE' : 'HOLD_AND_ESCALATE', rollback_required: !gate.ready && gate.blockers.some((blocker) => blocker.includes('BLOCKED') || blocker.includes('missing')) };
}
