import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { EvaluationLedger } from './evaluationLedger';
import { createAgentHealthPolicy } from './agentHealthPolicy';

describe('agent health policy', () => {
  it('quarantines an agent after repeated failed evaluations', async () => {
    const ledger = new EvaluationLedger(await mkdtemp(path.join(os.tmpdir(), 'agent-health-')));
    const policy = createAgentHealthPolicy('p1', ledger, { maxCostUsd: 1 });
    for (let i = 0; i < 2; i++) await policy.evaluate({ worker_id: 'coder', ok: false, evidence_ids: [], notes: 'failure' });
    expect(await policy.allowed('coder')).toBe(false);
    expect(await policy.allowed('qa')).toBe(true);
  });
});
