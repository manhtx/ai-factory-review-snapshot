import {it,expect} from 'vitest';
import {isSuccessfulRoleWork,roleDependencySatisfied,type RoleWorkItem} from './roleWorkQueue';

// Pure graph fixtures, not canonical work or product/operation evidence.
function row(id:string,deps:string[]=[],state:RoleWorkItem['state']='DONE'):RoleWorkItem{return{work_id:id,project_id:'unit',backlog_id:'UNIT',title:'In-memory graph fixture; no real outcome',role:'ux-research',state,depends_on:deps,evidence_ids:['UNIT'],research_result:{research_question:'Unit graph',source_reference:'UNIT',finding:'Unit only',confidence:0.2},created_at:'2026-10-01T00:00:00.000Z',updated_at:'2026-10-01T00:00:00.000Z'};}
it('withdrawal after DONE revokes current consumer success and indirect dependency authority',()=>{
 const source=row('A'),consumer=row('B',['A']),grandchild=row('C',['B'],'READY');const healthy=[source,consumer,grandchild];expect(isSuccessfulRoleWork(consumer,healthy)).toBe(true);expect(roleDependencySatisfied(grandchild,consumer,healthy)).toBe(true);
 const withdrawn=[{...source,state:'QUARANTINED' as const},consumer,grandchild];expect(isSuccessfulRoleWork(consumer,withdrawn)).toBe(false);expect(roleDependencySatisfied(grandchild,consumer,withdrawn)).toBe(false);expect(consumer.state).toBe('DONE');
});
it('uses current canonical row rather than stale passed DONE snapshot',()=>{const stale=row('A');expect(isSuccessfulRoleWork(stale,[{...stale,state:'CLAIMED'}])).toBe(false);});
it('missing snapshot cannot silently use shallow success',()=>{expect(isSuccessfulRoleWork(row('A'),undefined as never)).toBe(false);});
it.each(['missing','cross-project','ambiguous','cycle','self-cycle'])('fails closed for %s graph',kind=>{
 const a=row('A'),b=row('B',['A']);let rows=[a,b];if(kind==='missing')rows=[b];if(kind==='cross-project')a.project_id='foreign';if(kind==='ambiguous')rows.push({...a});if(kind==='cycle')a.depends_on=['B'];if(kind==='self-cycle')b.depends_on=['B'];expect(isSuccessfulRoleWork(b,rows)).toBe(false);
});
it('healthy diamond and deep graph avoid recursive stack overflow',()=>{
 const a=row('A'),b=row('B',['A']),c=row('C',['A']),d=row('D',['B','C']);expect(isSuccessfulRoleWork(d,[a,b,c,d])).toBe(true);
 const rows=Array.from({length:12000},(_,i)=>row(`N${i}`,i?[`N${i-1}`]:[]));expect(isSuccessfulRoleWork(rows.at(-1)!,rows)).toBe(true);rows[0].state='QUARANTINED';expect(isSuccessfulRoleWork(rows.at(-1)!,rows)).toBe(false);
});
it('explicit failed-review correction preserves exception but known correction cycles deny authority',()=>{
 const failed=row('FAILED-REVIEW',[],'BLOCKED');failed.evidence_ids=['UNIT'];failed.review_verdict={verdict:'HOLD',gate:'unit',summary:'missing input',evidence:['UNIT'],failure_class:'INSUFFICIENT_EVIDENCE',root_cause:'unit',recovery_required:false,recovery_actions:[],unblock_evidence:[],retry_budget:0,next_review_trigger:'unit',confidence:0.2};
 // Scoped metadata only; this does not assert a real assignment/provenance claim.
 failed.assignment={namespace:'N',run_id:'R'} as never;
 const correction=row('CORRECTION',['FAILED-REVIEW']);correction.recovery_source_work_id=failed.work_id;correction.assignment={namespace:'N',run_id:'R'} as never;
 expect(isSuccessfulRoleWork(correction,[failed,correction])).toBe(true);expect(isSuccessfulRoleWork(failed,[failed,correction])).toBe(false);
 const pending={...correction,state:'READY' as const};expect(roleDependencySatisfied(pending,failed,[failed,pending])).toBe(true);
 failed.depends_on=['CORRECTION'];expect(roleDependencySatisfied(pending,failed,[failed,pending])).toBe(false);expect(isSuccessfulRoleWork(correction,[failed,correction])).toBe(false);
});
