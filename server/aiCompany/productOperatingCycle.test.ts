import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BacklogLedger } from './backlogLedger';
import { OutcomeLedger } from './outcomeLedger';
import { runProductOperatingCycle } from './productOperatingCycle';

describe('product operating cycle', () => {
  it('runs outcome review through PM backlog and CEO prioritization', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'ai-company-'));
    const outcomes = new OutcomeLedger(path.join(root, 'outcomes'));
    const backlog = new BacklogLedger(path.join(root, 'backlog'));
    const outcome = await outcomes.record({ project_id: 'macro-os', task_id: 'T0', actor: 'user-persona', persona: 'researcher', workflow: 'compare', verdict: 'FAILURE', metric: { name: 'task_success', value: 0, target: 1 }, evidence_ids: ['UX-1'], findings: ['comparison unclear'] });
    const cycle = await runProductOperatingCycle({ projectId: 'macro-os', taskId: 'T1', outcomeLedger: outcomes, backlogLedger: backlog, period: '2026-W36' });
    expect(cycle).toMatchObject({ backlog_items_created: 2 });
    expect(cycle.ceo_decisions).toHaveLength(2);
    expect((await backlog.items('macro-os'))[0].source_outcome_ids).toContain(outcome.outcome_id);
  });
});
