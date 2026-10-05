import { recordNativeFixture } from './nativeReceiptTestFixture';
import { expect, it } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { RoleWorkQueue } from './roleWorkQueue';
import { RoleEvidenceLedger } from './roleEvidenceLedger';
import { assertAdminQueueRuntimeRoot, mutateAdminRoleWorkQueue } from './adminWorkQueueTransport';

async function fixture() {
  const root=await mkdtemp(path.join(os.tmpdir(),'admin-attempt-transport-'));
  const ledger=new RoleEvidenceLedger(root); const queue=new RoleWorkQueue(root,ledger);
  const item=await queue.create({project_id:'isolated',backlog_id:'B',title:'Unit native API contract only; product outcome UNKNOWN',role:'ux-research'});
  const claimed=await mutateAdminRoleWorkQueue(queue,{action:'claim',work_id:item.work_id,owner:'admin-fixture'});
  if (claimed.action !== 'claim') throw new Error('claim did not return handle');
  const authority=claimed.item.attempt_authority;
  const receipt=await recordNativeFixture(queue, ledger, {project_id:item.project_id,work_id:item.work_id,attempt_id:authority.attempt_id,role:item.role,namespace:item.assignment!.namespace,run_id:item.assignment!.run_id,provider_id:'unit-stub',model:'unit-stub',output:'Unit actual receipt bytes',limitation:'No product effect',usage:{input_tokens:0,output_tokens:0,estimated_cost_usd:0}}, authority);
  const body={action:'complete',work_id:item.work_id,evidence_ids:[receipt.evidence_id],research_result:{research_question:item.title,source_reference:receipt.evidence_id,finding:'Unit result only',confidence:.5},attempt_authority:authority};
  return {root,queue,item,authority,body};
}

it('transports the returned claim handle and typed contract through native completion without persisting the handle',async()=>{
  const f=await fixture();await mutateAdminRoleWorkQueue(f.queue,{action:'submit-review',work_id:f.item.work_id,attempt_authority:f.authority});
  expect((await mutateAdminRoleWorkQueue(f.queue,f.body)).item.state).toBe('DONE');
  const history=await readFile(path.join(f.root,'role-work-queue.jsonl'),'utf8');expect(history).not.toContain(f.authority.token);expect(history).not.toContain('attempt_authority');
});

it.each(['missing','malformed','wrong-token'])('rejects %s transported submit capability without adopting current claim',async kind=>{
  const f=await fixture();const before=await readFile(path.join(f.root,'role-work-queue.jsonl'));
  const authority=kind==='missing'?undefined:kind==='malformed'?{token:7}:{...f.authority,token:'0'.repeat(64)};
  await expect(mutateAdminRoleWorkQueue(f.queue,{action:'submit-review',work_id:f.item.work_id,attempt_authority:authority})).rejects.toThrow(/attempt authority/);
  expect(await readFile(path.join(f.root,'role-work-queue.jsonl'))).toEqual(before);
});

it('rejects completion without the handle even with a valid current receipt',async()=>{
  const f=await fixture();await mutateAdminRoleWorkQueue(f.queue,{action:'submit-review',work_id:f.item.work_id,attempt_authority:f.authority});const before=await readFile(path.join(f.root,'role-work-queue.jsonl'));
  await expect(mutateAdminRoleWorkQueue(f.queue,{...f.body,attempt_authority:undefined})).rejects.toThrow('attempt authority');
  expect(await readFile(path.join(f.root,'role-work-queue.jsonl'))).toEqual(before);
});

it('refuses mismatched configured native runtime roots',()=>{
  expect(()=>assertAdminQueueRuntimeRoot('/tmp/control/projects/macro-os','/tmp/control')).not.toThrow();
  expect(()=>assertAdminQueueRuntimeRoot('/tmp/other/projects/macro-os','/tmp/control')).toThrow('mutation refused');
});

it('does not adopt a newer claim when a previous caller retries completion',async()=>{
  const f=await fixture();await f.queue.blockAttempt(f.item.work_id,'old caller stopped',f.authority);await f.queue.requeueBlocked(f.item.work_id);
  const current=await mutateAdminRoleWorkQueue(f.queue,{action:'claim',work_id:f.item.work_id,owner:'new-caller'});
  if (current.action !== 'claim') throw new Error('claim did not return handle');
  await mutateAdminRoleWorkQueue(f.queue,{action:'submit-review',work_id:f.item.work_id,attempt_authority:current.item.attempt_authority});
  const before=await readFile(path.join(f.root,'role-work-queue.jsonl'));
  await expect(mutateAdminRoleWorkQueue(f.queue,f.body)).rejects.toThrow('attempt authority');
  expect(await readFile(path.join(f.root,'role-work-queue.jsonl'))).toEqual(before);
});
