import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BoundedOrchestrator } from './orchestrator';
import { CompanyStateStore } from './stateStore';

const task = { task_id: 'TASK-ORCH-1', project_id: 'macro-os', risk_level: 'P2' as const, acceptance_criteria: ['test passes'], budget: { max_attempts: 1, timeout_seconds: 30 } };

describe('BoundedOrchestrator', () => {
  it('runs the guarded path and releases only after independent workers pass', async () => {
    const store = new CompanyStateStore(await mkdtemp(path.join(os.tmpdir(), 'ai-company-')));
    const result = await new BoundedOrchestrator(store, [
      { id: 'coder', run: async () => ({ worker_id: 'coder', ok: true, evidence_ids: ['EVD-code'] }) },
      { id: 'functional-qa', run: async () => ({ worker_id: 'functional-qa', ok: true, evidence_ids: ['EVD-test'] }) },
      { id: 'ux-research', run: async () => ({ worker_id: 'ux-research', ok: true, evidence_ids: ['EVD-user'] }) },
      { id: 'domain-expert', run: async () => ({ worker_id: 'domain-expert', ok: true, evidence_ids: ['EVD-domain'] }) },
    ]).run(task);
    expect(result.status).toBe('RELEASED');
    expect(await store.stateOf(task.task_id)).toBe('RELEASED');
  });

  it('returns REVISE and never releases when a worker fails', async () => {
    const store = new CompanyStateStore(await mkdtemp(path.join(os.tmpdir(), 'ai-company-')));
    const result = await new BoundedOrchestrator(store, [{ id: 'coder', run: async () => ({ worker_id: 'coder', ok: false, evidence_ids: [], notes: 'compile failure' }) }]).run({ ...task, task_id: 'TASK-ORCH-2' });
    expect(result.status).toBe('REVISE');
    expect(await store.stateOf('TASK-ORCH-2')).toBe('REVISE');
  });

  it('times out a hung worker and returns REVISE', async () => {
    const store = new CompanyStateStore(await mkdtemp(path.join(os.tmpdir(), 'ai-company-')));
    const result = await new BoundedOrchestrator(store, [{ id: 'coder', run: async () => new Promise(() => undefined) }]).run({ ...task, task_id: 'TASK-ORCH-3', budget: { max_attempts: 1, timeout_seconds: 0.01 } });
    expect(result.status).toBe('REVISE');
    expect(result.workers[0].notes).toContain('timeout');
  });

  it('blocks when the cost budget is exceeded', async () => {
    const store = new CompanyStateStore(await mkdtemp(path.join(os.tmpdir(), 'ai-company-')));
    const result = await new BoundedOrchestrator(store, [{ id: 'coder', run: async () => ({ worker_id: 'coder', ok: true, evidence_ids: [], estimated_cost_usd: 2 }) }]).run({ ...task, task_id: 'TASK-ORCH-4', budget: { max_attempts: 1, timeout_seconds: 1, max_cost_usd: 1 } });
    expect(result.status).toBe('BLOCKED');
    expect(await store.stateOf('TASK-ORCH-4')).toBe('BLOCKED');
  });

  it('can resume from a persisted checkpoint after a new store instance', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'ai-company-'));
    const first = new CompanyStateStore(dir);
    await first.checkpoint({ aggregateId: 'TASK-ORCH-5', actor: 'coder', cursor: 'worker-2', payload: { completed: ['coder'] }, idempotencyKey: 'resume-1' });
    const restarted = new CompanyStateStore(dir);
    expect(await restarted.latestCheckpoint('TASK-ORCH-5')).toMatchObject({ cursor: 'worker-2', aggregate_id: 'TASK-ORCH-5' });
  });

  it('runs the independent evaluator after each worker result', async () => {
    const store = new CompanyStateStore(await mkdtemp(path.join(os.tmpdir(), 'ai-company-')));
    const evaluated: string[] = [];
    await new BoundedOrchestrator(store, [{ id: 'coder', run: async () => ({ worker_id: 'coder', ok: true, evidence_ids: ['E1'] }) }], undefined, async (result) => { evaluated.push(result.worker_id); }).run({ ...task, task_id: 'TASK-ORCH-6' });
    expect(evaluated).toEqual(['coder']);
  });

  it('persists a checkpoint after each worker result', async () => {
    const store = new CompanyStateStore(await mkdtemp(path.join(os.tmpdir(), 'ai-company-')));
    await new BoundedOrchestrator(store, [
      { id: 'coder', run: async () => ({ worker_id: 'coder', ok: true, evidence_ids: ['E1'] }) },
      { id: 'functional-qa', run: async () => ({ worker_id: 'functional-qa', ok: true, evidence_ids: ['E2'] }) },
    ]).run({ ...task, task_id: 'TASK-ORCH-CHECKPOINT' });
    await expect(store.latestCheckpoint('TASK-ORCH-CHECKPOINT')).resolves.toMatchObject({ cursor: 'worker-2', payload: { completed_worker_ids: ['coder', 'functional-qa'] } });
  });

  it('resumes unfinished workers from an execution checkpoint after restart', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'ai-company-'));
    const firstStore = new CompanyStateStore(dir);
    for (const [fromState, toState, actor, key] of [
      ['INTAKE', 'DISCOVERY', 'pm', 'discovery'], ['DISCOVERY', 'COUNCIL_REVIEW', 'domain-expert', 'council'],
      ['COUNCIL_REVIEW', 'PM_BACKLOGGED', 'pm', 'backlog'], ['PM_BACKLOGGED', 'CEO_PRIORITIZED', 'ceo', 'priority'],
      ['CEO_PRIORITIZED', 'READY', 'ceo', 'ready'], ['READY', 'EXECUTING', 'coder', 'execute'],
    ] as const) await firstStore.transition({ aggregateId: 'TASK-ORCH-RESUME', fromState, toState, actor, reason: 'test crash setup', idempotencyKey: `TASK-ORCH-RESUME:${key}` });
    await firstStore.checkpoint({ aggregateId: 'TASK-ORCH-RESUME', actor: 'coder', cursor: 'worker-1', payload: { completed_worker_ids: ['coder'], completed_results: [{ worker_id: 'coder', ok: true, evidence_ids: ['E1'] }] }, idempotencyKey: 'TASK-ORCH-RESUME:checkpoint:coder:1' });
    let coderRuns = 0;
    let qaRuns = 0;
    const result = await new BoundedOrchestrator(new CompanyStateStore(dir), [
      { id: 'coder', run: async () => { coderRuns += 1; return { worker_id: 'coder', ok: true, evidence_ids: ['E1'] }; } },
      { id: 'functional-qa', run: async () => { qaRuns += 1; return { worker_id: 'functional-qa', ok: true, evidence_ids: ['E2'] }; } },
    ]).run({ ...task, task_id: 'TASK-ORCH-RESUME' });
    expect(result.status).toBe('RELEASED');
    expect(coderRuns).toBe(0);
    expect(qaRuns).toBe(1);
  });

  it('blocks dispatch of a quarantined worker', async () => {
    const store = new CompanyStateStore(await mkdtemp(path.join(os.tmpdir(), 'ai-company-')));
    let ran = false;
    const result = await new BoundedOrchestrator(store, [{ id: 'coder', run: async () => { ran = true; return { worker_id: 'coder', ok: true, evidence_ids: [] }; } }], undefined, undefined, async () => false).run({ ...task, task_id: 'TASK-ORCH-7' });
    expect(result.status).toBe('BLOCKED');
    expect(ran).toBe(false);
  });

  it('blocks dispatch of an unregistered role', async () => {
    const store = new CompanyStateStore(await mkdtemp(path.join(os.tmpdir(), 'ai-company-')));
    let ran = false;
    const result = await new BoundedOrchestrator(store, [{ id: 'unregistered-agent', run: async () => { ran = true; return { worker_id: 'unregistered-agent', ok: true, evidence_ids: ['E'] }; } }]).run({ ...task, task_id: 'TASK-ORCH-UNREGISTERED' });
    expect(result.status).toBe('BLOCKED');
    expect(ran).toBe(false);
  });

  it('blocks release when the production gate reports blockers', async () => {
    const store = new CompanyStateStore(await mkdtemp(path.join(os.tmpdir(), 'ai-company-')));
    const workers = ['coder', 'functional-qa', 'ux-research', 'domain-expert'].map((id) => ({ id, run: async () => ({ worker_id: id, ok: true, evidence_ids: ['E1'] }) }));
    const result = await new BoundedOrchestrator(store, workers, undefined, undefined, undefined, async () => ({ ready: false, blockers: ['security review missing'] })).run({ ...task, task_id: 'TASK-ORCH-GATE' });
    expect(result.status).toBe('REVISE');
    expect(await store.stateOf('TASK-ORCH-GATE')).toBe('REVISE');
  });
  it('passes agent principles into the worker task contract', async () => {
    const store = new CompanyStateStore(await mkdtemp(path.join(os.tmpdir(), 'ai-company-')));
    let received: Record<string, string[]> | undefined;
    await new BoundedOrchestrator(store, [{ id: 'coder', run: async (input) => { received = input.agent_principles; return { worker_id: 'coder', ok: true, evidence_ids: ['E'] }; } }]).run({ ...task, task_id: 'TASK-ORCH-PRINCIPLES', agent_principles: { coder: ['emit evidence'] } });
    expect(received).toEqual({ coder: ['emit evidence'] });
  });
});
