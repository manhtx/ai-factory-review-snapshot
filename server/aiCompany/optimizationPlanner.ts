import type { CompanyHealth } from './healthMetrics';

export interface OptimizationProposal {
  proposal_id: string;
  priority: 'P0' | 'P1' | 'P2';
  problem: string;
  evidence_metric: keyof CompanyHealth;
  current_value: number;
  target_value: number;
  action: string;
  stop_condition: string;
  confidence: number;
}

export function proposeOptimizations(health: CompanyHealth): OptimizationProposal[] {
  const proposals: OptimizationProposal[] = [];
  if (health.agent_failure_rate > 0.1) proposals.push({ proposal_id: 'OPT-FAILURE', priority: 'P0', problem: 'Agent failures exceed tolerance', evidence_metric: 'agent_failure_rate', current_value: health.agent_failure_rate, target_value: 0.05, action: 'classify failures, tighten retry policy, and quarantine unstable workers', stop_condition: 'failure rate <= 5% for 3 consecutive runs', confidence: 0.9 });
  if (health.rework_rate > 0.2) proposals.push({ proposal_id: 'OPT-REWORK', priority: 'P1', problem: 'Too much work returns for revision', evidence_metric: 'rework_rate', current_value: health.rework_rate, target_value: 0.1, action: 'improve requirement contract and add pre-execution adversarial review', stop_condition: 'rework rate <= 10% for 5 tasks', confidence: 0.82 });
  if (health.cost_per_validated_outcome_usd > 10) proposals.push({ proposal_id: 'OPT-COST', priority: 'P1', problem: 'Validated outcome cost is too high', evidence_metric: 'cost_per_validated_outcome_usd', current_value: health.cost_per_validated_outcome_usd, target_value: 7, action: 'route classification/summarization to cheaper models and cache stable evidence', stop_condition: 'cost <= target without quality regression', confidence: 0.78 });
  if (health.evidence_coverage < 0.9) proposals.push({ proposal_id: 'OPT-EVIDENCE', priority: 'P0', problem: 'Too many events lack linked evidence', evidence_metric: 'evidence_coverage', current_value: health.evidence_coverage, target_value: 0.95, action: 'make evidence IDs mandatory at verification and release gates', stop_condition: 'coverage >= 95% on release-bound events', confidence: 0.95 });
  return proposals;
}
