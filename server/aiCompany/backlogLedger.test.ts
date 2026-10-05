import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BacklogLedger, ceoPrioritize } from './backlogLedger';

describe('backlog ledger', () => {
  it('persists PM items and CEO decisions in priority order', async () => {
    const ledger = new BacklogLedger(await mkdtemp(path.join(os.tmpdir(), 'backlog-')));
    const items = ['P2', 'P0'].map((priority, i) => ({ backlog_id: `b${i}`, project_id: 'p', task_id: 't', title: `x${i}`, priority: priority as 'P0' | 'P2', rationale: 'evidence', source_feedback_ids: [], acceptance_criteria: ['done'], status: 'PROPOSED' as const }));
    await ledger.add(items);
    const decisions = await ceoPrioritize(items, ledger);
    expect(decisions.map((d) => d.priority)).toEqual(['P0', 'P2']);
    expect((await ledger.items('p'))).toHaveLength(2);
  });

  it('does not duplicate a backlog item across concurrent promotion attempts', async () => {
    const ledger = new BacklogLedger(await mkdtemp(path.join(os.tmpdir(), 'backlog-')));
    const item = { backlog_id: 'same', project_id: 'p', task_id: 't', title: 'x', priority: 'P1' as const, rationale: 'evidence', source_feedback_ids: [], acceptance_criteria: ['done'], status: 'PROPOSED' as const };
    await Promise.all([ledger.add([item]), ledger.add([item])]);
    expect(await ledger.items('p')).toEqual([item]);
  });

  it('does not duplicate an unchanged CEO decision across repeated cycles', async () => {
    const ledger = new BacklogLedger(await mkdtemp(path.join(os.tmpdir(), 'backlog-')));
    const input = { backlog_id: 'same', project_id: 'p', priority: 'P1' as const, rationale: 'CEO evidence', decided_by: 'CEO' as const };
    const decisions = await Promise.all([ledger.decide(input), ledger.decide(input)]);
    expect(decisions[0]).toEqual(decisions[1]);
    expect(await ledger.decisions('p')).toHaveLength(1);
  });
});
