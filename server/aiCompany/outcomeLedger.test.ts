import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OutcomeLedger, summarizeProductOutcomes } from './outcomeLedger';

describe('product outcome ledger', () => {
  it('requires scoped evidence and persists user/stakeholder outcomes', async () => {
    const ledger = new OutcomeLedger(await mkdtemp(path.join(os.tmpdir(), 'ai-company-')));
    await expect(ledger.record({ project_id: 'macro-os', task_id: 'T1', actor: 'user-persona', persona: 'macro-researcher', workflow: 'inspect-evidence', verdict: 'SUCCESS', metric: { name: 'task_success', value: 1, target: 1 }, evidence_ids: ['UX-1'], findings: [] })).resolves.toMatchObject({ project_id: 'macro-os', actor: 'user-persona' });
    await expect(ledger.record({ project_id: 'macro-os', task_id: 'T1', actor: 'stakeholder-panel', persona: 'risk-owner', workflow: 'release-review', verdict: 'PARTIAL', metric: { name: 'confidence', value: .6 }, evidence_ids: [] , findings: ['needs durability'] })).rejects.toThrow('evidence');
    expect(await ledger.records('macro-os')).toHaveLength(1);
  });

  it('summarizes success and target attainment separately', () => {
    const base = { project_id: 'p', task_id: 't', actor: 'pm' as const, persona: 'analyst', workflow: 'compare', metric: { name: 'score', value: 1, target: 1 }, evidence_ids: ['E'], findings: [], outcome_id: 'o', created_at: '' };
    expect(summarizeProductOutcomes([{ ...base, verdict: 'SUCCESS' }, { ...base, outcome_id: 'o2', verdict: 'BLOCKED', metric: { ...base.metric, value: 0 } }])).toEqual({ total: 2, success: 1, success_rate: .5, target_hits: 1, target_rate: .5, blocked: 1 });
  });
});
