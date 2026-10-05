import type { WorkflowState } from './stateStore';

export type DangerousAction = 'RELEASE' | 'KILL' | 'ROLLBACK' | 'CHANGE_PRODUCT_GOAL' | 'CHANGE_PERMISSION';

export function dangerousActionForState(state: WorkflowState): DangerousAction | null {
  if (state === 'RELEASED') return 'RELEASE';
  if (state === 'KILLED') return 'KILL';
  if (state === 'ROLLBACK') return 'ROLLBACK';
  return null;
}

export function requiresDecision(action: DangerousAction): boolean {
  return action === 'RELEASE' || action === 'KILL' || action === 'ROLLBACK' || action === 'CHANGE_PRODUCT_GOAL' || action === 'CHANGE_PERMISSION';
}
