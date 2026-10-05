import {unlink} from 'node:fs/promises';import path from 'node:path';
import {readinessAuthorityFixture} from '/Users/manhtx/Documents/Macro Research Platform/server/aiCompany/readinessAuthorityTestFixture.ts';
import {evaluatePreReleaseReviewGate,preReleaseReviewRoles} from '/Users/manhtx/Documents/Macro Research Platform/server/aiCompany/preReleaseReviewGate.ts';
import {evaluateCadenceQuorum} from '/Users/manhtx/Documents/Macro Research Platform/server/aiCompany/cadenceQuorum.ts';
import {evaluatePromotion} from '/Users/manhtx/Documents/Macro Research Platform/server/aiCompany/releasePromotion.ts';
const release=await readinessAuthorityFixture(preReleaseReviewRoles),cadence=await readinessAuthorityFixture(['ceo','ceo-guild','pm','data-engineer','sre'],'CADENCE:daily');
const before={release:evaluatePreReleaseReviewGate(release.authority,'B-1'),promotion:evaluatePromotion(release.authority,'B-1'),cadence:evaluateCadenceQuorum({cadence:'daily',authority:cadence.authority})};
await unlink(path.join(release.root,'role-evidence.jsonl'));await unlink(path.join(cadence.root,'role-evidence.jsonl'));
const staleErrors:string[]=[];for(const read of [()=>evaluatePromotion(release.authority,'B-1'),()=>evaluateCadenceQuorum({cadence:'daily',authority:cadence.authority})])try{read();}catch(error){staleErrors.push(String(error));}
const releaseView=await release.queue.currentAuthority('unit'),cadenceView=await cadence.queue.currentAuthority('unit');
console.log(JSON.stringify({observedAt:new Date().toISOString(),scope:'Actual temporary queue typed fixture only; zero real release/governance',before,staleErrors,after:{release:evaluatePreReleaseReviewGate(releaseView,'B-1'),promotion:evaluatePromotion(releaseView,'B-1'),cadence:evaluateCadenceQuorum({cadence:'daily',authority:cadenceView})},historicalDonePreserved:(await release.queue.records('unit')).every(row=>row.state==='DONE')&&(await cadence.queue.records('unit')).every(row=>row.state==='DONE'),realProviderCalls:0,realProductReleases:0},null,2));
