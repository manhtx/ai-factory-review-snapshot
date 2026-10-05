import { mkdtemp, readFile, appendFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { RoleWorkQueue } from '/Users/manhtx/Documents/Macro Research Platform/server/aiCompany/roleWorkQueue.ts';
import { planIndependentReviews, planPreReleaseReviews } from '/Users/manhtx/Documents/Macro Research Platform/server/aiCompany/backlogWorkPlanner.ts';
import { InMemoryEvidenceResolver } from '/Users/manhtx/Documents/Macro Research Platform/server/aiCompany/evidenceResolver.ts';
const verdict={verdict:'PASS',gate:'isolated',summary:'fixture',evidence:['E'],failure_class:'NONE',root_cause:'none',recovery_required:false,recovery_actions:[],unblock_evidence:[],retry_budget:0,next_review_trigger:'fixture',confidence:.5};
const hash=(x)=>createHash('sha256').update(x).digest('hex');
const output=[];
for (const kind of ['missing-assignment','missing-run','blank-namespace','namespace-mismatch','run-mismatch','nonstring-run']) {
 const root=await mkdtemp(path.join(os.tmpdir(),'independent-planner-'));
 const q=new RoleWorkQueue(root);
 let pairs=[];
 for(const role of ['functional-qa','quality-control']) {
  let item=await q.create({project_id:'macro-os',backlog_id:'B:review:'+role,title:'historical isolated fixture',role,run_id:'same',namespace:'same'});
  item={...item,state:'DONE',review_verdict:verdict};
  if(role==='functional-qa') {
   if(kind==='missing-assignment') delete item.assignment;
   if(kind==='missing-run') delete item.assignment.run_id;
   if(kind==='blank-namespace') item.assignment.namespace='   ';
   if(kind==='namespace-mismatch') item.assignment.namespace='other';
   if(kind==='run-mismatch') item.assignment.run_id='other';
   if(kind==='nonstring-run') item.assignment.run_id=12;
  }
  pairs.push(item);
  await appendFile(path.join(root,'role-work-queue.jsonl'),JSON.stringify(item)+'\n');
 }
 const before=await readFile(path.join(root,'role-work-queue.jsonl'));
 let diagnostic='ACCEPTED'; try {await planPreReleaseReviews({projectId:'macro-os',queue:q})} catch(e){diagnostic=e.message;}
 const after=await readFile(path.join(root,'role-work-queue.jsonl'));
 output.push({kind,diagnostic,unchanged_bytes:before.equals(after),before_sha256:hash(before),after_sha256:hash(after)});
}
// Positive completion uses original dependency bytes and actual work binding.
const root=await mkdtemp(path.join(os.tmpdir(),'independent-planner-positive-'));
const resolver=new InMemoryEvidenceResolver(); const q=new RoleWorkQueue(root,resolver);
const item=await q.create({project_id:'macro-os',backlog_id:'B',title:'isolated backend fixture',role:'backend-engineer',namespace:'original',run_id:'original-run'});
const ev=resolver.createEvidence({evidence_id:'E',namespace:item.assignment.namespace,run_id:item.assignment.run_id,produced_by_role:item.role,content:'original isolated bytes'});
resolver.register({...ev,work_id:item.work_id,source_artifact:'isolated fixture'});
const bytesBefore=JSON.stringify(resolver.resolve('E'));
await q.claim(item.work_id,'backend'); await q.submitForReview(item.work_id);
await q.complete(item.work_id,['E'],undefined,undefined,{role:'backend-engineer',files_changed:['fixture.ts'],files_not_changed:[],implementation_summary:'fixture',summary:'fixture',tests_run:['fixture'],tests_failed:[],known_limitations:[],rollback_instruction:'fixture',evidence_ids:['E']});
const reviews=await planIndependentReviews({projectId:'macro-os',queue:q});
for(const r of reviews){await q.claim(r.work_id,r.role);await q.submitForReview(r.work_id);await q.complete(r.work_id,['E'],undefined,verdict);}
const prerelease=await planPreReleaseReviews({projectId:'macro-os',queue:q});
output.push({kind:'legitimate-backend-QA-QC-completion',reviews:reviews.map(r=>({role:r.role,namespace:r.assignment.namespace,run_id:r.assignment.run_id})),terminal:(await q.records()).map(r=>({role:r.role,state:r.state})),prerelease_count:prerelease.length,prerelease_scopes:prerelease.map(r=>[r.assignment.namespace,r.assignment.run_id]),unchanged_evidence:bytesBefore===JSON.stringify(resolver.resolve('E')),evidence_sha256:hash(bytesBefore)});
for (const file of ['server/aiCompany/backlogWorkPlanner.ts','server/aiCompany/backlogWorkPlanner.test.ts','docs/successor-takeover/EVIDENCE_ADMISSION_INVESTIGATION.md'])output.push({file,sha256:hash(await readFile('/Users/manhtx/Documents/Macro Research Platform/'+file))});
console.log(JSON.stringify(output,null,2));
