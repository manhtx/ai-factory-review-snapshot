import type { BacklogCandidate } from './backlogIntake';
import type { ProductBacklogItem, ProductPriority } from './productBacklog';

export type GroomingDecision = { action: 'PROMOTE' | 'MERGE' | 'HOLD_FOR_EVIDENCE' | 'DEFER' | 'REJECT' | 'LINK_AS_EVIDENCE'; candidate_id: string; decided_by: 'pm'; reason: string; backlog_id?: string; priority?: ProductPriority; product_backlog_item?: ProductBacklogItem };

export function applyGroomingDecision(candidate: BacklogCandidate, decision: GroomingDecision, existing?: ProductBacklogItem): { candidate: BacklogCandidate; backlog_item?: ProductBacklogItem } {
  if (decision.candidate_id !== candidate.candidate_id) throw new Error('GROOMING_CANDIDATE_MISMATCH');
  if (!decision.reason?.trim()) throw new Error('GROOMING_REASON_REQUIRED');
  if (decision.action === 'PROMOTE') {
    if (!decision.product_backlog_item) throw new Error('PROMOTE_REQUIRES_BACKLOG_ITEM');
    if (decision.product_backlog_item.pm_review_status !== 'APPROVED') throw new Error('PROMOTED_ITEM_REQUIRES_PM_APPROVAL');
    return { candidate: { ...candidate, status: 'PROMOTED', related_backlog_ids: [...new Set([...candidate.related_backlog_ids, decision.product_backlog_item.backlog_id])] }, backlog_item: decision.product_backlog_item };
  }
  if (decision.action === 'MERGE' || decision.action === 'LINK_AS_EVIDENCE') {
    if (!existing || !decision.backlog_id || existing.backlog_id !== decision.backlog_id) throw new Error('MERGE_REQUIRES_EXISTING_BACKLOG');
    return { candidate: { ...candidate, status: 'MERGED', related_backlog_ids: [...new Set([...candidate.related_backlog_ids, existing.backlog_id])] }, backlog_item: { ...existing, evidence_ids: [...new Set([...existing.evidence_ids, ...candidate.evidence_ids])], updated_at: new Date().toISOString() } };
  }
  const status = decision.action === 'HOLD_FOR_EVIDENCE' ? 'HOLD_FOR_EVIDENCE' : decision.action === 'DEFER' ? 'DEFERRED' : 'REJECTED';
  return { candidate: { ...candidate, status } };
}
