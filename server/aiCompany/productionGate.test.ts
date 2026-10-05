import { describe, expect, it } from 'vitest';
import { evaluateProductionGate } from './productionGate';

describe('production gate', () => {
  it('refuses release when evidence or operational proofs are missing', () => {
    const result = evaluateProductionGate({ health: { total_events: 1, released_tasks: 1, revised_tasks: 0, blocked_tasks: 0, agent_failure_rate: 0, rework_rate: 0, cost_per_validated_outcome_usd: 1, evidence_coverage: .8, recovery_success_rate: 1 }, independentVerification: true, securityReview: false, recoveryTest: true, telegramAuthenticated: true });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('security review missing');
    expect(result.blockers).toContain('evidence coverage below 95%');
  });
});
