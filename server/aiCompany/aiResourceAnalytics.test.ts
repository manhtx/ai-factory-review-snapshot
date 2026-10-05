import { describe, expect, it } from 'vitest';
import { analyzeAiUsage } from './aiResourceAnalytics';
import type { AiUsageEvent } from './aiUsageLedger';

const event = (
  id: string,
  role: string,
  tokens: number,
  status = 'COMPLETED',
  failureClass?: string,
  contextComp?: Record<string, number>,
  retries = 0
): AiUsageEvent => ({
  id,
  timestamp: '2026-09-08T00:00:00.000Z',
  company_id: 'ai-company',
  product_id: 'macro-os',
  run_id: 'run-01',
  workflow_id: 'benchmark-b0',
  task_id: id,
  assignment_id: id,
  agent_role: role,
  provider: 'codex',
  runner: 'codex',
  model: 'gpt-4-turbo',
  prompt_fingerprint: `fp-${id}`,
  input_tokens_actual: null,
  input_tokens_estimated: tokens,
  output_tokens_actual: 500,
  output_tokens_estimated: null,
  total_tokens_actual: 500,
  total_tokens_estimated: tokens + 500,
  latency_ms: 250,
  retry_count: retries,
  exit_code: status === 'COMPLETED' ? 0 : 1,
  status,
  failure_class: failureClass ?? null,
  context_composition: contextComp ?? {
    SYSTEM_POLICY: 500,
    ASSIGNMENT: 1000,
    ROLE_CONTRACT: 500,
    DEPENDENCY: tokens - 2000 > 0 ? tokens - 2000 : 0,
  },
});

describe('analyzeAiUsage', () => {
  it('calculates deterministic role totals and retry waste', () => {
    const result = analyzeAiUsage(
      [
        event('a', 'pm', 4000, 'COMPLETED'),
        event('b', 'functional-qa', 5000, 'COMPLETED'),
        event('c', 'quality-control', 5000, 'FAILED', 'PROVIDER_FAILURE', undefined, 2),
      ],
      Date.parse('2026-09-09')
    );

    expect(result.event_count).toBe(3);
    expect(result.totals.failed_events).toBe(1);
    expect(result.totals.successful_events).toBe(2);
    expect(result.by_role['pm'].runs).toBe(1);
    expect(result.by_role['quality-control'].failed).toBe(1);
    expect(result.by_failure_class['PROVIDER_FAILURE'].count).toBe(1);
    expect(result.context_composition_totals['SYSTEM_POLICY']).toBe(1500);
    expect(result.provenance.actual_and_estimated_kept_separate).toBe(true);
    expect(result.provenance.authoritative_baseline).toBe('BENCHMARK_B0');
  });

  it('detects OVER_CONTEXT and RETRY_WASTE anomalies deterministically', () => {
    const result = analyzeAiUsage(
      [
        event('a', 'pm', 2000),
        event('b', 'coder', 2000),
        event('c', 'qa', 2200),
        event('d', 'sre', 15000), // anomaly: > 2x median (2100)
        event('e', 'critic', 2000, 'COMPLETED', undefined, undefined, 3), // retry waste anomaly
      ],
      Date.parse('2026-09-09')
    );

    expect(result.context.anomalies.some((a) => a.taxonomy === 'OVER_CONTEXT')).toBe(true);
    expect(result.context.anomalies.some((a) => a.taxonomy === 'RETRY_WASTE')).toBe(true);
  });

  it('ignores non-numeric context metadata while aggregating composition', () => {
    const result = analyzeAiUsage([{
      ...event('metadata', 'pm', 1000),
      context_composition: { assignment: 40, unit: 'characters', method: 'bounded' },
    }], Date.parse('2026-09-09'));

    expect(result.context_composition_totals).toEqual({ ASSIGNMENT: 40 });
  });
});
