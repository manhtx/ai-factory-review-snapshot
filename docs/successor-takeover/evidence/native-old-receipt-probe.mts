import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { RoleWorkQueue } from '/Users/manhtx/Documents/Macro Research Platform/server/aiCompany/roleWorkQueue.ts';
import { RoleEvidenceLedger } from '/Users/manhtx/Documents/Macro Research Platform/server/aiCompany/roleEvidenceLedger.ts';
const root=await mkdtemp(path.join(os.tmpdir(),'native-old-receipt-'));
const ledger=new RoleEvidenceLedger(root); const queue=new RoleWorkQueue(root,ledger);
const item=await queue.create({project_id:'isolated',backlog_id:'B',title:'Isolated actual receipt lineage counterexample; product outcome UNKNOWN',role:'ux-research'});
const first=await queue.claim(item.work_id,'old-owner');
const receipt=await ledger.record({project_id:item.project_id,work_id:item.work_id,role:item.role,namespace:item.assignment!.namespace,run_id:item.assignment!.run_id,provider_id:'unit-stub',model:'unit-stub',output:'Isolated old attempt bytes; no actual provider/product effect',limitation:'Unit fixture only',usage:{input_tokens:0,output_tokens:0,estimated_cost_usd:0}});
await queue.blockAttempt(item.work_id,'first attempt stopped',first.attempt_authority);
await queue.requeueBlocked(item.work_id);
const second=await queue.claim(item.work_id,'new-owner');await queue.submitForReview(item.work_id,second.attempt_authority);
let state='',error='';
try{state=(await queue.complete(item.work_id,[receipt.evidence_id],{research_question:'Did these bytes originate from the current attempt?',source_reference:receipt.evidence_id,finding:'Actual old receipt; product outcome UNKNOWN',confidence:.5},undefined,undefined,undefined,undefined,second.attempt_authority)).state;}catch(e){error=String(e);}
const report={root,firstAttempt:first.attempt_id,secondAttempt:second.attempt_id,receiptId:receipt.evidence_id,receiptAttempt:(receipt as any).attempt_id??null,state,error,oldReceiptAcceptedAsNewAttempt:state==='DONE',providerCalls:0,liveMutations:false};
await writeFile('/tmp/native-old-receipt-result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
