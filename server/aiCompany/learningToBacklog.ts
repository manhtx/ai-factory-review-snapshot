import type { BacklogLedger, BacklogDecision } from './backlogLedger';
import type { BacklogItem } from './backlogSynthesis';
import type { ProductExperimentLedger } from './productExperiment';

export async function applyExperimentLearningToBacklog(input: { experiment: ProductExperimentLedger; experimentId: string; item: Pick<BacklogItem, 'backlog_id' | 'project_id'>; evidenceId: string; priority?: BacklogItem['priority']; ledger: BacklogLedger }): Promise<BacklogDecision> {
  const records = await input.experiment.records(input.experimentId);
  const learning = records.find((record) => record.record_type === 'LEARNING' && record.evidence_ids.includes(input.evidenceId));
  if (!learning) throw new Error('cannot reprioritize without linked experiment learning');
  const priority = input.priority ?? 'P1';
  const rationale = `Reprioritized from experiment ${input.experimentId}; learning=${learning.decision_affected}; evidence=${input.evidenceId}`;
  await input.experiment.reprioritize({
    experiment_id: input.experimentId,
    project_id: input.item.project_id,
    metric_name: 'learning_to_backlog',
    evidence_state: learning.evidence_state,
    evidence_ids: [input.evidenceId],
    decision_affected: input.item.backlog_id,
  });
  return input.ledger.decide({ backlog_id: input.item.backlog_id, project_id: input.item.project_id, priority, rationale, decided_by: 'CEO' });
}
