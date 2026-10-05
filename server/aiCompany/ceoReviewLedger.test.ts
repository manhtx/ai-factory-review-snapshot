import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CeoReviewLedger } from './ceoReviewLedger';
import {researchAuthorityFixture} from './researchAuthorityTestFixture';
import type { ProductIdea } from './ideaLedger';
const idea = (score: number): ProductIdea => ({ idea_id: 'I', project_id: 'macro-os', title: 'i', problem: 'p', target_persona: 'u', product_goal_reference: 'g', differentiation_hypothesis: 'd', validation_metric: 'm', status: 'DISCOVERED', opportunity_score: score, opportunity_decision: 'VALIDATE', created_at: '' });
describe('CEO review ledger', () => { it('persists period snapshots and flags material score drift', async () => { const ledger = new CeoReviewLedger(await mkdtemp(path.join(os.tmpdir(), 'ceo-review-'))); await ledger.review({ projectId: 'macro-os', period: '2026-W36', ideas: [idea(6)] }); const report = await ledger.review({ projectId: 'macro-os', period: '2026-W37', ideas: [idea(8)] }); expect(report.score_changes[0]).toMatchObject({ previous: 6, current: 8, action: 'REDECIDE' }); }); });

it('CEO readiness requires current advisory origin and is revoked by withdrawal',async()=>{
 const ledger=new CeoReviewLedger(await mkdtemp(path.join(os.tmpdir(),'ceo-origin-'))),f=await researchAuthorityFixture('macro-os','I'),researchSignals=f.signals;
 expect((await ledger.review({projectId:'macro-os',period:'unit-missing',ideas:[idea(6)],researchSignals})).ready_for_rescore_ideas).toEqual([]);
 expect((await ledger.review({projectId:'macro-os',period:'unit-healthy',ideas:[idea(6)],researchSignals,authority:f.authority})).ready_for_rescore_ideas).toEqual(['I']);await f.queue.quarantine(f.rows[0].work_id,'Unit withdrawal');expect((await ledger.review({projectId:'macro-os',period:'unit-withdrawn',ideas:[idea(6)],researchSignals,authority:await f.queue.currentAuthority('macro-os')})).ready_for_rescore_ideas).toEqual([]);
});
