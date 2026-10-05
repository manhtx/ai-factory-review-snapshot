import { describe, expect, it } from 'vitest';
import { CompanySupervisor } from './companySupervisor';

describe('company supervisor', () => {
  it('isolates scheduler failures and prevents overlapping ticks', async () => {
    let release: (() => void) | undefined;
    const first = new CompanySupervisor([{ id: 'macro-os', tick: () => new Promise((resolve) => { release = () => resolve('done'); }) }, { id: 'failing-project', tick: async () => { throw new Error('provider unavailable'); } }]);
    const pending = first.tick();
    await expect(first.tick()).resolves.toEqual([{ scheduler_id: 'macro-os', ok: false, error: 'tick already in progress' }, { scheduler_id: 'failing-project', ok: false, error: 'tick already in progress' }]);
    release?.();
    await expect(pending).resolves.toEqual([{ scheduler_id: 'macro-os', ok: true, result: 'done' }, { scheduler_id: 'failing-project', ok: false, error: 'provider unavailable' }]);
  });

  it('has idempotent start and stop lifecycle', async () => {
    const supervisor = new CompanySupervisor([], 60_000);
    supervisor.start();
    supervisor.start();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(supervisor.isRunning()).toBe(true);
    expect(supervisor.status().startedAt).toEqual(expect.any(String));
    expect(supervisor.status().lastTickAt).toEqual(expect.any(String));
    supervisor.stop();
    supervisor.stop();
    expect(supervisor.isRunning()).toBe(false);
  });

  it('persists the last tick result for operational health reporting', async () => {
    const supervisor = new CompanySupervisor([{ id: 'daily', tick: async () => ['daily'] }]);
    expect(supervisor.status().lastTickAt).toBeNull();
    const results = await supervisor.tick();
    expect(results[0]).toMatchObject({ scheduler_id: 'daily', ok: true });
    expect(supervisor.status()).toMatchObject({ running: false, ticking: false, lastResults: results });
    expect(supervisor.status().lastTickAt).toEqual(expect.any(String));
  });
});
