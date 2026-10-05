import type { CompanyStateStore, TransitionResult } from './stateStore';

export async function executeReleaseRollback(input: { store: CompanyStateStore; aggregateId: string; reason: string; evidenceIds: string[]; idempotencyKey: string }): Promise<TransitionResult> {
  if (!input.reason.trim()) throw new Error('rollback reason is required');
  if (!input.evidenceIds.length) throw new Error('rollback evidence is required');
  const current = await input.store.stateOf(input.aggregateId);
  if (current !== 'RELEASED') throw new Error(`rollback requires RELEASED state, current ${current ?? 'unknown'}`);
  return input.store.transition({ aggregateId: input.aggregateId, fromState: 'RELEASED', toState: 'ROLLBACK', actor: 'release-security-gate', reason: input.reason, idempotencyKey: input.idempotencyKey, payload: { rollback: true, evidence_ids: [...new Set(input.evidenceIds)] } });
}
