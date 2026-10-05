import { describe, expect, it } from 'vitest';
import { computeCompanyHealth } from './healthMetrics';

describe('CEO health metrics', () => {
  it('computes operational and cost metrics from independent ledgers', () => {
    const events = [
      { event_id: '1', event_type: 'STATE_TRANSITION' as const, aggregate_id: 'T1', to_state: 'RELEASED' as const, actor: 'gate', reason: 'ok', idempotency_key: '1', created_at: new Date().toISOString(), payload: { evidence_ids: ['E1'] } },
      { event_id: '2', event_type: 'STATE_TRANSITION' as const, aggregate_id: 'T2', to_state: 'REVISE' as const, actor: 'ceo', reason: 'fail', idempotency_key: '2', created_at: new Date().toISOString() },
      { event_id: '3', event_type: 'CHECKPOINT' as const, aggregate_id: 'T1', actor: 'coder', reason: 'checkpoint', idempotency_key: '3', created_at: new Date().toISOString(), payload: { recovered: true } },
    ];
    const health = computeCompanyHealth(events, [
      { usage_id: 'u1', run_id: 'T1', worker_id: 'coder', input_tokens: 10, output_tokens: 10, estimated_cost_usd: 1, outcome: 'PASS', created_at: new Date().toISOString() },
      { usage_id: 'u2', run_id: 'T2', worker_id: 'coder', input_tokens: 10, output_tokens: 10, estimated_cost_usd: 3, outcome: 'FAIL', created_at: new Date().toISOString() },
    ]);
    expect(health.released_tasks).toBe(1);
    expect(health.rework_rate).toBeCloseTo(1 / 2);
    expect(health.agent_failure_rate).toBeCloseTo(1 / 2);
    expect(health.cost_per_validated_outcome_usd).toBe(4);
    expect(health.recovery_success_rate).toBe(1);
  });
});
