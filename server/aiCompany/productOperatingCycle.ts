import { BacklogLedger, ceoPrioritize, type BacklogDecision } from './backlogLedger';
import { OutcomeLedger } from './outcomeLedger';
import { recommendationsToBacklog } from './outcomeBacklogAdapter';
import { runProductOperatingReview, type ProductOperatingReview } from './productOperatingReview';

export interface ProductOperatingCycleResult { review: ProductOperatingReview; backlog_items_created: number; ceo_decisions: BacklogDecision[] }

export async function runProductOperatingCycle(input: { projectId: string; taskId: string; outcomeLedger: OutcomeLedger; backlogLedger: BacklogLedger; period?: string }): Promise<ProductOperatingCycleResult> {
  const review = await runProductOperatingReview({ ledger: input.outcomeLedger, projectId: input.projectId, period: input.period });
  const items = await recommendationsToBacklog({ review, taskId: input.taskId, ledger: input.backlogLedger });
  const ceoDecisions = items.length ? await ceoPrioritize(items, input.backlogLedger) : [];
  return { review, backlog_items_created: items.length, ceo_decisions: ceoDecisions };
}
