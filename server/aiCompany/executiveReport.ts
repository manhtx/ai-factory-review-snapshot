import type { CompanyHealth } from './healthMetrics';
import type { OptimizationProposal } from './optimizationPlanner';

export interface ExecutiveReport {
  report_id: string;
  period: string;
  health: CompanyHealth;
  weakest_area: string;
  evidence: string[];
  optimization_proposals: OptimizationProposal[];
  chairman_decisions_required: string[];
  default_action_if_no_response: 'STOP' | 'CEO_DECIDE' | 'CONTINUE' | 'REPORT_AFTER';
}

export function buildExecutiveReport(input: { period: string; health: CompanyHealth; proposals: OptimizationProposal[]; chairmanDecisions?: string[] }): ExecutiveReport {
  const candidates: Array<[string, number]> = [
    ['agent_failure_rate', input.health.agent_failure_rate],
    ['rework_rate', input.health.rework_rate],
    ['evidence_coverage_gap', 1 - input.health.evidence_coverage],
    ['recovery_failure_rate', 1 - input.health.recovery_success_rate],
  ];
  const weakest = candidates.sort((a, b) => b[1] - a[1])[0];
  return {
    report_id: `RPT-${Date.now()}`,
    period: input.period,
    health: input.health,
    weakest_area: weakest[0],
    evidence: [`${weakest[0]}=${weakest[1].toFixed(4)}`, `released_tasks=${input.health.released_tasks}`, `cost_per_validated_outcome_usd=${input.health.cost_per_validated_outcome_usd.toFixed(4)}`],
    optimization_proposals: input.proposals,
    chairman_decisions_required: input.chairmanDecisions ?? [],
    default_action_if_no_response: 'CEO_DECIDE',
  };
}
