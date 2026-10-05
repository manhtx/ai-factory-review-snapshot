import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DeliveryLedger } from './deliveryLedger';

describe('DeliveryLedger', () => {
  it('persists delivery outcome and attempts', async () => {
    const ledger = new DeliveryLedger(await mkdtemp(path.join(os.tmpdir(), 'ai-company-')));
    await ledger.record({ channel: 'telegram', target: '42', report_id: 'R1', status: 'DEAD_LETTER', attempts: 2, error: 'http_503' });
    await expect(ledger.records()).resolves.toMatchObject([{ report_id: 'R1', status: 'DEAD_LETTER', attempts: 2 }]);
  });
});
