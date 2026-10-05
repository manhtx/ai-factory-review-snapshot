import type { RoleWorkItem } from './roleWorkQueue';

export type AutonomousNextAction = {
  kind: 'EXECUTE_READY_WORK' | 'RECOVER_BLOCKED_WORK' | 'WAITING_FOR_MEANINGFUL_WORK' | 'WAITING_FOR_EXTERNAL_EVIDENCE' | 'REVIEW_COMPLETED_CYCLE';
  reason: string;
  wake_condition?: string;
  work_ids?: string[];
};

export function selectAutonomousNextAction(input: { rows: RoleWorkItem[]; completed: RoleWorkItem[]; status?: string }): AutonomousNextAction {
  const ready = input.rows.filter((row) => row.state === 'READY');
  if (ready.length) return { kind: 'EXECUTE_READY_WORK', reason: 'dispatchable work remains', work_ids: ready.map((row) => row.work_id) };
  // An upstream PM HOLD is an intentional terminal disposition for skipped
  // downstream roles, not recoverable execution failure. Exclude it from the
  // next-action queue so liveness telemetry does not demand pointless retries.
  const blocked = input.rows.filter((row) => row.state === 'BLOCKED' && !String(row.blocked_reason || '').startsWith('UPSTREAM_PM_GATE:'));
  if (blocked.length) return { kind: 'RECOVER_BLOCKED_WORK', reason: 'blocked work requires bounded recovery or escalation', work_ids: blocked.map((row) => row.work_id) };
  if (input.status === 'BLOCKED_EXTERNAL') return { kind: 'WAITING_FOR_EXTERNAL_EVIDENCE', reason: 'external dependency prevented safe continuation', wake_condition: 'external-dependency-resolved' };
  if (input.completed.length) return { kind: 'REVIEW_COMPLETED_CYCLE', reason: 'completed work should be measured and converted into learning before another build task' };
  return { kind: 'WAITING_FOR_MEANINGFUL_WORK', reason: 'no useful safe work is currently available', wake_condition: 'new-authorized-work-or-product-evidence' };
}
