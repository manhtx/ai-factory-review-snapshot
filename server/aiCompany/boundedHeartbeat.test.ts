import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BoundedHeartbeatLedger, type BoundedHeartbeatRun } from './boundedHeartbeat';

describe('BoundedHeartbeatLedger', () => {
  it('records bounded run metadata and tracks next action when idle', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'heartbeat-test-'));
    const ledger = new BoundedHeartbeatLedger(tmpDir);

    const run1: BoundedHeartbeatRun = {
      heartbeat_id: 'HB-001',
      run_id: 'RUN-2026-09-08-01',
      trigger_reason: 'scheduled_cadence',
      start_time: '2026-09-08T10:00:00.000Z',
      end_time: '2026-09-08T10:00:05.000Z',
      duration_ms: 5000,
      budget_before_tokens: 50000,
      budget_after_tokens: 46200,
      tokens_consumed: 3800,
      active_tasks_count: 0,
      completed_tasks_count: 2,
      next_action: 'IDLE_WAIT_TASK',
      status: 'IDLE_NO_WORK',
    };

    await ledger.recordRun(run1);
    const latest = await ledger.getLatestRun();

    expect(latest).toBeDefined();
    expect(latest?.heartbeat_id).toBe('HB-001');
    expect(latest?.next_action).toBe('IDLE_WAIT_TASK');
    expect(latest?.tokens_consumed).toBe(3800);
    expect(latest?.status).toBe('IDLE_NO_WORK');
  });

  it('tracks escalation next action when recovery is required', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'heartbeat-test-'));
    const ledger = new BoundedHeartbeatLedger(tmpDir);

    const runEscalate: BoundedHeartbeatRun = {
      heartbeat_id: 'HB-002',
      run_id: 'RUN-2026-09-08-02',
      trigger_reason: 'recovery_escalation',
      start_time: '2026-09-08T10:05:00.000Z',
      end_time: '2026-09-08T10:05:12.000Z',
      duration_ms: 12000,
      budget_before_tokens: 46200,
      budget_after_tokens: 38000,
      tokens_consumed: 8200,
      active_tasks_count: 1,
      completed_tasks_count: 1,
      next_action: 'ESCALATE_CEO_RECOVERY',
      status: 'COMPLETED',
    };

    await ledger.recordRun(runEscalate);
    const runs = await ledger.getRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0].next_action).toBe('ESCALATE_CEO_RECOVERY');
  });
});
