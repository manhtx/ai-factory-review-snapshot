export type CountryCoverageRecord = {
  country: string;
  registeredIndicatorIds: string[];
  hydratedIndicatorIds: string[];
  currentHydratedIndicatorIds: string[];
  missingIndicatorIds: string[];
  registeredCount: number;
  hydratedCount: number;
  currentHydratedCount: number;
  coverageRatio: number;
  currentCoverageRatio: number;
  state: "hydrated" | "registered-only" | "uncovered";
  missingIndicatorPlan: Array<{ indicatorId: string; priority: "core" | "supporting" | "discovery"; priorityScore: number; priorityReason: string }>;
};

const CORE_TERMS = ["gdp", "cpi", "inflation", "policy rate", "interest rate", "unemployment"];
const SUPPORTING_TERMS = ["pmi", "credit", "m2", "trade", "industrial production", "retail"];

function planMissingIndicator(indicator: { id: string; name?: string; shortName?: string; category?: string }) {
  const label = `${indicator.name ?? ""} ${indicator.shortName ?? ""} ${indicator.id}`.toLowerCase();
  const coreTerm = CORE_TERMS.find((term) => label.includes(term));
  if (coreTerm) return { indicatorId: indicator.id, priority: "core" as const, priorityScore: 100, priorityReason: `Core macro coverage term: ${coreTerm}.` };
  const supportingTerm = SUPPORTING_TERMS.find((term) => label.includes(term));
  if (supportingTerm) return { indicatorId: indicator.id, priority: "supporting" as const, priorityScore: 60, priorityReason: `Supporting macro coverage term: ${supportingTerm}.` };
  const category = indicator.category?.trim() || "uncategorized";
  return { indicatorId: indicator.id, priority: "discovery" as const, priorityScore: 20, priorityReason: `Discovery backlog; no canonical core/supporting term matched (${category}).` };
}

export function buildCountryCoverage(
  countryCodes: string[],
  catalog: Array<{ id: string; country: string; name?: string; shortName?: string; category?: string }>,
  snapshots: Array<{ indicatorId: string; status?: string; quality?: string; sourceUrl?: string | null; freshness?: string }>,
): CountryCoverageRecord[] {
  return countryCodes.map((country) => {
    const registeredRecords = catalog.filter((indicator) => indicator.country === country);
    const registered = registeredRecords.map((indicator) => indicator.id).sort();
    const hydrated = snapshots.filter((snapshot) => registered.includes(snapshot.indicatorId) && snapshot.status === "actual" && snapshot.quality === "verified" && Boolean(snapshot.sourceUrl)).map((snapshot) => snapshot.indicatorId);
    const hydratedIndicatorIds = [...new Set(hydrated)].sort();
    const currentHydratedIndicatorIds = [...new Set(snapshots.filter((snapshot) => registered.includes(snapshot.indicatorId) && snapshot.status === "actual" && snapshot.quality === "verified" && Boolean(snapshot.sourceUrl) && snapshot.freshness === "fresh").map((snapshot) => snapshot.indicatorId))].sort();
    const missingIndicatorIds = registered.filter((indicatorId) => !hydratedIndicatorIds.includes(indicatorId));
    const missingIndicatorPlan = registeredRecords
      .filter((indicator) => missingIndicatorIds.includes(indicator.id))
      .map(planMissingIndicator)
      .sort((a, b) => b.priorityScore - a.priorityScore || a.indicatorId.localeCompare(b.indicatorId));
    return {
      country,
      registeredIndicatorIds: registered,
      hydratedIndicatorIds,
      currentHydratedIndicatorIds,
      missingIndicatorIds,
      registeredCount: registered.length,
      hydratedCount: hydratedIndicatorIds.length,
      currentHydratedCount: currentHydratedIndicatorIds.length,
      coverageRatio: registered.length === 0 ? 0 : hydratedIndicatorIds.length / registered.length,
      currentCoverageRatio: registered.length === 0 ? 0 : currentHydratedIndicatorIds.length / registered.length,
      state: hydratedIndicatorIds.length > 0 ? "hydrated" : registered.length > 0 ? "registered-only" : "uncovered",
      missingIndicatorPlan,
    };
  });
}
