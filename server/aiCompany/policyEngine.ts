import type { WorkflowState } from './stateStore';
import type { RiskLevel } from './domainTypes';

export type Action = 'TRANSITION' | 'RELEASE' | 'CHANGE_PRODUCT_GOAL' | 'CHANGE_PERMISSION' | 'READ_SECRET' | 'EXECUTE_SHELL';

const allowed: Record<string, Action[]> = {
  'chairman-interface': ['TRANSITION'],
  ceo: ['TRANSITION'],
  pm: ['TRANSITION'],
  'chief-of-staff': ['TRANSITION'],
  architect: ['TRANSITION'],
  coder: ['TRANSITION'],
  'requirements-qa': ['TRANSITION'],
  'functional-qa': ['TRANSITION'],
  'ux-research': ['TRANSITION'],
  'user-persona': ['TRANSITION'],
  'domain-expert': ['TRANSITION'],
  'release-security-gate': ['TRANSITION', 'RELEASE'],
};

const transitionRoleRules: Record<string, WorkflowState[]> = {
  coder: ['EXECUTING', 'BLOCKED', 'HOLD'],
  'requirements-qa': ['INDEPENDENT_VERIFICATION', 'REVISE', 'HOLD'],
  'functional-qa': ['INDEPENDENT_VERIFICATION', 'REVISE', 'HOLD'],
  'release-security-gate': ['RELEASE_GATE', 'RELEASED', 'ROLLBACK', 'KILLED'],
};

export function authorize(input: { actor: string; action: Action; toState?: WorkflowState; riskLevel?: RiskLevel }): void {
  if (input.action === 'READ_SECRET' || input.action === 'EXECUTE_SHELL') throw new Error(`denied action: ${input.action}`);
  if (!(allowed[input.actor] ?? []).includes(input.action)) throw new Error(`denied action ${input.action} for ${input.actor}`);
  if (input.action === 'RELEASE' && input.actor !== 'release-security-gate') throw new Error('only release-security-gate may release');
  if (input.toState && transitionRoleRules[input.actor] && !transitionRoleRules[input.actor].includes(input.toState)) {
    throw new Error(`actor ${input.actor} cannot transition to ${input.toState}`);
  }
  if (input.riskLevel === 'P0' && input.actor !== 'ceo' && input.actor !== 'chairman-interface' && input.actor !== 'release-security-gate') {
    throw new Error(`P0 transition requires executive or release authority: ${input.actor}`);
  }
}
