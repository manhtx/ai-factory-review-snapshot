import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ProjectRegistry } from './projectRegistry';
import { ProjectScopedStateStore } from './projectScopedStore';
import { CompanyStateStore } from './stateStore';

describe('ProjectScopedStateStore', () => {
  it('namespaces aggregates and denies an unscoped principal', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'ai-company-'));
    const registry = new ProjectRegistry(root);
    await registry.register({ project_id: 'macro-os', name: 'Macro', product_goal: 'truth', target_users: ['analyst'], monthly_budget_usd: 1, active: true });
    const scoped = new ProjectScopedStateStore(new CompanyStateStore(root), registry, { actor_id: 'pm', role: 'pm', project_ids: ['macro-os'] }, 'macro-os');
    await scoped.transition({ taskId: 'T1', fromState: 'INTAKE', toState: 'DISCOVERY', actor: 'pm', reason: 'start', idempotencyKey: 's1' });
    expect(await scoped.stateOf('T1')).toBe('DISCOVERY');
    expect(() => new ProjectScopedStateStore(new CompanyStateStore(root), registry, { actor_id: 'worker', role: 'coder', project_ids: [] }, 'macro-os')).toThrow('access denied');
  });
});
