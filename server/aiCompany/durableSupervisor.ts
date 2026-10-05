import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join } from 'node:path';

export type SupervisorLease = { owner_id: string; pid: number; acquired_at: string; expires_at: string };
export type SupervisorCheckpoint = { run_id: string | null; namespace: string | null; status: string; next_action: string; updated_at: string; payload?: Record<string, unknown> };

const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };

export class DurableSupervisorState {
  readonly leasePath: string;
  readonly lockPath: string;
  readonly checkpointPath: string;
  constructor(private readonly stateDir: string, private readonly now = () => new Date(), private readonly pid = process.pid) {
    this.leasePath = join(stateDir, 'supervisor-lease.json');
    this.lockPath = join(stateDir, 'supervisor-lease.lock');
    this.checkpointPath = join(stateDir, 'supervisor-checkpoint.json');
  }

  private async atomicJson(path: string, value: unknown) {
    await mkdir(dirname(path), { recursive: true });
    const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    await rename(temp, path);
  }

  async acquire(ownerId: string, ttlMs = 120_000): Promise<SupervisorLease> {
    await mkdir(this.stateDir, { recursive: true });
    let existing: SupervisorLease | null = null;
    try { existing = JSON.parse(await readFile(this.leasePath, 'utf8')) as SupervisorLease; } catch { /* absent or interrupted lease */ }
    const nowMs = this.now().getTime();
    if (existing && existing.owner_id === ownerId && existing.pid === this.pid && existing.expires_at && new Date(existing.expires_at).getTime() > nowMs) {
      const renewed = { ...existing, expires_at: new Date(nowMs + ttlMs).toISOString() };
      await this.atomicJson(this.leasePath, renewed);
      return renewed;
    }
    if (existing && existing.owner_id !== ownerId && existing.expires_at && new Date(existing.expires_at).getTime() > nowMs && alive(existing.pid)) throw new Error(`supervisor lease held by ${existing.owner_id}`);
    try { await mkdir(this.lockPath); } catch {
      if (!existing || (existing.expires_at && new Date(existing.expires_at).getTime() <= nowMs) || !alive(existing.pid)) {
        await rm(this.lockPath, { recursive: true, force: true });
        await mkdir(this.lockPath);
      } else throw new Error(`supervisor lease held by ${existing.owner_id}`);
    }
    const lease = { owner_id: ownerId, pid: this.pid, acquired_at: this.now().toISOString(), expires_at: new Date(nowMs + ttlMs).toISOString() };
    await this.atomicJson(this.leasePath, lease);
    const observed = JSON.parse(await readFile(this.leasePath, 'utf8')) as SupervisorLease;
    if (observed.owner_id !== ownerId || observed.pid !== this.pid) throw new Error('supervisor lease lost during acquisition');
    return lease;
  }

  async renew(ownerId: string, ttlMs = 120_000) {
    const current = JSON.parse(await readFile(this.leasePath, 'utf8')) as SupervisorLease;
    if (current.owner_id !== ownerId || current.pid !== this.pid) throw new Error('cannot renew another supervisor lease');
    return this.acquire(ownerId, ttlMs);
  }

  async release(ownerId: string) {
    try {
      const current = JSON.parse(await readFile(this.leasePath, 'utf8')) as SupervisorLease;
      if (current.owner_id === ownerId && current.pid === this.pid) {
        await this.atomicJson(this.leasePath, { ...current, expires_at: this.now().toISOString() });
        await rm(this.lockPath, { recursive: true, force: true });
      }
    } catch { /* already absent or corrupt; startup reconciliation will quarantine it */ }
  }

  async checkpoint(input: Omit<SupervisorCheckpoint, 'updated_at'>): Promise<SupervisorCheckpoint> {
    const checkpoint = { ...input, updated_at: this.now().toISOString() };
    await this.atomicJson(this.checkpointPath, checkpoint);
    return checkpoint;
  }

  async loadCheckpoint(): Promise<SupervisorCheckpoint | null> {
    try { return JSON.parse(await readFile(this.checkpointPath, 'utf8')) as SupervisorCheckpoint; } catch { return null; }
  }

  async reconcile(): Promise<{ lease: 'ACTIVE' | 'STALE' | 'ABSENT' | 'CORRUPT'; checkpoint: SupervisorCheckpoint | null; action: 'CONTINUE' | 'START' | 'QUARANTINE' }> {
    let leaseState: 'ACTIVE' | 'STALE' | 'ABSENT' | 'CORRUPT';
    try {
      const lease = JSON.parse(await readFile(this.leasePath, 'utf8')) as SupervisorLease;
      leaseState = lease.expires_at && new Date(lease.expires_at).getTime() > this.now().getTime() && alive(lease.pid) ? 'ACTIVE' : 'STALE';
    } catch (error) {
      leaseState = error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT' ? 'ABSENT' : 'CORRUPT';
    }
    const checkpoint = await this.loadCheckpoint();
    return { lease: leaseState, checkpoint, action: leaseState === 'ACTIVE' ? 'CONTINUE' : checkpoint?.status === 'RUNNING' ? 'CONTINUE' : checkpoint ? 'CONTINUE' : 'START' };
  }

  static async isReadable(path: string) { try { await access(path, constants.R_OK); return true; } catch { return false; } }
}
