import type { BacklogLedger } from './backlogLedger';
import type { CompetitiveEvidenceLedger } from './competitiveEvidenceLedger';
import { reviewCompetitiveEvidence } from './competitiveReview';

export async function createCompetitiveReviewActions(input: { projectId: string; evidence: CompetitiveEvidenceLedger; backlog: BacklogLedger }): Promise<{ created: boolean; backlogId?: string; status: string }> {
  const review = reviewCompetitiveEvidence(await input.evidence.records(input.projectId));
  if (review.status === 'CURRENT') return { created: false, status: review.status };
  const backlogId = review.status === 'REFRESH_REQUIRED' ? 'CI-REFRESH-REQUIRED' : 'CI-EVIDENCE-DISCOVERY';
  if ((await input.backlog.items(input.projectId)).some((item) => item.backlog_id === backlogId && item.status === 'PROPOSED')) return { created: false, backlogId, status: review.status };
  await input.backlog.add([{ backlog_id: backlogId, project_id: input.projectId, task_id: 'competitive-review', title: review.status === 'REFRESH_REQUIRED' ? 'Refresh stale competitive evidence' : 'Collect official competitive evidence', priority: 'P1', rationale: review.actions.join('; '), source_feedback_ids: [], acceptance_criteria: review.status === 'REFRESH_REQUIRED' ? ['refresh every stale source', 're-score affected opportunities'] : ['record at least one official source-backed evidence item'], status: 'PROPOSED' }]);
  return { created: true, backlogId, status: review.status };
}
