import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { DurableSupervisorState } from './durableSupervisor';

describe('DurableSupervisorState', () => {
  it('persists checkpoint and reconciles it after a simulated restart', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-company-supervisor-'));
    const state = new DurableSupervisorState(dir, () => new Date('2026-09-11T00:00:00Z'), 999999);
    await state.checkpoint({ run_id: 'run-1', namespace: 'ns-1', status: 'RUNNING', next_action: 'resume-ready-work' });
    const restarted = new DurableSupervisorState(dir, () => new Date('2026-09-11T00:00:01Z'), 999998);
    await expect(restarted.reconcile()).resolves.toMatchObject({ lease: 'ABSENT', action: 'CONTINUE', checkpoint: { run_id: 'run-1' } });
  });

  it('rejects a live unexpired lease owned by another process', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-company-supervisor-'));
    const state = new DurableSupervisorState(dir, () => new Date('2026-09-11T00:00:00Z'), process.pid);
    await state.acquire('owner-a');
    const other = new DurableSupervisorState(dir, () => new Date('2026-09-11T00:00:00Z'), process.pid);
    await expect(other.acquire('owner-b')).rejects.toThrow('lease held');
  });

  it('renews an existing lease for the same owner idempotently', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-company-supervisor-')); const state = new DurableSupervisorState(dir, () => new Date('2026-09-11T00:00:00Z'), process.pid);
    await state.acquire('owner-a', 1_000); await expect(state.renew('owner-a', 5_000)).resolves.toMatchObject({ owner_id: 'owner-a', expires_at: '2026-09-11T00:00:05.000Z' });
  });

  it('takes over an expired lease and preserves checkpoint state', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-company-supervisor-'));
    const state = new DurableSupervisorState(dir, () => new Date('2026-09-11T00:00:00Z'), process.pid);
    await state.acquire('owner-a', 1);
    const later = new DurableSupervisorState(dir, () => new Date('2026-09-11T00:01:00Z'), process.pid);
    await expect(later.acquire('owner-b')).resolves.toMatchObject({ owner_id: 'owner-b' });
  });

  it('reconciles a checkpoint after a real coordinator process is killed', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-company-crash-'));
    const code = `import { DurableSupervisorState } from './server/aiCompany/durableSupervisor.ts'; const s=new DurableSupervisorState(process.argv[1],()=>new Date(),process.pid); await s.checkpoint({run_id:'crash-run',namespace:'crash-ns',status:'RUNNING',next_action:'resume-after-crash'}); console.log('READY'); setInterval(()=>{},1000);`;
    const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code, dir], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    await new Promise<void>((resolve, reject) => { const timer = setTimeout(() => reject(new Error(`child did not start: ${output}`)), 10_000); child.stdout.on('data', () => { if (output.includes('READY')) { clearTimeout(timer); resolve(); } }); child.once('error', reject); });
    child.kill('SIGTERM'); await once(child, 'exit');
    const restarted = new DurableSupervisorState(dir, () => new Date(), process.pid);
    await expect(restarted.reconcile()).resolves.toMatchObject({ checkpoint: { run_id: 'crash-run', next_action: 'resume-after-crash' }, action: 'CONTINUE' });
  }, 20_000);
});
