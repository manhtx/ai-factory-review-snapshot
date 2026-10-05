export type CompanyOperatingState = 'operating' | 'degraded' | 'blocked';

export function deriveCompanyOperatingStatus(input: {
  runtime: { running: boolean; lastTickAt: string | null; readiness: { ready: boolean; blockers: string[]; checkedAt: string | null } };
  latestCycle?: { status?: string; error?: string } | null;
  governance?: { work_items?: number; blocked_work_items?: number; ready_work_items?: number };
}) {
  const blockers = [...input.runtime.readiness.blockers];
  if (!input.runtime.running) blockers.push('company supervisor is not running');
  if (input.runtime.running && !input.runtime.lastTickAt) blockers.push('company supervisor has not completed a tick');
  if (input.latestCycle?.status === 'FAILED' && input.latestCycle.error) blockers.push(`latest cycle failed: ${input.latestCycle.error}`);
  if ((input.governance?.blocked_work_items ?? 0) > 0) blockers.push(`${input.governance?.blocked_work_items} work item(s) are blocked`);
  const state: CompanyOperatingState = !input.runtime.readiness.ready ? 'blocked' : blockers.length ? 'degraded' : 'operating';
  return { state, blockers: [...new Set(blockers)], local_ready: input.runtime.readiness.ready, production_ready: false, observed_at: new Date().toISOString() };
}
