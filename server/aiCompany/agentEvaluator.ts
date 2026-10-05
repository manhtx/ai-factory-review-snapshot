import type { WorkerResult } from './orchestrator';
import type { EvaluationLedger } from './evaluationLedger';

export interface AgentEvaluation { agent_id: string; score: number; contract_compliance: number; evidence_score: number; cost_score: number; decision: 'RETAIN' | 'COACH' | 'QUARANTINE'; reasons: string[] }

export function evaluateAgent(result: WorkerResult, limits: { maxCostUsd: number }): AgentEvaluation {
  const contract = result.worker_id.length > 0 && typeof result.ok === 'boolean' ? 1 : 0;
  const evidence = result.ok ? (result.evidence_ids.length > 0 ? 1 : 0.25) : 0;
  const cost = result.estimated_cost_usd === undefined ? 0.5 : Math.max(0, Math.min(1, limits.maxCostUsd === 0 ? 0 : 1 - result.estimated_cost_usd / limits.maxCostUsd));
  const score = (contract * 0.35) + (evidence * 0.4) + (cost * 0.25);
  const reasons: string[] = [];
  if (!result.ok) reasons.push('worker failed');
  if (result.ok && !result.evidence_ids.length) reasons.push('successful result has no evidence');
  if (result.estimated_cost_usd !== undefined && result.estimated_cost_usd > limits.maxCostUsd) reasons.push('cost limit exceeded');
  return { agent_id: result.worker_id, score, contract_compliance: contract, evidence_score: evidence, cost_score: cost, decision: score >= 0.8 ? 'RETAIN' : score >= 0.5 ? 'COACH' : 'QUARANTINE', reasons };
}

export function evaluationCallback(projectId: string, ledger: EvaluationLedger, limits: { maxCostUsd: number }) {
  return async (result: WorkerResult): Promise<void> => { await ledger.record(projectId, evaluateAgent(result, limits)); };
}
