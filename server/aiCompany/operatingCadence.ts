import type { ProductCyclePeriod } from './productCycleScheduler';

export type OperatingReviewCadence = ProductCyclePeriod | 'annual';
export interface CadencePolicy { cadence: OperatingReviewCadence; objective: string; accountable_roles: string[]; required_evidence: string[]; release_blocking: boolean; }

export const macroOsCadencePolicy: readonly CadencePolicy[] = [
  { cadence: 'daily', objective: 'Detect truth, freshness, user-demand and delivery issues and create the next bounded work.', accountable_roles: ['ceo', 'ceo-guild', 'pm', 'data-engineer', 'sre'], required_evidence: ['health snapshot', 'freshness/data-state snapshot', 'user telemetry or explicit no-data statement', 'backlog and cycle attempt'], release_blocking: true },
  { cadence: 'weekly', objective: 'Review research workflow outcomes, rework, incidents, backlog aging and competitive signals across every delivery function.', accountable_roles: ['ceo', 'ceo-guild', 'pm', 'tech-lead', 'critic', 'coder', 'data-engineer', 'backend-engineer', 'frontend-engineer', 'ai-engineer', 'sre', 'functional-qa', 'quality-control', 'ux-research', 'user-persona', 'domain-expert', 'security', 'release-security-gate'], required_evidence: ['outcome review', 'independent QA/QC evidence', 'user task evidence', 'delivery and provider reliability report', 'release and rollback gate review', 'open escalation review'], release_blocking: true },
  { cadence: 'monthly', objective: 'Reassess customer value, opportunity portfolio, provider rights, cost and market position.', accountable_roles: ['ceo', 'pm', 'stakeholder-panel', 'domain-expert', 'ai-engineer', 'security'], required_evidence: ['opportunity scorecard', 'competitive evidence', 'provider/cost report', 'stakeholder decision record'], release_blocking: true },
  { cadence: 'quarterly', objective: 'Reset portfolio, SLOs, risk budget and roadmap against the CEO mandate.', accountable_roles: ['ceo', 'pm', 'stakeholder-panel', 'sre', 'security', 'quality-control'], required_evidence: ['strategy review', 'SLO/recovery review', 'security review', 'roadmap decision and escalation disposition'], release_blocking: true },
  { cadence: 'annual', objective: 'Revalidate the 3–15 year direction and durable competitive moat.', accountable_roles: ['ceo', 'pm', 'stakeholder-panel', 'domain-expert', 'user-persona'], required_evidence: ['long-horizon strategy review', 'user-value trend', 'domain/market review', 'capital and risk reset'], release_blocking: true },
];

export function cadencePolicyFor(cadence: OperatingReviewCadence, policies: readonly CadencePolicy[] = macroOsCadencePolicy): CadencePolicy {
  const policy = policies.find((item) => item.cadence === cadence);
  if (!policy) throw new Error(`unsupported operating cadence: ${cadence}`);
  return policy;
}

export function cadencePolicySnapshot(policies: readonly CadencePolicy[] = macroOsCadencePolicy) {
  return { evidence: 'macro-os-operating-cadence-policy', policies, blocking_cadences: policies.filter((item) => item.release_blocking).map((item) => item.cadence) };
}
