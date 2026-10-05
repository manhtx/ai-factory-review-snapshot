import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DecisionLedger } from './decisionLedger';

describe('decision ledger', () => {
  it('enforces expiry when resolving active decisions', async () => {
    const ledger = new DecisionLedger(await mkdtemp(path.join(os.tmpdir(), 'decision-')));
    await ledger.record({ decision_id: 'D1', action: 'APPROVE', actor: 'CHAIRMAN', expires_at: '2020-01-01T00:00:00.000Z' });
    expect(await ledger.active('D1')).toBeNull();
  });
  it('is idempotent by decision id', async () => {
    const ledger = new DecisionLedger(await mkdtemp(path.join(os.tmpdir(), 'decision-idem-')));
    const first = await ledger.record({ decision_id: 'D1', action: 'APPROVE', actor: 'CHAIRMAN', expires_at: new Date(Date.now() + 10000).toISOString() });
    const second = await ledger.record({ decision_id: 'D1', action: 'REJECT', actor: 'CHAIRMAN', expires_at: new Date(Date.now() + 10000).toISOString() });
    expect(second.action).toBe(first.action);
    expect(await ledger.records()).toHaveLength(1);
  });
});
