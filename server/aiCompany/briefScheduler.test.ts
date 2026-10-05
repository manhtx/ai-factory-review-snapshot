import { describe, expect, it } from 'vitest';
import { BriefScheduler } from './briefScheduler';

describe('CEO brief scheduler', () => {
  it('sends daily once and weekly once on Monday 08:00 UTC', async () => {
    const sent: string[] = [];
    const scheduler = new BriefScheduler({ now: () => new Date('2026-09-07T08:00:00Z'), send: async (period) => { sent.push(period); } });
    expect(await scheduler.tick()).toEqual(['daily', 'weekly']);
    expect(await scheduler.tick()).toEqual([]);
    expect(sent).toEqual(['daily', 'weekly']);
  });

  it('does not send outside the scheduled hour', async () => {
    const scheduler = new BriefScheduler({ now: () => new Date('2026-09-07T09:00:00Z'), send: async () => { throw new Error('must not send'); } });
    await expect(scheduler.tick()).resolves.toEqual([]);
  });

  it('does not duplicate a brief after scheduler restart', async () => {
    const memory = new Map<string, string>();
    const state = { get: async (key: string) => memory.get(key) ?? null, set: async (key: string, value: string) => { memory.set(key, value); } };
    const now = () => new Date('2026-09-08T08:00:00Z');
    const sent: string[] = [];
    await new BriefScheduler({ now, state, send: async (period) => { sent.push(period); } }).tick();
    await new BriefScheduler({ now, state, send: async (period) => { sent.push(period); } }).tick();
    expect(sent).toEqual(['daily']);
  });
});
