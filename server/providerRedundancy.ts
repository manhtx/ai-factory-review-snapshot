import { DATA_SOURCES } from "../src/app/config/dataSources.js";
import { buildSourceMappingReport, SOURCE_MAPPINGS } from "./sourceMapping.js";

export type ProviderRedundancyState = "no-mapping" | "mapped-unreconciled" | "reconciled-blocked" | "reconciled-candidate";
export type ProviderRedundancyRecord = {
  indicatorId: string;
  state: ProviderRedundancyState;
  mapping: ReturnType<typeof buildSourceMappingReport>["mapping"];
  evidence: ReturnType<typeof buildSourceMappingReport>["evidence"];
  suitableForFallback: boolean | null;
  limitation: string;
  reasonCodes: string[];
  nextActions: string[];
};

export function buildProviderRedundancyReport(
  indicatorIds: string[] = Object.keys(DATA_SOURCES),
  mappings = SOURCE_MAPPINGS,
  seriesByIndicator: Parameters<typeof buildSourceMappingReport>[2] = {},
) {
  const records: ProviderRedundancyRecord[] = indicatorIds.map((indicatorId) => {
    const report = buildSourceMappingReport(indicatorId, mappings.find((mapping) => mapping.indicatorId === indicatorId), seriesByIndicator);
    const suitable = report.reconciliation?.suitableForFallback ?? null;
    const state: ProviderRedundancyState = report.status === "no-mapping" ? "no-mapping" : report.evidence === "reconciliation" ? suitable ? "reconciled-candidate" : "reconciled-blocked" : "mapped-unreconciled";
    const reasonCodes = state === "no-mapping"
      ? ["NO_INDEPENDENT_MAPPING"]
      : state === "mapped-unreconciled"
        ? ["MAPPING_NOT_RECONCILED"]
        : state === "reconciled-blocked"
          ? ["RECONCILIATION_NOT_SUITABLE"]
          : ["CANDIDATE_REQUIRES_RIGHTS_HEALTH_REVIEW"];
    const nextActions = state === "no-mapping"
      ? ["Declare an independently operated secondary source only after semantic and rights review."]
      : state === "mapped-unreconciled"
        ? ["Ingest both series and run bounded reconciliation before considering fallback."]
        : state === "reconciled-blocked"
          ? ["Resolve semantic or overlap discrepancies; do not use this mapping for fallback."]
          : ["Verify rights, freshness, runtime health, telemetry and owner approval before any operational fallback decision."];
    return { indicatorId, state, mapping: report.mapping, evidence: report.evidence, suitableForFallback: suitable, limitation: report.limitation, reasonCodes, nextActions };
  });
  const counts = records.reduce<Record<ProviderRedundancyState, number>>((result, record) => { result[record.state] += 1; return result; }, { "no-mapping": 0, "mapped-unreconciled": 0, "reconciled-blocked": 0, "reconciled-candidate": 0 });
  return {
    records,
    counts,
    evidence: "configuration-and-reconciliation" as const,
    automaticFallback: false as const,
    limitations: ["No mapping is inferred from provider names or source URLs.", "A reconciled candidate is not a production fallback: rights, live health, freshness, telemetry and independent operational review remain separate gates.", "This report does not fetch, copy, publish or promote observation values."],
  };
}
