import { DATA_SOURCES, DataSourceConfig, DataSourceType } from "./dataSources.js";
import { PROVIDER_MANIFEST_VERSION, ProviderOperation } from "../../../server/providerContract.js";
import { freshnessSlo } from "../../../server/freshness.js";
import { QUARANTINED_PROVIDER_IDS } from './quarantinedProviderIds.js';

export type ProviderRole = "primary" | "secondary" | "snapshot" | "manual";
export type RightsStatus = "review-required" | "public-source" | "manual-review";
export type AdapterMode = "server-adapter" | "snapshot-only" | "manual-or-rights-gated" | "external-or-rights-gated";

export interface ProviderCapability {
  manifestVersion: string;
  providerId: string;
  providerName: string;
  sourceTypes: DataSourceType[];
  indicatorIds: string[];
  roles: ProviderRole[];
  supportsHistorical: boolean;
  supportsRealtime: boolean;
  supportsRevisions: boolean;
  rightsStatus: RightsStatus;
  adapterMode: AdapterMode;
  frequencyLabels: string[];
  sourceUrls: string[];
  supportedOperations: ProviderOperation[];
}

export type ProviderRuntimeStatus = "never-run" | "running" | "succeeded" | "failed" | "quarantined" | "stale" | "unknown";

export interface ProviderIngestionRun {
  indicatorId: string;
  status: string;
  startedAt?: string | null;
  completedAt?: string | null;
  errorMessage?: string | null;
}

export interface ProviderRuntimeHealth {
  providerId: string;
  status: ProviderRuntimeStatus;
  indicatorCount: number;
  indicatorsWithRuns: number;
  lastRunAt: string | null;
  failedIndicatorIds: string[];
  staleIndicatorIds: string[];
  indicatorStatuses: Record<string, ProviderRuntimeStatus>;
  affectedIndicatorIds: string[];
  latestFailures: Array<{ indicatorId: string; status: string; errorMessage: string | null; completedAt: string | null }>;
  freshness: "fresh" | "delayed" | "outdated" | "unavailable";
  evidence: "ingestion-run" | "none";
}

function providerIdFor(source: DataSourceConfig): string {
  if (source.type === "fred") return "fred";
  if (source.type.startsWith("worldbank")) return "world-bank";
  if (source.type === "coingecko") return "coingecko";
  if (source.type === "manual") return "manual";
  return source.type;
}

function providerRoleFor(source: DataSourceConfig): ProviderRole {
  if (source.type === "manual") return "manual";
  if (source.type === "f-fin-json" || source.type === "mendeley-csv") return "snapshot";
  if (source.type === "er-api") return "secondary";
  return "primary";
}

function rightsStatusFor(source: DataSourceConfig): RightsStatus {
  if (source.type === "manual") return "manual-review";
  if (source.type === "fred" || source.type.startsWith("worldbank")) return "public-source";
  return "review-required";
}

function adapterModeFor(source: DataSourceConfig): AdapterMode {
  if (["fred", "worldbank", "worldbank-commodity", "worldbank-broad-money-basket", "coingecko"].includes(source.type)) return "server-adapter";
  if (["f-fin-json", "mendeley-csv", "quanganh-vnindex-valuation-json", "quanganh-index-json"].includes(source.type)) return "snapshot-only";
  if (source.type === "manual") return "manual-or-rights-gated";
  return "external-or-rights-gated";
}

function capabilityFor(source: DataSourceConfig): Omit<ProviderCapability, "providerId" | "providerName" | "sourceTypes" | "indicatorIds" | "frequencyLabels" | "sourceUrls" | "supportedOperations"> {
  const role = providerRoleFor(source);
  return {
    manifestVersion: PROVIDER_MANIFEST_VERSION,
    roles: [role],
    supportsHistorical: true,
    supportsRealtime: source.frequencyLabel.toLowerCase() === "daily" && role !== "snapshot",
    supportsRevisions: source.type === "fred" || source.type.startsWith("worldbank"),
    rightsStatus: rightsStatusFor(source),
    adapterMode: adapterModeFor(source),
  };
}

function supportedOperationsFor(capability: Omit<ProviderCapability, "providerId" | "providerName" | "sourceTypes" | "indicatorIds" | "frequencyLabels" | "sourceUrls" | "supportedOperations">): ProviderOperation[] {
  return [
    "catalog",
    "historical",
    ...(capability.supportsRealtime ? ["realtime" as const] : []),
    ...(capability.supportsRevisions ? ["revisions" as const] : []),
    ...(capability.adapterMode === "server-adapter" ? ["ingest" as const] : []),
    "evidence",
  ];
}

export function buildProviderRegistry(
  sources: Record<string, DataSourceConfig> = DATA_SOURCES,
): ProviderCapability[] {
  const grouped = new Map<string, ProviderCapability>();

  for (const [indicatorId, source] of Object.entries(sources)) {
    const providerId = providerIdFor(source);
    const existing = grouped.get(providerId);
    const derived = capabilityFor(source);
    const supportedOperations = supportedOperationsFor(derived);
    if (!existing) {
      grouped.set(providerId, {
        manifestVersion: PROVIDER_MANIFEST_VERSION,
        providerId,
        providerName: source.source,
        sourceTypes: [source.type],
        indicatorIds: [indicatorId],
        roles: derived.roles,
        supportsHistorical: derived.supportsHistorical,
        supportsRealtime: derived.supportsRealtime,
        supportsRevisions: derived.supportsRevisions,
        rightsStatus: derived.rightsStatus,
        adapterMode: derived.adapterMode,
        frequencyLabels: [source.frequencyLabel],
        sourceUrls: [source.sourceUrl],
        supportedOperations,
      });
      continue;
    }

    existing.sourceTypes = [...new Set([...existing.sourceTypes, source.type])];
    existing.indicatorIds.push(indicatorId);
    existing.roles = [...new Set([...existing.roles, ...derived.roles])];
    existing.supportsRealtime ||= derived.supportsRealtime;
    existing.supportsRevisions ||= derived.supportsRevisions;
    existing.frequencyLabels = [...new Set([...existing.frequencyLabels, source.frequencyLabel])];
    existing.sourceUrls = [...new Set([...existing.sourceUrls, source.sourceUrl])];
    existing.supportedOperations = [...new Set([...existing.supportedOperations, ...supportedOperations])];
    if (existing.rightsStatus === "public-source" && derived.rightsStatus !== "public-source") {
      existing.rightsStatus = derived.rightsStatus;
    }
    if (existing.adapterMode !== derived.adapterMode) existing.adapterMode = "external-or-rights-gated";
  }

  return [...grouped.values()].sort((a, b) => a.providerId.localeCompare(b.providerId));
}

export const PROVIDER_REGISTRY = buildProviderRegistry();

export function getProviderCapability(providerId: string): ProviderCapability | undefined {
  return PROVIDER_REGISTRY.find((provider) => provider.providerId === providerId);
}

export function getIndicatorProviderCapability(indicatorId: string): ProviderCapability | undefined {
  if (QUARANTINED_PROVIDER_IDS.has(indicatorId)) return undefined;
  const source = DATA_SOURCES[indicatorId];
  return source ? getProviderCapability(providerIdFor(source)) : undefined;
}

export function buildProviderRuntimeHealth(
  capabilities: ProviderCapability[] = PROVIDER_REGISTRY,
  runs: ProviderIngestionRun[] = [],
  now = new Date(),
): ProviderRuntimeHealth[] {
  return capabilities.map((provider) => {
    const providerRuns = runs.filter((run) => provider.indicatorIds.includes(run.indicatorId));
    const latestByIndicator = new Map<string, ProviderIngestionRun>();
    for (const run of providerRuns) {
      const prior = latestByIndicator.get(run.indicatorId);
      const runTime = Date.parse(run.completedAt ?? run.startedAt ?? "");
      const priorTime = Date.parse(prior?.completedAt ?? prior?.startedAt ?? "");
      if (!prior || runTime >= priorTime) latestByIndicator.set(run.indicatorId, run);
    }
    const latestRuns = [...latestByIndicator.values()];
    const latestRunAt = latestRuns
      .map((run) => run.completedAt ?? run.startedAt ?? null)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;
    const statuses = latestRuns.map((run) => run.status);
    const staleIndicatorIds = latestRuns.filter((run) => {
      if (run.status !== "succeeded" || !run.completedAt) return false;
      const source = DATA_SOURCES[run.indicatorId];
      const providerFrequency = source?.frequencyLabel ?? provider.frequencyLabels[0];
      const delayedUntilDays = freshnessSlo(providerFrequency).delayedUntilDays;
      return (now.getTime() - Date.parse(run.completedAt)) / 86_400_000 > delayedUntilDays;
    }).map((run) => run.indicatorId);
    const freshness = latestRuns.length === 0
      ? "unavailable" as const
      : staleIndicatorIds.length > 0
        ? "outdated" as const
        : statuses.some((value) => value === "succeeded")
          ? "fresh" as const
          : "unavailable" as const;
    const status: ProviderRuntimeStatus = latestRuns.length === 0
      ? "never-run"
      : statuses.some((value) => value === "running")
        ? "running"
        : statuses.some((value) => value === "failed")
          ? "failed"
            : statuses.some((value) => value === "quarantined")
              ? "quarantined"
              : staleIndicatorIds.length > 0
                ? "stale"
            : statuses.every((value) => value === "succeeded")
              ? "succeeded"
              : "unknown";
    const indicatorStatuses = Object.fromEntries(latestRuns.map((run) => {
      const stale = staleIndicatorIds.includes(run.indicatorId);
      const indicatorStatus: ProviderRuntimeStatus = run.status === "running"
        ? "running"
        : run.status === "failed"
          ? "failed"
          : run.status === "quarantined"
            ? "quarantined"
            : stale
              ? "stale"
              : run.status === "succeeded"
                ? "succeeded"
                : "unknown";
      return [run.indicatorId, indicatorStatus];
    })) as Record<string, ProviderRuntimeStatus>;
    const affectedIndicatorIds = [...new Set([
      ...latestRuns.filter((run) => ["failed", "quarantined"].includes(run.status)).map((run) => run.indicatorId),
      ...staleIndicatorIds,
    ])].sort();
    return {
      providerId: provider.providerId,
      status,
      indicatorCount: provider.indicatorIds.length,
      indicatorsWithRuns: latestRuns.length,
      lastRunAt: latestRunAt,
      failedIndicatorIds: latestRuns.filter((run) => run.status === "failed").map((run) => run.indicatorId),
      staleIndicatorIds,
      indicatorStatuses,
      affectedIndicatorIds,
      latestFailures: latestRuns.filter((run) => ["failed", "quarantined"].includes(run.status)).slice(0, 3).map((run) => ({ indicatorId: run.indicatorId, status: run.status, errorMessage: run.errorMessage ?? null, completedAt: run.completedAt ?? null })),
      freshness,
      evidence: latestRuns.length > 0 ? "ingestion-run" : "none",
    };
  });
}
