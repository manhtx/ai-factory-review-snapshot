export type ArchitectureDecision = 'PRESERVE_ALL_OPTIONS' | 'INVESTIGATE_PRODUCT_DATA_BOTTLENECK' | 'SELECT_A' | 'SELECT_B' | 'SELECT_C';

export interface ArchitectureLearningReplay {
  learning_id: string;
  source_trial_id: string;
  prior_decision: ArchitectureDecision;
  later_decision: ArchitectureDecision;
  decision_delta: string;
  evidence_ids: string[];
  replayed_at: string;
}

/**
 * Applies a previously recorded, evidence-backed finding to a later
 * architecture decision. A learning row alone is deliberately insufficient:
 * the replay must cite the source trial and produce a material decision delta.
 */
export function replayArchitectureLearning(input: {
  learning_id: string;
  source_trial_id: string;
  prior_decision: ArchitectureDecision;
  learned_bottleneck: 'PRODUCT_DATA' | 'ARCHITECTURE';
  evidence_ids: string[];
}): ArchitectureLearningReplay {
  if (!input.learning_id.trim() || !input.source_trial_id.trim()) throw new Error('learning replay requires identity');
  if (!input.evidence_ids.length) throw new Error('learning replay requires evidence');
  const later_decision = input.learned_bottleneck === 'PRODUCT_DATA' ? 'INVESTIGATE_PRODUCT_DATA_BOTTLENECK' : input.prior_decision;
  if (later_decision === input.prior_decision) throw new Error('learning replay produced no material architecture decision delta');
  return {
    learning_id: input.learning_id,
    source_trial_id: input.source_trial_id,
    prior_decision: input.prior_decision,
    later_decision,
    decision_delta: `${input.prior_decision} -> ${later_decision}`,
    evidence_ids: [...new Set(input.evidence_ids)],
    replayed_at: new Date().toISOString(),
  };
}
