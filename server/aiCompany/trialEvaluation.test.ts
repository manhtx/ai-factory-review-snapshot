import { describe, expect, it } from 'vitest';
import { compareTrialReports, runMacroOsAbTrial } from './trialEvaluation';

const health = (failure: number, evidence: number, rework: number, cost: number) => ({ total_events: 1, released_tasks: 1, revised_tasks: 0, blocked_tasks: 0, agent_failure_rate: failure, rework_rate: rework, cost_per_validated_outcome_usd: cost, evidence_coverage: evidence, recovery_success_rate: 1 });
const report = (h: ReturnType<typeof health>) => ({ rounds: 1, scenario_id: 'test', results: [], health: h, quality: { user_task_success: 0, revise_rate: 0, average_confidence: 0 }, proposals: [], backlog_decisions: 0, principle_updates: 0 });

describe('trial evaluation', () => {
  it('only marks intervention improved when all core metrics do not regress', () => {
    const delta = compareTrialReports(report(health(.2, .8, .3, 5)), report(health(.1, .9, .2, 4)));
    expect(delta.improved).toBe(true);
    expect(delta.failure_rate_delta).toBe(-.1);
  });
  it('runs independent baseline and intervention datasets', async () => {
    const result = await runMacroOsAbTrial(2);
    expect(result.baseline.results).toHaveLength(2);
    expect(result.intervention.results).toHaveLength(2);
    expect(result.delta.improved).toBe(true);
    expect(result.delta.failure_rate_delta).toBeLessThan(0);
  });
});
