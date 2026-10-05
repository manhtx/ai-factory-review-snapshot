import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ProjectRegistry } from './projectRegistry';
import { ProjectScopedUsageLedger } from './projectScopedUsage';
import { UsageLedger } from './usageLedger';

describe('ProjectScopedUsageLedger', () => {
  it('namespaces and filters usage records by project', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'ai-company-'));
    const registry = new ProjectRegistry(root);
    await registry.register({ project_id: 'macro-os', name: 'Macro', product_goal: 'truth', target_users: ['analyst'], monthly_budget_usd: 1, active: true });
    const scoped = new ProjectScopedUsageLedger(new UsageLedger(root), registry, { actor_id: 'ceo', role: 'ceo', project_ids: ['macro-os'] }, 'macro-os');
    await scoped.record({ run_id: 'T1', worker_id: 'coder', input_tokens: 1, output_tokens: 1, estimated_cost_usd: 0.1, outcome: 'PASS' });
    expect((await scoped.records())[0].run_id).toBe('macro-os:T1');
  });
});
