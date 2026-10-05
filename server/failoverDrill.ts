export type DrillProviderStatus = "succeeded" | "failed" | "quarantined" | "stale" | "unavailable";
export type DrillFreshness = "fresh" | "delayed" | "outdated" | "unavailable";
export type DrillRightsStatus = "public-source" | "review-required" | "manual-review";

export type ProviderFailoverDrillScenario = {
  indicatorId: string;
  primaryProviderId: string;
  fallbackProviderId: string;
  primaryStatus: DrillProviderStatus;
  fallbackStatus: DrillProviderStatus;
  fallbackFreshness: DrillFreshness;
  fallbackRightsStatus: DrillRightsStatus;
  semanticParity: boolean;
  sourceUrlAvailable: boolean;
};

export type ProviderFailoverDrillResult = ProviderFailoverDrillScenario & {
  evidence: "drill";
  decision: "safe-fallback" | "stale-fallback" | "rights-blocked" | "semantic-mismatch" | "unavailable";
  publishObservation: false;
  nextAction: string;
  limitations: string[];
};

const LIMITATIONS = [
  "This is a deterministic operational drill, not a provider reachability check.",
  "The drill does not copy, create or promote observation values.",
  "Automatic fallback still requires independent redundancy, rights, telemetry and production review.",
];

export function evaluateProviderFailoverDrill(scenario: ProviderFailoverDrillScenario): ProviderFailoverDrillResult {
  let decision: ProviderFailoverDrillResult["decision"];
  let nextAction: string;
  if (scenario.fallbackStatus !== "succeeded" || scenario.fallbackFreshness === "unavailable") {
    decision = "unavailable";
    nextAction = "Keep the indicator unavailable and investigate the provider outage.";
  } else if (!scenario.semanticParity) {
    decision = "semantic-mismatch";
    nextAction = "Do not fail over; review unit, frequency, definition and transformation metadata.";
  } else if (scenario.fallbackRightsStatus !== "public-source" || !scenario.sourceUrlAvailable) {
    decision = "rights-blocked";
    nextAction = "Do not fail over; complete rights review and source provenance verification.";
  } else if (scenario.fallbackFreshness !== "fresh") {
    decision = "stale-fallback";
    nextAction = "Keep the fallback out of current actuals; show an explicit delayed or outdated state.";
  } else {
    decision = "safe-fallback";
    nextAction = "Fallback is eligible for a separate review; this drill still does not publish it automatically.";
  }
  return {
    ...scenario,
    evidence: "drill",
    decision,
    publishObservation: false,
    nextAction,
    limitations: LIMITATIONS,
  };
}

export function validateProviderFailoverDrillScenario(input: unknown): string[] {
  const value = input as Partial<ProviderFailoverDrillScenario> | null;
  if (!value || typeof value !== "object") return ["scenario must be an object"];
  const issues: string[] = [];
  for (const field of ["indicatorId", "primaryProviderId", "fallbackProviderId"] as const) {
    if (typeof value[field] !== "string" || !value[field]?.trim()) issues.push(`${field} is required`);
  }
  const statuses = ["succeeded", "failed", "quarantined", "stale", "unavailable"];
  const freshness = ["fresh", "delayed", "outdated", "unavailable"];
  const rights = ["public-source", "review-required", "manual-review"];
  if (!statuses.includes(String(value.primaryStatus))) issues.push("primaryStatus is invalid");
  if (!statuses.includes(String(value.fallbackStatus))) issues.push("fallbackStatus is invalid");
  if (!freshness.includes(String(value.fallbackFreshness))) issues.push("fallbackFreshness is invalid");
  if (!rights.includes(String(value.fallbackRightsStatus))) issues.push("fallbackRightsStatus is invalid");
  if (typeof value.semanticParity !== "boolean") issues.push("semanticParity must be boolean");
  if (typeof value.sourceUrlAvailable !== "boolean") issues.push("sourceUrlAvailable must be boolean");
  return issues;
}
