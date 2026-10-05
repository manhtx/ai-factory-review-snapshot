import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CompanyStateStore } from './stateStore';
import { executeReleaseRollback } from './releaseRollback';

describe('release rollback', () => {
  it('requires released state and incident evidence, then persists replayable rollback', async () => {
    const store = new CompanyStateStore(await mkdtemp(path.join(os.tmpdir(), 'rollback-')));
    await store.transition({ aggregateId: 'B-1', fromState: 'RELEASE_GATE', toState: 'RELEASED', actor: 'release-security-gate', reason: 'approved', idempotencyKey: 'release' });
    await expect(executeReleaseRollback({ store, aggregateId: 'B-1', reason: '', evidenceIds: [], idempotencyKey: 'rollback' })).rejects.toThrow('rollback reason');
    const result = await executeReleaseRollback({ store, aggregateId: 'B-1', reason: 'provider regression', evidenceIds: ['INC-1'], idempotencyKey: 'rollback' });
    expect(result).toMatchObject({ applied: true, current_state: 'ROLLBACK', event: { payload: { rollback: true, evidence_ids: ['INC-1'] } } });
    await expect(executeReleaseRollback({ store, aggregateId: 'B-1', reason: 'again', evidenceIds: ['INC-2'], idempotencyKey: 'rollback-2' })).rejects.toThrow('requires RELEASED');
  });
});
