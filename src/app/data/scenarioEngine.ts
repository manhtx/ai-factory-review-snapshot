import { HistoricalCycle } from "./types";

export interface ScenarioReproducibilityRecord {
  scenarioId: string;
  version: "scenario-narrative-v1";
  fingerprint: string;
  assumptions: string[];
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function scenarioReproducibilityRecord(scenario: HistoricalCycle): ScenarioReproducibilityRecord | null {
  if (scenario.kind !== "scenario") return null;
  const assumptions = [scenario.context, scenario.policy, scenario.impact]
    .map((item) => item.trim())
    .filter(Boolean);
  const canonical = JSON.stringify({
    id: scenario.id,
    period: scenario.period,
    indicators: [...scenario.keyIndicators].sort(),
    assumptions,
  });
  return {
    scenarioId: scenario.id,
    version: "scenario-narrative-v1",
    fingerprint: stableHash(canonical),
    assumptions,
  };
}
