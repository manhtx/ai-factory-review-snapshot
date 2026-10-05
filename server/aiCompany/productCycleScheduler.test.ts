import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ProductCycleScheduler } from './productCycleScheduler';

describe('product cycle scheduler', () => {
  it('runs and persists a daily cycle once per period', async () => {
    const values = new Map<string, string>();
    let calls = 0;
    const scheduler = new ProductCycleScheduler({ projectId: 'macro-os', now: () => new Date('2026-09-04T08:00:00Z'), reportDir: await mkdtemp(path.join(os.tmpdir(), 'ai-company-')), run: async () => { calls += 1; return { review: {} as never, backlog_items_created: 0, ceo_decisions: [] }; }, state: { get: async (key) => values.get(key) ?? null, set: async (key, value) => { values.set(key, value); } } });
    await expect(scheduler.tick()).resolves.toEqual(['daily']);
    await expect(scheduler.tick()).resolves.toEqual([]);
    expect(calls).toBe(1);
  });

  it('catches up a daily cycle after the due hour when the process restarted', async () => {
    const values = new Map<string, string>();
    let calls = 0;
    const scheduler = new ProductCycleScheduler({ projectId: 'macro-os', now: () => new Date('2026-09-04T11:30:00Z'), run: async () => { calls += 1; return { review: {} as never, backlog_items_created: 0, ceo_decisions: [] }; }, state: { get: async (key) => values.get(key) ?? null, set: async (key, value) => { values.set(key, value); } } });
    await expect(scheduler.tick()).resolves.toEqual(['daily']);
    expect(calls).toBe(1);
  });

  it('runs monthly and quarterly executive cycles on the first day', async () => {
    const values = new Map<string, string>();
    const periods: string[] = [];
    const scheduler = new ProductCycleScheduler({ projectId: 'macro-os', now: () => new Date('2026-07-01T08:00:00Z'), run: async (period) => { periods.push(period); return { review: {} as never, backlog_items_created: 0, ceo_decisions: [] }; }, state: { get: async (key) => values.get(key) ?? null, set: async (key, value) => { values.set(key, value); } } });
    await expect(scheduler.tick()).resolves.toEqual(['daily', 'monthly', 'quarterly']);
    expect(periods).toEqual(['daily', 'monthly', 'quarterly']);
  });

  it('runs the annual executive cycle on January 1', async () => {
    const values = new Map<string, string>();
    const periods: string[] = [];
    const scheduler = new ProductCycleScheduler({ projectId: 'macro-os', now: () => new Date('2026-01-01T08:00:00Z'), run: async (period) => { periods.push(period); return { review: {} as never, backlog_items_created: 0, ceo_decisions: [] }; }, state: { get: async (key) => values.get(key) ?? null, set: async (key, value) => { values.set(key, value); } } });
    await expect(scheduler.tick()).resolves.toEqual(['daily', 'monthly', 'quarterly', 'annual']);
    expect(periods).toEqual(['daily', 'monthly', 'quarterly', 'annual']);
  });

  it('does not advance the cadence checkpoint after a failed cycle', async () => {
    const values = new Map<string, string>();
    let calls = 0;
    const scheduler = new ProductCycleScheduler({ projectId: 'macro-os', now: () => new Date('2026-09-04T08:00:00Z'), run: async () => { calls += 1; if (calls === 1) throw new Error('provider unavailable'); return { review: {} as never, backlog_items_created: 0, ceo_decisions: [] }; }, state: { get: async (key) => values.get(key) ?? null, set: async (key, value) => { values.set(key, value); } } });
    await expect(scheduler.tick()).rejects.toThrow('provider unavailable');
    expect(values.size).toBe(0);
    await expect(scheduler.tick()).resolves.toEqual(['daily']);
    expect(calls).toBe(2);
  });
});
