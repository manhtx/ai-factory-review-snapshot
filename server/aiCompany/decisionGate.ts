import type { DecisionLedger, DecisionRecord } from './decisionLedger';
import type { CompanyStateStore, TransitionResult } from './stateStore';

export async function requireActiveDecision(ledger: DecisionLedger, decisionId: string, action: DecisionRecord['action'], now = new Date()): Promise<DecisionRecord> {
  const decision = await ledger.active(decisionId, now);
  if (!decision) throw new Error('decision missing or expired');
  if (decision.action !== action) throw new Error(`decision action mismatch: expected ${action}`);
  return decision;
}

export async function transitionWithDecision(store: CompanyStateStore, ledger: DecisionLedger, input: Parameters<CompanyStateStore['transition']>[0] & { decisionId: string; decisionAction: DecisionRecord['action'] }): Promise<TransitionResult> {
  await requireActiveDecision(ledger, input.decisionId, input.decisionAction);
  const { decisionId, decisionAction, ...transition } = input;
  return store.transition({ ...transition, payload: { ...(transition.payload ?? {}), decision_id: decisionId, decision_action: decisionAction } });
}
