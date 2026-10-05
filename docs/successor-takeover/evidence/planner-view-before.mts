import {unlink} from 'node:fs/promises';import path from 'node:path';
import {readinessAuthorityFixture} from '/Users/manhtx/Documents/Macro Research Platform/server/aiCompany/readinessAuthorityTestFixture.ts';
import {planIndependentReviews} from '/Users/manhtx/Documents/Macro Research Platform/server/aiCompany/backlogWorkPlanner.ts';
import {runAutonomousWorkflow} from '/Users/manhtx/Documents/Macro Research Platform/server/aiCompany/autonomousCoordinator.ts';
const p=await readinessAuthorityFixture(['data-engineer']),c=await readinessAuthorityFixture(['data-engineer']);await unlink(path.join(p.root,'role-evidence.jsonl'));await unlink(path.join(c.root,'role-evidence.jsonl'));
let calls=0;const run=await runAutonomousWorkflow({queue:c.queue,projectId:'unit',runId:'R',namespace:'N',execute:async()=>{calls++;throw new Error('No actual execution intended');}});
console.log(JSON.stringify({scope:'Actual temporary typed queue only',generatedReviews:(await planIndependentReviews({projectId:'unit',queue:p.queue})).length,status:run.status,runs:run.runs,executeCalls:calls,realProviderCalls:0},null,2));
