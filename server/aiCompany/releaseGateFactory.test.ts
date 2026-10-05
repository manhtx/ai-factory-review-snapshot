import { describe, expect, it } from 'vitest';
import { createReleaseGate } from './releaseGateFactory';

describe('release gate factory', () => {
  it('composes live evidence providers into one gate', async () => {
    const gate = createReleaseGate({ health: async () => ({ total_events: 1, released_tasks: 0, revised_tasks: 0, blocked_tasks: 0, agent_failure_rate: 0, rework_rate: 0, cost_per_validated_outcome_usd: 0, evidence_coverage: 1, recovery_success_rate: 1 }), independentVerification: async () => true, securityReview: async () => true, recoveryTest: async () => true, telegramAuthenticated: async () => false });
    const result = await gate();
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('telegram authentication not verified');
  });
});
