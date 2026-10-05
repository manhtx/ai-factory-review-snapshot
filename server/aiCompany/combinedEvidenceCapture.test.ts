import { it, expect, vi } from 'vitest';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { RoleWorkQueue } from './roleWorkQueue';
import { RoleEvidenceLedger } from './roleEvidenceLedger';
import { RoleEvidenceResolver } from './roleEvidenceResolver';
import { JsonlEvidenceResolver } from './evidenceResolver';

// Actual temporary claims/issuance/publication; no provider or product effects.
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'combined-capture-'));
  const ledger = new RoleEvidenceLedger(root), resolver = new RoleEvidenceResolver(root), queue = new RoleWorkQueue(root, resolver);
  const prepare = async () => {
    const work = await queue.create({ project_id: 'unit', backlog_id: 'B', title: 'Unit only', role: 'ux-research', namespace: 'N', run_id: 'R' });
    const claim = await queue.claim(work.work_id, 'fixture');
    await queue.reserveProviderDispatch(work.work_id, 'stub', claim.attempt_authority, claim);
    return { claim, input: { project_id: 'unit', work_id: work.work_id, attempt_id: claim.attempt_id!, role: work.role, provider_id: 'stub', model: 'stub', namespace: 'N', run_id: 'R', output: 'Unit only', limitation: 'No actual product effect', usage: { input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0 } } };
  };
  const source = await prepare(), receipt = await ledger.record(source.input, source.claim.attempt_authority);
  await queue.submitForReview(source.claim.work_id, source.claim.attempt_authority);
  const done = await queue.complete(source.claim.work_id, [receipt.evidence_id], { research_question: 'Unit', source_reference: receipt.evidence_id, finding: 'Unit only', confidence: .2 }, undefined, undefined, undefined, undefined, source.claim.attempt_authority);
  return { root, ledger, resolver, queue, done, receipt, other: await prepare(), nativeFile: path.join(root, 'role-evidence.jsonl'), cliFile: path.join(root, 'role-dispatch-evidence.jsonl') };
}

async function duringCapture<T>(read: () => Promise<T>, change: () => Promise<void>): Promise<T> {
  let nativeReady!: () => void, cliReady!: () => void, release!: () => void;
  const nativeCaptured = new Promise<void>(resolve => nativeReady = resolve), cliCaptured = new Promise<void>(resolve => cliReady = resolve), paused = new Promise<void>(resolve => release = resolve);
  const nativeOriginal = RoleEvidenceLedger.prototype.snapshot, cliOriginal = JsonlEvidenceResolver.prototype.snapshot;
  const nativeSpy = vi.spyOn(RoleEvidenceLedger.prototype, 'snapshot').mockImplementation(async function(this: RoleEvidenceLedger) { const snapshot = await nativeOriginal.call(this); nativeReady(); return snapshot; });
  const cliSpy = vi.spyOn(JsonlEvidenceResolver.prototype, 'snapshot').mockImplementation(async function(this: JsonlEvidenceResolver) { const snapshot = await cliOriginal.call(this); cliReady(); await paused; return snapshot; });
  const pending = read();
  // Attach rejection observation before injecting a fault; no unhandled promise.
  const outcome = pending.then(value => ({ value }), error => ({ error }));
  try {
    await Promise.all([nativeCaptured, cliCaptured]);
    await change(); release();
    const result = await outcome;
    if ('error' in result) throw result.error;
    return result.value;
  } finally { release(); nativeSpy.mockRestore(); cliSpy.mockRestore(); }
}

it('combined selected success permits unrelated authorized receipt during capture', async () => {
  const f = await fixture(); expect(await f.queue.currentSuccess(f.done)).toBe(true);
  const before = await readFile(path.join(f.root, 'role-work-queue.jsonl'));
  const success = await duringCapture(() => f.queue.currentSuccess(f.done), async () => { await f.ledger.record(f.other.input, f.other.claim.attempt_authority); });
  expect(success).toBe(true); expect(await f.ledger.resolve(f.receipt.evidence_id)).not.toBeNull(); expect(await f.ledger.records()).toHaveLength(2); expect(await readFile(path.join(f.root, 'role-work-queue.jsonl'))).toEqual(before);
});
it.each(['withdrawal', 'mutation', 'ambiguous'])('direct combined resolution rejects selected %s during capture', async kind => {
  const f = await fixture();
  await expect(duringCapture(() => f.resolver.resolve(f.receipt.evidence_id), async () => {
    if (kind === 'withdrawal') await writeFile(f.nativeFile, '');
    if (kind === 'mutation') await writeFile(f.nativeFile, JSON.stringify({ ...f.receipt, output: 'Changed selected bytes' }) + '\n');
    if (kind === 'ambiguous') await writeFile(f.cliFile, JSON.stringify({ evidence_id: f.receipt.evidence_id, namespace: 'N', run_id: 'R', produced_by_role: f.receipt.role, work_id: f.receipt.work_id, attempt_id: f.receipt.attempt_id, content: 'Foreign fixture bytes', content_hash: createHash('sha256').update('Foreign fixture bytes').digest('hex'), created_at: new Date().toISOString(), source_artifact: 'Unit only' }) + '\n');
  })).rejects.toThrow(/snapshot changed|ambiguous/);
});
it.each(['corrupt', 'duplicate'])('global %s original history denies selected query during capture', async kind => {
  const f = await fixture();
  const result = await duringCapture(() => f.queue.currentSuccess(f.done), async () => { const row = JSON.stringify(f.receipt) + '\n'; await writeFile(f.nativeFile, kind === 'corrupt' ? row + '{invalid}\n' : row + row); });
  expect(result).toBe(false); expect((await f.queue.records()).find(row => row.work_id === f.done.work_id)!.state).toBe('DONE');
});
it.each(['withdrawal', 'mutation', 'ambiguous'])('combined selected success requires revalidation after %s during capture', async kind => {
  const f = await fixture();
  await expect(duringCapture(() => f.queue.currentSuccess(f.done), async () => {
    if (kind === 'withdrawal') await writeFile(f.nativeFile, '');
    if (kind === 'mutation') await writeFile(f.nativeFile, JSON.stringify({ ...f.receipt, output: 'Changed selected bytes' }) + '\n');
    if (kind === 'ambiguous') await writeFile(f.cliFile, JSON.stringify({ evidence_id: f.receipt.evidence_id, namespace: 'N', run_id: 'R', produced_by_role: f.receipt.role, work_id: f.receipt.work_id, attempt_id: f.receipt.attempt_id, content: 'Foreign fixture bytes', content_hash: createHash('sha256').update('Foreign fixture bytes').digest('hex'), created_at: new Date().toISOString(), source_artifact: 'Unit only' }) + '\n');
  })).rejects.toThrow('snapshot changed');
  expect((await f.queue.records()).find(row => row.work_id === f.done.work_id)!.state).toBe('DONE');
});
it('combined full-view guard retains exact-byte invalidation after unrelated publication', async () => {
  const f = await fixture(), snapshot = await f.resolver.snapshot();
  await f.ledger.record(f.other.input, f.other.claim.attempt_authority);
  expect(() => snapshot.assertCurrent()).toThrow('snapshot changed');
  snapshot.assertCurrent([f.receipt.evidence_id]);
});
