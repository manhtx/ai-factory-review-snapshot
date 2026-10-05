import { createHash } from 'node:crypto';

export type EffectiveLineageState = 'ACTIVE_READY' | 'ACTIVE_RUNNING' | 'ACTIVE_BLOCKED' | 'STALE_BLOCKED' | 'SUPERSEDED' | 'QUARANTINED' | 'RESOLVED' | 'TERMINAL_HISTORY' | 'UNKNOWN_LINEAGE';
export type ObjectiveEligibilityResult = 'ELIGIBLE' | 'INELIGIBLE_ACTIVE_WORK' | 'INELIGIBLE_ACTIVE_BLOCKER' | 'INELIGIBLE_ALREADY_SATISFIED' | 'INELIGIBLE_SUPERSEDED' | 'REQUIRES_RECONCILIATION' | 'UNKNOWN';
export interface LineageRecord { work_id: string; state?: string; effective_state?: EffectiveLineageState; objective_id?: string; run_id?: string; namespace?: string; lineage_version?: string; }
export interface ObjectiveEligibility { objective_id: string; result: ObjectiveEligibilityResult; blocker_ids: string[]; lineage_states: Record<string, EffectiveLineageState>; relevant_version: string; attempt_key: string; }

const active = new Set<EffectiveLineageState>(['ACTIVE_READY', 'ACTIVE_RUNNING', 'ACTIVE_BLOCKED']);
export function effectiveLineageState(record: LineageRecord): EffectiveLineageState {
  if (record.effective_state) return record.effective_state;
  if (record.state === 'READY') return 'ACTIVE_READY';
  if (record.state === 'CLAIMED' || record.state === 'IN_REVIEW') return 'ACTIVE_RUNNING';
  if (record.state === 'BLOCKED') return 'STALE_BLOCKED';
  if (record.state === 'QUARANTINED') return 'QUARANTINED';
  if (record.state === 'DONE') return 'TERMINAL_HISTORY';
  return 'UNKNOWN_LINEAGE';
}
export function eligibilityForObjective(objectiveId: string, records: LineageRecord[], relevantRevision = 'v1'): ObjectiveEligibility {
  const relevant = records.filter((r) => r.objective_id === objectiveId);
  const states = Object.fromEntries(relevant.map((r) => [r.work_id, effectiveLineageState(r)]));
  const blockers = relevant.filter((r) => active.has(states[r.work_id])).map((r) => r.work_id).sort();
  const unknown = relevant.filter((r) => states[r.work_id] === 'UNKNOWN_LINEAGE');
  const result: ObjectiveEligibilityResult = unknown.length ? 'REQUIRES_RECONCILIATION' : blockers.length ? (blockers.some((id) => states[id] === 'ACTIVE_BLOCKED') ? 'INELIGIBLE_ACTIVE_BLOCKER' : 'INELIGIBLE_ACTIVE_WORK') : relevant.some((r) => states[r.work_id] === 'SUPERSEDED') ? 'INELIGIBLE_SUPERSEDED' : 'ELIGIBLE';
  const fingerprint = JSON.stringify(relevant.map((r) => [r.work_id, states[r.work_id], r.lineage_version ?? '']).sort());
  const relevant_version = createHash('sha256').update(JSON.stringify([objectiveId, relevantRevision, fingerprint])).digest('hex').slice(0, 24);
  const attempt_key = createHash('sha256').update(JSON.stringify([objectiveId, relevant_version, fingerprint])).digest('hex').slice(0, 32);
  return { objective_id: objectiveId, result, blocker_ids: blockers, lineage_states: states, relevant_version, attempt_key };
}
