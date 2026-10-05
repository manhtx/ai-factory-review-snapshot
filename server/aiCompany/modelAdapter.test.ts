import { describe, expect, it } from 'vitest';
import { modelWorker } from './modelAdapter';

describe('model adapter boundary', () => {
  it('normalizes provider usage into worker output', async () => {
    const worker = modelWorker({ id: 'test-model', complete: async () => ({ ok: true, evidence_ids: ['EVD-1'], usage: { input_tokens: 12, output_tokens: 8, estimated_cost_usd: 0.03 } }) });
    const result = await worker.run({ task_id: 'T', project_id: 'p', risk_level: 'P2', acceptance_criteria: ['x'], budget: { max_attempts: 1, timeout_seconds: 1 } });
    expect(result).toMatchObject({ ok: true, input_tokens: 12, output_tokens: 8, estimated_cost_usd: 0.03 });
  });
});
