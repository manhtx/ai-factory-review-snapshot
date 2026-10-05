import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CompanyStateStore } from './stateStore';
import { briefSchedulerState } from './briefStateAdapter';

describe('brief scheduler state adapter', () => {
  it('persists daily/weekly markers in the company checkpoint store', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'ai-company-'));
    const first = briefSchedulerState(new CompanyStateStore(dir));
    await first.set('brief:daily', '2026-09-08');
    const restarted = briefSchedulerState(new CompanyStateStore(dir));
    expect(await restarted.get('brief:daily')).toBe('2026-09-08');
  });
});
