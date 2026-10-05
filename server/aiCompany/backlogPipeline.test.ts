import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BacklogLedger } from './backlogLedger';
import { runPmCeoBacklogPipeline } from './backlogPipeline';

describe('PM to CEO backlog pipeline', () => {
  it('persists synthesized items and CEO decisions', async () => {
    const ledger = new BacklogLedger(await mkdtemp(path.join(os.tmpdir(), 'backlog-pipeline-')));
    const output = await runPmCeoBacklogPipeline({ projectId: 'p', taskId: 't', ledger, feedback: [{ feedback_id: 'f', council_id: 'user', project_id: 'p', task_id: 't', verdict: 'REVISE', findings: ['missing citation'], confidence: .9, evidence_ids: ['e'], created_at: '' }] });
    expect(output.items[0].priority).toBe('P1');
    expect(output.decisions[0].decided_by).toBe('CEO');
    expect(await ledger.decisions('p')).toHaveLength(1);
  });
});
