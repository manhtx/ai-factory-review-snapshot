export * from "./types.js";
export * from "./cycles.js";
export * from "./alerts.js";
export * from "./dataContract.js";
export * from "./seriesUtils.js";
export * from "./alertEngine.js";
export * from "./groundedAnalysis.js";
export * from "./analytics.js";
export * from "./historicalSimilarity.js";
export * from "./scenarioEngine.js";
export * from "./watchlist.js";
export * from "./regimeDetection.js";
export * from "./crossAssetRiskMatrix.js";
export * from "./scenarioStressGenerator.js";
export * from "./multiFactorAttribution.js";
export * from "./regimeMarkovPredictor.js";
export * from "./liquidityCascadeContagion.js";
export * from "./dataRevisionTimeline.js";
export * from "./businessCycleDetector.js";
export * from "./crossCountryLeadLag.js";
export * from "./macroWaveletComovement.js";


import { DATA_SOURCES, MVP_EXPANSION_SOURCES, OECD_MONTHLY_EXPANSION_SOURCES, EMERGING_MARKETS_EXPANSION_SOURCES } from "../config/dataSources.js";
import { historicalCycles } from "./cycles.js";
import { normalizeIndicator, validateIndicators } from "./dataContract.js";
import { indicatorCatalogMetadata } from "./indicatorCatalogMetadata.js";

const rawIndicators = [
  ...indicatorCatalogMetadata,
] as unknown as import("./types.js").Indicator[];

Object.assign(DATA_SOURCES, MVP_EXPANSION_SOURCES, OECD_MONTHLY_EXPANSION_SOURCES, EMERGING_MARKETS_EXPANSION_SOURCES);

const normalizedIndicators = rawIndicators.map((indicator) =>
  normalizeIndicator(indicator, DATA_SOURCES[indicator.id])
);

/** Runtime catalog. Prototype observations are intentionally stripped. */
const metadataOnlyIndicators = normalizedIndicators.map((indicator) => ({
  ...indicator,
  series: [],
  snapshot: { value: 0, date: "", change: 0, changePct: 0 },
  trend: "flat" as const,
  momentum: "stable" as const,
  provenance: {
    ...indicator.provenance,
    status: "simulated" as const,
    quality: "unverified" as const,
    observedThrough: "",
    notes: "Metadata catalog only; no bundled observation is available.",
  },
}));

/** No bundled observation is exported into application state. */
export const allIndicators = metadataOnlyIndicators;
export const indicatorCatalog = allIndicators;

export const dataQualityReport = validateIndicators(
  normalizedIndicators,
  DATA_SOURCES,
  historicalCycles.flatMap((cycle) =>
    cycle.keyIndicators.map((indicatorId) => ({ owner: cycle.id, indicatorId }))
  )
);

if (dataQualityReport.errorCount > 0) {
  console.error("[Data Quality] Contract violations:", dataQualityReport);
} else if (dataQualityReport.warningCount > 0) {
  console.warn("[Data Quality] Warnings:", dataQualityReport);
}

export function getIndicatorById(id: string) {
  return allIndicators.find((i) => i.id === id);
}

export function getIndicatorsByCategory(category: string) {
  return allIndicators.filter((i) => i.category === category);
}

export function getIndicatorsByCountry(country: string) {
  return allIndicators.filter((i) => i.country === country);
}

export const DASHBOARD_INDICATORS = [
  "core-pce-us",
  "fed-funds-rate",
  "unemployment-us",
  "pmi-us",
  "us10y-yield",
  "dxy",
  "credit-growth-vn",
  "vnindex",
  "gold",
  "bitcoin",
];
