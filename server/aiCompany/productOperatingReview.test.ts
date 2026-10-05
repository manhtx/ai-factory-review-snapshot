import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OutcomeLedger } from './outcomeLedger';
import { runProductOperatingReview } from './productOperatingReview';

describe('product operating review', () => {
  it('turns evidence-backed outcomes into CEO and PM actions', async () => {
    const ledger = new OutcomeLedger(await mkdtemp(path.join(os.tmpdir(), 'ai-company-')));
    await ledger.record({ project_id: 'macro-os', task_id: 'T1', actor: 'user-persona', persona: 'analyst', workflow: 'inspect', verdict: 'BLOCKED', metric: { name: 'task_success', value: 0, target: 1 }, evidence_ids: ['E1'], findings: ['missing source'] });
    await ledger.record({ project_id: 'macro-os', task_id: 'T2', actor: 'stakeholder-panel', persona: 'risk-owner', workflow: 'review', verdict: 'FAILURE', metric: { name: 'confidence', value: .3, target: .8 }, evidence_ids: ['E2'], findings: ['not reproducible'] });
    const review = await runProductOperatingReview({ ledger, projectId: 'macro-os', period: '2026-W36' });
    expect(review.outcomes).toMatchObject({ total: 2, blocked: 1 });
    expect(review.recommendations.map((item) => item.owner)).toEqual(['ceo', 'pm', 'pm']);
    expect(review.reviewed_outcome_ids).toHaveLength(2);
  });
});
