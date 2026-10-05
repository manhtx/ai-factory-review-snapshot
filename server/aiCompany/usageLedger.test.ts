import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { UsageLedger } from './usageLedger';

describe('UsageLedger', () => {
  it('records normalized usage and reloads it', async () => {
    const ledger = new UsageLedger(await mkdtemp(path.join(os.tmpdir(), 'ai-company-')));
    await ledger.record({ run_id: 'run-1', worker_id: 'coder', input_tokens: 10, output_tokens: 20, estimated_cost_usd: 0.01, outcome: 'PASS' });
    const records = await ledger.records();
    expect(records).toHaveLength(1);
    expect(records[0].input_tokens + records[0].output_tokens).toBe(30);
  });
});
