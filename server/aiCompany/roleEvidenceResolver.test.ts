import { recordNativeFixture } from './nativeReceiptTestFixture';
import { expect,it } from 'vitest';
import { mkdtemp,writeFile,readFile } from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';import {createHash}from'node:crypto';
import {RoleEvidenceResolver}from'./roleEvidenceResolver';import {RoleEvidenceLedger}from'./roleEvidenceLedger';import{RoleWorkQueue}from'./roleWorkQueue';
async function fixture(){
 const root=await mkdtemp(path.join(os.tmpdir(),'original-provider-evidence-'));const resolver=new RoleEvidenceResolver(root),ledger=new RoleEvidenceLedger(root),queue=new RoleWorkQueue(root,resolver);
 const item=await queue.create({project_id:'isolated',backlog_id:'B',title:'Isolated original bytes only',role:'ux-research'});const claimed=await queue.claim(item.work_id,'fixture');
 const native=await recordNativeFixture(queue, ledger, {project_id:item.project_id,work_id:item.work_id,attempt_id:claimed.attempt_id!,namespace:item.assignment!.namespace,run_id:item.assignment!.run_id,role:item.role,provider_id:'unit-stub',model:'unit-stub',output:'Actual unit native bytes',limitation:'No product effect',usage:{input_tokens:0,output_tokens:0,estimated_cost_usd:0}}, claimed.attempt_authority);
 const cli={evidence_id:'CLI-UNIT',namespace:item.assignment!.namespace,run_id:item.assignment!.run_id,produced_by_role:item.role,work_id:item.work_id,attempt_id:claimed.attempt_id,content:'Actual unit CLI bytes',content_hash:createHash('sha256').update('Actual unit CLI bytes').digest('hex'),source_artifact:'unit-stub-output',created_at:new Date().toISOString()};
 const file=path.join(root,'role-dispatch-evidence.jsonl');return{root,resolver,ledger,queue,item,claimed,native,cli,file};
}
it('reads native and CLI original scopes without copying or relabeling either store',async()=>{
 const f=await fixture();const bytes=JSON.stringify(f.cli)+'\n';await writeFile(f.file,bytes);
 expect(await f.resolver.resolve(f.native.evidence_id)).toMatchObject({work_id:f.item.work_id,attempt_id:f.claimed.attempt_id,evidence_kind:'PROVIDER_OUTPUT'});
 expect(await f.resolver.resolve(f.cli.evidence_id)).toEqual({...f.cli,evidence_kind:'PROVIDER_OUTPUT'});expect(await readFile(f.file,'utf8')).toBe(bytes);
});
it('preserves legacy CLI receipt bytes but does not resolve unbound output',async()=>{
 const f=await fixture();const {attempt_id:omitted,...legacy}=f.cli;expect(omitted).toBe(f.claimed.attempt_id);const bytes=JSON.stringify(legacy)+'\n';await writeFile(f.file,bytes);
 expect(await f.resolver.resolve(legacy.evidence_id)).toBeNull();expect(await readFile(f.file,'utf8')).toBe(bytes);
});
it('refuses a cross-store duplicate identity rather than choosing a preferred source',async()=>{
 const f=await fixture();await writeFile(f.file,JSON.stringify({...f.cli,evidence_id:f.native.evidence_id})+'\n');await expect(f.resolver.resolve(f.native.evidence_id)).rejects.toThrow('both stores');
});
it('refuses a duplicate identity inside the CLI store',async()=>{
 const f=await fixture();await writeFile(f.file,(JSON.stringify(f.cli)+'\n').repeat(2));await expect(f.resolver.resolve(f.cli.evidence_id)).rejects.toThrow('duplicated');
});
it('does not hide corruption in another producer store as successful native lookup',async()=>{
 const f=await fixture();await writeFile(f.file,'{bad}\n');await expect(f.resolver.resolve(f.native.evidence_id)).rejects.toThrow('corrupt evidence ledger');
});
it('rejects a CLI receipt from the stopped attempt with current capability and no queue append',async()=>{
 const f=await fixture();await writeFile(f.file,JSON.stringify(f.cli)+'\n');await f.queue.blockAttempt(f.item.work_id,'stopped',f.claimed.attempt_authority);await f.queue.requeueBlocked(f.item.work_id);
 const current=await f.queue.claim(f.item.work_id,'current');await f.queue.submitForReview(f.item.work_id,current.attempt_authority);const before=await readFile(path.join(f.root,'role-work-queue.jsonl'));
 await expect(f.queue.complete(f.item.work_id,[f.cli.evidence_id],{research_question:f.item.title,source_reference:f.cli.evidence_id,finding:'Unit only',confidence:.5},undefined,undefined,undefined,undefined,current.attempt_authority)).rejects.toThrow('selected producer attempt');expect(await readFile(path.join(f.root,'role-work-queue.jsonl'))).toEqual(before);
});

it.each(['CLI-unbound','native-unbound'] as const)('rejects cross-store ambiguity even when the %s record is historical unresolved',async kind=>{
 const f=await fixture();const {attempt_id:omitted,...legacy}=kind==='CLI-unbound'?f.cli:f.native;expect(omitted).toBe(f.claimed.attempt_id);
 if(kind==='CLI-unbound')await writeFile(f.file,JSON.stringify({...legacy,evidence_id:f.native.evidence_id})+'\n');
 else {await writeFile(path.join(f.root,'role-evidence.jsonl'),JSON.stringify(legacy)+'\n');await writeFile(f.file,JSON.stringify({...f.cli,evidence_id:f.native.evidence_id})+'\n');}
 await expect(f.resolver.resolve(f.native.evidence_id)).rejects.toThrow('both stores');
});
