import { describe, expect, it } from 'vitest';
import { proposeOptimizations } from './optimizationPlanner';

describe('CEO optimization planner', () => {
  it('prioritizes evidence and reliability problems with measurable stop conditions', () => {
    const proposals = proposeOptimizations({ total_events: 100, released_tasks: 2, revised_tasks: 4, blocked_tasks: 1, agent_failure_rate: 0.3, rework_rate: 0.4, cost_per_validated_outcome_usd: 15, evidence_coverage: 0.6, recovery_success_rate: 1 });
    expect(proposals.map((proposal) => proposal.proposal_id)).toEqual(['OPT-FAILURE', 'OPT-REWORK', 'OPT-COST', 'OPT-EVIDENCE']);
    expect(proposals.every((proposal) => proposal.stop_condition.length > 0)).toBe(true);
  });

  it('does not create noise when metrics are within target', () => {
    expect(proposeOptimizations({ total_events: 1, released_tasks: 1, revised_tasks: 0, blocked_tasks: 0, agent_failure_rate: 0, rework_rate: 0, cost_per_validated_outcome_usd: 1, evidence_coverage: 1, recovery_success_rate: 1 })).toEqual([]);
  });
});
