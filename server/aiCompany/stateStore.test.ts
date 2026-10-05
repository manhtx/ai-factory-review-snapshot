import { mkdtemp, readFile, open, utimes, appendFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CompanyStateStore } from './stateStore';

async function store() {
  return new CompanyStateStore(await mkdtemp(path.join(os.tmpdir(), 'ai-company-')));
}

describe('CompanyStateStore', () => {
  it('appends a valid transition and recovers current state', async () => {
    const state = await store();
    const result = await state.transition({ aggregateId: 'TASK-1', fromState: 'INTAKE', toState: 'DISCOVERY', actor: 'pm', reason: 'discovery', idempotencyKey: 'k1' });
    expect(result.applied).toBe(true);
    expect(await state.stateOf('TASK-1')).toBe('DISCOVERY');
  });

  it('is idempotent for duplicate commands', async () => {
    const state = await store();
    const input = { aggregateId: 'TASK-2', fromState: 'INTAKE' as const, toState: 'DISCOVERY' as const, actor: 'pm', reason: 'discovery', idempotencyKey: 'same' };
    expect((await state.transition(input)).applied).toBe(true);
    expect((await state.transition(input)).applied).toBe(false);
    expect((await state.events())).toHaveLength(1);
  });

  it('rejects invalid, stale, and terminal transitions', async () => {
    const state = await store();
    await expect(state.transition({ aggregateId: 'TASK-3', fromState: 'INTAKE', toState: 'RELEASED', actor: 'coder', reason: 'bad', idempotencyKey: 'bad' })).rejects.toThrow('invalid transition');
    await state.transition({ aggregateId: 'TASK-3', fromState: 'INTAKE', toState: 'DISCOVERY', actor: 'pm', reason: 'ok', idempotencyKey: 'ok' });
    await expect(state.transition({ aggregateId: 'TASK-3', fromState: 'INTAKE', toState: 'DISCOVERY', actor: 'pm', reason: 'stale', idempotencyKey: 'stale' })).rejects.toThrow('stale transition');
  });

  it('writes append-only JSONL events', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'ai-company-'));
    const state = new CompanyStateStore(dir);
    await state.transition({ aggregateId: 'TASK-4', fromState: 'INTAKE', toState: 'DISCOVERY', actor: 'pm', reason: 'ok', idempotencyKey: 'k4' });
    const raw = await readFile(path.join(dir, 'events.jsonl'), 'utf8');
    expect(raw.trim().split('\n')).toHaveLength(1);
    expect(JSON.parse(raw).event_type).toBe('STATE_TRANSITION');
  });

  it('persists and recovers an idempotent checkpoint', async () => {
    const state = await store();
    const input = { aggregateId: 'TASK-5', actor: 'coder', cursor: 'step-2', payload: { files: ['a.ts'] }, idempotencyKey: 'checkpoint-1' };
    const first = await state.checkpoint(input);
    const second = await state.checkpoint(input);
    expect(second.checkpoint_id).toBe(first.checkpoint_id);
    expect(await state.latestCheckpoint('TASK-5')).toEqual(first);
    expect((await state.events())).toHaveLength(1);
  });

  it('enforces policy at the state-store boundary', async () => {
    const state = await store();
    await expect(state.transition({ aggregateId: 'TASK-6', fromState: 'INTAKE', toState: 'DISCOVERY', actor: 'coder', reason: 'unauthorized', idempotencyKey: 'deny-1' })).rejects.toThrow('cannot transition');
  });

  it('serializes concurrent transitions and rejects the stale writer', async () => {
    const state = await store();
    const input = (key: string) => ({ aggregateId: 'TASK-7', fromState: 'INTAKE' as const, toState: 'DISCOVERY' as const, actor: 'pm', reason: 'concurrent', idempotencyKey: key });
    const results = await Promise.allSettled([state.transition(input('race-a')), state.transition(input('race-b'))]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await state.stateOf('TASK-7')).toBe('DISCOVERY');
  });

  it('recovers from a stale lock left by a crashed process', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'ai-company-'));
    const lock = path.join(dir, 'events.jsonl.lock');
    const handle = await open(lock, 'w');
    await handle.close();
    const old = new Date(Date.now() - 5_000);
    await utimes(lock, old, old);
    const state = new CompanyStateStore(dir, 1_000);
    const result = await state.transition({ aggregateId: 'TASK-8', fromState: 'INTAKE', toState: 'DISCOVERY', actor: 'pm', reason: 'recover', idempotencyKey: 'recover-1' });
    expect(result.applied).toBe(true);
  });

  it('reports interrupted or corrupt JSONL writes without repairing them', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'ai-company-'));
    const state = new CompanyStateStore(dir);
    await appendFile(path.join(dir, 'events.jsonl'), '{"event_id":"partial"\n', 'utf8');
    await expect(state.validateIntegrity()).resolves.toMatchObject({ valid: false, event_count: 0, errors: ['line 1: invalid JSON'] });
    await expect(state.assertIntegrity()).rejects.toThrow('state store integrity failure');
  });

  it('rejects a checkpoint whose worker IDs do not match its results', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'ai-company-'));
    const state = new CompanyStateStore(dir);
    await state.checkpoint({ aggregateId: 'TASK-9', actor: 'coder', cursor: 'worker-1', payload: { completed_worker_ids: ['coder'], completed_results: [{ worker_id: 'functional-qa', ok: true, evidence_ids: ['E'] }] }, idempotencyKey: 'checkpoint-bad' });
    await expect(state.validateIntegrity()).resolves.toMatchObject({ valid: false, errors: ['line 1: checkpoint worker/result mismatch'] });
  });

  it('records an idempotent recovery command in the append-only audit log', async () => {
    const state = await store();
    const input = { aggregateId: 'TASK-10', actor: 'ceo', reason: 'resume', idempotencyKey: 'resume-command', payload: { cursor: 'worker-1' } };
    const first = await state.recordCommand(input);
    const second = await state.recordCommand(input);
    expect(second.event_id).toBe(first.event_id);
    expect(first.event_type).toBe('COMMAND');
    expect(await state.validateIntegrity()).toMatchObject({ valid: true, event_count: 1 });
  });

  it('allows one worker owner at a time and releases the claim', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'ai-company-'));
    const state = new CompanyStateStore(dir);
    await expect(state.acquireWorkerLease({ aggregateId: 'TASK-11', workerId: 'coder', owner: 'one' })).resolves.toBe(true);
    await expect(state.acquireWorkerLease({ aggregateId: 'TASK-11', workerId: 'coder', owner: 'two' })).resolves.toBe(false);
    await state.releaseWorkerLease({ aggregateId: 'TASK-11', workerId: 'coder', owner: 'one' });
    await expect(state.acquireWorkerLease({ aggregateId: 'TASK-11', workerId: 'coder', owner: 'two' })).resolves.toBe(true);
  });
});
