import { DATA_SOURCES } from "../src/app/config/dataSources.js";
import { reconcileSeries, ReconciliationResult, ReconciliationSeries } from "./reconciliation.js";

export type SourceMappingStatus = "declared" | "no-mapping" | "invalid-mapping";

export interface SourceMapping {
  indicatorId: string;
  primaryIndicatorId: string;
  secondaryIndicatorId: string;
  relationship: "fallback" | "corroboration";
  rationale: string;
}

export interface SourceMappingReport {
  indicatorId: string;
  status: SourceMappingStatus;
  mapping: SourceMapping | null;
  reconciliation: ReconciliationResult | null;
  evidence: "configuration" | "reconciliation" | "none";
  limitation: string;
}

/**
 * Candidate mappings under evaluation for rights review and semantic compatibility.
 * (Finding F-013 / P2-05)
 */
export const CANDIDATE_SOURCE_MAPPINGS: SourceMapping[] = [
  {
    indicatorId: "cpi-us",
    primaryIndicatorId: "cpi-us",
    secondaryIndicatorId: "core-cpi-us",
    relationship: "corroboration",
    rationale: "Headline CPI vs Core CPI (ex Food & Energy) corroboration from BLS via FRED.",
  },
  {
    indicatorId: "core-pce-us",
    primaryIndicatorId: "core-pce-us",
    secondaryIndicatorId: "pce-us",
    relationship: "corroboration",
    rationale: "Core PCE vs Headline PCE price index corroboration from BEA via FRED.",
  },
  {
    indicatorId: "unemployment-us",
    primaryIndicatorId: "unemployment-us",
    secondaryIndicatorId: "nfp-us",
    relationship: "corroboration",
    rationale: "Civilian Unemployment Rate vs Nonfarm Payrolls change from BLS.",
  },
];

/** Empty until an independently operated, semantically compatible and rights-reviewed pair is proven. */
export const SOURCE_MAPPINGS: SourceMapping[] = [];

export function buildSourceMappingReport(
  indicatorId: string,
  mapping: SourceMapping | undefined = SOURCE_MAPPINGS.find((item) => item.indicatorId === indicatorId),
  seriesByIndicator: Record<string, ReconciliationSeries> = {},
): SourceMappingReport {
  if (!mapping) return {
    indicatorId, status: "no-mapping", mapping: null, reconciliation: null, evidence: "none",
    limitation: "No independently validated primary/secondary source mapping is registered.",
  };
  if (!DATA_SOURCES[mapping.primaryIndicatorId] || !DATA_SOURCES[mapping.secondaryIndicatorId]) return {
    indicatorId, status: "invalid-mapping", mapping, reconciliation: null, evidence: "configuration",
    limitation: "The declared mapping references an indicator outside the data catalog.",
  };
  const primary = seriesByIndicator[mapping.primaryIndicatorId];
  const secondary = seriesByIndicator[mapping.secondaryIndicatorId];
  if (!primary || !secondary) return {
    indicatorId, status: "declared", mapping, reconciliation: null, evidence: "configuration",
    limitation: "The mapping exists, but both source series are not available for reconciliation.",
  };
  const reconciliation = reconcileSeries(primary, secondary);
  return {
    indicatorId, status: "declared", mapping, reconciliation, evidence: "reconciliation",
    limitation: reconciliation.suitableForFallback
      ? "Fallback suitability is based on the supplied comparison sample; rights and live health remain separate gates."
      : "The comparison does not establish fallback suitability.",
  };
}
