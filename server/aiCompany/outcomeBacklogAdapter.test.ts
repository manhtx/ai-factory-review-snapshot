import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BacklogLedger } from './backlogLedger';
import { recommendationsToBacklog } from './outcomeBacklogAdapter';

describe('outcome to backlog adapter', () => {
  it('preserves outcome lineage and owner action', async () => {
    const ledger = new BacklogLedger(await mkdtemp(path.join(os.tmpdir(), 'ai-company-')));
    const items = await recommendationsToBacklog({ review: { project_id: 'macro-os', period: '2026-W36', outcomes: { total: 1, success: 0, success_rate: 0, target_hits: 0, target_rate: 0, blocked: 1 }, reviewed_outcome_ids: ['OUT-1'], recommendations: [{ owner: 'ceo', priority: 'P0', action: 'open decision', rationale: 'blocked', source_outcome_ids: ['OUT-1'] }] }, taskId: 'T1', ledger });
    expect(items[0]).toMatchObject({ priority: 'P0', source_outcome_ids: ['OUT-1'], status: 'PROPOSED' });
    expect(await ledger.items('macro-os')).toHaveLength(1);
  });
});
