import type { MacroOsTrialReport } from './macroOsTrial';
import { runMacroOsTrials } from './macroOsTrial';

export interface TrialDelta { failure_rate_delta: number; evidence_coverage_delta: number; rework_rate_delta: number; cost_delta_usd: number; improved: boolean; }

export function compareTrialReports(baseline: MacroOsTrialReport, intervention: MacroOsTrialReport): TrialDelta {
  const failure_rate_delta = intervention.health.agent_failure_rate - baseline.health.agent_failure_rate;
  const evidence_coverage_delta = intervention.health.evidence_coverage - baseline.health.evidence_coverage;
  const rework_rate_delta = intervention.health.rework_rate - baseline.health.rework_rate;
  const cost_delta_usd = intervention.health.cost_per_validated_outcome_usd - baseline.health.cost_per_validated_outcome_usd;
  const qualityDelta = intervention.quality.user_task_success - baseline.quality.user_task_success;
  const nonRegressive = failure_rate_delta <= 0 && evidence_coverage_delta >= 0 && rework_rate_delta <= 0 && cost_delta_usd <= 0 && qualityDelta >= 0;
  const strictlyBetter = failure_rate_delta < 0 || evidence_coverage_delta > 0 || rework_rate_delta < 0 || cost_delta_usd < 0 || qualityDelta > 0;
  return { failure_rate_delta, evidence_coverage_delta, rework_rate_delta, cost_delta_usd, improved: nonRegressive && strictlyBetter };
}

export async function runMacroOsAbTrial(rounds: number, scenarioId = 'generic'): Promise<{ baseline: MacroOsTrialReport; intervention: MacroOsTrialReport; delta: TrialDelta }> {
  const baseline = await runMacroOsTrials({ rounds, scenarioId, injectFailureRound: 1 });
  // The intervention is intentionally explicit: a repaired QA worker records
  // evidence and succeeds on the known failure case. This is a harness-level
  // experiment, not a claim that principles alone fix provider failures.
  const intervention = await runMacroOsTrials({
    rounds, scenarioId,
    injectFailureRound: 1,
    principlesImproveBehavior: true,
    workerBehavior: ({ agent_id, round, failing }) => failing && agent_id === 'functional-qa'
      ? { ok: true, evidence_ids: [`E-${round}-${agent_id}-recovered`], notes: 'intervention recovery behavior' }
      : {},
  });
  return { baseline, intervention, delta: compareTrialReports(baseline, intervention) };
}
