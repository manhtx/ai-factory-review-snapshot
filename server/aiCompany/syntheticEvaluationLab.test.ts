import { describe, expect, it } from 'vitest';
import { aggregateLockedFindings, compareBeforeAfter, lockFindings, scoreSyntheticProduct } from './syntheticEvaluationLab';

describe('synthetic evaluation lab', () => {
  it('locks findings immutably and preserves disagreement', () => {
    const lock = lockFindings('SNAP-1', [
      { finding_id: 'F1', evaluator_id: 'E1', scenario_id: 'S1', title: 'Trust state mismatch', statement: 'Shows loading despite hydrated count', severity: 'S2', confidence: 'HIGH', evidence_ids: ['BROWSER-1'], affected_personas: ['analyst'], reproducible: true },
      { finding_id: 'F2', evaluator_id: 'U2', scenario_id: 'S1', title: 'Trust state mismatch', statement: 'Source status is unclear before opening a card', severity: 'S2', confidence: 'MEDIUM', evidence_ids: ['BROWSER-1'], affected_personas: ['beginner'], reproducible: true },
    ], '2026-09-11T00:00:00.000Z');
    const [cluster] = aggregateLockedFindings(lock);
    expect(lock.immutable_hash).toHaveLength(64);
    expect(cluster.evaluator_count).toBe(2);
    expect(cluster.disagreement).toHaveLength(1);
  });

  it('scores only synthetic product quality and never market success', () => {
    const score = scoreSyntheticProduct({ product_value: 10, domain_usefulness: 10, trust_evidence: 8, usability: 8, information_architecture: 7, ui_quality: 7, task_efficiency: 3, accessibility: 3, reliability: 3, product_coherence: 4, evidence_ids: ['BROWSER-1'] });
    expect(score.total).toBe(63);
    expect(score.provenance).toContain('NOT_MARKET_SUCCESS');
  });

  it('revises when a regression exists even if the score rises', () => {
    expect(compareBeforeAfter({ baseline_snapshot_id: 'A', candidate_snapshot_id: 'B', baseline_score: 60, candidate_score: 70, regression_count: 1, evidence_ids: ['BROWSER-1'] }).decision).toBe('REVISE');
  });
});
