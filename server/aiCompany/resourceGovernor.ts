import { mkdir, realpath } from 'node:fs/promises';
import { closeSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { ChildProcess, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { computeRetryDelayMs } from './quotaPause';
import { withQueueMutationGate } from './queueMutationGate';

export type ResourceDecision = 'ALLOW' | 'HOLD_LOW_RESOURCE' | 'HOLD_EXHAUSTED' | 'UNKNOWN';

export interface AdmissionDecision {
  executor: string;
  model_id: string;
  resource_pool_id: string;
  observed_at: string;
  snapshot_age_ms: number;
  remaining_fraction: number | null;
  reset_at: string | null;
  source: string;
  freshness: 'fresh' | 'unknown';
  evidence_level: 'STRUCTURED_PREFLIGHT_AVAILABLE' | 'ERROR_ONLY_RESOURCE_SIGNAL' | 'PREFLIGHT_SIGNAL_UNAVAILABLE';
  decision: ResourceDecision;
  reason: string;
  lease_id: string | null;
}

const resourceRoot = (root: string) => path.join(root, '.ai-company', 'runtime', 'projects', 'macro-os');

function metadataBytes(file: string): Buffer {
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 64 * 1024) throw new Error('resource metadata must be a bounded regular unaliased file');
  const bytes = readFileSync(file);
  new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return bytes;
}

function validInstant(value: unknown): number | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return;
  const canonical = new Date(parsed).toISOString();
  if (canonical !== value && canonical.replace('.000Z', 'Z') !== value) return;
  return parsed;
}

function unknownDecision(decision: AdmissionDecision, source: string, reason: string): AdmissionDecision {
  return { ...decision, decision: 'UNKNOWN', source, freshness: 'unknown', lease_id: null, reason };
}

function evaluatePolicy(root: string, model: string, now: Date): AdmissionDecision {
  const fallback: AdmissionDecision = { executor: 'agy', model_id: model, resource_pool_id: 'antigravity-host', observed_at: now.toISOString(), snapshot_age_ms: 0, remaining_fraction: null, reset_at: null, source: 'agy-cli-1.2.4:error-only', freshness: 'unknown', evidence_level: 'ERROR_ONLY_RESOURCE_SIGNAL', decision: 'ALLOW', reason: 'No structured preflight quota signal is exposed by the installed Antigravity CLI; allow only under error-only reactive policy.', lease_id: null };
  const pausePath = path.join(resourceRoot(root), 'quota-pause.json');
  let bytes: Buffer;
  try { bytes = metadataBytes(pausePath); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    return unknownDecision(fallback, pausePath, 'Persisted quota evidence is unreadable or aliased; admission withheld.');
  }
  try {
    const pause = JSON.parse(bytes.toString('utf8'));
    if (!pause || pause.status !== 'WAITING_RESOURCE') throw new Error('unknown quota state');
    let resetTime = validInstant(pause.retry_not_before);
    if (pause.retry_not_before === null) {
      const detected = validInstant(pause.detected_at);
      if (detected === undefined || !Number.isSafeInteger(pause.resume_attempt_count) || pause.resume_attempt_count < 0) throw new Error('quota backoff facts missing');
      resetTime = detected + computeRetryDelayMs(pause.resume_attempt_count, 0);
    }
    if (resetTime === undefined || !Number.isFinite(resetTime)) throw new Error('quota reset is invalid');
    return { ...fallback, source: pausePath, freshness: 'fresh', reset_at: new Date(resetTime).toISOString(), decision: now.getTime() < resetTime ? 'HOLD_EXHAUSTED' : 'ALLOW', reason: now.getTime() < resetTime ? 'Durable quota pause is active; cognition admission is held until its valid reset/backoff window elapses.' : 'Valid quota reset/backoff window elapsed; permit only an error-only reactive probe, not proof of quota recovery.' };
  } catch {
    return unknownDecision(fallback, pausePath, 'Persisted quota facts are corrupt, unsupported or incomplete; admission withheld.');
  }
}

export async function evaluateAntigravityAdmission({ root, model, now = new Date() }: { root: string; model: string; now?: Date }): Promise<AdmissionDecision> {
  return evaluatePolicy(root, model, now);
}

interface ResourceOwner {
  lease_id: string;
  owner_pid: number;
  provider_launch_phase: 'NOT_STARTED' | 'LAUNCH_UNCERTAIN' | 'GROUP_BOUND' | 'LEGACY_UNATTESTED';
  provider_group_pid?: number;
}

export interface ResourceAdmission {
  decision: AdmissionDecision;
  release: () => Promise<void>;
  beginProviderLaunch: () => Promise<void>;
  bindProviderProcess: (provider: ChildProcess) => Promise<void>;
}

function currentOwner(lock: string): ResourceOwner | undefined {
  let stat;
  try { stat = lstatSync(lock); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('resource slot must be an unaliased directory');
  const row = JSON.parse(metadataBytes(path.join(lock, 'decision.json')).toString('utf8'));
  if (!row || row.decision !== 'ALLOW' || row.executor !== 'agy' || row.resource_pool_id !== 'antigravity-host' || typeof row.lease_id !== 'string' || !/^[A-Za-z0-9:._-]{1,256}$/.test(row.lease_id) || !Number.isSafeInteger(row.owner_pid) || row.owner_pid <= 0) throw new Error('resource owner identity is invalid');
  const phase = row.provider_launch_phase ?? 'LEGACY_UNATTESTED';
  if (!['NOT_STARTED', 'LAUNCH_UNCERTAIN', 'GROUP_BOUND', 'LEGACY_UNATTESTED'].includes(phase) || (phase === 'GROUP_BOUND' && (!Number.isSafeInteger(row.provider_group_pid) || row.provider_group_pid <= 0))) throw new Error('resource provider ownership is invalid');
  return { lease_id: row.lease_id, owner_pid: row.owner_pid, provider_launch_phase: phase, ...(phase === 'GROUP_BOUND' ? { provider_group_pid: row.provider_group_pid } : {}) };
}

function ownerLiveness(pid: number): 'ALIVE' | 'DEAD' | 'UNKNOWN' {
  try { process.kill(pid, 0); return 'ALIVE'; }
  catch (error) { return (error as NodeJS.ErrnoException).code === 'ESRCH' ? 'DEAD' : 'UNKNOWN'; }
}

function syncDirectory(directory: string): void {
  const fd = openSync(directory, 'r');
  try { fsyncSync(fd); } finally { closeSync(fd); }
}

function writeOwner(lock: string, row: object): void {
  const temporary = path.join(lock, `.decision-${randomUUID()}.tmp`);
  let published = false;
  let created = false;
  try {
    const fd = openSync(temporary, 'wx', 0o600);
    created = true;
    try { writeFileSync(fd, `${JSON.stringify(row, null, 2)}\n`, 'utf8'); fsyncSync(fd); }
    finally { closeSync(fd); }
    renameSync(temporary, path.join(lock, 'decision.json')); published = true; syncDirectory(lock);
  } finally { if (created && !published) unlinkSync(temporary); }
}

function sameOwner(current: ResourceOwner, expected: ResourceOwner): boolean {
  return current.lease_id === expected.lease_id && current.owner_pid === expected.owner_pid;
}

function providerLiveness(current: ResourceOwner): 'DEAD' | 'ALIVE' | 'UNKNOWN' {
  if (current.provider_launch_phase === 'NOT_STARTED') return 'DEAD';
  if (current.provider_launch_phase !== 'GROUP_BOUND' || !current.provider_group_pid) return 'UNKNOWN';
  return ownerLiveness(-current.provider_group_pid);
}

async function updateProviderOwner(root: string, lock: string, expected: ResourceOwner, provider?: ChildProcess): Promise<void> {
  let effectStarted = false;
  try {
    await withQueueMutationGate(root, () => {
      const current = currentOwner(lock);
      if (!current || !sameOwner(current, expected)) throw new Error('RESOURCE_ADMISSION_STALE_PROVIDER_BINDING: original owner lost authority');
      let providerGroupPid: number | undefined;
      if (provider === undefined) {
        if (current.provider_launch_phase !== 'NOT_STARTED') throw new Error('RESOURCE_PROVIDER_ALREADY_MARKED: repeated launch refused');
      } else {
        if (current.provider_launch_phase !== 'LAUNCH_UNCERTAIN' || !(provider instanceof ChildProcess) || !Number.isSafeInteger(provider.pid) || !provider.pid) throw new Error('RESOURCE_PROVIDER_BINDING_REQUIRED: actual issued child is required');
        const observed = execFileSync('/bin/ps', ['-p', String(provider.pid), '-o', 'ppid=', '-o', 'pgid='], { encoding: 'utf8', timeout: 1000 }).trim().split(/\s+/).map(Number);
        if (observed.length !== 2 || observed[0] !== process.pid || observed[1] !== provider.pid) throw new Error('RESOURCE_PROVIDER_BINDING_REQUIRED: child must belong to this owner and its own OS group');
        providerGroupPid = provider.pid;
      }
      const row = JSON.parse(metadataBytes(path.join(lock, 'decision.json')).toString('utf8'));
      effectStarted = true;
      writeOwner(lock, { ...row, provider_launch_phase: provider ? 'GROUP_BOUND' : 'LAUNCH_UNCERTAIN', ...(providerGroupPid ? { provider_group_pid: providerGroupPid } : {}) });
      return { value: undefined };
    });
  } catch (error) {
    if (effectStarted) throw new Error('RESOURCE_ADMISSION_COMMIT_UNCERTAIN: provider binding effects started; inspect slot before retry', { cause: error });
    throw error;
  }
}

async function releaseOwnedResource(root: string, lock: string, expected: ResourceOwner): Promise<void> {
  let effectStarted = false;
  try {
    await withQueueMutationGate(root, () => {
      let current: ResourceOwner | undefined;
      try { current = currentOwner(lock); }
      catch (error) { throw new Error('RESOURCE_ADMISSION_UNKNOWN_OWNER: release withheld', { cause: error }); }
      if (!current) return { value: undefined };
      if (!sameOwner(current, expected)) throw new Error('RESOURCE_ADMISSION_STALE_RELEASE: original owner cannot release the current slot');
      const provider = providerLiveness(current);
      if (provider === 'ALIVE') throw new Error('RESOURCE_ADMISSION_BUSY: provider group is still alive; release withheld');
      if (provider === 'UNKNOWN') throw new Error('RESOURCE_PROVIDER_OWNERSHIP_UNKNOWN: release withheld for launch/legacy uncertainty');
      effectStarted = true;
      rmSync(lock, { recursive: true });
      syncDirectory(root);
      return { value: undefined };
    });
  } catch (error) {
    if (effectStarted) throw new Error('RESOURCE_ADMISSION_COMMIT_UNCERTAIN: release effects started; inspect slot before retry', { cause: error });
    throw error;
  }
}

export async function acquireAntigravityAdmission({ root, model, now = new Date() }: { root: string; model: string; now?: Date }): Promise<ResourceAdmission> {
  const runtime = resourceRoot(root);
  await mkdir(runtime, { recursive: true, mode: 0o700 });
  const canonical = await realpath(runtime);
  const lock = path.join(canonical, 'antigravity-admission.lock');
  let effectStarted = false;
  try {
    return await withQueueMutationGate<ResourceAdmission>(canonical, () => {
      const decision = evaluatePolicy(root, model, now);
      const noProviderAuthority = async () => { throw new Error('RESOURCE_ADMISSION_REQUIRED: withheld admission cannot authorize provider launch'); };
      const withheld = (value: AdmissionDecision) => ({ value: { decision: value, release: async () => {}, beginProviderLaunch: noProviderAuthority, bindProviderProcess: noProviderAuthority } });
      if (decision.decision !== 'ALLOW') return withheld(decision);
      let current: ResourceOwner | undefined;
      try { current = currentOwner(lock); }
      catch { return withheld(unknownDecision(decision, lock, 'Resource owner state is unknown; preserve slot for explicit reconciliation.')); }
      if (current) {
        const alive = ownerLiveness(current.owner_pid);
        if (alive === 'ALIVE') throw new Error('RESOURCE_ADMISSION_BUSY: current owner remains alive; age does not authorize takeover');
        if (alive === 'UNKNOWN') return withheld(unknownDecision(decision, lock, 'Resource owner liveness is unknown; takeover withheld.'));
        const provider = providerLiveness(current);
        if (provider === 'ALIVE') throw new Error('RESOURCE_ADMISSION_BUSY: original provider group remains alive after dispatcher death');
        if (provider === 'UNKNOWN') return withheld(unknownDecision(decision, lock, 'Original provider launch/legacy ownership is unproven; takeover withheld.'));
        effectStarted = true;
        rmSync(lock, { recursive: true });
      }
      effectStarted = true;
      mkdirSync(lock, { mode: 0o700 });
      const leased = { ...decision, lease_id: `AGY-LEASE-${now.getTime()}-${randomUUID()}`, owner_pid: process.pid, provider_launch_phase: 'NOT_STARTED' as const };
      writeOwner(lock, leased); syncDirectory(canonical);
      const expected = Object.freeze({ lease_id: leased.lease_id, owner_pid: leased.owner_pid, provider_launch_phase: 'NOT_STARTED' as const });
      return { value: Object.freeze({ decision: Object.freeze({ ...leased }), release: () => releaseOwnedResource(canonical, lock, expected), beginProviderLaunch: () => updateProviderOwner(canonical, lock, expected), bindProviderProcess: (provider: ChildProcess) => updateProviderOwner(canonical, lock, expected, provider) }) };
    });
  } catch (error) {
    if (effectStarted) throw new Error('RESOURCE_ADMISSION_COMMIT_UNCERTAIN: acquisition effects started; inspect slot before retry', { cause: error });
    throw error;
  }
}
