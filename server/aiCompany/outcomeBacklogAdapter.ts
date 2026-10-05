import type { BacklogItem } from './backlogSynthesis';
import type { BacklogLedger } from './backlogLedger';
import type { ProductOperatingRecommendation, ProductOperatingReview } from './productOperatingReview';

export async function recommendationsToBacklog(input: { review: ProductOperatingReview; taskId: string; ledger: BacklogLedger }): Promise<BacklogItem[]> {
  const items = input.review.recommendations.map((recommendation, index) => recommendationToBacklog(input.review.project_id, input.taskId, recommendation, index));
  if (items.length) await input.ledger.add(items);
  return items;
}

function recommendationToBacklog(projectId: string, taskId: string, recommendation: ProductOperatingRecommendation, index: number): BacklogItem {
  return { backlog_id: `OUTCOME-${Date.now()}-${index}`, project_id: projectId, task_id: taskId, title: recommendation.action, priority: recommendation.priority, rationale: recommendation.rationale, source_feedback_ids: [], source_outcome_ids: recommendation.source_outcome_ids, acceptance_criteria: [`address ${recommendation.source_outcome_ids.length} evidence-backed outcome(s)`, `review owner ${recommendation.owner} outcome`], status: 'PROPOSED' };
}
