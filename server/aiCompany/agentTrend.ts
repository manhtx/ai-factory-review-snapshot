import type { EvaluationRecord } from './evaluationLedger';

export interface AgentTrend { agent_id: string; sample_count: number; average_score: number; failure_rate: number; recommendation: 'RETAIN' | 'COACH' | 'QUARANTINE' }

export function summarizeAgentTrends(records: EvaluationRecord[], recentLimit = 10): AgentTrend[] {
  const grouped = new Map<string, EvaluationRecord[]>();
  for (const record of records) grouped.set(record.agent_id, [...(grouped.get(record.agent_id) ?? []), record]);
  return [...grouped].map(([agent_id, all]) => {
    const recent = all.slice(-recentLimit);
    const average_score = recent.reduce((sum, record) => sum + record.score, 0) / recent.length;
    const failure_rate = recent.filter((record) => record.reasons.includes('worker failed')).length / recent.length;
    const recommendation = average_score < 0.5 || failure_rate >= 0.5 ? 'QUARANTINE' : average_score < 0.8 ? 'COACH' : 'RETAIN';
    return { agent_id, sample_count: recent.length, average_score, failure_rate, recommendation };
  });
}
