import { describe, expect, it } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { acquireAntigravityAdmission, evaluateAntigravityAdmission } from './resourceGovernor';

describe('Antigravity resource governor', () => {
  it('uses an honest error-only signal when CLI preflight is unavailable', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agy-governor-'));
    const d = await evaluateAntigravityAdmission({ root, model: 'gemini-3.8-flash-high' });
    expect(d).toMatchObject({ decision: 'ALLOW', evidence_level: 'ERROR_ONLY_RESOURCE_SIGNAL', remaining_fraction: null });
  });
  it('holds cognition while a durable quota pause is active', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agy-governor-pause-'));
    const dir = path.join(root, '.ai-company/runtime/projects/macro-os'); await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'quota-pause.json'), JSON.stringify({ status: 'WAITING_RESOURCE', retry_not_before: '2099-01-01T00:00:00.000Z' }));
    const d = await evaluateAntigravityAdmission({ root, model: 'gemini-3.8-flash-high' });
    expect(d.decision).toBe('HOLD_EXHAUSTED');
  });
  it('allows cognition after durable quota pause retry_not_before has elapsed', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agy-governor-elapsed-'));
    const dir = path.join(root, '.ai-company/runtime/projects/macro-os'); await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'quota-pause.json'), JSON.stringify({ status: 'WAITING_RESOURCE', retry_not_before: '2020-01-01T00:00:00.000Z' }));
    const d = await evaluateAntigravityAdmission({ root, model: 'gemini-3.8-flash-high', now: new Date('2026-09-22T00:00:00.000Z') });
    expect(d.decision).toBe('ALLOW');
  });
  it('serializes leases so concurrent cognition cannot start together', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agy-governor-lock-'));
    const a = await acquireAntigravityAdmission({ root, model: 'm' });
    await expect(acquireAntigravityAdmission({ root, model: 'm' })).rejects.toThrow('RESOURCE_ADMISSION_BUSY');
    await a.release();
    const b = await acquireAntigravityAdmission({ root, model: 'm' }); await b.release();
  });
});
