import type { CompetitiveEvidence } from './competitiveEvidenceLedger';

export interface CompetitiveReviewResult { status: 'CURRENT' | 'REFRESH_REQUIRED' | 'NO_EVIDENCE'; staleEvidenceIds: string[]; subjects: string[]; reviewedAt: string; actions: string[]; }
export function reviewCompetitiveEvidence(records: CompetitiveEvidence[], now = new Date(), maxAgeDays = 30): CompetitiveReviewResult {
  if (!records.length) return { status: 'NO_EVIDENCE', staleEvidenceIds: [], subjects: [], reviewedAt: now.toISOString(), actions: ['collect official competitor evidence'] };
  const cutoff = now.getTime() - maxAgeDays * 86_400_000;
  const staleEvidenceIds = records.filter((record) => !Number.isFinite(Date.parse(record.retrieved_at)) || Date.parse(record.retrieved_at) < cutoff).map((record) => record.evidence_id);
  const actions = staleEvidenceIds.length ? ['refresh stale official sources', 're-score affected opportunities after refresh'] : ['continue scheduled source review'];
  return { status: staleEvidenceIds.length ? 'REFRESH_REQUIRED' : 'CURRENT', staleEvidenceIds, subjects: [...new Set(records.map((record) => record.subject))], reviewedAt: now.toISOString(), actions };
}
