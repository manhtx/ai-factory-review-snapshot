import { describe, expect, it } from 'vitest';
import { eligibilityForObjective } from './objectiveEligibility';

describe('objective eligibility', () => {
  it('excludes historical blocked work but retains it in lineage', () => {
    const result = eligibilityForObjective('A', [{ work_id: 'old', objective_id: 'A', state: 'BLOCKED' }]);
    expect(result.result).toBe('ELIGIBLE');
    expect(result.lineage_states.old).toBe('STALE_BLOCKED');
  });
  it('blocks active work and is stable across unrelated revisions', () => {
    const rows = [{ work_id: 'active', objective_id: 'A', state: 'CLAIMED' }];
    const a = eligibilityForObjective('A', rows, 'same');
    const b = eligibilityForObjective('A', rows, 'same');
    expect(a.result).toBe('INELIGIBLE_ACTIVE_WORK');
    expect(a.attempt_key).toBe(b.attempt_key);
    expect(eligibilityForObjective('A', rows, 'changed').attempt_key).not.toBe(a.attempt_key);
  });
  it('routes unknown lineage to reconciliation', () => {
    expect(eligibilityForObjective('A', [{ work_id: 'x', objective_id: 'A', state: 'MYSTERY' }]).result).toBe('REQUIRES_RECONCILIATION');
  });
  it('allows an alternative objective when the first is blocked', () => {
    expect(eligibilityForObjective('B', [{ work_id: 'a', objective_id: 'A', state: 'CLAIMED' }]).result).toBe('ELIGIBLE');
  });
  it('keeps one unchanged semantic attempt stable across 100 scheduler ticks', () => {
    const rows = [{ work_id: 'active', objective_id: 'A', state: 'BLOCKED', effective_state: 'ACTIVE_BLOCKED' as const, lineage_version: '7' }];
    const keys = new Set(Array.from({ length: 100 }, () => eligibilityForObjective('A', rows, 'requirements-7').attempt_key));
    expect(keys.size).toBe(1);
  });
});
