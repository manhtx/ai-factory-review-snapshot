import { mkdtemp, appendFile, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { RoleWorkQueue, roleDependencySatisfied, isSuccessfulRoleWork } from '/Users/manhtx/Documents/Macro Research Platform/server/aiCompany/roleWorkQueue.ts';
import { InMemoryEvidenceResolver } from '/Users/manhtx/Documents/Macro Research Platform/server/aiCompany/evidenceResolver.ts';
import { executeReadyRoleWork } from '/Users/manhtx/Documents/Macro Research Platform/server/aiCompany/roleWorkExecutor.ts';
import { runAutonomousWorkflow } from '/Users/manhtx/Documents/Macro Research Platform/server/aiCompany/autonomousCoordinator.ts';
const outputs:any[]=[];
async function fixture() {
 const root=await mkdtemp(path.join(os.tmpdir(),'independent-terminal-review-'));const resolver=new InMemoryEvidenceResolver();const q=new RoleWorkQueue(root,resolver);
 const src=await q.create({project_id:'fixture',backlog_id:'source',title:'source',role:'user-persona',run_id:'R',namespace:'N'});
 resolver.register({...resolver.createEvidence({evidence_id:'E',namespace:'N',run_id:'R',produced_by_role:src.role,content:'isolated fixture'}),work_id:src.work_id,source_artifact:'/tmp/independent-terminal-review.mts'});
 await q.claim(src.work_id,'fixture');await q.submitForReview(src.work_id);await q.complete(src.work_id,['E'],{research_question:'fixture',source_reference:'E',finding:'fixture',confidence:.5});
 const r=await q.create({project_id:'fixture',backlog_id:'review',title:'review',role:'functional-qa',run_id:'R',namespace:'N',depends_on:[src.work_id]});
 const v={verdict:'HOLD',gate:'fixture',summary:'fixture',evidence:['E'],failure_class:'INSUFFICIENT_EVIDENCE',root_cause:'fixture',recovery_required:false,recovery_actions:[],unblock_evidence:[],retry_budget:0,next_review_trigger:'fixture',confidence:.5} as const;
 await q.claim(r.work_id,'fixture');await q.submitForReview(r.work_id);const failed=await q.complete(r.work_id,['E'],undefined,v as any);
 const make=(extra:any={})=>q.create({project_id:'fixture',backlog_id:'correction',title:'correction',role:'sre',run_id:'R',namespace:'N',depends_on:[r.work_id],recovery_source_work_id:r.work_id,...extra});return {root,q,resolver,src,r,failed,make};
}
{
 const f=await fixture();for(const [kind,extra] of [['wrongRun',{run_id:'X'}],['wrongNamespace',{namespace:'X'}],['wrongProject',{project_id:'X'}],['wrongSource',{depends_on:[f.r.work_id,f.src.work_id],recovery_source_work_id:f.src.work_id}],['ordinary',{recovery_source_work_id:undefined}] ] as any){const w=await f.make(extra);await assert.rejects(f.q.claim(w.work_id,'fixture'));outputs.push({kind,denied:true});}
 await assert.rejects(f.make({recovery_source_work_id:'MISSING'}));outputs.push({kind:'undeclaredSource',denied:true});
 const correction=await f.make();assert.equal(roleDependencySatisfied(correction,f.failed),true);await f.q.claim(correction.work_id,'fixture');outputs.push({kind:'validCorrection',claimed:true,sourceSuccess:isSuccessfulRoleWork(f.failed)});
 await appendFile(path.join(f.root,'role-work-queue.jsonl'),JSON.stringify({...f.failed,state:'DONE'})+'\n');const ordinary=await f.make({recovery_source_work_id:undefined});await assert.rejects(f.q.claim(ordinary.work_id,'fixture'));outputs.push({kind:'legacyDONEHOLD',ordinaryDenied:true});
}
{
 const f=await fixture();const correction=await f.make();assert.equal(roleDependencySatisfied(correction,f.failed),true);
 const quarantined=await f.q.reconcileOrphanedReady('fixture');const stored=(await f.q.records()).find(x=>x.work_id===correction.work_id)!;
 outputs.push({kind:'reconcileCounterexampleRepaired',predicateBefore:true,stateAfter:stored.state,quarantined:quarantined.map(x=>x.work_id),root:f.root});assert.equal(stored.state,'READY');assert.equal(quarantined.length,0);await f.q.claim(correction.work_id,'fixture');
}
for(const dispatch of ['wave','coordinator']) {
 const f=await fixture();await f.make();const ordinary=await f.make({recovery_source_work_id:undefined});let calls=0;
 const execute=async(item:any)=>{calls++;const id='FIX';f.resolver.register({...f.resolver.createEvidence({evidence_id:id,namespace:'N',run_id:'R',produced_by_role:'sre',content:'isolated correction'}),work_id:item.work_id,source_artifact:'/tmp/independent-terminal-review.mts'});return {evidence_ids:[id],research_result:{research_question:'fixture',source_reference:id,finding:'fixture',confidence:.5}};};
 const result=dispatch==='wave'?await executeReadyRoleWork({projectId:'fixture',queue:f.q,execute}):await runAutonomousWorkflow({projectId:'fixture',runId:'R',namespace:'N',queue:f.q,execute});assert.equal(calls,1);assert.equal(result.completed.length,1);assert.ok(!(result as any).status||(result as any).status==='TERMINAL_HOLD');outputs.push({kind:dispatch,calls,completed:result.completed.length,status:(result as any).status,ordinaryState:(await f.q.records()).find(x=>x.work_id===ordinary.work_id)!.state});
}
{
const root=await mkdtemp(path.join(os.tmpdir(),'independent-terminal-empty-'));const result=await runAutonomousWorkflow({queue:new RoleWorkQueue(root,new InMemoryEvidenceResolver()),projectId:'fixture',runId:'R',namespace:'N',execute:async()=>{throw Error('must not run')}});assert.equal(result.status,'TERMINAL_HOLD');outputs.push({kind:'emptyWorkflow',status:result.status});
}
for(const file of ['roleWorkQueue.ts','roleWorkExecutor.ts','autonomousCoordinator.ts','backlogWorkPlanner.ts','recoveryCoordinator.ts','reviewTerminalAdmission.test.ts','autonomousCoordinator.test.ts','assignmentEnvelope.ts','assignmentEnvelope.test.ts'])outputs.push({file,sha256:createHash('sha256').update(await readFile('/Users/manhtx/Documents/Macro Research Platform/server/aiCompany/'+file)).digest('hex')});
await writeFile('/tmp/independent-terminal-rereview-result.json',JSON.stringify(outputs,null,2));console.log(JSON.stringify(outputs,null,2));
