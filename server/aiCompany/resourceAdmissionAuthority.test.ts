import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile, symlink, link, chmod, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { acquireAntigravityAdmission, evaluateAntigravityAdmission } from './resourceGovernor';

const durabilityFault = vi.hoisted(() => ({ active: false }));
vi.mock('node:fs', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, fsyncSync(fd: number) {
    if (durabilityFault.active && actual.fstatSync(fd).isDirectory()) throw Object.assign(new Error('temporary durability fault after owner publication'), { code: 'EIO' });
    return actual.fsyncSync(fd);
  } };
});

const roots: string[] = [];
const providers: ChildProcess[] = [];
afterEach(async () => {
  durabilityFault.active = false; vi.restoreAllMocks();
  for (const child of providers.splice(0)) if (child.exitCode === null && child.signalCode === null) { const closed = once(child, 'close'); child.kill('SIGKILL'); await closed; }
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'resource-admission-authority-')); roots.push(root);
  const runtime = path.join(root, '.ai-company/runtime/projects/macro-os');
  const lock = path.join(runtime, 'antigravity-admission.lock');
  return { root, runtime, lock, owner: path.join(lock, 'decision.json'), pause: path.join(runtime, 'quota-pause.json') };
}

it('late A release preserves B and C cannot enter while B is alive', async () => {
  const f = await fixture(); const a = await acquireAntigravityAdmission({ root: f.root, model: 'fixture' });
  await a.release(); const b = await acquireAntigravityAdmission({ root: f.root, model: 'fixture' });
  const bytes = await readFile(f.owner);
  await expect(a.release()).rejects.toThrow('RESOURCE_ADMISSION_STALE_RELEASE');
  expect(await readFile(f.owner)).toEqual(bytes);
  await expect(acquireAntigravityAdmission({ root: f.root, model: 'fixture' })).rejects.toThrow('RESOURCE_ADMISSION_BUSY');
  await b.release();
});

it('does not steal a slow live owner even under a +16-minute clock fault', async () => {
  const f = await fixture(); const a = await acquireAntigravityAdmission({ root: f.root, model: 'fixture' });
  const bytes = await readFile(f.owner);
  await expect(acquireAntigravityAdmission({ root: f.root, model: 'fixture', now: new Date(Date.now() + 16 * 60000) })).rejects.toThrow('RESOURCE_ADMISSION_BUSY');
  expect(await readFile(f.owner)).toEqual(bytes); await a.release();
});

it('issues distinct owner identities at an identical clock instant and keeps queue bytes untouched', async () => {
  const f = await fixture(); await mkdir(f.runtime, { recursive: true });
  const queue = path.join(f.runtime, 'role-work-queue.jsonl'); const original = '{"uninterpreted":"queue bytes are not resource authority"}\n'; await writeFile(queue, original);
  const now = new Date('2026-10-05T00:00:00.000Z'); const a = await acquireAntigravityAdmission({ root: f.root, model: 'fixture', now });
  await a.release(); const b = await acquireAntigravityAdmission({ root: f.root, model: 'fixture', now });
  expect(b.decision.lease_id).not.toBe(a.decision.lease_id); expect(await readFile(queue, 'utf8')).toBe(original);
  const stored = await readFile(f.owner, 'utf8'); expect(JSON.parse(stored).owner_pid).toBe(process.pid); await b.release();
});

it('one concurrent acquisition wins without an initialization window', async () => {
  const f = await fixture(); const outcomes = await Promise.allSettled(Array.from({ length: 8 }, () => acquireAntigravityAdmission({ root: f.root, model: 'fixture' })));
  const admitted = outcomes.filter((outcome): outcome is PromiseFulfilledResult<Awaited<ReturnType<typeof acquireAntigravityAdmission>>> => outcome.status === 'fulfilled' && outcome.value.decision.decision === 'ALLOW');
  expect(admitted).toHaveLength(1); expect(outcomes.filter(outcome => outcome.status === 'rejected')).toHaveLength(7); await admitted[0].value.release();
});

it.each(['missing', 'corrupt', 'invalid-pid', 'wrong-decision', 'symlink', 'hardlink'] as const)('withholds %s owner state without deleting it', async kind => {
  const f = await fixture(); await mkdir(f.lock, { recursive: true });
  if (kind !== 'missing') {
    const bytes = kind === 'corrupt' ? '{' : JSON.stringify({ decision: kind === 'wrong-decision' ? 'UNKNOWN' : 'ALLOW', resource_pool_id: 'antigravity-host', executor: 'agy', owner_pid: kind === 'invalid-pid' ? -1 : process.pid, lease_id: 'AGY-LEGACY-FIXTURE' });
    if (kind === 'symlink' || kind === 'hardlink') {
      const original = path.join(f.runtime, 'preserved-owner'); await writeFile(original, bytes);
      if (kind === 'symlink') await symlink(original, f.owner); else await link(original, f.owner);
    } else await writeFile(f.owner, bytes);
  }
  const names = await readdir(f.lock); const bytes = kind === 'missing' ? undefined : await readFile(f.owner);
  const admission = await acquireAntigravityAdmission({ root: f.root, model: 'fixture' }); expect(admission.decision.decision).toBe('UNKNOWN'); expect(admission.decision.lease_id).toBeNull();
  await admission.release(); expect(await readdir(f.lock)).toEqual(names); if (bytes) expect(await readFile(f.owner)).toEqual(bytes);
});

it.each([
  ['corrupt', '{'],
  ['unknown-status', JSON.stringify({ status: 'UNKNOWN' })],
  ['invalid-date', JSON.stringify({ status: 'WAITING_RESOURCE', retry_not_before: 'invalid' })],
  ['unknown-reset', JSON.stringify({ status: 'WAITING_RESOURCE', retry_not_before: null })],
] as const)('withholds %s quota evidence rather than treating it as absent', async (_kind, bytes) => {
  const f = await fixture(); await mkdir(f.runtime, { recursive: true }); await writeFile(f.pause, bytes);
  expect((await evaluateAntigravityAdmission({ root: f.root, model: 'fixture' })).decision).toBe('UNKNOWN');
  const admission = await acquireAntigravityAdmission({ root: f.root, model: 'fixture' }); expect(admission.decision.decision).toBe('UNKNOWN');
  expect(await readFile(f.pause, 'utf8')).toBe(bytes); expect(await readdir(f.runtime)).not.toContain('antigravity-admission.lock'); await admission.release();
});

it('does not follow an aliased quota file', async () => {
  const f = await fixture(); await mkdir(f.runtime, { recursive: true }); const target = path.join(f.root, 'preserved-quota'); await writeFile(target, JSON.stringify({ status: 'WAITING_RESOURCE', retry_not_before: '2020-01-01T00:00:00.000Z' })); await symlink(target, f.pause);
  expect((await evaluateAntigravityAdmission({ root: f.root, model: 'fixture' })).decision).toBe('UNKNOWN');
});

it('does not reinterpret unreadable quota evidence as absence', async () => {
  const f = await fixture(); await mkdir(f.runtime, { recursive: true }); await writeFile(f.pause, '{}'); await chmod(f.pause, 0);
  try { expect((await evaluateAntigravityAdmission({ root: f.root, model: 'fixture' })).decision).toBe('UNKNOWN'); }
  finally { await chmod(f.pause, 0o600); }
});

it('retains the real quota-ledger bounded backoff when reset time is unknown', async () => {
  const f = await fixture(); await mkdir(f.runtime, { recursive: true }); await writeFile(f.pause, JSON.stringify({ status: 'WAITING_RESOURCE', retry_not_before: null, detected_at: '2026-10-05T00:00:00.000Z', resume_attempt_count: 0 }));
  expect((await evaluateAntigravityAdmission({ root: f.root, model: 'fixture', now: new Date('2026-10-05T00:14:00.000Z') })).decision).toBe('HOLD_EXHAUSTED');
  const elapsed = await evaluateAntigravityAdmission({ root: f.root, model: 'fixture', now: new Date('2026-10-05T00:16:00.000Z') }); expect(elapsed.decision).toBe('ALLOW'); expect(elapsed.remaining_fraction).toBeNull(); expect(elapsed.evidence_level).toBe('ERROR_ONLY_RESOURCE_SIGNAL');
});

it('permission ambiguity in a genuine current owner liveness check withholds takeover', async () => {
  const f = await fixture(); const a = await acquireAntigravityAdmission({ root: f.root, model: 'fixture' }); const before = await readFile(f.owner);
  const kill = process.kill.bind(process);
  const spy = vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
    if (pid === process.pid && signal === 0) throw Object.assign(new Error('temporary OS permission fault'), { code: 'EPERM' });
    return kill(pid, signal);
  });
  const b = await acquireAntigravityAdmission({ root: f.root, model: 'fixture' }); expect(b.decision.decision).toBe('UNKNOWN'); expect(await readFile(f.owner)).toEqual(before);
  spy.mockRestore(); await a.release();
});

it('publication durability failure reports uncertain effects and retains the actual owner slot', async () => {
  const f = await fixture(); durabilityFault.active = true;
  await expect(acquireAntigravityAdmission({ root: f.root, model: 'fixture' })).rejects.toThrow('RESOURCE_ADMISSION_COMMIT_UNCERTAIN'); durabilityFault.active = false;
  const before = await readFile(f.owner); expect(JSON.parse(before.toString()).owner_pid).toBe(process.pid);
  await expect(acquireAntigravityAdmission({ root: f.root, model: 'fixture' })).rejects.toThrow('RESOURCE_ADMISSION_BUSY'); expect(await readFile(f.owner)).toEqual(before);
});

it('public decision mutation cannot rebind an old handle to B', async () => {
  const f = await fixture(); const a = await acquireAntigravityAdmission({ root: f.root, model: 'fixture' }); await a.release(); const b = await acquireAntigravityAdmission({ root: f.root, model: 'fixture' }); const before = await readFile(f.owner);
  expect(() => Object.assign(a.decision, { lease_id: b.decision.lease_id })).toThrow();
  await expect(a.release()).rejects.toThrow('RESOURCE_ADMISSION_STALE_RELEASE'); await expect(a.beginProviderLaunch()).rejects.toThrow('RESOURCE_ADMISSION_STALE_PROVIDER_BINDING'); expect(await readFile(f.owner)).toEqual(before); await b.release();
});

it('withheld admission cannot begin or bind any provider', async () => {
  const f = await fixture(); await mkdir(f.runtime, { recursive: true }); await writeFile(f.pause, '{'); const a = await acquireAntigravityAdmission({ root: f.root, model: 'fixture' });
  await expect(a.beginProviderLaunch()).rejects.toThrow('RESOURCE_ADMISSION_REQUIRED'); await expect(a.bindProviderProcess(new (await import('node:child_process')).ChildProcess())).rejects.toThrow('RESOURCE_ADMISSION_REQUIRED');
});

it('a real bound private provider group prevents early release and releases after quiescence', async () => {
  const f = await fixture(); const a = await acquireAntigravityAdmission({ root: f.root, model: 'fixture' }); await a.beginProviderLaunch();
  const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { detached: true, stdio: 'ignore' }); providers.push(child); await once(child, 'spawn'); await a.bindProviderProcess(child);
  const before = await readFile(f.owner); expect(JSON.parse(before.toString()).provider_group_pid).toBe(child.pid);
  await expect(a.release()).rejects.toThrow('RESOURCE_ADMISSION_BUSY'); expect(await readFile(f.owner)).toEqual(before);
  const closed = once(child, 'close'); process.kill(-child.pid!, 'SIGKILL'); await closed; await a.release(); expect(await readdir(f.runtime)).not.toContain('antigravity-admission.lock');
});

it('repeated launch and a real child outside its own OS group cannot certify provider ownership', async () => {
  const f = await fixture(); const a = await acquireAntigravityAdmission({ root: f.root, model: 'fixture' }); await a.beginProviderLaunch(); const before = await readFile(f.owner);
  await expect(a.beginProviderLaunch()).rejects.toThrow('RESOURCE_PROVIDER_ALREADY_MARKED');
  const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: 'ignore' }); providers.push(child); await once(child, 'spawn');
  await expect(a.bindProviderProcess(child)).rejects.toThrow('own OS group'); expect(await readFile(f.owner)).toEqual(before); await expect(a.release()).rejects.toThrow('RESOURCE_PROVIDER_OWNERSHIP_UNKNOWN');
});
