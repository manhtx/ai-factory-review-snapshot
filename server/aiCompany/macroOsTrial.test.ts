import { describe, expect, it } from 'vitest';
import { runMacroOsTrials } from './macroOsTrial';

describe('Macro OS trial harness', () => {
  it('runs multiple rounds and exposes failure-driven improvement signals', async () => {
    const report = await runMacroOsTrials({ rounds: 2, injectFailureRound: 1 });
    expect(report.results).toHaveLength(2);
    expect(report.results[0].status).toBe('REVISE');
    expect(report.health.agent_failure_rate).toBeGreaterThan(0);
    expect(report.backlog_decisions).toBeGreaterThan(0);
    expect(report.proposals.some((proposal) => proposal.proposal_id === 'OPT-FAILURE')).toBe(true);
    expect(report.principle_updates).toBeGreaterThan(0);
  });
});
