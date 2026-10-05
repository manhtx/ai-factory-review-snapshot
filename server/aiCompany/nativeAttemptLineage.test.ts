import { recordNativeFixture } from './nativeReceiptTestFixture';
import { expect, it } from 'vitest';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { RoleWorkQueue, type ClaimedRoleWorkItem } from './roleWorkQueue';
import { RoleEvidenceLedger } from './roleEvidenceLedger';
import { evidenceProducingRoleWorkExecutor } from './roleWorkExecutor';

async function fixture() {
  const root=await mkdtemp(path.join(os.tmpdir(),'native-attempt-lineage-'));
  const ledger=new RoleEvidenceLedger(root); const queue=new RoleWorkQueue(root,ledger);
  const item=await queue.create({project_id:'isolated',backlog_id:'B',title:'Isolated lineage; product outcome UNKNOWN',role:'ux-research',namespace:'N',run_id:'R'});
  const claim=await queue.claim(item.work_id,'fixture');
  const record=(work: ClaimedRoleWorkItem=claim) => recordNativeFixture(queue, ledger, {project_id:work.project_id,work_id:work.work_id,attempt_id:work.attempt_id!,role:work.role,namespace:work.assignment!.namespace,run_id:work.assignment!.run_id,provider_id:'unit-stub',model:'unit-stub',output:'Isolated receipt bytes; no provider effect',limitation:'Unit only; outcome UNKNOWN',usage:{input_tokens:0,output_tokens:0,estimated_cost_usd:0}}, work.attempt_authority);
  const complete=(work: ClaimedRoleWorkItem,id:string)=>queue.complete(work.work_id,[id],{research_question:work.title,source_reference:id,finding:'Unit bytes only; outcome UNKNOWN',confidence:.5},undefined,undefined,undefined,undefined,work.attempt_authority);
  return {root,ledger,queue,item,claim,record,complete};
}

it('rejects bound old receipt after reclaim without a queue append, then accepts current receipt',async()=>{
  const f=await fixture(); const old=await f.record();
  await f.queue.blockAttempt(f.item.work_id,'stopped',f.claim.attempt_authority);await f.queue.requeueBlocked(f.item.work_id);
  const next=await f.queue.claim(f.item.work_id,'new-owner');await f.queue.reserveProviderDispatch(next.work_id,'unit-stub',next.attempt_authority,next);await f.queue.submitForReview(f.item.work_id,next.attempt_authority);
  const before=await readFile(path.join(f.root,'role-work-queue.jsonl'));
  await expect(f.complete(next,old.evidence_id)).rejects.toThrow('selected producer attempt');
  expect(await readFile(path.join(f.root,'role-work-queue.jsonl'))).toEqual(before);
  const current=await f.record(next);expect(current.evidence_id).not.toBe(old.evidence_id);
  expect((await f.complete(next,current.evidence_id)).state).toBe('DONE');
});

it('keeps historical unbound receipt bytes but refuses to resolve them',async()=>{
  const f=await fixture();const current=await f.record();const {attempt_id: omitted,...legacy}=current;expect(omitted).toBe(f.claim.attempt_id);
  const file=path.join(f.root,'role-evidence.jsonl');const bytes=JSON.stringify(legacy)+'\n';await writeFile(file,bytes);
  expect(await f.ledger.resolve(legacy.evidence_id)).toBeNull();expect(await readFile(file,'utf8')).toBe(bytes);
  await f.queue.submitForReview(f.item.work_id,f.claim.attempt_authority);
  await expect(f.complete(f.claim,legacy.evidence_id)).rejects.toThrow('cannot be resolved');
});

it('preserves dependency receipt producer attempt instead of assigning the consuming attempt',async()=>{
  const f=await fixture();const source=await f.record();await f.queue.submitForReview(f.item.work_id,f.claim.attempt_authority);await f.complete(f.claim,source.evidence_id);
  const consumer=await f.queue.create({project_id:'isolated',backlog_id:'B',title:'Unit independent input consumption',role:'user-persona',namespace:'N',run_id:'R',depends_on:[f.item.work_id]});
  const current=await f.queue.claim(consumer.work_id,'consumer');await f.queue.submitForReview(consumer.work_id,current.attempt_authority);
  expect(current.attempt_id).not.toBe(f.claim.attempt_id);
  expect((await f.complete(current,source.evidence_id)).state).toBe('DONE');
  expect((await f.ledger.resolve(source.evidence_id))?.attempt_id).toBe(f.claim.attempt_id);
});

it.each(['missing','malformed'])('rejects %s native receipt attempt metadata',async kind=>{
  const f=await fixture();const receipt=await f.record();
  await expect(f.ledger.record({...receipt,namespace:'N',run_id:'R',protocol_status:'RECEIVED',attempt_id:kind==='missing'?undefined as never:'bad'})).rejects.toThrow('claimed attempt_id');
});

it('rejects unclaimed native execution before a provider call or receipt write',async()=>{
  const f=await fixture();let calls=0;
  const execute=evidenceProducingRoleWorkExecutor({id:'unit-stub',complete:async()=>{calls++;throw new Error('must not dispatch');}},f.ledger, f.queue);
  await expect(execute(f.item)).rejects.toThrow('actual claimed attempt');expect(calls).toBe(0);expect(await f.ledger.records()).toEqual([]);
});
