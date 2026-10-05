import type { CompanyHealth } from './healthMetrics';
import type { BacklogLedger } from './backlogLedger';

export interface PostReleaseMonitorResult { status: 'HEALTHY' | 'ATTENTION' | 'ROLLBACK_RECOMMENDED'; signals: string[]; rollback_recommended: boolean; evaluated_at: string; }

export function evaluatePostReleaseHealth(health: CompanyHealth, evaluatedAt = new Date()): PostReleaseMonitorResult {
  const signals: string[] = [];
  if (health.agent_failure_rate > .05) signals.push('agent failure rate above 5%');
  if (health.rework_rate > .2) signals.push('rework rate above 20%');
  if (health.evidence_coverage < .95) signals.push('evidence coverage below 95%');
  if (health.recovery_success_rate < 1 && health.total_events > 0) signals.push('recovery success is below 100%');
  const rollbackRecommended = signals.length > 0 && (health.agent_failure_rate > .1 || health.evidence_coverage < .8 || health.recovery_success_rate < .5);
  return { status: rollbackRecommended ? 'ROLLBACK_RECOMMENDED' : signals.length ? 'ATTENTION' : 'HEALTHY', signals, rollback_recommended: rollbackRecommended, evaluated_at: evaluatedAt.toISOString() };
}

export async function recordPostReleaseIncident(input: { projectId: string; health: CompanyHealth; ledger: BacklogLedger; evaluatedAt?: Date }): Promise<{ recorded: boolean; backlogId?: string }> {
  const monitor = evaluatePostReleaseHealth(input.health, input.evaluatedAt);
  if (!monitor.rollback_recommended) return { recorded: false };
  const existing = (await input.ledger.items(input.projectId)).find((item) => item.task_id === 'post-release-monitor' && item.title === 'P0 post-release regression incident');
  if (existing) return { recorded: false, backlogId: existing.backlog_id };
  const item = { backlog_id: `INC-${Date.now()}`, project_id: input.projectId, task_id: 'post-release-monitor', title: 'P0 post-release regression incident', priority: 'P0' as const, rationale: monitor.signals.join('; '), source_feedback_ids: [], acceptance_criteria: ['resolve all post-release monitor signals', 'complete rollback assessment'], status: 'PROPOSED' as const };
  await input.ledger.add([item]);
  return { recorded: true, backlogId: item.backlog_id };
}
