import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runCeoOptimizationCycle } from './ceoOptimizationCycle';
import { OptimizationLedger } from './optimizationLedger';

describe('CEO optimization cycle', () => {
  it('persists evidence-backed proposals and returns an executive report', async () => {
    const ledger = new OptimizationLedger(await mkdtemp(path.join(os.tmpdir(), 'optimization-')));
    const report = await runCeoOptimizationCycle({ period: 'daily', ledger, health: { total_events: 1, released_tasks: 0, revised_tasks: 1, blocked_tasks: 0, agent_failure_rate: 0.2, rework_rate: 0.3, cost_per_validated_outcome_usd: 0, evidence_coverage: 0.5, recovery_success_rate: 1 } });
    expect(report.optimization_proposals.length).toBe(3);
    expect((await ledger.records()).every((record) => record.status === 'OPEN')).toBe(true);
  });
});
