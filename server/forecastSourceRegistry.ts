export type ForecastSourceRightsStatus = "public-source" | "review-required" | "disabled";

export interface ForecastSourceDefinition {
  sourceId: string;
  displayName: string;
  sourceType: "official" | "institutional" | "market" | "internal";
  rightsStatus: ForecastSourceRightsStatus;
  allowedHosts: string[];
  indicatorIds: string[];
  cadence: string;
  retrievalMode: "operator-supplied" | "adapter-planned" | "disabled";
  enabled: boolean;
}

export interface ForecastSourceRegistryEntry {
  sourceId: string;
  displayName: string;
  rightsStatus: ForecastSourceRightsStatus;
  indicatorCount: number;
  allowedHosts: string[];
  cadence: string;
  retrievalMode: ForecastSourceDefinition["retrievalMode"];
  enabled: boolean;
  eligibility: "eligible" | "review-required" | "disabled";
  limitations: string[];
}

export const FORECAST_SOURCE_REGISTRY_VERSION = "2026-08-20.v1";

function sourceTypeFor(type: string): ForecastSourceDefinition["sourceType"] {
  if (type === "manual") return "internal";
  if (type === "fred" || type.startsWith("worldbank")) return "official";
  if (type === "coingecko" || type.endsWith("json")) return "market";
  return "institutional";
}

function rightsStatusFor(type: string): ForecastSourceRightsStatus {
  if (type === "fred" || type.startsWith("worldbank")) return "public-source";
  if (type === "manual") return "review-required";
  return "review-required";
}

export function buildForecastSourceRegistry(sources = DATA_SOURCES): ForecastSourceDefinition[] {
  const grouped = new Map<string, ForecastSourceDefinition>();
  for (const [indicatorId, source] of Object.entries(sources)) {
    const sourceId = source.source.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || source.type;
    const host = (() => { try { return new URL(source.sourceUrl).hostname; } catch { return ""; } })();
    const existing = grouped.get(sourceId);
    if (existing) {
      existing.indicatorIds.push(indicatorId);
      if (host) existing.allowedHosts.push(host);
      continue;
    }
    grouped.set(sourceId, {
      sourceId,
      displayName: source.source,
      sourceType: sourceTypeFor(source.type),
      rightsStatus: rightsStatusFor(source.type),
      allowedHosts: host ? [host] : [],
      indicatorIds: [indicatorId],
      cadence: source.frequencyLabel,
      retrievalMode: source.type === "manual" ? "operator-supplied" : "adapter-planned",
      enabled: source.type !== "manual",
    });
  }
  grouped.set("macro-os-operator", {
    sourceId: "macro-os-operator",
    displayName: "Macro OS operator-supplied forecast",
    sourceType: "internal",
    rightsStatus: "public-source",
    allowedHosts: ["macro-os.local"],
    indicatorIds: [],
    cadence: "operator-defined",
    retrievalMode: "operator-supplied",
    enabled: true,
  });
  return [...grouped.values()].map((source) => ({ ...source, allowedHosts: [...new Set(source.allowedHosts)].sort(), indicatorIds: [...new Set(source.indicatorIds)].sort() })).sort((a, b) => a.sourceId.localeCompare(b.sourceId));
}

export const FORECAST_SOURCE_REGISTRY = buildForecastSourceRegistry();

function normalizeHost(host: string) {
  return host.trim().toLowerCase().replace(/^www\./, "");
}

export function forecastSourceIdForName(sourceName: string) {
  return String(sourceName ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function hostMatches(host: string, allowedHosts: string[]) {
  const normalized = normalizeHost(host);
  return allowedHosts.some((allowed) => {
    const candidate = normalizeHost(allowed);
    return normalized === candidate || normalized.endsWith(`.${candidate}`);
  });
}

export function findForecastSource(sourceId: string, registry = FORECAST_SOURCE_REGISTRY) {
  return registry.find((source) => source.sourceId === sourceId) ?? null;
}

export function assessForecastSubmission(
  input: { sourceName?: string | null; sourceUrl?: string | null; indicatorId?: string | null },
  registry = FORECAST_SOURCE_REGISTRY,
) {
  const result = assessForecastSource({ sourceId: forecastSourceIdForName(String(input.sourceName ?? "")), sourceUrl: input.sourceUrl, indicatorId: input.indicatorId }, registry);
  return { sourceId: forecastSourceIdForName(String(input.sourceName ?? "")), eligible: result.eligible, state: result.state, reason: result.reason };
}

export function assessForecastSource(
  input: { sourceId?: string | null; sourceUrl?: string | null; indicatorId?: string | null },
  registry = FORECAST_SOURCE_REGISTRY,
) {
  const source = findForecastSource(String(input.sourceId ?? ""), registry);
  if (!source) return { eligible: false as const, state: "review-required" as const, reason: "unknown-source" };
  if (!source.enabled || source.rightsStatus === "disabled" || source.retrievalMode === "disabled") {
    return { eligible: false as const, state: "disabled" as const, reason: "source-disabled", source };
  }
  if (source.rightsStatus !== "public-source") {
    return { eligible: false as const, state: "review-required" as const, reason: "rights-review-required", source };
  }
  if (source.indicatorIds.length && !source.indicatorIds.includes(String(input.indicatorId ?? ""))) {
    return { eligible: false as const, state: "review-required" as const, reason: "indicator-not-mapped", source };
  }
  let url: URL;
  try { url = new URL(String(input.sourceUrl ?? "")); } catch { return { eligible: false as const, state: "review-required" as const, reason: "invalid-source-url", source }; }
  if (url.protocol !== "https:" || !hostMatches(url.hostname, source.allowedHosts)) {
    return { eligible: false as const, state: "review-required" as const, reason: "source-host-not-allowlisted", source };
  }
  return { eligible: true as const, state: "eligible" as const, reason: "registry-match", source };
}

export function buildForecastSourceRegistryAudit(registry = FORECAST_SOURCE_REGISTRY) {
  return {
    schema: "macro-os.forecast-source-registry",
    registryVersion: FORECAST_SOURCE_REGISTRY_VERSION,
    entries: registry.map((source): ForecastSourceRegistryEntry => ({
      sourceId: source.sourceId,
      displayName: source.displayName,
      rightsStatus: source.rightsStatus,
      indicatorCount: source.indicatorIds.length,
      allowedHosts: [...source.allowedHosts].sort(),
      cadence: source.cadence,
      retrievalMode: source.retrievalMode,
      enabled: source.enabled,
      eligibility: !source.enabled || source.rightsStatus === "disabled" || source.retrievalMode === "disabled"
        ? "disabled"
        : source.rightsStatus === "public-source" ? "eligible" : "review-required",
      limitations: [
        "Registry configuration does not prove live availability, freshness, provider continuity or legal permission.",
        "No provider payloads or credentials are exposed by this projection.",
      ],
    })).sort((a, b) => a.sourceId.localeCompare(b.sourceId)),
    limitations: [
      "Only explicitly registered source identities are registry-eligible; unknown historical source metadata remains visible but requires review.",
      "Operator-supplied forecasts are not automatically fetched or redistributed.",
    ],
  };
}
import { DATA_SOURCES } from "../src/app/config/dataSources.js";
