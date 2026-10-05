import type { WorkerResult } from './orchestrator';
import type { EvaluationLedger } from './evaluationLedger';
import { evaluateAgent } from './agentEvaluator';
import { summarizeAgentTrends } from './agentTrend';

/** Runtime policy that turns independent evaluations into a quarantine gate. */
export function createAgentHealthPolicy(projectId: string, ledger: EvaluationLedger, limits: { maxCostUsd: number }) {
  return {
    evaluate: async (result: WorkerResult): Promise<void> => {
      await ledger.record(projectId, evaluateAgent(result, limits));
    },
    allowed: async (workerId: string): Promise<boolean> => {
      const trends = summarizeAgentTrends((await ledger.records(projectId)).filter((record) => record.agent_id === workerId));
      const trend = trends[0];
      return !trend || trend.recommendation !== 'QUARANTINE';
    },
  };
}
