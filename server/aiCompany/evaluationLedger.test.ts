import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EvaluationLedger } from './evaluationLedger';

describe('EvaluationLedger', () => {
  it('persists and scopes independent agent evaluations', async () => {
    const ledger = new EvaluationLedger(await mkdtemp(path.join(os.tmpdir(), 'ai-company-')));
    await ledger.record('macro-os', { agent_id: 'qa', score: 0.9, contract_compliance: 1, evidence_score: 1, cost_score: 0.6, decision: 'RETAIN', reasons: [] });
    await ledger.record('other', { agent_id: 'coder', score: 0.4, contract_compliance: 1, evidence_score: 0, cost_score: 0, decision: 'QUARANTINE', reasons: ['failed'] });
    expect(await ledger.records('macro-os')).toHaveLength(1);
  });
});
