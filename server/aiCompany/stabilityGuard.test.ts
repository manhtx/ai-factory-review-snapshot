import { describe, expect, it } from 'vitest';
import { validateWorkerResults } from './stabilityGuard';

const task = { task_id: 't', project_id: 'p', risk_level: 'P2' as const, acceptance_criteria: ['x'], budget: { max_attempts: 1, timeout_seconds: 1, max_cost_usd: 1 } };
describe('stability guard', () => {
  it('accepts bounded evidenced worker results', () => expect(validateWorkerResults(task, [{ worker_id: 'coder', ok: true, evidence_ids: ['e'], estimated_cost_usd: .5 }])).toEqual([]));
  it('rejects unsafe result invariants', () => expect(validateWorkerResults(task, [{ worker_id: 'coder', ok: true, evidence_ids: [] }, { worker_id: 'coder', ok: false, evidence_ids: [], estimated_cost_usd: 2 }])).toEqual(expect.arrayContaining(['duplicate worker result: coder', 'evidence missing: coder', 'worker failed: coder', 'aggregate cost exceeds task budget'])));
});
