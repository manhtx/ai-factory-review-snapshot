import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ProjectRegistry } from './projectRegistry';

describe('ProjectRegistry', () => {
  it('registers isolated projects with independent state directories', async () => {
    const registry = new ProjectRegistry(await mkdtemp(path.join(os.tmpdir(), 'ai-company-')));
    const a = await registry.register({ project_id: 'macro-os', name: 'Macro OS', product_goal: 'truth', target_users: ['analyst'], monthly_budget_usd: 10, active: true });
    const b = await registry.register({ project_id: 'second-project', name: 'Second', product_goal: 'value', target_users: ['user'], monthly_budget_usd: 5, active: true });
    expect(a.state_dir).not.toBe(b.state_dir);
    expect(registry.list()).toHaveLength(2);
  });

  it('rejects invalid, duplicate and underspecified projects', async () => {
    const registry = new ProjectRegistry('/tmp/ai-company-registry-test');
    await expect(registry.register({ project_id: 'Bad ID', name: 'x', product_goal: 'x', target_users: ['u'], monthly_budget_usd: 1, active: true })).rejects.toThrow('invalid project_id');
    await expect(registry.register({ project_id: 'valid', name: 'x', product_goal: '', target_users: [], monthly_budget_usd: 1, active: true })).rejects.toThrow('required');
  });

  it('restores the registry snapshot after restart', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'ai-company-'));
    const first = new ProjectRegistry(dir);
    await first.register({ project_id: 'macro-os', name: 'Macro OS', product_goal: 'truth', target_users: ['analyst'], monthly_budget_usd: 10, active: true });
    await first.save();
    const restarted = new ProjectRegistry(dir);
    await restarted.restore();
    expect(restarted.get('macro-os').monthly_budget_usd).toBe(10);
  });

  it('denies cross-project access even when the project exists', async () => {
    const registry = new ProjectRegistry(await mkdtemp(path.join(os.tmpdir(), 'ai-company-')));
    await registry.register({ project_id: 'macro-os', name: 'Macro OS', product_goal: 'truth', target_users: ['analyst'], monthly_budget_usd: 10, active: true });
    expect(registry.authorize({ actor_id: 'ceo', role: 'ceo', project_ids: ['macro-os'] }, 'macro-os').project_id).toBe('macro-os');
    expect(() => registry.authorize({ actor_id: 'worker', role: 'coder', project_ids: [] }, 'macro-os')).toThrow('access denied');
  });
});
