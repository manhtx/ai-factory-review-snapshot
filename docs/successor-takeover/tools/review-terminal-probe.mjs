import { mkdtemp,readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';import path from 'node:path';
import { RoleWorkQueue } from '/Users/manhtx/Documents/Macro Research Platform/server/aiCompany/roleWorkQueue.ts';
import { InMemoryEvidenceResolver } from '/Users/manhtx/Documents/Macro Research Platform/server/aiCompany/evidenceResolver.ts';
const root=await mkdtemp(path.join(os.tmpdir(),'review-terminal-probe-'));
const resolver=new InMemoryEvidenceResolver();const q=new RoleWorkQueue(root,resolver);
const source=await q.create({project_id:'macro-os',backlog_id:'ISOLATED',title:'isolated dependency fixture',role:'user-persona',namespace:'fixture',run_id:'fixture-run'});
const ev=resolver.createEvidence({evidence_id:'FIXTURE:SOURCE',namespace:'fixture',run_id:'fixture-run',produced_by_role:'user-persona',content:'Isolated evidence; no product or provider effects.'});resolver.register({...ev,work_id:source.work_id,source_artifact:'isolated-probe'});
await q.claim(source.work_id,'fixture');await q.submitForReview(source.work_id);await q.complete(source.work_id,[ev.evidence_id],{research_question:'fixture',source_reference:ev.evidence_id,finding:'fixture',confidence:.5});
const review=await q.create({project_id:'macro-os',backlog_id:'ISOLATED-review',title:'isolated HOLD review',role:'functional-qa',namespace:'fixture',run_id:'fixture-run',depends_on:[source.work_id]});
await q.claim(review.work_id,'fixture');await q.submitForReview(review.work_id);
const verdict={verdict:'HOLD',gate:'fixture',summary:'insufficient evidence',evidence:[ev.evidence_id],failure_class:'INSUFFICIENT_EVIDENCE',root_cause:'missing actual outcome',recovery_required:false,recovery_actions:[],unblock_evidence:[],retry_budget:0,next_review_trigger:'outcome recorded',confidence:.5};
const result=await q.complete(review.work_id,[ev.evidence_id],undefined,verdict);
const downstream=await q.create({project_id:'macro-os',backlog_id:'ISOLATED-downstream',title:'downstream fixture',role:'sre',namespace:'fixture',run_id:'fixture-run',depends_on:[review.work_id]});
let downstreamClaim;try{downstreamClaim=(await q.claim(downstream.work_id,'fixture')).state;}catch(e){downstreamClaim=e.message;}
const sourceFile='/Users/manhtx/Documents/Macro Research Platform/server/aiCompany/roleWorkQueue.ts';
console.log(JSON.stringify({schema:'ai-factory.counterexample.v1',isolated:true,providerCalls:0,sourceHash:createHash('sha256').update(await readFile(sourceFile)).digest('hex'),reviewVerdict:result.review_verdict.verdict,reviewState:result.state,downstreamClaim,classification:'CURRENT_REPRODUCED',conclusion:'Non-PASS review DONE satisfies ordinary success dependency; no approved terminal reducer'},null,2));
