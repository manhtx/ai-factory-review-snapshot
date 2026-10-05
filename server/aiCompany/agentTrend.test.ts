import { describe, expect, it } from 'vitest';
import { summarizeAgentTrends } from './agentTrend';

describe('agent trend evaluator', () => {
  it('quarantines a repeatedly failing agent and retains a stable one', () => {
    const base = { project_id: 'macro-os', evaluation_id: 'e', created_at: new Date().toISOString(), contract_compliance: 1, evidence_score: 1, cost_score: 1, decision: 'RETAIN' as const, reasons: [] as string[] };
    const trends = summarizeAgentTrends([
      { ...base, agent_id: 'bad', score: 0.2, reasons: ['worker failed'] },
      { ...base, agent_id: 'bad', score: 0.3, reasons: ['worker failed'] },
      { ...base, agent_id: 'good', score: 0.9 },
      { ...base, agent_id: 'good', score: 0.85 },
    ]);
    expect(trends.find((trend) => trend.agent_id === 'bad')?.recommendation).toBe('QUARANTINE');
    expect(trends.find((trend) => trend.agent_id === 'good')?.recommendation).toBe('RETAIN');
  });
});
