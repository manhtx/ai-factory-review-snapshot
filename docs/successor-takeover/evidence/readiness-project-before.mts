import {readinessAuthorityFixture} from '/Users/manhtx/Documents/Macro Research Platform/server/aiCompany/readinessAuthorityTestFixture.ts';
import {evaluatePreReleaseReviewGate,preReleaseReviewRoles} from '/Users/manhtx/Documents/Macro Research Platform/server/aiCompany/preReleaseReviewGate.ts';
import {evaluateCadenceQuorum} from '/Users/manhtx/Documents/Macro Research Platform/server/aiCompany/cadenceQuorum.ts';
const r=await readinessAuthorityFixture(preReleaseReviewRoles),c=await readinessAuthorityFixture(['ceo','ceo-guild','pm','data-engineer','sre'],'CADENCE:daily');
console.log(JSON.stringify({scope:'Temporary healthy foreign project only',release:evaluatePreReleaseReviewGate(await r.queue.currentAuthority('EMPTY-TARGET'),'B-1'),cadence:evaluateCadenceQuorum({cadence:'daily',authority:await c.queue.currentAuthority('EMPTY-TARGET')}),realProviderCalls:0},null,2));
