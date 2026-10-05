import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DecisionLedger } from './decisionLedger';
import { requireActiveDecision } from './decisionGate';
import { CompanyStateStore } from './stateStore';
import { transitionWithDecision } from './decisionGate';

describe('decision gate', () => {
  it('requires an unexpired decision with the exact action', async () => {
    const ledger = new DecisionLedger(await mkdtemp(path.join(os.tmpdir(), 'gate-')));
    await ledger.record({ decision_id: 'D1', action: 'APPROVE', actor: 'CHAIRMAN', expires_at: new Date(Date.now() + 10000).toISOString() });
    await expect(requireActiveDecision(ledger, 'D1', 'REJECT')).rejects.toThrow('action mismatch');
    expect((await requireActiveDecision(ledger, 'D1', 'APPROVE')).actor).toBe('CHAIRMAN');
  });
  it('attaches a valid decision to the durable transition', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'gate-transition-'));
    const ledger = new DecisionLedger(root); const store = new CompanyStateStore(root);
    await ledger.record({ decision_id: 'D2', action: 'APPROVE', actor: 'CHAIRMAN', expires_at: new Date(Date.now() + 10000).toISOString() });
    const result = await transitionWithDecision(store, ledger, { aggregateId: 't', fromState: 'RELEASE_GATE', toState: 'RELEASED', actor: 'release-security-gate', reason: 'approved', idempotencyKey: 'x', decisionId: 'D2', decisionAction: 'APPROVE' });
    expect(result.event.payload?.decision_id).toBe('D2');
  });
});
