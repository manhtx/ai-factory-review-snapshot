import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ProductCycleAttemptLedger } from './productCycleAttemptLedger';

describe('ProductCycleAttemptLedger', () => {
  it('persists completed and blocked attempts across instances', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'ai-company-cycle-'));
    const first = new ProductCycleAttemptLedger(root);
    await first.record({ project_id: 'macro-os', period: 'daily', started_at: '2026-09-04T08:00:00Z', completed_at: '2026-09-04T08:00:01Z', status: 'DONE' });
    await first.record({ project_id: 'macro-os', period: 'daily', started_at: '2026-09-05T08:00:00Z', completed_at: '2026-09-05T08:00:00Z', status: 'BLOCKED', blockers: ['provider missing'], error: 'readiness gate' });
    expect(await new ProductCycleAttemptLedger(root).records('macro-os')).toHaveLength(2);
    expect((await new ProductCycleAttemptLedger(root).records('macro-os'))[1]).toMatchObject({ status: 'BLOCKED', blockers: ['provider missing'] });
  });
});
