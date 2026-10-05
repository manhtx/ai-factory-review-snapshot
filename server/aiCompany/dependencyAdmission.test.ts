import { recordNativeFixture } from './nativeReceiptTestFixture';
import {mkdtemp,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {it,expect,vi} from 'vitest';
import {RoleWorkQueue,type AttemptAuthority} from './roleWorkQueue';
import {RoleEvidenceLedger} from './roleEvidenceLedger';
import {evidenceProducingRoleWorkExecutor} from './roleWorkExecutor';

const usage={input_tokens:0,output_tokens:0,estimated_cost_usd:0};
const research=(id:string)=>({research_question:'Unit only',source_reference:id,finding:'Advisory fixture; outcome unknown',confidence:0.2});
async function fixture(prepareReceipt=true){
 const root=await mkdtemp(path.join(os.tmpdir(),'dependency-admission-'));const ledger=new RoleEvidenceLedger(root),queue=new RoleWorkQueue(root,ledger);
 const source=await queue.create({project_id:'unit',backlog_id:'B',title:'Unit producer only',role:'ux-research',namespace:'N',run_id:'R'});
 const sourceClaim=await queue.claim(source.work_id,'fixture');
 const record=(work_id:string,attempt_id:string,authority:AttemptAuthority)=>recordNativeFixture(queue,ledger,{project_id:'unit',work_id,attempt_id,role:'ux-research',provider_id:'fixture',model:'stub',output:'Unit advisory only',limitation:'Not product evidence',namespace:'N',run_id:'R',usage},authority);
 const evidence=await record(source.work_id,sourceClaim.attempt_id!,sourceClaim.attempt_authority);await queue.submitForReview(source.work_id,sourceClaim.attempt_authority);await queue.complete(source.work_id,[evidence.evidence_id],research(evidence.evidence_id),undefined,undefined,undefined,undefined,sourceClaim.attempt_authority);
 const consumer=await queue.create({project_id:'unit',backlog_id:'B',title:'Unit consumer only',role:'ux-research',namespace:'N',run_id:'R',depends_on:[source.work_id]});const claim=await queue.claim(consumer.work_id,'fixture');const receipt=prepareReceipt?await record(consumer.work_id,claim.attempt_id!,claim.attempt_authority):undefined;
 const withdraw=async()=>{const selected=(await queue.records()).find(row=>row.work_id===source.work_id)!;await queue.quarantine(source.work_id,'Unit explicit dependency withdrawal',selected);};
 return{root,ledger,queue,source,claim,receipt,withdraw};
}
it.each(['dispatch','review','terminal'])('refuses dependency withdrawn before %s without transition',async phase=>{
 const f=await fixture(phase!=='dispatch');if(phase==='terminal')await f.queue.submitForReview(f.claim.work_id,f.claim.attempt_authority);await f.withdraw();const before=await readFile(path.join(f.root,'role-work-queue.jsonl'));
 const complete=vi.fn(async({task})=>({ok:true,text:JSON.stringify(research(task.role_execution.receipt_evidence_id)),evidence_ids:[],usage}));
 const promise=phase==='dispatch'?evidenceProducingRoleWorkExecutor({id:'stub',complete},f.ledger,f.queue)(f.claim,f.claim.attempt_authority):phase==='review'?f.queue.submitForReview(f.claim.work_id,f.claim.attempt_authority):f.queue.complete(f.claim.work_id,[f.receipt!.evidence_id],research(f.receipt!.evidence_id),undefined,undefined,undefined,undefined,f.claim.attempt_authority);
 await expect(promise).rejects.toThrow('dependencies are not complete');expect(complete).not.toHaveBeenCalled();expect(await readFile(path.join(f.root,'role-work-queue.jsonl'))).toEqual(before);
});
it('valid dependency still authorizes dispatch and terminal admission',async()=>{
 const f=await fixture(false);const execute=evidenceProducingRoleWorkExecutor({id:'stub',complete:async({task})=>({ok:true,text:JSON.stringify(research(task.role_execution!.receipt_evidence_id!)),evidence_ids:[],usage})},f.ledger,f.queue);const result=await execute(f.claim,f.claim.attempt_authority);await f.queue.submitForReview(f.claim.work_id,f.claim.attempt_authority);expect((await f.queue.complete(f.claim.work_id,result.evidence_ids,result.research_result,undefined,undefined,undefined,undefined,f.claim.attempt_authority)).state).toBe('DONE');
});
it('withdrawal while evidence resolution is pending refuses terminal CAS',async()=>{
 const f=await fixture();await f.queue.submitForReview(f.claim.work_id,f.claim.attempt_authority);let release!:()=>void,entered!:()=>void;const ready=new Promise<void>(r=>entered=r),waiting=new Promise<void>(r=>release=r);
 const queue=new RoleWorkQueue(f.root,{snapshot:()=>f.ledger.snapshot(),resolve:async id=>{entered();await waiting;return f.ledger.resolve(id);}});
 const pending=queue.complete(f.claim.work_id,[f.receipt!.evidence_id],research(f.receipt!.evidence_id),undefined,undefined,undefined,undefined,f.claim.attempt_authority);await ready;await f.withdraw();release();await expect(pending).rejects.toThrow('stale queue mutation');expect((await f.queue.records()).find(row=>row.work_id===f.claim.work_id)!.state).toBe('IN_REVIEW');
});

it('indirect withdrawal during evidence resolution refuses terminal commit',async()=>{
 const f=await fixture();await f.queue.submitForReview(f.claim.work_id,f.claim.attempt_authority);await f.queue.complete(f.claim.work_id,[f.receipt!.evidence_id],research(f.receipt!.evidence_id),undefined,undefined,undefined,undefined,f.claim.attempt_authority);
 const leaf=await f.queue.create({project_id:'unit',backlog_id:'B',title:'Unit leaf only',role:'ux-research',namespace:'N',run_id:'R',depends_on:[f.claim.work_id]});const claim=await f.queue.claim(leaf.work_id,'fixture');const receipt=await recordNativeFixture(f.queue, f.ledger, {project_id:'unit',work_id:leaf.work_id,attempt_id:claim.attempt_id!,role:'ux-research',provider_id:'fixture',model:'stub',output:'Unit leaf only',limitation:'Not product evidence',namespace:'N',run_id:'R',usage}, claim.attempt_authority);await f.queue.submitForReview(leaf.work_id,claim.attempt_authority);
 let release!:()=>void,entered!:()=>void;const ready=new Promise<void>(r=>entered=r),waiting=new Promise<void>(r=>release=r);const queue=new RoleWorkQueue(f.root,{snapshot:()=>f.ledger.snapshot(),resolve:async id=>{entered();await waiting;return f.ledger.resolve(id);}});
 const middleBefore=(await f.queue.records()).find(row=>row.work_id===f.claim.work_id);const pending=queue.complete(leaf.work_id,[receipt.evidence_id],research(receipt.evidence_id),undefined,undefined,undefined,undefined,claim.attempt_authority);await ready;await f.withdraw();const before=await readFile(path.join(f.root,'role-work-queue.jsonl'));release();await expect(pending).rejects.toThrow('dependencies are not complete');const rows=await f.queue.records();expect(rows.find(row=>row.work_id===leaf.work_id)!.state).toBe('IN_REVIEW');expect(rows.find(row=>row.work_id===f.claim.work_id)).toEqual(middleBefore);expect(await readFile(path.join(f.root,'role-work-queue.jsonl'))).toEqual(before);
});
