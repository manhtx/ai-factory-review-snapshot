import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ProjectRegistry } from './projectRegistry';
import { ProjectOrchestrator } from './projectOrchestrator';
import { BoundedOrchestrator } from './orchestrator';
import { CompanyStateStore } from './stateStore';

describe('ProjectOrchestrator', () => {
  it('authorizes and namespaces task execution', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'ai-company-'));
    const registry = new ProjectRegistry(root);
    await registry.register({ project_id: 'macro-os', name: 'Macro', product_goal: 'truth', target_users: ['analyst'], monthly_budget_usd: 1, active: true });
    const scoped = new ProjectOrchestrator((workers, _projectId, evaluate, allowed) => new BoundedOrchestrator(new CompanyStateStore(root), workers, undefined, evaluate, allowed), registry, { actor_id: 'ceo', role: 'ceo', project_ids: ['macro-os'] }, 'macro-os', [{ id: 'coder', run: async () => ({ worker_id: 'coder', ok: true, evidence_ids: [] }) }]);
    const result = await scoped.run({ task_id: 'T1', risk_level: 'P2', acceptance_criteria: ['x'], budget: { max_attempts: 1, timeout_seconds: 1 } });
    expect(result.task_id).toBe('macro-os:T1');
  });
  it('passes the project release gate through the adapter', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'ai-company-'));
    const registry = new ProjectRegistry(root);
    await registry.register({ project_id: 'p2', name: 'P2', product_goal: 'goal', target_users: ['user'], monthly_budget_usd: 1, active: true });
    const scoped = new ProjectOrchestrator((workers, _projectId, evaluate, allowed, releaseGate) => new BoundedOrchestrator(new CompanyStateStore(root), workers, undefined, evaluate, allowed, releaseGate), registry, { actor_id: 'ceo', role: 'ceo', project_ids: ['p2'] }, 'p2', [{ id: 'coder', run: async () => ({ worker_id: 'coder', ok: true, evidence_ids: ['E'] }) }], undefined, undefined, async () => ({ ready: false, blockers: ['recovery test missing'] }));
    expect((await scoped.run({ task_id: 'T2', risk_level: 'P2', acceptance_criteria: ['x'], budget: { max_attempts: 1, timeout_seconds: 1 } })).status).toBe('REVISE');
  });
});
