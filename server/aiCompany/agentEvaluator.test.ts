import { describe, expect, it } from 'vitest';
import { evaluateAgent } from './agentEvaluator';
import { evaluationCallback } from './agentEvaluator';
import { EvaluationLedger } from './evaluationLedger';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

describe('independent agent evaluator', () => {
  it('retains a cheap successful evidence-backed agent', () => {
    expect(evaluateAgent({ worker_id: 'qa', ok: true, evidence_ids: ['E1'], estimated_cost_usd: 0.1 }, { maxCostUsd: 1 }).decision).toBe('RETAIN');
  });
  it('quarantines a failed expensive agent', () => {
    const evaluation = evaluateAgent({ worker_id: 'coder', ok: false, evidence_ids: [], estimated_cost_usd: 2 }, { maxCostUsd: 1 });
    expect(evaluation.decision).toBe('QUARANTINE');
    expect(evaluation.reasons).toContain('cost limit exceeded');
  });

  it('persists callback evaluations for CEO history', async () => {
    const ledger = new EvaluationLedger(await mkdtemp(path.join(os.tmpdir(), 'ai-company-')));
    await evaluationCallback('macro-os', ledger, { maxCostUsd: 1 })({ worker_id: 'qa', ok: true, evidence_ids: ['E1'], estimated_cost_usd: 0.1 });
    expect(await ledger.records('macro-os')).toHaveLength(1);
  });
});
