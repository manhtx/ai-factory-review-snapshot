import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createCompanyHealthProvider } from './healthProvider';
import { CompanyStateStore } from './stateStore';
import { UsageLedger } from './usageLedger';

describe('company health provider', () => {
  it('derives CEO health from durable event and usage ledgers', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'ai-company-'));
    const store = new CompanyStateStore(dir);
    const usage = new UsageLedger(dir);
    await store.transition({ aggregateId: 'T1', fromState: 'INTAKE', toState: 'DISCOVERY', actor: 'pm', reason: 'start', idempotencyKey: 'h1' });
    await usage.record({ run_id: 'T1', worker_id: 'coder', input_tokens: 3, output_tokens: 2, estimated_cost_usd: 0.1, outcome: 'PASS' });
    await expect(createCompanyHealthProvider(store, usage)()).resolves.toMatchObject({ total_events: 1, agent_failure_rate: 0, released_tasks: 0 });
  });
});
