import type { CouncilFeedback } from './council';
import { synthesizeBacklog, type BacklogItem } from './backlogSynthesis';
import { BacklogLedger, ceoPrioritize, type BacklogDecision } from './backlogLedger';

export async function runPmCeoBacklogPipeline(input: { projectId: string; taskId: string; feedback: CouncilFeedback[]; ledger: BacklogLedger }): Promise<{ items: BacklogItem[]; decisions: BacklogDecision[] }> {
  const items = synthesizeBacklog(input.projectId, input.taskId, input.feedback);
  await input.ledger.add(items);
  const decisions = await ceoPrioritize(items, input.ledger);
  return { items, decisions };
}
