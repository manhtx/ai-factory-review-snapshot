import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FeedbackLedger, runIndependentCouncil } from './council';

describe('independent councils', () => {
  it('stores separate, scoped feedback from each member', async () => {
    const ledger = new FeedbackLedger(await mkdtemp(path.join(os.tmpdir(), 'council-')));
    const brief = { task_id: 'T1', project_id: 'p1', artifact_ids: ['A1'], question: 'usable?' };
    const result = await runIndependentCouncil(brief, ['investor', 'mobile'].map((council_id) => ({ council_id, review: async () => ({ task_id: 'T1', project_id: 'p1', verdict: 'REVISE' as const, findings: [council_id], confidence: .8, evidence_ids: ['A1'] }) })), ledger);
    expect(result).toHaveLength(2);
    expect((await ledger.records('T1')).map((item) => item.council_id)).toEqual(['investor', 'mobile']);
  });
});
