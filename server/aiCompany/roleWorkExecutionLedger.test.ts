import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RoleWorkExecutionLedger } from './roleWorkExecutionLedger';

describe('role work execution ledger', () => {
  it('persists successful and blocked execution evidence', async () => {
    const ledger = new RoleWorkExecutionLedger(await mkdtemp(path.join(os.tmpdir(), 'execution-ledger-')));
    await ledger.record({ work_id: 'W-1', project_id: 'macro-os', role: 'backend-engineer', status: 'DONE', evidence_ids: ['E-1'] });
    await ledger.record({ work_id: 'W-2', project_id: 'macro-os', role: 'data-engineer', status: 'BLOCKED', evidence_ids: [], error: 'provider unavailable' });
    await expect(ledger.records('macro-os')).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ status: 'DONE', evidence_ids: ['E-1'] }), expect.objectContaining({ status: 'BLOCKED', error: 'provider unavailable' })]));
  });
});
