import { deterministicFingerprint } from "../src/app/data/deterministicFingerprint.js";

export const PROVIDER_MANIFEST_VERSION = "1.0.0";
export type ProviderOperation = "catalog" | "historical" | "realtime" | "revisions" | "ingest" | "evidence";
export interface ProviderOperationAvailability {
  providerId: string;
  operation: ProviderOperation;
  status: "configuration-supported" | "configuration-unsupported";
  reasonCode: "DECLARED_BY_ADAPTER" | "NOT_DECLARED_BY_ADAPTER";
  explanation: string;
  nextAction: string;
  evidence: "configuration";
  limitations: string[];
}

export function buildProviderOperationAvailability(
  provider: { providerId: string; supportedOperations?: ProviderOperation[] },
  operation: ProviderOperation,
): ProviderOperationAvailability {
  const supported = provider.supportedOperations?.includes(operation) ?? false;
  return {
    providerId: provider.providerId,
    operation,
    status: supported ? "configuration-supported" : "configuration-unsupported",
    reasonCode: supported ? "DECLARED_BY_ADAPTER" : "NOT_DECLARED_BY_ADAPTER",
    explanation: supported
      ? "The configured provider adapter declares this operation in its capability manifest."
      : "The configured provider adapter does not declare this operation.",
    nextAction: supported
      ? "Check runtime health, freshness, rights and source evidence before using the operation."
      : "Use a declared operation or update the adapter contract after review; no operation was attempted.",
    evidence: "configuration",
    limitations: ["This response does not probe the provider, invoke an adapter, prove freshness, or grant rights/redistribution permission."],
  };
}

export type ProviderErrorCode = "network" | "rate-limited" | "authentication" | "rights-gated" | "schema-invalid" | "semantic-mismatch" | "empty-response" | "parse-failed" | "unknown";
export type QuarantineReason = "invalid-date" | "non-finite-value" | "duplicate-period" | "non-chronological" | "semantic-mismatch" | "unexpected-unit";
export interface NormalizedObservation { date: string; value: number; unit?: string; }
export interface ProviderManifest {
  manifestVersion: string; providerId: string; seriesId: string; definitionKey: string; unit: string;
  frequency: string; transformation: string; transformationVersion: string; seasonalAdjustment: string;
  observations: NormalizedObservation[];
}
export interface ProviderValidationResult { valid: boolean; reasons: QuarantineReason[]; errorCode?: ProviderErrorCode; }

export interface ProviderQueryBounds {
  indicator: string;
  lookbackDays: number;
  asOf: string;
  now?: string;
}

export interface ProviderObservationWithRelease {
  date: string;
  value: number;
  status: "actual" | "estimated" | "forecast";
  vintage?: string;
  releasedAt?: string;
}

export function validateProviderQuery(bounds: ProviderQueryBounds): string[] {
  const issues: string[] = [];
  if (!/^[A-Za-z0-9_.-]{1,80}$/.test(bounds.indicator)) issues.push("invalid-indicator-identifier");
  if (!Number.isInteger(bounds.lookbackDays) || bounds.lookbackDays < 1 || bounds.lookbackDays > 3650) issues.push("invalid-lookback-days");
  if (!ISO_DATE.test(bounds.asOf) || Number.isNaN(Date.parse(`${bounds.asOf}T00:00:00Z`))) issues.push("invalid-as-of-date");
  const now = bounds.now ?? new Date().toISOString().slice(0, 10);
  if (ISO_DATE.test(bounds.asOf) && bounds.asOf > now) issues.push("future-as-of-date");
  return issues;
}

export function filterProviderObservationsByCutoff<T extends ProviderObservationWithRelease>(observations: T[], asOf: string): T[] {
  return observations.filter((observation) => !observation.releasedAt || observation.releasedAt.slice(0, 10) <= asOf);
}

export interface ProviderContractAuditRecord {
  indicatorId: string;
  providerId: string;
  valid: boolean;
  missingFields: string[];
  manifestVersion: string;
}
export interface ProviderRightsAuditRecord { providerId: string; providerName: string; rightsStatus: string; adapterMode: string; indicatorCount: number; sourceUrls: string[]; reviewRequired: boolean; }
export interface ProviderRightsReviewRecord extends ProviderRightsAuditRecord { indicatorIds: string[]; omittedIndicatorCount: number; omittedSourceUrlCount: number; reviewScope: string[]; nextActions: string[]; }
export interface ProviderEvidenceMatrixRecord { providerId: string; indicatorCount: number; contract: { valid: number; invalid: number }; rights: { status: string; reviewRequired: boolean }; operations: { evidence: "configuration-supported" | "configuration-unsupported"; ingest: "configuration-supported" | "configuration-unsupported" }; runtime: { status: string; freshness: string; indicatorsWithRuns: number; staleIndicatorCount: number }; }

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export function validateProviderManifest(manifest: ProviderManifest): ProviderValidationResult {
  const reasons: QuarantineReason[] = [];
  if (!manifest.providerId || !manifest.seriesId || !manifest.definitionKey || !manifest.unit || !manifest.frequency) {
    return { valid: false, reasons: ["semantic-mismatch"], errorCode: "schema-invalid" };
  }
  let previousDate = "";
  const dates = new Set<string>();
  for (const observation of manifest.observations) {
    if (!ISO_DATE.test(observation.date)) reasons.push("invalid-date");
    if (!Number.isFinite(observation.value)) reasons.push("non-finite-value");
    if (dates.has(observation.date)) reasons.push("duplicate-period");
    if (previousDate && observation.date < previousDate) reasons.push("non-chronological");
    dates.add(observation.date);
    previousDate = observation.date;
  }
  const uniqueReasons = [...new Set(reasons)];
  return uniqueReasons.length === 0
    ? { valid: true, reasons: [] }
    : { valid: false, reasons: uniqueReasons, errorCode: "schema-invalid" };
}

export function buildProviderContractAudit(
  sources: Record<string, { type: string; source?: string; agency?: string; sourceUrl?: string; seriesId?: string; coinId?: string; frequencyLabel?: string }> = {},
): { manifestVersion: string; total: number; valid: number; invalid: number; records: ProviderContractAuditRecord[] } {
  const records = Object.entries(sources).map(([indicatorId, source]) => {
    const missingFields = [
      ["source", source.source], ["agency", source.agency], ["sourceUrl", source.sourceUrl],
      ["seriesId", source.seriesId ?? source.coinId], ["frequencyLabel", source.frequencyLabel],
    ].filter(([, value]) => !String(value ?? "").trim()).map(([field]) => field).filter((field): field is string => Boolean(field));
    return { indicatorId, providerId: source.type, valid: missingFields.length === 0, missingFields, manifestVersion: PROVIDER_MANIFEST_VERSION };
  }).sort((a, b) => a.indicatorId.localeCompare(b.indicatorId));
  return { manifestVersion: PROVIDER_MANIFEST_VERSION, total: records.length, valid: records.filter((record) => record.valid).length, invalid: records.filter((record) => !record.valid).length, records };
}

export function buildProviderRightsAudit(capabilities: Array<{ providerId: string; providerName: string; rightsStatus: string; adapterMode: string; indicatorIds: string[]; sourceUrls: string[] }> = []) {
  const records: ProviderRightsAuditRecord[] = capabilities.map((provider) => ({ providerId: provider.providerId, providerName: provider.providerName, rightsStatus: provider.rightsStatus, adapterMode: provider.adapterMode, indicatorCount: provider.indicatorIds.length, sourceUrls: [...new Set(provider.sourceUrls)].slice(0, 20), reviewRequired: provider.rightsStatus !== "public-source" })).sort((a, b) => a.providerId.localeCompare(b.providerId));
  return { total: records.length, publicSource: records.filter((record) => record.rightsStatus === "public-source").length, reviewRequired: records.filter((record) => record.reviewRequired).length, records };
}

export function buildProviderRightsReviewPackage(
  capabilities: Array<{ providerId: string; providerName: string; rightsStatus: string; adapterMode: string; indicatorIds: string[]; sourceUrls: string[] }> = [],
  limits: { maxIndicators?: number; maxSourceUrls?: number } = {},
) {
  const maxIndicators = Math.max(1, Math.floor(limits.maxIndicators ?? 25));
  const maxSourceUrls = Math.max(1, Math.floor(limits.maxSourceUrls ?? 10));
  const records: ProviderRightsReviewRecord[] = capabilities.map((provider) => {
    const indicatorIds = [...new Set(provider.indicatorIds)].sort();
    const sourceUrls = [...new Set(provider.sourceUrls)].sort();
    const reviewRequired = provider.rightsStatus !== "public-source";
    return {
      providerId: provider.providerId,
      providerName: provider.providerName,
      rightsStatus: provider.rightsStatus,
      adapterMode: provider.adapterMode,
      indicatorCount: indicatorIds.length,
      sourceUrls: sourceUrls.slice(0, maxSourceUrls),
      reviewRequired,
      indicatorIds: indicatorIds.slice(0, maxIndicators),
      omittedIndicatorCount: Math.max(0, indicatorIds.length - maxIndicators),
      omittedSourceUrlCount: Math.max(0, sourceUrls.length - maxSourceUrls),
      reviewScope: reviewRequired
        ? ["owner-approval", "license-and-redistribution-terms", "retention-and-attribution", "provider-continuity"]
        : ["license-and-redistribution-terms", "retention-and-attribution", "provider-continuity"],
      nextActions: reviewRequired
        ? ["Obtain owner-approved rights/retention decision.", "Record provider terms and permitted redistribution scope.", "Confirm continuity/quotas before production use."]
        : ["Verify current provider terms and attribution requirements.", "Record retention and redistribution evidence.", "Recheck terms when provider or adapter changes."],
    };
  }).sort((a, b) => a.providerId.localeCompare(b.providerId));
  const packageContent = {
    schema: "macro-os.provider-rights-review-package",
    version: 1,
    records,
    summary: { total: records.length, reviewRequired: records.filter((record) => record.reviewRequired).length },
    evidence: "configuration",
    limitations: ["This package is a governance checklist, not a legal determination or redistribution license.", "Configuration and source URLs do not prove that terms were accepted or that provider continuity is guaranteed."],
  } as const;
  return { ...packageContent, fingerprint: deterministicFingerprint(packageContent) };
}

export function buildProviderEvidenceMatrix(
  capabilities: Array<{ providerId: string; rightsStatus: string; indicatorIds: string[]; supportedOperations?: string[] }> = [],
  health: Array<{ providerId: string; status: string; freshness: string; indicatorsWithRuns: number; staleIndicatorIds?: string[] }> = [],
  contractRecords: Array<{ indicatorId: string; providerId: string; valid: boolean }> = [],
): ProviderEvidenceMatrixRecord[] {
  return capabilities.map((provider) => {
    const providerHealth = health.find((item) => item.providerId === provider.providerId);
    const contract = contractRecords.filter((record) => provider.indicatorIds.includes(record.indicatorId));
    const supports = (operation: string) => provider.supportedOperations?.includes(operation) ? "configuration-supported" as const : "configuration-unsupported" as const;
    return { providerId: provider.providerId, indicatorCount: provider.indicatorIds.length, contract: { valid: contract.filter((record) => record.valid).length, invalid: contract.filter((record) => !record.valid).length }, rights: { status: provider.rightsStatus, reviewRequired: provider.rightsStatus !== "public-source" }, operations: { evidence: supports("evidence"), ingest: supports("ingest") }, runtime: { status: providerHealth?.status ?? "unknown", freshness: providerHealth?.freshness ?? "unavailable", indicatorsWithRuns: providerHealth?.indicatorsWithRuns ?? 0, staleIndicatorCount: providerHealth?.staleIndicatorIds?.length ?? 0 } };
  }).sort((a, b) => a.providerId.localeCompare(b.providerId));
}
