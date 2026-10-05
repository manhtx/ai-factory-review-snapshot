import { describe, expect, it } from 'vitest';
import { withAgentPrinciples } from './principledWorker';

describe('principled worker enforcement', () => {
  it('rejects a successful result without required evidence', async () => {
    const worker = withAgentPrinciples({ id: 'coder', run: async () => ({ worker_id: 'coder', ok: true, evidence_ids: [] }) }, ['always emit evidence IDs']);
    const result = await worker.run({ task_id: 't', project_id: 'p', risk_level: 'P2', acceptance_criteria: ['x'], budget: { max_attempts: 1, timeout_seconds: 1 } });
    expect(result.ok).toBe(false);
    expect(result.notes).toContain('principle violation');
  });
});
