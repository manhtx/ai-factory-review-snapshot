import { mkdtemp, readFile, cp, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { RoleWorkQueue, type AttemptAuthority, type RoleWorkItem } from './roleWorkQueue';
import { RoleEvidenceLedger } from './roleEvidenceLedger';
import { evidenceProducingRoleWorkExecutor, modelRoleWorkExecutor } from './roleWorkExecutor';

const usage = { input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0 };
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'native-issuance-'));
  const ledger = new RoleEvidenceLedger(root), queue = new RoleWorkQueue(root, ledger);
  const item = await queue.create({ project_id: 'unit', backlog_id: 'B', title: 'Unit issuance only; no effect/outcome claim', role: 'ux-research' });
  const claim = await queue.claim(item.work_id, 'fixture');
  return { root, ledger, queue, claim, item };
}
function stub() { return vi.fn(async ({ task }) => ({ ok: true, text: JSON.stringify({ research_question: 'Unit question', source_reference: task.role_execution.receipt_evidence_id, finding: 'Only advisory unit transcript', confidence: 0.2 }), evidence_ids: [], usage })); }
function withoutHandle(row: RoleWorkItem & { attempt_authority?: AttemptAuthority }) { const copy = { ...row }; delete copy.attempt_authority; return copy; }

describe('native durable dispatch issuance', () => {
  it('admits one of concurrent same-claim native dispatches before provider', async () => {
    const f = await fixture(), complete = stub();
    const execute = evidenceProducingRoleWorkExecutor({ id: 'unit-stub', complete }, f.ledger, f.queue);
    const result = await Promise.allSettled([execute(f.claim, f.claim.attempt_authority), execute(f.claim, f.claim.attempt_authority)]);
    expect(result.filter(row => row.status === 'fulfilled')).toHaveLength(1);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(await f.ledger.records()).toHaveLength(1);
    expect((await f.queue.records('unit'))[0].provider_dispatch).toMatchObject({ attempt_id: f.claim.attempt_id, provider_id: 'unit-stub' });
    expect(JSON.stringify(complete.mock.calls)).not.toContain(f.claim.attempt_authority.token);
    expect(await readFile(path.join(f.root, 'role-work-queue.jsonl'), 'utf8')).not.toContain(f.claim.attempt_authority.token);
  });

  it('uses committed canonical lineage when caller mutates its original snapshot during provider await', async () => {
    const f = await fixture();
    let finish!: () => void, started!: () => void;
    const ready = new Promise<void>(resolve => { started = resolve; });
    const wait = new Promise<void>(resolve => { finish = resolve; });
    const execute = evidenceProducingRoleWorkExecutor({ id: 'unit-stub', complete: async ({ task }) => {
      started(); await wait;
      return { ok: true, text: JSON.stringify({ research_question: 'Original question', source_reference: task.role_execution!.receipt_evidence_id!, finding: 'Advisory only', confidence: 0.2 }), evidence_ids: [], usage };
    } }, f.ledger, f.queue);
    const pending = execute(f.claim, f.claim.attempt_authority);
    await ready;
    f.claim.project_id = 'forged-project'; f.claim.role = 'coder'; f.claim.assignment!.namespace = 'forged-scope';
    finish();
    const result = await pending;
    expect(result.research_result?.research_question).toBe('Original question');
    expect((await f.ledger.records())[0]).toMatchObject({ project_id: 'unit', role: 'ux-research', namespace: f.item.assignment!.namespace });
  });

  it('no-response issuance survives a new queue/executor instance and refuses replay', async () => {
    const f = await fixture();
    const complete = vi.fn(async () => ({ ok: false, notes: 'Injected no response; effect unknown', evidence_ids: [], usage }));
    await expect(evidenceProducingRoleWorkExecutor({ id: 'unit-stub', complete }, f.ledger, f.queue)(f.claim, f.claim.attempt_authority)).rejects.toThrow('no response');
    const restartedQueue = new RoleWorkQueue(f.root, new RoleEvidenceLedger(f.root));
    const current = (await restartedQueue.records('unit'))[0];
    await expect(evidenceProducingRoleWorkExecutor({ id: 'unit-stub', complete }, new RoleEvidenceLedger(f.root), restartedQueue)(current, f.claim.attempt_authority)).rejects.toThrow('already issued');
    expect(complete).toHaveBeenCalledTimes(1);
    expect(await f.ledger.records()).toEqual([]);
    expect(current.state).toBe('CLAIMED');
  });

  it.each(['missing', 'wrong', 'stale'])('refuses %s capability before provider or marker', async kind => {
    const f = await fixture(), complete = stub();
    let authority: AttemptAuthority | undefined = f.claim.attempt_authority;
    if (kind === 'missing') authority = undefined;
    if (kind === 'wrong') authority = { ...f.claim.attempt_authority, token: '0'.repeat(64) };
    if (kind === 'stale') { await f.queue.blockAttempt(f.claim.work_id, 'Unit retry', f.claim.attempt_authority); await f.queue.requeueBlocked(f.claim.work_id); await f.queue.claim(f.claim.work_id, 'fixture'); }
    const current = (await f.queue.records('unit'))[0];
    const before = await readFile(path.join(f.root, 'role-work-queue.jsonl'));
    await expect(evidenceProducingRoleWorkExecutor({ id: 'unit-stub', complete }, f.ledger, f.queue)(current, authority)).rejects.toThrow('capability');
    expect(complete).not.toHaveBeenCalled();
    expect(await readFile(path.join(f.root, 'role-work-queue.jsonl'))).toEqual(before);
    expect(current.provider_dispatch).toBeUndefined();
  });

  it('refuses changed selected intent and copied-root capability before provider', async () => {
    const f = await fixture(), complete = stub();
    const tampered = withoutHandle(f.claim); tampered.title = 'Different selected intent';
    await expect(evidenceProducingRoleWorkExecutor({ id: 'unit-stub', complete }, f.ledger, f.queue)(tampered, f.claim.attempt_authority)).rejects.toThrow('stale queue selection');
    const target = await mkdtemp(path.join(os.tmpdir(), 'native-issuance-copy-'));
    await cp(path.join(f.root, 'role-work-queue.jsonl'), path.join(target, 'role-work-queue.jsonl'));
    const queue = new RoleWorkQueue(target, new RoleEvidenceLedger(target));
    const row = (await queue.records('unit'))[0];
    await expect(evidenceProducingRoleWorkExecutor({ id: 'unit-stub', complete }, new RoleEvidenceLedger(target), queue)(row, f.claim.attempt_authority)).rejects.toThrow('capability');
    expect(complete).not.toHaveBeenCalled();
  });

  it('an explicit bounded new claim permits one new issuance while old handle stays invalid', async () => {
    const f = await fixture(), complete = vi.fn(async () => ({ ok: false, notes: 'Injected failure', evidence_ids: [], usage }));
    const execute = evidenceProducingRoleWorkExecutor({ id: 'unit-stub', complete }, f.ledger, f.queue);
    await expect(execute(f.claim, f.claim.attempt_authority)).rejects.toThrow('Injected failure');
    await f.queue.blockAttempt(f.claim.work_id, 'Unit bounded retry; prior effect uncertain', f.claim.attempt_authority);
    await f.queue.requeueBlocked(f.claim.work_id);
    const next = await f.queue.claim(f.claim.work_id, 'fixture');
    expect(next.provider_dispatch).toBeUndefined();
    await expect(execute(next, f.claim.attempt_authority)).rejects.toThrow('capability');
    await expect(execute(next, next.attempt_authority)).rejects.toThrow('Injected failure');
    expect(complete).toHaveBeenCalledTimes(2);
    const histories = (await readFile(path.join(f.root, 'role-work-queue.jsonl'), 'utf8')).trim().split('\n').map(row => JSON.parse(row));
    expect(new Set(histories.filter(row => row.provider_dispatch).map(row => row.provider_dispatch.attempt_id)).size).toBe(2);
  });

  it.each(['null', 'missing fields', 'wrong attempt', 'invalid time', 'empty provider'])('refuses corrupt issuance marker %s without rewriting history', async kind => {
    const f = await fixture();
    const marker = { attempt_id: f.claim.attempt_id!, provider_id: 'unit-stub', issued_at: new Date().toISOString() };
    let invalid: unknown = marker;
    if (kind === 'null') invalid = null;
    if (kind === 'missing fields') invalid = {};
    if (kind === 'wrong attempt') invalid = { ...marker, attempt_id: '00000000-0000-0000-0000-000000000000' };
    if (kind === 'invalid time') invalid = { ...marker, issued_at: 'not-a-date' };
    if (kind === 'empty provider') invalid = { ...marker, provider_id: '' };
    const file = path.join(f.root, 'role-work-queue.jsonl');
    const content = await readFile(file, 'utf8');
    const rows = content.trim().split('\n').map(row => JSON.parse(row));
    rows[rows.length - 1].provider_dispatch = invalid;
    const bytes = rows.map(row => JSON.stringify(row)).join('\n') + '\n';
    await writeFile(file, bytes);
    await expect(f.queue.records('unit')).rejects.toThrow('corrupt provider dispatch');
    expect(await readFile(file, 'utf8')).toBe(bytes);
  });

  it('generic model role wrapper also consumes issuance before failure', async () => {
    const f = await fixture(), complete = vi.fn(async () => ({ ok: false, notes: 'Injected model failure', evidence_ids: [], usage }));
    const execute = modelRoleWorkExecutor({ id: 'unit-model', complete }, f.queue);
    await expect(execute(f.claim, f.claim.attempt_authority)).rejects.toThrow('model failure');
    const current = (await f.queue.records('unit'))[0];
    await expect(execute(current, f.claim.attempt_authority)).rejects.toThrow('already issued');
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('independent processes admit one reservation and committed marker survives SIGKILL before request', async () => {
    const f = await fixture();
    const script = path.join(f.root, 'reserve.mjs');
    const modulePath = path.join(process.cwd(), 'server/aiCompany/roleWorkQueue.ts');
    const ledgerModulePath = path.join(process.cwd(), 'server/aiCompany/roleEvidenceLedger.ts');
    await writeFile(script, `import {readFileSync} from 'node:fs';import{RoleWorkQueue}from ${JSON.stringify(modulePath)};import{RoleEvidenceLedger}from ${JSON.stringify(ledgerModulePath)};const input=JSON.parse(readFileSync(0,'utf8'));const queue=new RoleWorkQueue(input.root,new RoleEvidenceLedger(input.root));try{await queue.reserveProviderDispatch(input.row.work_id,'unit-child',input.authority,input.row);if(input.kill)process.kill(process.pid,'SIGKILL');console.log(JSON.stringify({admitted:true}));}catch(e){console.log(JSON.stringify({admitted:false,error:String(e)}));}`);
    const child = (kill: boolean) => new Promise<{ code: number | null; signal: string | null; output: string }>((resolve, reject) => {
      const processChild = spawn(process.execPath, ['--import', 'tsx', script], { cwd: process.cwd(), stdio: ['pipe', 'pipe', 'pipe'] });
      let output = ''; processChild.stdout.on('data', b => { output += String(b); }); processChild.stderr.resume(); processChild.on('error', reject); processChild.on('close', (code, signal) => resolve({ code, signal, output }));
      processChild.stdin.end(JSON.stringify({ root: f.root, row: withoutHandle(f.claim), authority: f.claim.attempt_authority, kill }));
    });
    const settled = await Promise.all([child(true), child(true)]);
    expect(settled.filter(row => row.signal === 'SIGKILL')).toHaveLength(1);
    expect(settled.filter(row => row.code === 0 && JSON.parse(row.output).admitted === false)).toHaveLength(1);
    const current = (await new RoleWorkQueue(f.root).records('unit'))[0];
    expect(current.provider_dispatch).toMatchObject({ attempt_id: f.claim.attempt_id, provider_id: 'unit-child' });
    await expect(f.queue.reserveProviderDispatch(current.work_id, 'unit-child', f.claim.attempt_authority, current)).rejects.toThrow('already issued');
    expect(await readFile(path.join(f.root, 'role-work-queue.jsonl'), 'utf8')).not.toContain(f.claim.attempt_authority.token);
  });
});
