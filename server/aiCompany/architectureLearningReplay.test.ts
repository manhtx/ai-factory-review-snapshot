import { describe, expect, it } from 'vitest';
import { replayArchitectureLearning } from './architectureLearningReplay';

describe('architecture causal learning replay', () => {
  it('changes a later architecture decision from architecture selection to the observed data bottleneck', () => {
    const replay = replayArchitectureLearning({
      learning_id: 'LEARN-freshness-1789537572410',
      source_trial_id: 'freshness-architecture-1789537572410',
      prior_decision: 'PRESERVE_ALL_OPTIONS',
      learned_bottleneck: 'PRODUCT_DATA',
      evidence_ids: ['ARCH-TRIAL:freshness-architecture-1789537572410:D_PRODUCT_BOTTLENECK:observation'],
    });
    expect(replay).toMatchObject({ later_decision: 'INVESTIGATE_PRODUCT_DATA_BOTTLENECK', source_trial_id: 'freshness-architecture-1789537572410' });
    expect(replay.decision_delta).toContain('->');
  });

  it('rejects a learning row that does not change a decision', () => {
    expect(() => replayArchitectureLearning({ learning_id: 'L-1', source_trial_id: 'T-1', prior_decision: 'PRESERVE_ALL_OPTIONS', learned_bottleneck: 'ARCHITECTURE', evidence_ids: ['E-1'] })).toThrow('no material architecture decision delta');
  });
});
