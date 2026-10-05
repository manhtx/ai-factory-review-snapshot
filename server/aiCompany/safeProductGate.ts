import type { CompanyHealth } from './healthMetrics';

export interface SafeProductGateInput {
  health: CompanyHealth;
  independentVerification: boolean;
  securityReview: boolean;
  recoveryTest: boolean;
  durablePersistence: boolean;
  runtimeAttested: boolean;
  syntheticPaths: number;
  featureFlagsScoped: boolean;
}

export interface SafeProductGateResult { ready: boolean; blockers: string[]; }

/** Product canary gate intentionally excludes Telegram; it is a separate control plane. */
export function evaluateSafeProductGate(input: SafeProductGateInput): SafeProductGateResult {
  const blockers: string[] = [];
  if (!input.independentVerification) blockers.push('independent verification missing');
  if (!input.securityReview) blockers.push('security review missing');
  if (!input.recoveryTest) blockers.push('recovery test missing');
  if (!input.durablePersistence) blockers.push('durable persistence missing');
  if (!input.runtimeAttested) blockers.push('runtime attestation missing');
  if (input.syntheticPaths > 0) blockers.push(`synthetic production paths remain: ${input.syntheticPaths}`);
  if (!input.featureFlagsScoped) blockers.push('feature flags are not project-scoped');
  if (input.health.evidence_coverage < .95) blockers.push('evidence coverage below 95%');
  if (input.health.agent_failure_rate > .05) blockers.push('agent failure rate above 5%');
  return { ready: blockers.length === 0, blockers };
}
