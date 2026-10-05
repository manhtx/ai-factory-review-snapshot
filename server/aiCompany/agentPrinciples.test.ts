import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AgentPrinciplesLedger, updatePrinciplesFromHealth } from './agentPrinciples';

describe('agent principles learning loop', () => {
  it('versions evidence-driven principle updates', async () => {
    const ledger = new AgentPrinciplesLedger(await mkdtemp(path.join(os.tmpdir(), 'principles-')));
    const updates = await updatePrinciplesFromHealth(ledger, { total_events: 1, released_tasks: 0, revised_tasks: 1, blocked_tasks: 0, agent_failure_rate: .2, rework_rate: 0, cost_per_validated_outcome_usd: 0, evidence_coverage: .5, recovery_success_rate: 1 });
    expect(updates).toHaveLength(2);
    expect((await ledger.records('functional-qa'))[0].version).toBe(1);
  });
});
