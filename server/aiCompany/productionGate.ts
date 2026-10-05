import type { CompanyHealth } from './healthMetrics';

export interface ProductionGateResult { ready: boolean; blockers: string[]; }

export function evaluateProductionGate(input: { health: CompanyHealth; independentVerification: boolean; securityReview: boolean; recoveryTest: boolean; telegramAuthenticated: boolean }): ProductionGateResult {
  const blockers: string[] = [];
  if (!input.independentVerification) blockers.push('independent verification missing');
  if (!input.securityReview) blockers.push('security review missing');
  if (!input.recoveryTest) blockers.push('recovery test missing');
  if (!input.telegramAuthenticated) blockers.push('telegram authentication not verified');
  if (input.health.evidence_coverage < .95) blockers.push('evidence coverage below 95%');
  if (input.health.agent_failure_rate > .05) blockers.push('agent failure rate above 5%');
  return { ready: blockers.length === 0, blockers };
}
