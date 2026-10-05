import { recordNativeFixture } from './nativeReceiptTestFixture';
import {mkdtemp,readFile,writeFile,unlink} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {it,expect,vi} from 'vitest';
import {RoleWorkQueue} from './roleWorkQueue';import {evidenceProducingRoleWorkExecutor} from './roleWorkExecutor';import {RoleEvidenceLedger} from './roleEvidenceLedger';
async function fixture(){const root=await mkdtemp(path.join(os.tmpdir(),'current-authority-')),ledger=new RoleEvidenceLedger(root),queue=new RoleWorkQueue(root,ledger);const finish=async(depends_on:string[]=[])=>{const work=await queue.create({project_id:'unit',backlog_id:'UNIT',title:'Advisory unit fixture',role:'ux-research',namespace:'N',run_id:'R',depends_on});const c=await queue.claim(work.work_id,'fixture');const e=await recordNativeFixture(queue, ledger, {project_id:'unit',work_id:work.work_id,attempt_id:c.attempt_id!,role:'ux-research',namespace:'N',run_id:'R',provider_id:'stub',model:'stub',output:'Advisory unit only',limitation:'No real user/product outcome',usage:{input_tokens:0,output_tokens:0,estimated_cost_usd:0}}, c.attempt_authority);await queue.submitForReview(work.work_id,c.attempt_authority);return queue.complete(work.work_id,[e.evidence_id],{research_question:'unit',source_reference:e.evidence_id,finding:'Advisory only',confidence:.2},undefined,undefined,undefined,undefined,c.attempt_authority);};const source=await finish(),consumer=await finish([source.work_id]);return{root,ledger,queue,source,consumer};}
it('healthy evidence supports current dependency authority; missing original receipts revoke it',async()=>{const f=await fixture(),view=await f.queue.currentAuthority('unit');expect(view.isSuccessful(f.consumer)).toBe(true);const child=await f.queue.create({project_id:'unit',backlog_id:'UNIT',title:'Unit only',role:'ux-research',depends_on:[f.consumer.work_id]});const current=await f.queue.currentAuthority('unit');expect(current.dependencySatisfied(child,f.consumer)).toBe(true);await unlink(path.join(f.root,'role-evidence.jsonl'));expect(()=>current.isSuccessful(f.consumer)).toThrow('snapshot changed');const missing=await f.queue.currentAuthority('unit');expect(missing.isSuccessful(f.consumer)).toBe(false);expect(missing.dependencySatisfied(child,f.consumer)).toBe(false);expect((await f.queue.records()).find(row=>row.work_id===f.consumer.work_id)!.state).toBe('DONE');});
it.each(['hash','attempt','age'])('rejects current %s receipt mismatch',async kind=>{const f=await fixture(),file=path.join(f.root,'role-evidence.jsonl'),rows=(await readFile(file,'utf8')).trim().split('\n').map(line=>JSON.parse(line));if(kind==='hash')rows[0].output='Changed';if(kind==='attempt')rows[0].attempt_id='00000000-0000-4000-8000-000000000001';if(kind==='age')rows[0].created_at=new Date(Date.now()-8*24*60*60*1000).toISOString();await writeFile(file,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');const view=await f.queue.currentAuthority();expect(view.isSuccessful(f.consumer)).toBe(false);expect(view.errors.get(f.source.work_id)!.length).toBeGreaterThan(0);});
it('resolver without snapshot cannot silently authorize successful history',async()=>{const f=await fixture(),queue=new RoleWorkQueue(f.root,{resolve:id=>f.ledger.resolve(id)}),view=await queue.currentAuthority();expect(view.isSuccessful(f.consumer)).toBe(false);expect(view.rows).toHaveLength(2);expect(view.errors.get(f.source.work_id)).toContain('current evidence snapshot authority is unavailable');});
it('snapshot preserves internal rows and freshness policy is checked at use time',async()=>{const f=await fixture(),view=await f.queue.currentAuthority();const external=view.rows.find(row=>row.work_id===f.consumer.work_id)!;external.state='QUARANTINED';expect(view.isSuccessful(f.consumer)).toBe(true);const now=Date.now();vi.spyOn(Date,'now').mockReturnValue(now+8*24*60*60*1000);try{expect(view.isSuccessful(f.consumer)).toBe(false);}finally{vi.restoreAllMocks();}await f.queue.quarantine(f.source.work_id,'Unit withdrawal');expect(()=>view.isSuccessful(f.consumer)).toThrow('snapshot changed');});
it.each(['claim','reserve','review','complete'])('missing producer receipt refuses actual %s transition',async phase=>{const f=await fixture(),child=await f.queue.create({project_id:'unit',backlog_id:'CHILD',title:'Advisory unit',role:'ux-research',namespace:'N',run_id:'R',depends_on:[f.consumer.work_id]});const claim=phase==='claim'?undefined:await f.queue.claim(child.work_id,'fixture');let receipt:string|undefined;if(phase==='complete'){const e=await recordNativeFixture(f.queue, f.ledger, {project_id:'unit',work_id:child.work_id,attempt_id:claim!.attempt_id!,role:'ux-research',namespace:'N',run_id:'R',provider_id:'stub',model:'stub',output:'Unit only',limitation:'No actual product outcome',usage:{input_tokens:0,output_tokens:0,estimated_cost_usd:0}}, claim!.attempt_authority);receipt=e.evidence_id;await f.queue.submitForReview(child.work_id,claim!.attempt_authority);}if(phase==='complete'){const file=path.join(f.root,'role-evidence.jsonl'),own=(await readFile(file,'utf8')).trim().split('\n').map(line=>JSON.parse(line)).filter(row=>row.work_id===child.work_id);await writeFile(file,own.map(row=>JSON.stringify(row)).join('\n')+'\n');}else await unlink(path.join(f.root,'role-evidence.jsonl'));const before=await readFile(path.join(f.root,'role-work-queue.jsonl'));const pending=phase==='claim'?f.queue.claim(child.work_id,'fixture'):phase==='reserve'?f.queue.reserveProviderDispatch(child.work_id,'stub',claim!.attempt_authority,claim!):phase==='review'?f.queue.submitForReview(child.work_id,claim!.attempt_authority):f.queue.complete(child.work_id,[receipt!],{research_question:'unit',source_reference:receipt!,finding:'Unit only',confidence:.2},undefined,undefined,undefined,undefined,claim!.attempt_authority);await expect(pending).rejects.toThrow(/evidence/);expect(await readFile(path.join(f.root,'role-work-queue.jsonl'))).toEqual(before);});
it('unrelated queue and evidence append after captured snapshot does not block selected claim',async()=>{const f=await fixture(),child=await f.queue.create({project_id:'unit',backlog_id:'CHILD',title:'Unit only',role:'ux-research',depends_on:[f.consumer.work_id]});const queue=new RoleWorkQueue(f.root,{resolve:id=>f.ledger.resolve(id),snapshot:async()=>{const captured=await f.ledger.snapshot();const unrelated=await f.queue.create({project_id:'unit',backlog_id:'OTHER',title:'Unrelated unit',role:'ux-research',namespace:'N',run_id:'R'}),handle=await f.queue.claim(unrelated.work_id,'fixture');await recordNativeFixture(f.queue,f.ledger,{project_id:'unit',work_id:unrelated.work_id,attempt_id:handle.attempt_id!,role:'ux-research',namespace:'N',run_id:'R',provider_id:'stub',model:'stub',output:'Unrelated advisory receipt',limitation:'Not company or product work',usage:{input_tokens:0,output_tokens:0,estimated_cost_usd:0}},handle.attempt_authority);return captured;}});expect((await queue.claim(child.work_id,'fixture')).state).toBe('CLAIMED');});
it('selected receipt changed after snapshot refuses locked admission',async()=>{const f=await fixture(),child=await f.queue.create({project_id:'unit',backlog_id:'CHILD',title:'Unit only',role:'ux-research',depends_on:[f.consumer.work_id]});const file=path.join(f.root,'role-evidence.jsonl');const queue=new RoleWorkQueue(f.root,{resolve:id=>f.ledger.resolve(id),snapshot:async()=>{const captured=await f.ledger.snapshot();const rows=(await readFile(file,'utf8')).trim().split('\n').map(line=>JSON.parse(line));rows[0].output='Changed after capture';await writeFile(file,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');return captured;}});const before=await readFile(path.join(f.root,'role-work-queue.jsonl'));await expect(queue.claim(child.work_id,'fixture')).rejects.toThrow('selected evidence snapshot changed');expect(await readFile(path.join(f.root,'role-work-queue.jsonl'))).toEqual(before);});
it('two healthy independent terminal commits share producer without blocking each other',async()=>{const f=await fixture();const prepare=async()=>{const item=await f.queue.create({project_id:'unit',backlog_id:'LEAF',title:'Unit advisory',role:'ux-research',namespace:'N',run_id:'R',depends_on:[f.consumer.work_id]}),claim=await f.queue.claim(item.work_id,'fixture');const e=await recordNativeFixture(f.queue, f.ledger, {project_id:'unit',work_id:item.work_id,attempt_id:claim.attempt_id!,role:'ux-research',namespace:'N',run_id:'R',provider_id:'stub',model:'stub',output:'Unit advisory',limitation:'No outcome proof',usage:{input_tokens:0,output_tokens:0,estimated_cost_usd:0}}, claim.attempt_authority);await f.queue.submitForReview(item.work_id,claim.attempt_authority);return()=>f.queue.complete(item.work_id,[e.evidence_id],{research_question:'unit',source_reference:e.evidence_id,finding:'Unit only',confidence:.2},undefined,undefined,undefined,undefined,claim.attempt_authority);};const a=await prepare(),b=await prepare();expect((await Promise.all([a(),b()])).map(row=>row.state)).toEqual(['DONE','DONE']);});

it('unsupported snapshot resolver refuses native provider before call or issuance',async()=>{
 const f=await fixture(),queue=new RoleWorkQueue(f.root,{resolve:id=>f.ledger.resolve(id)}),item=await queue.create({project_id:'unit',backlog_id:'ROOT',title:'Unit only',role:'ux-research'}),claim=await queue.claim(item.work_id,'fixture');
 const complete=vi.fn();const execute=evidenceProducingRoleWorkExecutor({id:'stub',complete},f.ledger,queue);const before=await readFile(path.join(f.root,'role-work-queue.jsonl'));await expect(execute(claim,claim.attempt_authority)).rejects.toThrow('consistent evidence snapshot capability');expect(complete).not.toHaveBeenCalled();expect(await readFile(path.join(f.root,'role-work-queue.jsonl'))).toEqual(before);expect((await queue.records()).find(row=>row.work_id===item.work_id)!.provider_dispatch).toBeUndefined();
});

it('configured but unavailable snapshot refuses provider before issuance',async()=>{
 const f=await fixture(),queue=new RoleWorkQueue(f.root,{resolve:id=>f.ledger.resolve(id),snapshot(){throw new Error('snapshot inspection unavailable');}}),item=await queue.create({project_id:'unit',backlog_id:'ROOT',title:'Unit only',role:'ux-research'}),claim=await queue.claim(item.work_id,'fixture'),complete=vi.fn();const execute=evidenceProducingRoleWorkExecutor({id:'stub',complete},f.ledger,queue),before=await readFile(path.join(f.root,'role-work-queue.jsonl'));await expect(execute(claim,claim.attempt_authority)).rejects.toThrow('snapshot inspection unavailable');expect(complete).not.toHaveBeenCalled();expect(await readFile(path.join(f.root,'role-work-queue.jsonl'))).toEqual(before);
});

it('selected current success reads without rewriting or creating queue bytes', async () => {
 const f=await fixture(),{stat}=await import('node:fs/promises'),file=path.join(f.root,'role-work-queue.jsonl');
 const before=await stat(file),bytes=await readFile(file);
 expect(await f.queue.currentSuccess(f.consumer)).toBe(true);
 const after=await stat(file);expect(await readFile(file)).toEqual(bytes);expect(after.ino).toBe(before.ino);expect(after.mtimeMs).toBe(before.mtimeMs);
 const {withQueueMutationGate}=await import('./queueMutationGate'),empty=await mkdtemp(path.join(os.tmpdir(),'selected-read-empty-'));
 expect(await withQueueMutationGate(empty,bytes=>({value:bytes.length}))).toBe(0);
 await expect(readFile(path.join(empty,'role-work-queue.jsonl'))).rejects.toMatchObject({code:'ENOENT'});
});
it('selected current success permits unrelated valid queue and receipt appends during capture', async () => {
 const f=await fixture();
 const queue=new RoleWorkQueue(f.root,{resolve:id=>f.ledger.resolve(id),snapshot:async()=>{
  const captured=await f.ledger.snapshot();
  const unrelated=await f.queue.create({project_id:'unit',backlog_id:'OTHER',title:'Unrelated fixture',role:'ux-research',namespace:'N',run_id:'R'}),handle=await f.queue.claim(unrelated.work_id,'fixture');
  await recordNativeFixture(f.queue,f.ledger,{project_id:'unit',work_id:unrelated.work_id,attempt_id:handle.attempt_id!,role:'ux-research',namespace:'N',run_id:'R',provider_id:'stub',model:'stub',output:'Unrelated fixture',limitation:'No product evidence',usage:{input_tokens:0,output_tokens:0,estimated_cost_usd:0}},handle.attempt_authority);
  return captured;
 }});
 expect(await queue.currentSuccess(f.consumer)).toBe(true);
});
it('selected current success rejects changed receipt during capture', async () => {
 const f=await fixture(),file=path.join(f.root,'role-evidence.jsonl');
 const queue=new RoleWorkQueue(f.root,{resolve:id=>f.ledger.resolve(id),snapshot:async()=>{
  const captured=await f.ledger.snapshot(),rows=(await readFile(file,'utf8')).trim().split('\n').map(line=>JSON.parse(line));rows[0].output='Changed selected receipt';await writeFile(file,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');return captured;
 }});
 await expect(queue.currentSuccess(f.consumer)).rejects.toThrow('selected evidence snapshot changed');
});
it('selected current success denies missing receipts, unavailable snapshots and stale or foreign selections', async () => {
 const f=await fixture();
 expect(await f.queue.currentSuccess({...f.consumer,project_id:'foreign'})).toBe(false);
 expect(await new RoleWorkQueue(f.root,{resolve:id=>f.ledger.resolve(id)}).currentSuccess(f.consumer)).toBe(false);
 expect(await new RoleWorkQueue(f.root,{resolve:id=>f.ledger.resolve(id),snapshot(){throw new Error('Unavailable');}}).currentSuccess(f.consumer)).toBe(false);
 await f.queue.quarantine(f.source.work_id,'Unit withdrawal');expect(await f.queue.currentSuccess(f.consumer)).toBe(false);
 await unlink(path.join(f.root,'role-evidence.jsonl'));expect(await f.queue.currentSuccess(f.consumer)).toBe(false);
 expect((await f.queue.records()).find(row=>row.work_id===f.consumer.work_id)!.state).toBe('DONE');
});
it('concurrent selected terminal queries tolerate independent healthy completions', async () => {
 const f=await fixture();
 const prepare=async()=>{
  const work=await f.queue.create({project_id:'unit',backlog_id:'LEAF',title:'Unit',role:'ux-research',namespace:'N',run_id:'R',depends_on:[f.consumer.work_id]}),claim=await f.queue.claim(work.work_id,'fixture');
  const receipt=await recordNativeFixture(f.queue, f.ledger, {project_id:'unit',work_id:work.work_id,attempt_id:claim.attempt_id!,role:work.role,namespace:'N',run_id:'R',provider_id:'stub',model:'stub',output:'Unit',limitation:'No product outcome',usage:{input_tokens:0,output_tokens:0,estimated_cost_usd:0}}, claim.attempt_authority);
  await f.queue.submitForReview(work.work_id,claim.attempt_authority);
  return async()=>{const done=await f.queue.complete(work.work_id,[receipt.evidence_id],{research_question:'Unit',source_reference:receipt.evidence_id,finding:'Unit',confidence:.2},undefined,undefined,undefined,undefined,claim.attempt_authority);return f.queue.currentSuccess(done);};
 };
 const a=await prepare(),b=await prepare();expect(await Promise.all([a(),b()])).toEqual([true,true]);
});

it('receipt loss after terminal commit requests revalidation without blocking committed history', async () => {
 const f=await fixture(),{executeReadyRoleWork}=await import('./roleWorkExecutor');
 await f.queue.create({project_id:'unit',backlog_id:'LEAF',title:'Unit',role:'ux-research',namespace:'N',run_id:'R',depends_on:[f.consumer.work_id]});
 const original=f.queue.complete.bind(f.queue),block=vi.spyOn(f.queue,'blockAttempt');
 vi.spyOn(f.queue,'complete').mockImplementation(async(...args)=>{const done=await original(...args);await unlink(path.join(f.root,'role-evidence.jsonl'));return done;});
 const execute=evidenceProducingRoleWorkExecutor({id:'stub',complete:async({task})=>({ok:true,text:JSON.stringify({research_question:'Unit',source_reference:task.role_execution!.receipt_evidence_id!,finding:'Unit only',confidence:.2}),evidence_ids:[],usage:{input_tokens:0,output_tokens:0,estimated_cost_usd:0}})},f.ledger,f.queue);
 await expect(executeReadyRoleWork({projectId:'unit',queue:f.queue,execute})).rejects.toThrow('TERMINAL_REVALIDATION_REQUIRED');
 expect(block).not.toHaveBeenCalled();expect((await f.queue.records('unit')).find(row=>row.backlog_id==='LEAF')!.state).toBe('DONE');
});

it('selected dependency query checks original receipts and exact work/dependency identities', async () => {
 const f=await fixture(),work=await f.queue.create({project_id:'unit',backlog_id:'READY',title:'Unit',role:'ux-research',depends_on:[f.consumer.work_id]});
 expect(await f.queue.currentDependencySatisfied(work,f.consumer)).toBe(true);
 expect(await f.queue.currentDependencySatisfied({...work,project_id:'foreign'},f.consumer)).toBe(false);
 expect(await f.queue.currentDependencySatisfied(work,{...f.consumer,project_id:'foreign'})).toBe(false);
 expect(await f.queue.currentDependencySatisfied(work,undefined)).toBe(false);
 await unlink(path.join(f.root,'role-evidence.jsonl'));
 expect(await f.queue.currentDependencySatisfied(work,f.consumer)).toBe(false);
 expect((await f.queue.records()).find(row=>row.work_id===work.work_id)!.state).toBe('READY');
});
