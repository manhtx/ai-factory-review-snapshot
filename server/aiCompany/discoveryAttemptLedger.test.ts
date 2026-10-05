import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DiscoveryAttemptLedger } from './discoveryAttemptLedger';

describe('discovery attempt ledger', () => {
  it('persists success and failure outcomes independently', async () => {
    const ledger = new DiscoveryAttemptLedger(await mkdtemp(path.join(os.tmpdir(), 'discovery-attempt-')));
    await ledger.record({ project_id: 'macro-os', provider: 'localhost', model: 'qwen', status: 'FAILED', evidence_count: 2, error: 'timeout' });
    await ledger.record({ project_id: 'macro-os', provider: 'localhost', model: 'qwen', status: 'SUCCEEDED', evidence_count: 2, idea_id: 'AI-1' });
    expect(await ledger.records('macro-os')).toEqual([expect.objectContaining({ status: 'FAILED' }), expect.objectContaining({ status: 'SUCCEEDED', idea_id: 'AI-1' })]);
  });
});
