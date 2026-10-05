import type { WorkflowEvent } from './stateStore';
import type { UsageRecord } from './usageLedger';

export interface CompanyHealth {
  total_events: number;
  released_tasks: number;
  revised_tasks: number;
  blocked_tasks: number;
  agent_failure_rate: number;
  rework_rate: number;
  cost_per_validated_outcome_usd: number;
  evidence_coverage: number;
  recovery_success_rate: number;
}

export function computeCompanyHealth(events: WorkflowEvent[], usage: UsageRecord[]): CompanyHealth {
  const taskIds = new Set(events.map((event) => event.aggregate_id));
  const released = new Set(events.filter((event) => event.to_state === 'RELEASED').map((event) => event.aggregate_id));
  const revised = new Set(events.filter((event) => event.to_state === 'REVISE').map((event) => event.aggregate_id));
  const blocked = new Set(events.filter((event) => event.to_state === 'BLOCKED').map((event) => event.aggregate_id));
  const failures = usage.filter((record) => record.outcome !== 'PASS').length;
  const totalUsage = usage.reduce((sum, record) => sum + record.estimated_cost_usd, 0);
  const evidenceEvents = events.filter((event) => (event.payload?.evidence_ids as unknown[] | undefined)?.length).length;
  const recoveryEvents = events.filter((event) => event.event_type === 'CHECKPOINT');
  const recoverySuccess = recoveryEvents.filter((event) => event.payload?.recovered === true).length;
  return {
    total_events: events.length,
    released_tasks: released.size,
    revised_tasks: revised.size,
    blocked_tasks: blocked.size,
    agent_failure_rate: usage.length ? failures / usage.length : 0,
    rework_rate: taskIds.size ? revised.size / taskIds.size : 0,
    cost_per_validated_outcome_usd: released.size ? totalUsage / released.size : 0,
    evidence_coverage: events.length ? evidenceEvents / events.length : 0,
    recovery_success_rate: recoveryEvents.length ? recoverySuccess / recoveryEvents.length : 0,
  };
}
