import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, writeFile, symlink, link, chmod, stat, mkdir, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { RoleWorkQueue } from './roleWorkQueue';
import { InMemoryEvidenceResolver } from './evidenceResolver';

const root = () => mkdtemp(path.join(os.tmpdir(), 'queue-fence-'));
const spec = { project_id: 'isolated', backlog_id: 'B', title: 'Isolated fixture only', role: 'ux-research' as const };
async function fixture() {
  const dir = await root();
  const resolver = new InMemoryEvidenceResolver();
  const queue = new RoleWorkQueue(dir, resolver);
  const item = await queue.create(spec);
  const evidence = resolver.createEvidence({ evidence_id: 'E-FIXTURE', namespace: item.assignment!.namespace, run_id: item.assignment!.run_id, produced_by_role: item.role, content: 'Isolated bytes; product outcome UNKNOWN' });
  resolver.register({ ...evidence, work_id: item.work_id, source_artifact: 'queueMutationFence.test.ts' });
  const claimAuthority1 = await queue.claim(item.work_id, 'fixture-owner');
  await queue.submitForReview(item.work_id, claimAuthority1.attempt_authority);
  const complete = () => queue.complete(item.work_id, ['E-FIXTURE'], { research_question: 'Snapshot admission', source_reference: 'E-FIXTURE', finding: 'Isolated fixture', confidence: 0.5 }, undefined, undefined, undefined, undefined, claimAuthority1.attempt_authority);
  return { dir, resolver, queue, item, complete, authority: claimAuthority1.attempt_authority };
}

describe('queue mutation fencing', () => {
  it.each(['block', 'quarantine'] as const)('rejects delayed completion after %s without any append', async operation => {
    const { queue, resolver, item, complete, dir } = await fixture();
    let entered!: () => void, resume!: () => void;
    const barrier = new Promise<void>(r => { entered = r; });
    const release = new Promise<void>(r => { resume = r; });
    const resolve = resolver.resolve.bind(resolver);
    vi.spyOn(resolver, 'resolve').mockImplementation((async (id: string) => { entered(); await release; return resolve(id); }) as never);
    const pending = complete();
    const outcome = expect(pending).rejects.toThrow('stale queue mutation');
    await barrier;
    await queue[operation](item.work_id, 'newer stop');
    const stopped = await readFile(path.join(dir, 'role-work-queue.jsonl'));
    resume();
    await outcome;
    expect(await readFile(path.join(dir, 'role-work-queue.jsonl'))).toEqual(stopped);
  });

  it('does not reopen DONE from an outer stale-lease selection', async () => {
    const { queue, complete } = await fixture();
    const original = queue.records.bind(queue);
    let entered!: () => void, resume!: () => void;
    const barrier = new Promise<void>(r => { entered = r; });
    const release = new Promise<void>(r => { resume = r; });
    vi.spyOn(queue, 'records').mockImplementationOnce(async project => { const selected = await original(project); entered(); await release; return selected; });
    const pending = queue.recoverStaleLeases('isolated', 1000, new Date(Date.now() + 10_000));
    const outcome = expect(pending).rejects.toThrow('stale queue selection');
    await barrier;
    await complete();
    resume();
    await outcome;
    expect((await queue.records())[0].state).toBe('DONE');
  });

  it('permits only one claim across independent processes', async () => {
    const dir = await root(); const queue = new RoleWorkQueue(dir); const item = await queue.create(spec);
    const code = `import {RoleWorkQueue} from './server/aiCompany/roleWorkQueue.ts';const q=new RoleWorkQueue(process.argv[1]);try{await q.claim(process.argv[2],process.argv[3]);console.log('ACCEPTED')}catch(e){console.log('REJECTED:'+e.message)}`;
    const run = promisify(execFile);
    const results = await Promise.all(['a', 'b'].map(owner => run(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code, dir, item.work_id, owner])));
    expect(results.filter(result => result.stdout.trim() === 'ACCEPTED')).toHaveLength(1);
    expect(results.filter(result => result.stdout.includes('REJECTED:'))).toHaveLength(1);
    expect((await queue.records())[0].queue_revision).toBe(2);
  });

  it('releases the OS gate when its process dies', async () => {
    const dir = await root();
    const code = `import {DatabaseSync} from 'node:sqlite';const db=new DatabaseSync(process.argv[1]);db.exec('BEGIN IMMEDIATE');console.log('LOCKED');setInterval(()=>{},1000)`;
    const child = spawn(process.execPath, ['--input-type=module', '-e', code, path.join(dir, 'role-work-queue.write-gate.sqlite')], { stdio: ['ignore', 'pipe', 'pipe'] });
    try {
      const [bytes] = await once(child.stdout!, 'data'); expect(bytes.toString()).toContain('LOCKED');
      const mutation = new RoleWorkQueue(dir).create(spec);
      const exited = once(child, 'exit'); child.kill('SIGKILL'); await exited;
      expect((await mutation).state).toBe('READY');
    } finally { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }
  });

  it.each(['symlink', 'hardlink'] as const)('rejects %s queue aliases with original bytes preserved', async kind => {
    const { dir } = await fixture(); const file = path.join(dir, 'role-work-queue.jsonl'); const aliasRoot = await root();
    const alias = path.join(aliasRoot, 'role-work-queue.jsonl');
    await (kind === 'symlink' ? symlink(file, alias) : link(file, alias));
    const before = await readFile(file);
    await expect(new RoleWorkQueue(aliasRoot).create(spec)).rejects.toThrow('unaliased');
    expect(await readFile(file)).toEqual(before);
  });

  it('preserves exact history prefix and permission bits', async () => {
    const { dir, queue } = await fixture(); const file = path.join(dir, 'role-work-queue.jsonl');
    await chmod(file, 0o640); const before = await readFile(file);
    await queue.create({ ...spec, title: 'Second fixture' });
    expect((await readFile(file)).subarray(0, before.length)).toEqual(before);
    expect((await stat(file)).mode & 0o777).toBe(0o640);
  });

  it('rejects invalid history without salvage or overwrite', async () => {
    const dir = await root(); const file = path.join(dir, 'role-work-queue.jsonl');
    const bytes = Buffer.from('{"work_id":"partial"}'); await writeFile(file, bytes);
    await expect(new RoleWorkQueue(dir).create(spec)).rejects.toThrow('unterminated');
    expect(await readFile(file)).toEqual(bytes);
  });
  it('rejects exhausted revisions without making history unreadable', async () => {
    const dir = await root(); const queue = new RoleWorkQueue(dir); const item = await queue.create(spec);
    const file = path.join(dir, 'role-work-queue.jsonl');
    await writeFile(file, JSON.stringify({ ...item, queue_revision: Number.MAX_SAFE_INTEGER }) + '\n');
    const before = await readFile(file);
    await expect(queue.claim(item.work_id, 'new-owner')).rejects.toThrow('revision exhausted');
    expect(await readFile(file)).toEqual(before);
    expect((await queue.records())[0].state).toBe('READY');
  });

  it('classifies a create provenance error as committed', async () => {
    const dir = await root();
    await mkdir(path.join(dir, 'forensic-write-provenance.jsonl'));
    const previous = process.env.AI_COMPANY_FORENSIC_RUN_ID;
    process.env.AI_COMPANY_FORENSIC_RUN_ID = 'isolated-postcommit-probe';
    try {
      const queue = new RoleWorkQueue(dir);
      await expect(queue.create(spec)).rejects.toThrow('QUEUE_COMMITTED_PROVENANCE_FAILURE');
      expect(await queue.records()).toHaveLength(1);
    } finally {
      if (previous === undefined) delete process.env.AI_COMPANY_FORENSIC_RUN_ID;
      else process.env.AI_COMPANY_FORENSIC_RUN_ID = previous;
    }
  });

  it('binds canonical root before a directory alias retarget', async () => {
    const { dir, resolver, item, authority } = await fixture();
    const alias = path.join(await root(), 'alias'); const targetB = await root();
    await symlink(dir, alias);
    await writeFile(path.join(targetB, 'role-work-queue.jsonl'), await readFile(path.join(dir, 'role-work-queue.jsonl')));
    const queue = new RoleWorkQueue(alias, resolver);
    let entered!: () => void, resume!: () => void;
    const barrier = new Promise<void>(r => { entered = r; }); const release = new Promise<void>(r => { resume = r; });
    const resolve = resolver.resolve.bind(resolver);
    vi.spyOn(resolver, 'resolve').mockImplementation((async (id: string) => { entered(); await release; return resolve(id); }) as never);
    const pending = queue.complete(item.work_id, ['E-FIXTURE'], { research_question: 'Alias identity', source_reference: 'E-FIXTURE', finding: 'Fixture', confidence: 0.5 }, undefined, undefined, undefined, undefined, authority);
    await barrier; await unlink(alias); await symlink(targetB, alias); resume();
    expect((await pending).state).toBe('DONE');
    expect((await new RoleWorkQueue(dir).records())[0].state).toBe('DONE');
    expect((await new RoleWorkQueue(targetB).records())[0].state).toBe('IN_REVIEW');
  });

  it.each(['record-workspace-synthesis-cycle.mjs', 'record-disclaimer-banner-cycle.mjs'])('historical %s rejects before any file effect', async script => {
    const dir = await root(); const run = promisify(execFile);
    await expect(run(process.execPath, ['--import', createRequire(import.meta.url).resolve('tsx'), path.join(process.cwd(), 'scripts', script)], { cwd: dir })).rejects.toMatchObject({ stderr: expect.stringContaining('Historical cycle recorder disabled') });
    const { readdir } = await import('node:fs/promises');
    expect(await readdir(dir)).toEqual([]);
  });

});
