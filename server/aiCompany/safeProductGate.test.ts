import { describe, expect, it } from 'vitest';
import { evaluateSafeProductGate } from './safeProductGate';

const health = { total_events: 10, released_tasks: 10, revised_tasks: 0, blocked_tasks: 0, agent_failure_rate: 0, rework_rate: 0, cost_per_validated_outcome_usd: 1, evidence_coverage: 1, recovery_success_rate: 1 };

describe('safe product gate', () => {
  it('does not require Telegram for a product canary', () => {
    expect(evaluateSafeProductGate({ health, independentVerification: true, securityReview: true, recoveryTest: true, durablePersistence: true, runtimeAttested: true, syntheticPaths: 0, featureFlagsScoped: true }).ready).toBe(true);
  });
  it('denies unsafe product conditions with explicit blockers', () => {
    const result = evaluateSafeProductGate({ health, independentVerification: true, securityReview: true, recoveryTest: true, durablePersistence: false, runtimeAttested: false, syntheticPaths: 2, featureFlagsScoped: true });
    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining(['durable persistence missing', 'runtime attestation missing', 'synthetic production paths remain: 2']));
  });
});
