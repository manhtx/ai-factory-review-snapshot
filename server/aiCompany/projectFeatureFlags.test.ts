import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ProjectFeatureFlagStore } from './projectFeatureFlags';

describe('project feature flags', () => {
  it('isolates flags by project and defaults disabled', async () => {
    const store = new ProjectFeatureFlagStore(await mkdtemp(path.join(os.tmpdir(), 'flags-')));
    await store.set({ project_id: 'macro-os', flag: 'real-data-v1', enabled: true, actor: 'ceo', reason: 'canary' });
    expect(await store.isEnabled('macro-os', 'real-data-v1')).toBe(true);
    expect(await store.isEnabled('other', 'real-data-v1')).toBe(false);
  });
  it('rejects unscoped writes', async () => {
    const store = new ProjectFeatureFlagStore(await mkdtemp(path.join(os.tmpdir(), 'flags-')));
    await expect(store.set({ project_id: '', flag: 'x', enabled: true, actor: 'ceo', reason: 'bad' })).rejects.toThrow('project-scoped');
  });
});
