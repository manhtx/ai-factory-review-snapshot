import {unlink} from 'node:fs/promises';import path from 'node:path';
import {readinessAuthorityFixture} from '/Users/manhtx/Documents/Macro Research Platform/server/aiCompany/readinessAuthorityTestFixture.ts';
import {evaluatePreReleaseReviewGate,preReleaseReviewRoles} from '/Users/manhtx/Documents/Macro Research Platform/server/aiCompany/preReleaseReviewGate.ts';
import {evaluateCadenceQuorum} from '/Users/manhtx/Documents/Macro Research Platform/server/aiCompany/cadenceQuorum.ts';
const release=await readinessAuthorityFixture(preReleaseReviewRoles),cadence=await readinessAuthorityFixture(['ceo','ceo-guild','pm','data-engineer','sre'],'CADENCE:daily');
const before={release:evaluatePreReleaseReviewGate(release.rows,'B-1'),cadence:evaluateCadenceQuorum({cadence:'daily',work:cadence.rows})};
await unlink(path.join(release.root,'role-evidence.jsonl'));await unlink(path.join(cadence.root,'role-evidence.jsonl'));
console.log(JSON.stringify({scope:'Temporary typed fixture only; no real release/governance',before,after:{release:evaluatePreReleaseReviewGate(await release.queue.records('unit'),'B-1'),cadence:evaluateCadenceQuorum({cadence:'daily',work:await cadence.queue.records('unit')})},realProviderCalls:0},null,2));
