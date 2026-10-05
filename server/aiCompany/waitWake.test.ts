import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WaitWakeLedger } from './waitWake';

describe('WaitWakeLedger', () => {
  it('persists an evidence wait without requiring an active worker', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-company-wait-'));
    const ledger = new WaitWakeLedger(dir);
    await ledger.wait({ project_id: 'macro-os', workflow_id: 'experiment-1', state: 'AWAITING_REAL_EVIDENCE', wake_type: 'EVENT', wake_condition: 'new-sample', earliest_time: null, deadline: null, evidence_required: ['sample'], next_action: 'measure outcome' });
    await expect(ledger.due(new Date(), 'new-sample')).resolves.toHaveLength(1);
  });
  it('does not wake a timer before earliest time', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-company-wait-'));
    const ledger = new WaitWakeLedger(dir);
    await ledger.wait({ project_id: 'macro-os', workflow_id: 'experiment-2', state: 'AWAITING_SCHEDULE', wake_type: 'TIMER', wake_condition: 'time', earliest_time: '2026-09-12T00:00:00Z', deadline: null, evidence_required: [], next_action: 'continue' });
    await expect(ledger.due(new Date('2026-09-11T00:00:00Z'))).resolves.toHaveLength(0);
  });
  it('resumes a due wait durably and is idempotent', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-company-wait-'));
    const ledger = new WaitWakeLedger(dir);
    const waiting = await ledger.wait({ project_id: 'macro-os', workflow_id: 'experiment-3', state: 'AWAITING_REAL_EVIDENCE', wake_type: 'EVENT', wake_condition: 'new-sample', earliest_time: null, deadline: null, evidence_required: ['sample'], next_action: 'measure outcome' });
    const resumed = await ledger.resume(waiting.wait_id, '2026-09-11T01:00:00Z');
    expect(resumed.resumed_at).toBe('2026-09-11T01:00:00Z');
    await expect(ledger.due(new Date(), 'new-sample')).resolves.toHaveLength(0);
    await expect(ledger.resume(waiting.wait_id, '2026-09-11T02:00:00Z')).resolves.toMatchObject({ resumed_at: '2026-09-11T01:00:00Z' });
  });
});
