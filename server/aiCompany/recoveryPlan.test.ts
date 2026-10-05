import { expect, it } from 'vitest';
import { nextRecoveryAction, validateRecoveryPlan, type RecoveryPlan } from './recoveryPlan';
const p: RecoveryPlan={recovery_id:'R',source_decision_id:'D',failure_class:'INSUFFICIENT_EVIDENCE',root_cause:'missing',actions:['collect'],accountable_role:'sre',dependency_updates:['D'],required_evidence:['E'],acceptance_criteria:['pass'],retry_budget:2,priority:'P1',re_review_trigger:'E exists',terminal_if_failed:'ESCALATE'};
it('bounds recovery and validates CEO recovery plan',()=>{expect(validateRecoveryPlan(p)).toEqual([]);expect(nextRecoveryAction(p,0)).toBe('CREATE_TASK');expect(nextRecoveryAction(p,2)).toBe('ESCALATE');});
