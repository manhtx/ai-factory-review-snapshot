import { describe, expect, it } from 'vitest';
import { buildExecutiveReport } from './executiveReport';

describe('CEO executive report', () => {
  it('selects the weakest measured area and only includes decision packets', () => {
    const report = buildExecutiveReport({ period: '2026-W36', health: { total_events: 10, released_tasks: 1, revised_tasks: 2, blocked_tasks: 0, agent_failure_rate: 0.1, rework_rate: 0.2, cost_per_validated_outcome_usd: 2, evidence_coverage: 0.5, recovery_success_rate: 1 }, proposals: [], chairmanDecisions: ['DEC-1'] });
    expect(report.weakest_area).toBe('evidence_coverage_gap');
    expect(report.chairman_decisions_required).toEqual(['DEC-1']);
    expect(report.default_action_if_no_response).toBe('CEO_DECIDE');
  });
});
