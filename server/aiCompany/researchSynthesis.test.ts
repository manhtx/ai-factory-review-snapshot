import { randomUUID } from 'node:crypto';
import { recordNativeFixture } from './nativeReceiptTestFixture';
import { mkdtemp, appendFile, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ResearchSignalLedger } from './researchSignalLedger';
import { type RoleWorkItem, RoleWorkQueue } from './roleWorkQueue';
import { RoleEvidenceLedger } from './roleEvidenceLedger';
import { evaluateResearchQuorum, synthesizeCompletedResearch, researchWorkOrigin, hasMatchingResearchWorkOrigin } from './researchSynthesis';
import {researchAuthorityFixture} from './researchAuthorityTestFixture';
import type { ResearchSignal } from './researchSignalLedger';

describe('research synthesis', () => {
  it('turns completed research work into idempotent evidence signals', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'synthesis-')); const evidence = new RoleEvidenceLedger(root); const queue = new RoleWorkQueue(root,evidence);
    const item = await queue.create({ project_id: 'macro-os', backlog_id: 'I-1', title: 'UX research', role: 'ux-research', namespace:'N', run_id:'R' });
    const claim=await queue.claim(item.work_id, 'ux'); const receipt=await recordNativeFixture(queue, evidence, {project_id:'macro-os',work_id:item.work_id,attempt_id:claim.attempt_id!,role:'ux-research',namespace:'N',run_id:'R',provider_id:'stub',model:'stub',output:'Unit advisory only',limitation:'Not a real user session',usage:{input_tokens:0,output_tokens:0,estimated_cost_usd:0}}, claim.attempt_authority); await queue.submitForReview(item.work_id,claim.attempt_authority); await queue.complete(item.work_id, [receipt.evidence_id], { research_question: 'q', source_reference: receipt.evidence_id, finding: 'f', confidence: .8 },undefined,undefined,undefined,undefined,claim.attempt_authority);
    const ledger = new ResearchSignalLedger(root);
    expect(await synthesizeCompletedResearch({ projectId: 'macro-os', authority: await queue.currentAuthority('macro-os'), ledger })).toBe(1);
    expect(await synthesizeCompletedResearch({ projectId: 'macro-os', authority: await queue.currentAuthority('macro-os'), ledger })).toBe(0);
  });
  it('requires current bound advisory perspectives before re-score', async () => {
    const {authority,signals}=await researchAuthorityFixture();
    expect(evaluateResearchQuorum(signals.slice(0,3),'I-1',.6,'unit',authority)).toMatchObject({status:'RESEARCH_INCOMPLETE',missingRoles:['domain-expert']});
    expect(evaluateResearchQuorum(signals,'I-1',.6,'unit',authority).status).toBe('READY_FOR_RE_SCORE');
    expect(evaluateResearchQuorum(signals,'I-1',.6,'unit').status).toBe('RESEARCH_INCOMPLETE');
  });
});

it('does not synthesize historical DONE research after ancestor withdrawal',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'synthesis-withdraw-')),evidence=new RoleEvidenceLedger(root),queue=new RoleWorkQueue(root,evidence),ledger=new ResearchSignalLedger(root);
 const finish=async(work_id:string)=>{const claim=await queue.claim(work_id,'fixture');const receipt=await recordNativeFixture(queue, evidence, {project_id:'unit',work_id,attempt_id:claim.attempt_id!,role:'ux-research',namespace:'N',run_id:'R',provider_id:'stub',model:'stub',output:'Unit advisory only',limitation:'Not a real user session',usage:{input_tokens:0,output_tokens:0,estimated_cost_usd:0}}, claim.attempt_authority);await queue.submitForReview(work_id,claim.attempt_authority);return queue.complete(work_id,[receipt.evidence_id],{research_question:'unit',source_reference:receipt.evidence_id,finding:'unit only',confidence:.2},undefined,undefined,undefined,undefined,claim.attempt_authority);};
 const source=await queue.create({project_id:'unit',backlog_id:'SOURCE',title:'Unit source',role:'ux-research',namespace:'N',run_id:'R'});await finish(source.work_id);const leaf=await queue.create({project_id:'unit',backlog_id:'LEAF',title:'Unit advisory',role:'ux-research',namespace:'N',run_id:'R',depends_on:[source.work_id]});await finish(leaf.work_id);await queue.quarantine(source.work_id,'Unit withdrawal');expect(await synthesizeCompletedResearch({projectId:'unit',authority:await queue.currentAuthority('unit'),ledger})).toBe(0);expect(await ledger.records('unit')).toEqual([]);expect((await queue.records('unit')).find(row=>row.work_id===leaf.work_id)!.state).toBe('DONE');
});

// In-memory provenance equality controls, not real provider/user evidence.
function advisoryFixture(){
 const roles=['user-persona','ux-research','stakeholder-panel','domain-expert'] as const;
 const rows:RoleWorkItem[]=roles.map(role=>({work_id:role,project_id:'unit',backlog_id:`I-1:research:${role}`,title:'Unit advisory only',role,state:'DONE',evidence_ids:['E'],created_at:'2026-10-01T00:00:00.000Z',updated_at:'2026-10-01T00:00:00.000Z',attempt_id:'unit-attempt',queue_revision:3,research_result:{research_question:'Unit',source_reference:'E',finding:'Advisory only',confidence:.8}}));
 const signals:ResearchSignal[]=rows.map(row=>({signal_id:`RS-${row.backlog_id}`,project_id:'unit',source_type:'AI_ADVISORY',persona:row.role,...row.research_result!,created_at:row.updated_at,work_origin:researchWorkOrigin(row,rows)!}));return{rows,signals};
}
it.each(['legacy','wrong-project','substring','withdrawn','changed-attempt','changed-result','changed-hash','ambiguous','invalid-confidence'])('denies %s persisted signal authority',async kind=>{
 const {root,queue,rows,signals}=await researchAuthorityFixture();
 if(kind==='legacy'){signals[0].source_type='USER_INTERVIEW';delete signals[0].work_origin;}
 if(kind==='wrong-project')signals[0].project_id='foreign';
 if(kind==='substring')signals[0].signal_id='RS-I-10:research:user-persona';
 if(kind==='withdrawn')rows[0].state='QUARANTINED';
 if(kind==='changed-attempt'){rows[0].attempt_id=randomUUID();rows[0].provider_dispatch!.attempt_id=rows[0].attempt_id;}
 if(kind==='changed-result')rows[0].research_result!.finding='Different';
 if(kind==='changed-hash')signals[0].work_origin!.work_sha256='0'.repeat(64);
 if(kind==='ambiguous')signals.push({...signals[0]});
 if(kind==='invalid-confidence')signals[0].confidence=Number.NaN;
 if(['withdrawn','changed-attempt','changed-result'].includes(kind)){rows[0].queue_revision!++;await appendFile(path.join(root,'role-work-queue.jsonl'),JSON.stringify(rows[0])+'\n');}
 const authority=await queue.currentAuthority('unit');
 expect(evaluateResearchQuorum(signals,'I-1',.6,'unit',authority).status).toBe('RESEARCH_INCOMPLETE');
});
it('binds all transitive input row versions and ignores unrelated work',()=>{
 const {rows,signals}=advisoryFixture();const source={...rows[0],work_id:'SOURCE',backlog_id:'SOURCE'};rows[0].depends_on=['SOURCE'];rows.push(source);signals[0].work_origin=researchWorkOrigin(rows[0],rows)!;expect(hasMatchingResearchWorkOrigin(signals[0],rows)).toBe(true);rows.push({...source,work_id:'OTHER'});expect(hasMatchingResearchWorkOrigin(signals[0],rows)).toBe(true);source.queue_revision!++;expect(hasMatchingResearchWorkOrigin(signals[0],rows)).toBe(false);
});

it('missing receipts revoke actual quorum and new synthesis while preserving signal history',async()=>{const f=await researchAuthorityFixture();expect(evaluateResearchQuorum(f.signals,'I-1',.6,'unit',f.authority).status).toBe('READY_FOR_RE_SCORE');await unlink(path.join(f.root,'role-evidence.jsonl'));expect(()=>evaluateResearchQuorum(f.signals,'I-1',.6,'unit',f.authority)).toThrow('snapshot changed');const authority=await f.queue.currentAuthority('unit');expect(evaluateResearchQuorum(f.signals,'I-1',.6,'unit',authority).status).toBe('RESEARCH_INCOMPLETE');const empty=new ResearchSignalLedger(await mkdtemp(path.join(os.tmpdir(),'empty-research-')));expect(await synthesizeCompletedResearch({projectId:'unit',authority,ledger:empty})).toBe(0);expect(await f.ledger.records('unit')).toEqual(f.signals);});
it('plain rows or forged authority cannot grant research readiness',async()=>{const f=await researchAuthorityFixture();expect(evaluateResearchQuorum(f.signals,'I-1',.6,'unit',f.rows as never).status).toBe('RESEARCH_INCOMPLETE');const forged={rows:f.rows,currentRows:()=>f.rows,isSuccessful:()=>true,assertCurrent:()=>{},errors:new Map(),dependencySatisfied:()=>true};expect(evaluateResearchQuorum(f.signals,'I-1',.6,'unit',forged).status).toBe('RESEARCH_INCOMPLETE');});
it('mutable display rows cannot fabricate canonical research origin',async()=>{const f=await researchAuthorityFixture();const row=f.authority.rows[0];row.research_result!.finding='Invented';const signal={...f.signals[0],finding:'Invented',work_origin:researchWorkOrigin(row,f.authority.rows)!};expect(evaluateResearchQuorum([signal,...f.signals.slice(1)],'I-1',.6,'unit',f.authority).status).toBe('RESEARCH_INCOMPLETE');});

it('issued authority callbacks cannot be replaced by caller-created approval',async()=>{const f=await researchAuthorityFixture();expect(Object.isFrozen(f.authority)).toBe(true);expect(()=>Object.defineProperty(f.authority,'isSuccessful',{value:()=>true})).toThrow();expect(evaluateResearchQuorum(f.signals,'I-1',.6,'unit',{...f.authority}).status).toBe('RESEARCH_INCOMPLETE');});
