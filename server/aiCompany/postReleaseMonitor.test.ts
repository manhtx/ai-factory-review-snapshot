import { describe, expect, it } from 'vitest';
import { evaluatePostReleaseHealth } from './postReleaseMonitor';
import { recordPostReleaseIncident } from './postReleaseMonitor';
import { BacklogLedger } from './backlogLedger';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const health = (overrides = {}) => ({ total_events: 10, released_tasks: 1, revised_tasks: 0, blocked_tasks: 0, agent_failure_rate: 0, rework_rate: 0, cost_per_validated_outcome_usd: 1, evidence_coverage: 1, recovery_success_rate: 1, ...overrides });
describe('post-release monitor', () => {
  it('reports attention without overreacting to a moderate signal', () => expect(evaluatePostReleaseHealth(health({ rework_rate: .3 })).status).toBe('ATTENTION'));
  it('recommends rollback for severe evidence or failure regression', () => expect(evaluatePostReleaseHealth(health({ agent_failure_rate: .2 })).rollback_recommended).toBe(true));
  it('remains healthy when all SLOs hold', () => expect(evaluatePostReleaseHealth(health()).status).toBe('HEALTHY'));
  it('records one idempotent P0 incident for severe regression', async () => {
    const ledger = new BacklogLedger(await mkdtemp(path.join(os.tmpdir(), 'incident-')));
    const input = { projectId: 'macro-os', health: health({ agent_failure_rate: .2 }), ledger };
    await expect(recordPostReleaseIncident(input)).resolves.toMatchObject({ recorded: true });
    await expect(recordPostReleaseIncident(input)).resolves.toMatchObject({ recorded: false });
    await expect(ledger.items('macro-os')).resolves.toHaveLength(1);
  });
});
