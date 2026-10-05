import { DataPoint, Indicator } from "../data/types";
import { resolveIndicatorSeries } from "../data/seriesUtils";
import { trackUserTelemetry } from "./telemetry";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

interface ApiObservation extends DataPoint {
  indicatorId: string;
  status: "actual" | "estimated" | "forecast";
  quality: "verified" | "provisional";
  sourceName: string;
  sourceSeriesId?: string;
  sourceUrl?: string | null;
  frequency?: string;
  transformation?: string;
  vintage: string;
  ingestedAt: string;
  freshness?: "fresh" | "delayed" | "outdated" | "unavailable";
}

export interface PlatformHealth {
  status: "ok" | "degraded" | "offline";
  time?: string;
  database?: string;
  fredConfigured?: boolean;
  supabase?: {
    configured: boolean;
    connected: boolean;
    errorCode?: "jwt-clock-or-credential" | "authentication" | "unavailable";
  };
  lastIngestion?: {
    indicatorId: string;
    status: string;
    completedAt?: string;
  } | null;
}

export interface ProviderHealthRecord {
  providerId: string;
  indicatorCount: number;
  indicatorsWithRuns: number;
  indicatorIds?: string[];
  status: string;
  evidence: string;
  lastRunAt?: string | null;
  failedIndicatorIds?: string[];
  affectedIndicatorIds?: string[];
  lastRun?: {
    indicatorId: string;
    status: string;
    startedAt?: string | null;
    completedAt?: string | null;
    errorMessage?: string | null;
  } | null;
  staleIndicatorIds?: string[];
  freshness?: "fresh" | "delayed" | "outdated" | "unavailable";
  latestFailures?: Array<{
    indicatorId: string;
    status: string;
    errorMessage: string | null;
    completedAt: string | null;
  }>;
}
export interface ProviderHealthHistoryRecord {
  providerId: string;
  indicatorId: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs?: number | null;
  errorMessage: string | null;
}
export interface ProviderTelemetryRecord {
  providerId: string;
  attempts: number;
  succeeded: number;
  failed: number;
  successRate: number | null;
  failureRate: number | null;
  freshnessBreachCount: number;
  durationSamples: number;
  p50DurationMs: number | null;
  p95DurationMs: number | null;
  evidence: "orchestration-telemetry";
}
export interface ProviderDegradationRecord {
  providerId: string;
  status: "ok" | "attention" | "insufficient-evidence";
  reasons: string[];
  evidence: "orchestration-telemetry";
  thresholds: {
    minimumAttempts: number;
    failureRate: number;
    p95DurationMs: number;
    maxFreshnessBreaches: number;
  };
}
export interface ProviderTelemetryTrendRecord {
  providerId: string;
  windowDays: number;
  current: {
    attempts: number;
    failureRate: number | null;
    p95DurationMs: number | null;
  };
  previous: {
    attempts: number;
    failureRate: number | null;
    p95DurationMs: number | null;
  };
  direction: "improving" | "worsening" | "stable" | "insufficient-evidence";
  evidence: "orchestration-telemetry";
}
export interface ProviderTelemetrySnapshotRecord {
  id: string;
  capturedAt: string;
  telemetry: ProviderTelemetryRecord[];
  degradation: ProviderDegradationRecord[];
  trends: ProviderTelemetryTrendRecord[];
}
export interface ProviderCapabilityRecord {
  providerId: string;
  providerName: string;
  indicatorIds: string[];
  adapterMode: string;
  rightsStatus: string;
  supportedOperations?: Array<"catalog" | "historical" | "realtime" | "revisions" | "ingest" | "evidence">;
}
export interface ProviderOperationAvailability {
  providerId: string;
  operation: "catalog" | "historical" | "realtime" | "revisions" | "ingest" | "evidence";
  status: "configuration-supported" | "configuration-unsupported";
  reasonCode: "DECLARED_BY_ADAPTER" | "NOT_DECLARED_BY_ADAPTER";
  explanation: string;
  nextAction: string;
  evidence: "configuration";
  limitations: string[];
}
export interface CountryCoverageRecord {
  country: string;
  registeredIndicatorIds: string[];
  registeredCount: number;
  hydratedIndicatorIds: string[];
  hydratedCount: number;
  currentHydratedIndicatorIds: string[];
  currentHydratedCount: number;
  missingIndicatorIds: string[];
  missingIndicatorPlan: Array<{
    indicatorId: string;
    priority: "core" | "supporting" | "discovery";
    priorityScore: number;
    priorityReason: string;
  }>;
  coverageRatio: number;
  currentCoverageRatio: number;
  state: "hydrated" | "registered-only" | "uncovered";
}
export interface MvpReadinessReport {
  evidence: "catalog-and-snapshot";
  target: {
    countryCount: number;
    indicatorRange: { min: number; max: number };
  };
  observed: {
    countryCount: number;
    registeredIndicatorCount: number;
    historicalHydratedCount: number;
    currentEligibleCount: number;
  };
  countryStates: {
    hydrated: number;
    registeredOnly: number;
    uncovered: number;
  };
  dimensions: {
    scope: MvpReadinessDimension;
    historicalEvidence: MvpReadinessDimension;
    currentEvidence: MvpReadinessDimension;
  };
  priorityGaps: Array<{
    country: string;
    indicatorId: string;
    priority: "core" | "supporting" | "discovery";
    priorityScore: number;
    priorityReason: string;
  }>;
  state: "partial" | "on-track" | "unavailable";
  nextActions: string[];
  limitations: string[];
  fingerprint?: string;
  artifact?: {
    schema: "macro-os.mvp-readiness";
    version: 1;
    exportedAt: string;
    fingerprint: string;
    boundary: "bounded-catalog-and-snapshot-planning-artifact";
    report: MvpReadinessReport;
    countries: CountryCoverageRecord[];
    limitations: string[];
  };
}
export interface MvpReadinessDimension {
  status: "pass" | "attention" | "unavailable";
  observed: number;
  target: number;
  detail: string;
}

export interface ProductionPreflightCheck {
  id: string;
  status: "pass" | "attention" | "blocked";
  detail: string;
}
export interface ProductionPreflight {
  productionReady: boolean;
  checks: ProductionPreflightCheck[];
  nextActions?: Array<{ id: string; action: string }>;
  limitations: string[];
}
export interface IndicatorCatalogRecord {
  indicatorId: string;
  type: string;
  source: string;
  seriesId: string | null;
  sourceUrl: string;
  frequency: string;
  providerId: string | null;
  rightsStatus: string | null;
  adapterMode: string | null;
  fetchable: boolean;
  acquisitionStatus: string;
  licenseReview: string;
}
export interface SourceReconciliation {
  indicatorId: string;
  status: string;
  mapping: unknown;
  reconciliation: unknown;
  evidence: string;
  limitation: string;
  limitations: string[];
}
export interface SourceMappingReport {
  indicatorId: string;
  status: "declared" | "no-mapping" | "invalid-mapping";
  evidence: string;
  limitation: string;
}
export interface ProviderRedundancyRecord {
  indicatorId: string;
  state:
    | "no-mapping"
    | "mapped-unreconciled"
    | "reconciled-blocked"
    | "reconciled-candidate";
  evidence: string;
  suitableForFallback: boolean | null;
  limitation: string;
}
export interface ProviderRedundancyReport {
  records: ProviderRedundancyRecord[];
  counts: Record<ProviderRedundancyRecord["state"], number>;
  evidence: string;
  automaticFallback: false;
  limitations: string[];
}
export interface ProviderContractAudit {
  manifestVersion: string;
  total: number;
  valid: number;
  invalid: number;
  records: Array<{
    indicatorId: string;
    providerId: string;
    valid: boolean;
    missingFields: string[];
    manifestVersion: string;
  }>;
}
export interface ProviderRightsAudit {
  total: number;
  publicSource: number;
  reviewRequired: number;
  records: Array<{
    providerId: string;
    providerName: string;
    rightsStatus: string;
    adapterMode: string;
    indicatorCount: number;
    sourceUrls: string[];
    reviewRequired: boolean;
  }>;
}
export interface ProviderEvidenceMatrixRecord {
  providerId: string;
  indicatorCount: number;
  contract: { valid: number; invalid: number };
  rights: { status: string; reviewRequired: boolean };
  operations?: { evidence: "configuration-supported" | "configuration-unsupported"; ingest: "configuration-supported" | "configuration-unsupported" };
  runtime: {
    status: string;
    freshness: string;
    indicatorsWithRuns: number;
    staleIndicatorCount: number;
  };
}

export interface ProviderRightsReviewPackage {
  schema: "macro-os.provider-rights-review-package";
  version: 1;
  fingerprint: string;
  records: Array<{
    providerId: string;
    providerName: string;
    rightsStatus: string;
    adapterMode: string;
    indicatorCount: number;
    sourceUrls: string[];
    reviewRequired: boolean;
    indicatorIds: string[];
    omittedIndicatorCount: number;
    omittedSourceUrlCount: number;
    reviewScope: string[];
    nextActions: string[];
  }>;
  summary: { total: number; reviewRequired: number };
  evidence: "configuration";
  limitations: string[];
}
export interface EvidenceCommentaryResponse {
  evidence: string;
  records: Array<{
    indicatorId: string;
    observations: Array<{
      date: string;
      value: number;
      status: "actual";
      quality: "verified";
    }>;
    freshness?: string;
    latestObservationEligible?: boolean;
    eligibleObservationCount?: number;
    currentEligibleObservationCount?: number;
    operationSupported?: boolean;
    operationAvailability?: ProviderOperationAvailability | null;
    evidenceState?: "current-eligible" | "historical-eligible" | "none";
    currentEvidence?: boolean;
    source: {
      name: string;
      agency: string;
      seriesId: string | null;
      sourceUrl: string;
      unit: string | null;
      frequency: string;
    };
  }>;
  calculation: {
    method: "latest-direction";
    causalInference: false;
    inputs: string[];
  };
  limitations: string[];
}
export interface OpenBBSidecarStatus {
  configured: boolean;
  status: "not-configured" | "staging-configured" | "pilot-gate-pending";
  endpointConfigured: boolean;
  rightsReviewRecorded: boolean;
  runtimeEvidence: "not-probed";
  promotion: "staging-only";
  limitations: string[];
}
export interface OpenBBPilotGateReport {
  decision: "pilot-gate-pending" | "retain-isolated-sidecar";
  checks: {
    endpointConfigured: boolean;
    rightsReviewRecorded: boolean;
    runtimeProbe: "not-probed" | "reachable" | "unreachable";
    comparisonReview: "not-run" | "reviewable" | "blocked";
    promotion: "staging-only";
  };
  reasonCodes: string[];
  nextActions: string[];
  evidence: "configuration-and-staging-review";
  limitations: string[];
}
export interface OpenBBPilotGateArtifactResponse {
  evidence: "configuration-and-staging-review";
  artifact: { schema: "macro-os.openbb-pilot-gate"; version: 1; exportedAt: string; fingerprint: string; boundary: "bounded-staging-governance-report"; report: OpenBBPilotGateReport; limitations: string[] };
  limitations: string[];
}
export interface FallbackReviewRecord extends ResearchRunRecord {
  output: {
    schema: "macro-os.provider-fallback-review";
    decision: "approved" | "rejected";
    reviewer: string;
    rationale: string;
    indicatorId: string;
    primaryIndicatorId: string;
    fallbackIndicatorId: string;
    evidence: Array<{ kind: string; reference: string }>;
    automaticFallback: false;
  };
}
export interface FallbackReviewResponse {
  reviews: FallbackReviewRecord[];
  evidence: string;
  limitations: string[];
}

export interface QualityFreshnessRow {
  indicatorId: string;
  observedThrough: string | null;
  ingestedAt: string | null;
  sourceName: string | null;
  sourceSeriesId: string | null;
  sourceUrl: string | null;
  frequency: string | null;
  status: "fresh" | "delayed" | "outdated" | "unavailable";
}

export interface PlatformQuality {
  observations: number;
  quarantined: number;
  runSummary: Array<{ status: string; count: number }>;
  freshness: QualityFreshnessRow[];
}

export interface FreshnessSlo {
  frequency: string;
  freshWithinDays: number;
  delayedUntilDays: number;
}

export interface VerifiedObservationsResponse {
  indicatorId: string;
  observations: ApiObservation[];
  count: number;
  evidence: "actual-verified-source-backed" | "none";
  freshness: "fresh" | "delayed" | "outdated" | "unavailable";
  operationAvailability?: ProviderOperationAvailability;
  researchEligibility: {
    hasVerifiedActual: boolean;
    hasCurrentEvidence?: boolean;
    eligibleObservationCount: number;
    currentEligibleObservationCount?: number;
    freshness: string;
    latestObservationEligible?: boolean;
    operation?: "evidence";
    operationSupported?: boolean;
  };
  source: {
    source: string;
    seriesId: string | null;
    sourceUrl: string;
    frequency: string;
    unit: string | null;
  };
  limitations: string[];
}

export interface ForecastRecord {
  id: string;
  indicatorId: string;
  country: string;
  forecastValue: number;
  forecastDate: string;
  targetDate: string;
  institution: string;
  analyst?: string;
  methodology: string;
  confidence?: number;
  version: number;
  status: "consensus" | "internal";
  sourceName: string;
  sourceUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface InstitutionalOutlookRecord {
  id: string;
  indicatorId: string;
  country: string;
  institution: string;
  analyst?: string;
  publicationDate: string;
  targetDate: string;
  midpoint: number | null;
  rangeLow: number | null;
  rangeHigh: number | null;
  direction?: "stronger" | "weaker" | "range-bound" | "mixed";
  thesis: string;
  methodology: string;
  sourceName: string;
  sourceUrl: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ForecastAccuracyRecord {
  id: string;
  indicatorId: string;
  targetDate: string;
  forecastValue: number;
  institution: string;
  actualValue: number | null;
  accuracyState: "available" | "pending";
  error: number | null;
  absolutePercentageError: number | null;
}

export interface ForecastSummary {
  indicatorId: string;
  targetDate: string;
  institutionCount: number;
  recordCount: number;
  min: number;
  max: number;
  average: number;
  median: number;
  latestVersion: number;
  eligibleRecordCount?: number;
  evidenceState?: "complete" | "partial" | "unavailable";
}

export interface ForecastRevisionRecord extends ForecastAccuracyRecord {
  forecastDate: string;
  version: number;
  sourceName: string | null;
  sourceUrl: string | null;
  sourceGovernance?: { sourceId: string; eligible: boolean; state: "eligible" | "review-required" | "disabled"; reason: string };
  methodology: string | null;
  lifecycle: "published" | "revised" | "superseded" | "evaluated";
}

export interface ForecastRevisionTimeline {
  indicatorId: string;
  institution: string;
  targetDate: string;
  current: ForecastRevisionRecord;
  revisions: ForecastRevisionRecord[];
  revisionCount: number;
  evaluationState: "pending" | "evaluated";
  limitation: string;
}

export interface ResearchMemoryRecord {
  id: string;
  predictionId: string;
  indicatorId: string;
  institution: string;
  version: number;
  targetDate: string;
  predictionValue: number;
  actualValue: number;
  actualDate: string;
  actualStatus: "actual-verified-source-backed";
  predictionSource: string;
  predictionFingerprint: string;
  debateSessionId: string | null;
  debateFingerprint: string | null;
  error: number;
  absolutePercentageError: number | null;
  predictedDirection: "higher" | "lower" | "flat";
  actualDirection: "higher" | "lower" | "flat";
  directionCorrect: boolean;
  lesson: string | null;
  createdAt?: string;
}

export async function fetchResearchMemory(indicatorId?: string, signal?: AbortSignal) {
  const query = indicatorId ? `?indicatorId=${encodeURIComponent(indicatorId)}` : "";
  return getJson<{ memory: ResearchMemoryRecord[]; evidence: "actual-verified-source-backed" | "none"; limitations: string[] }>(`/api/research-memory${query}`, signal);
}

export interface InternalForecastModelReport {
  modelId: "naive-persistence-v1";
  methodology: string;
  status: "ready" | "unavailable";
  eligibleObservationCount: number;
  currentEvidence: boolean;
  freshness: string;
  asOfPeriod: string | null;
  targetPeriod: string | null;
  forecastValue: number | null;
  backtest: { sampleSize: number; mae: number | null; mape: number | null };
  limitation: string;
  operationSupported?: boolean;
}

export interface PersistedAlertRecord {
  id: string;
  indicatorId: string;
  condition: "above" | "below" | "crossover";
  threshold: number;
  active: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedAlertEvent {
  id: number;
  alertId: string;
  indicatorId: string;
  observationPeriod: string;
  observedValue: number;
  triggeredAt: string;
  acknowledgedAt?: string;
}
export interface AlertEvidenceExplanation {
  event: {
    id: number;
    indicatorId: string;
    observationPeriod: string;
    observedValue: number;
    triggeredAt: string;
    acknowledgedAt?: string | null;
  };
  alert: {
    condition: string;
    threshold: number;
    note?: string | null;
    active: number;
  } | null;
  source: { source: string; seriesId: string | null; sourceUrl: string } | null;
  evidence: "recorded-alert-event";
  limitations: string[];
}

export interface IngestionMetrics {
  runtime: {
    evidence: string;
    counters: {
      runs: number;
      successfulIndicators: number;
      failedIndicators: number;
      retriedIndicators: number;
      attempts: number;
    };
    limitations: string[];
  };
  persisted: {
    evidence: string;
    counters: {
      jobs: number;
      active: number;
      stale: number;
      succeeded: number;
      failed: number;
      recovered: number;
      retried: number;
      attempts: number;
    };
    latestFailures: Array<{
      indicatorId?: string;
      completedAt?: string;
      errorMessage?: string;
    }>;
    limitations: string[];
  };
}

export interface ResearchRunRecord {
  id: string;
  title: string;
  question: string;
  indicatorIds: string[];
  sourceVintages: Array<{
    indicatorId: string;
    sourceSeriesId: string | null;
    vintage: string | null;
  }>;
  dateRange: { start: string | null; end: string | null };
  transformations: string[];
  calculation: { method: string; version: string };
  output: unknown;
  evidence: Array<{
    indicatorId: string;
    sourceUrl: string;
    periods: string[];
  }>;
  limitations: string[];
  createdAt: string;
}

export interface ResearchLineageRecord {
  runId: string;
  nodes: Array<{ id: string; type: string; label: string; evidence: string }>;
  edges: Array<{ from: string; to: string; relation: string }>;
  limitations: string[];
}

export interface ResearchRunExportResponse {
  evidence: "persisted-research-artifact";
  artifact: {
    schema: "macro-os.research-run";
    version: 1;
    exportedAt: string;
    fingerprint: string;
    run: ResearchRunRecord;
    boundary: "persisted-research-artifact";
    limitations: string[];
  };
  limitations: string[];
}

export interface OpenBBReviewArtifactRecord {
  schema: "macro-os.openbb-comparison-review";
  version: number;
  exportedAt: string;
  boundary: "staging-only-review-artifact";
  comparison: {
    indicatorId: string;
    sidecar: {
      source: string;
      seriesId: string;
      sourceUrl: string;
      unit: string;
      frequency: string;
      rightsStatus: string;
      observationCount: number;
      freshness: string;
      runtime?: {
        observedAt: string;
        latestObservationDate: string | null;
        latencyMs: number;
      } | null;
    };
    macroOs: { observationCount: number };
    overlap: { count: number; first: string | null; last: string | null };
    revisions: { revisedPeriodCount: number };
    comparisonAudit: {
      semantics: { status: string };
      revisions: { status: string };
      freshness: {
        status: string;
        measured: boolean;
        latestObservationDate: string | null;
      };
      rights: { status: string; classification: string };
      operationalCost: { status: string; latencyMs: number | null };
    };
    reviewability: { status: string; reasons: string[] };
    reviewDecision: {
      status: "ready-for-human-review" | "blocked" | "insufficient-evidence";
      reasonCodes: string[];
      nextActions: string[];
      limitation: string;
    };
    discrepancySummary: {
      count: number;
      meanAbsoluteDifference: number | null;
      maxAbsoluteDifference: number | null;
    };
  };
  limitations: string[];
}

export interface OpenBBReviewResponse {
  evidence: "persisted-staging-review";
  reviewRunId: string;
  createdAt: string | null;
  reviewArtifact: OpenBBReviewArtifactRecord;
  limitations: string[];
}

export interface OpenBBReviewPackageResponse {
  evidence: "persisted-staging-review-package";
  artifact: {
    schema: "macro-os.openbb-review-package";
    version: 1;
    exportedAt: string;
    fingerprint: string;
    boundary: "bounded-persisted-staging-review";
    run: ResearchRunRecord;
    reviewArtifact: OpenBBReviewArtifactRecord;
    lineage: ResearchLineageRecord;
    limitations: string[];
  };
  limitations: string[];
}

export interface IndicatorEvidenceBundle {
  indicator: {
    indicatorId: string;
    sourceUrl: string | null;
    frequency: string | null;
  };
  latest: { date: string; value: number; vintage?: string | null } | null;
  changes: {
    periodChanges: Array<{
      date: string;
      previousDate: string;
      delta: number;
      percentChange: number | null;
      vintage: string | null;
    }>;
    vintageChanges: Array<{
      date: string;
      delta: number;
      vintage: string | null;
      previousVintage: string | null;
    }>;
    limitations: string[];
  };
  availability: {
    status: string;
    reasonCode: string;
    explanation: string;
    nextAction: string;
    freshness: string;
  };
  operationAvailability?: ProviderOperationAvailability | null;
  records?: Array<{
    observations: Array<{
      date: string;
      value: number;
      status: string;
      quality: string;
    }>;
  }>;
  researchEligibility?: {
    eligibleObservationCount: number;
    hasVerifiedActual: boolean;
    requiresSourceBackedEvidence: boolean;
    operation?: "evidence";
    operationSupported?: boolean;
  };
}

export interface ComparisonEvidence {
  indicators: Array<{
    indicatorId: string;
    source: string;
    seriesId: string | null;
    sourceUrl: string;
    frequency: string;
    freshness?: string;
    operationAvailability?: ProviderOperationAvailability;
  }>;
  report: {
    indicatorIds: string[];
    transformation: string;
    evidenceState?: string;
    currentEvidenceState?: string;
    eligibleCounts?: Record<string, number>;
    currentEligibleCounts?: Record<string, number>;
    excludedCounts?: Record<string, number>;
    operationAvailability?: Record<string, ProviderOperationAvailability>;
    overlap: { status: string; count: number; periods: string[] };
    relationship: {
      correlation: number | null;
      sampleSize: number;
      lagSweep?: Array<{
        lag: number;
        correlation: number | null;
        sampleSize: number;
      }>;
    } | null;
    limitations: string[];
  };
  limitations: string[];
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const timeoutSignal = AbortSignal.timeout(15_000);
  const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json" },
    signal: requestSignal,
  });
  if (!response.ok) throw new Error(`Platform API ${response.status}: ${path}`);
  return response.json() as Promise<T>;
}

export async function fetchPlatformHealth(
  signal?: AbortSignal,
): Promise<PlatformHealth> {
  return getJson<PlatformHealth>("/api/health", signal);
}

export async function fetchProductionPreflight(
  signal?: AbortSignal,
): Promise<ProductionPreflight> {
  return getJson<ProductionPreflight>("/api/production-preflight", signal);
}

export async function fetchSourceReconciliation(
  indicatorId: string,
  signal?: AbortSignal,
): Promise<SourceReconciliation> {
  return getJson<SourceReconciliation>(
    `/api/mcp/tools/get_source_reconciliation?indicatorId=${encodeURIComponent(indicatorId)}`,
    signal,
  );
}

export async function fetchSourceMappings(
  signal?: AbortSignal,
): Promise<{ mappings: SourceMappingReport[]; declaredMappingCount: number }> {
  return getJson<{
    mappings: SourceMappingReport[];
    declaredMappingCount: number;
  }>("/api/source-mappings", signal);
}

export async function fetchProviderRedundancy(
  signal?: AbortSignal,
): Promise<ProviderRedundancyReport> {
  return getJson<ProviderRedundancyReport>("/api/provider-redundancy", signal);
}

export async function fetchPlatformQuality(
  signal?: AbortSignal,
): Promise<PlatformQuality> {
  return getJson<PlatformQuality>("/api/quality", signal);
}

export async function fetchIndicatorCatalog(
  signal?: AbortSignal,
): Promise<IndicatorCatalogRecord[]> {
  return getJson<IndicatorCatalogRecord[]>("/api/catalog", signal);
}

export async function fetchCountryCoverage(
  signal?: AbortSignal,
): Promise<CountryCoverageRecord[]> {
  const payload = await getJson<{ countries: CountryCoverageRecord[] }>(
    "/api/coverage/countries",
    signal,
  );
  return payload.countries;
}
export async function fetchMvpReadiness(
  signal?: AbortSignal,
): Promise<MvpReadinessReport> {
  return getJson<MvpReadinessReport>("/api/mvp/readiness", signal);
}

export async function fetchFreshnessSlos(
  signal?: AbortSignal,
): Promise<FreshnessSlo[]> {
  const payload = await getJson<{ slos: FreshnessSlo[] }>(
    "/api/freshness-slos",
    signal,
  );
  return payload.slos;
}

export async function fetchProviderHealth(
  providerId?: string,
  signal?: AbortSignal,
): Promise<ProviderHealthRecord[]> {
  const query = providerId
    ? `?providerId=${encodeURIComponent(providerId)}`
    : "";
  const payload = await getJson<{ providers: ProviderHealthRecord[] }>(
    `/api/mcp/tools/get_provider_health${query}`,
    signal,
  );
  return payload.providers;
}

export async function fetchProviderHealthHistory(
  providerId?: string,
  limit = 20,
  signal?: AbortSignal,
): Promise<ProviderHealthHistoryRecord[]> {
  const query = new URLSearchParams({ limit: String(Math.min(50, limit)) });
  if (providerId) query.set("providerId", providerId);
  const payload = await getJson<{ history: ProviderHealthHistoryRecord[] }>(
    `/api/provider-health/history?${query}`,
    signal,
  );
  return payload.history;
}

export async function fetchProviderTelemetry(signal?: AbortSignal): Promise<{
  telemetry: ProviderTelemetryRecord[];
  degradation: ProviderDegradationRecord[];
  trends: ProviderTelemetryTrendRecord[];
}> {
  return getJson<{
    telemetry: ProviderTelemetryRecord[];
    degradation: ProviderDegradationRecord[];
    trends: ProviderTelemetryTrendRecord[];
  }>("/api/provider-health/telemetry", signal);
}

export async function fetchProviderTelemetrySnapshots(
  signal?: AbortSignal,
): Promise<ProviderTelemetrySnapshotRecord[]> {
  const payload = await getJson<{
    snapshots: ProviderTelemetrySnapshotRecord[];
  }>("/api/provider-health/telemetry/snapshots", signal);
  return payload.snapshots;
}

export async function fetchProviderCapabilities(
  signal?: AbortSignal,
): Promise<ProviderCapabilityRecord[]> {
  const payload = await getJson<{ providers: ProviderCapabilityRecord[] }>(
    "/api/providers",
    signal,
  );
  return payload.providers;
}

export async function fetchProviderOperationAvailability(
  providerId: string,
  operation: ProviderOperationAvailability["operation"],
  signal?: AbortSignal,
): Promise<ProviderOperationAvailability> {
  return getJson<ProviderOperationAvailability>(
    `/api/providers/${encodeURIComponent(providerId)}/operations/${encodeURIComponent(operation)}`,
    signal,
  );
}

export async function fetchProviderContractAudit(
  signal?: AbortSignal,
): Promise<ProviderContractAudit> {
  const payload = await getJson<{ audit: ProviderContractAudit }>(
    "/api/provider-contract",
    signal,
  );
  return payload.audit;
}
export async function fetchProviderRightsAudit(
  signal?: AbortSignal,
): Promise<ProviderRightsAudit> {
  const payload = await getJson<{ audit: ProviderRightsAudit }>(
    "/api/provider-rights",
    signal,
  );
  return payload.audit;
}
export async function fetchProviderRightsReviewPackage(
  signal?: AbortSignal,
): Promise<ProviderRightsReviewPackage> {
  return getJson<ProviderRightsReviewPackage>(
    "/api/provider-rights/review-package",
    signal,
  );
}
export async function fetchProviderRightsDetail(
  providerId: string,
  signal?: AbortSignal,
): Promise<ProviderRightsAudit["records"][number]> {
  const payload = await getJson<{
    provider: ProviderRightsAudit["records"][number];
  }>(`/api/provider-rights/${encodeURIComponent(providerId)}`, signal);
  return payload.provider;
}
export async function fetchProviderRightsMcp(
  providerId?: string,
  signal?: AbortSignal,
): Promise<ProviderRightsAudit> {
  const query = providerId
    ? `?providerId=${encodeURIComponent(providerId)}`
    : "";
  const payload = await getJson<{
    providers: ProviderRightsAudit["records"];
    summary: Pick<
      ProviderRightsAudit,
      "total" | "publicSource" | "reviewRequired"
    >;
  }>(`/api/mcp/tools/get_provider_rights${query}`, signal);
  return { ...payload.summary, records: payload.providers };
}
export async function fetchProviderEvidenceMatrix(
  signal?: AbortSignal,
): Promise<ProviderEvidenceMatrixRecord[]> {
  const payload = await getJson<{ matrix: ProviderEvidenceMatrixRecord[] }>(
    "/api/provider-evidence-matrix",
    signal,
  );
  return payload.matrix;
}
export async function fetchProviderEvidenceMatrixMcp(
  providerId?: string,
  signal?: AbortSignal,
): Promise<ProviderEvidenceMatrixRecord[]> {
  const query = providerId
    ? `?providerId=${encodeURIComponent(providerId)}`
    : "";
  const payload = await getJson<{ matrix: ProviderEvidenceMatrixRecord[] }>(
    `/api/mcp/tools/get_provider_evidence_matrix${query}`,
    signal,
  );
  return payload.matrix;
}
export async function fetchOpenBBSidecarStatus(
  signal?: AbortSignal,
): Promise<OpenBBSidecarStatus> {
  const payload = await getJson<{ sidecar: OpenBBSidecarStatus }>(
    "/api/openbb/status",
    signal,
  );
  return payload.sidecar;
}
export async function fetchOpenBBSidecarStatusMcp(
  signal?: AbortSignal,
): Promise<OpenBBSidecarStatus> {
  const payload = await getJson<{ sidecar: OpenBBSidecarStatus }>(
    "/api/mcp/tools/get_openbb_sidecar_status",
    signal,
  );
  return payload.sidecar;
}
export async function fetchOpenBBPilotGate(
  signal?: AbortSignal,
): Promise<OpenBBPilotGateReport> {
  return getJson<OpenBBPilotGateReport>("/api/openbb/pilot-gate", signal);
}

export async function fetchOpenBBPilotGateArtifact(
  signal?: AbortSignal,
): Promise<OpenBBPilotGateArtifactResponse> {
  return getJson<OpenBBPilotGateArtifactResponse>("/api/openbb/pilot-gate/export", signal);
}

export async function fetchVerifiedObservations(
  indicatorId: string,
  limit = 300,
  signal?: AbortSignal,
): Promise<VerifiedObservationsResponse> {
  const query = new URLSearchParams({ indicatorId, limit: String(limit) });
  return getJson<VerifiedObservationsResponse>(
    `/api/mcp/tools/get_verified_observations?${query}`,
    signal,
  );
}

export async function fetchEvidenceCommentary(
  indicatorIds: string[],
  limit = 20,
  signal?: AbortSignal,
): Promise<EvidenceCommentaryResponse> {
  const query = new URLSearchParams({
    indicatorIds: indicatorIds.join(","),
    limit: String(Math.min(100, limit)),
  });
  return getJson<EvidenceCommentaryResponse>(
    `/api/mcp/tools/get_evidence_commentary?${query}`,
    signal,
  );
}

export async function fetchForecasts(
  signal?: AbortSignal,
): Promise<ForecastRecord[]> {
  const payload = await getJson<{ forecasts: ForecastRecord[] }>(
    "/api/forecasts",
    signal,
  );
  return payload.forecasts;
}

export async function fetchForecastDebates(signal?: AbortSignal) {
  return getJson<{ debates: Array<{ forecastId: string; session: import("../data/macroDebate").DebateSession }>; evidence: string; limitations: string[] }>("/api/forecast-debates", signal);
}

export interface ForecastCoverageRow {
  indicatorId: string;
  name: string | null;
  country: string | null;
  category: string | null;
  covered: boolean;
  forecastCount: number;
  latest: (ForecastRecord & { debateAvailable?: boolean }) | null;
}

export interface ForecastCoverage {
  generatedAt: string;
  totalIndicators: number;
  coveredIndicators: number;
  uncoveredIndicators: number;
  coveragePercent: number;
  rows: ForecastCoverageRow[];
  evidence: string;
  limitations: string[];
}

export async function fetchForecastCoverage(signal?: AbortSignal): Promise<ForecastCoverage> {
  return getJson<ForecastCoverage>("/api/forecast-coverage", signal);
}

export async function fetchInstitutionalOutlooks(
  signal?: AbortSignal,
): Promise<InstitutionalOutlookRecord[]> {
  const payload = await getJson<{ outlooks: InstitutionalOutlookRecord[] }>(
    "/api/institutional-outlooks",
    signal,
  );
  return payload.outlooks;
}

export async function fetchForecastAccuracy(
  signal?: AbortSignal,
): Promise<ForecastAccuracyRecord[]> {
  const payload = await getJson<{ forecasts: ForecastAccuracyRecord[] }>(
    "/api/forecast-accuracy",
    signal,
  );
  return payload.forecasts;
}

export async function fetchForecastSummaries(
  signal?: AbortSignal,
): Promise<ForecastSummary[]> {
  const payload = await getJson<{ summaries: ForecastSummary[] }>(
    "/api/forecast-summaries",
    signal,
  );
  return payload.summaries;
}

export async function fetchForecastRevisionTimelines(
  indicatorId?: string,
  signal?: AbortSignal,
): Promise<ForecastRevisionTimeline[]> {
  const query = indicatorId
    ? `?indicatorId=${encodeURIComponent(indicatorId)}`
    : "";
  const payload = await getJson<{ timelines: ForecastRevisionTimeline[] }>(
    `/api/forecast-revisions${query}`,
    signal,
  );
  return payload.timelines;
}

export async function fetchForecastRevisionEvidence(
  indicatorId?: string,
  signal?: AbortSignal,
): Promise<ForecastRevisionTimeline[]> {
  const query = indicatorId
    ? `?indicatorId=${encodeURIComponent(indicatorId)}`
    : "";
  const payload = await getJson<{ timelines: ForecastRevisionTimeline[] }>(
    `/api/mcp/tools/get_forecast_revision_evidence${query}`,
    signal,
  );
  return payload.timelines;
}

export async function fetchInternalForecastModel(
  indicatorId: string,
  signal?: AbortSignal,
): Promise<InternalForecastModelReport> {
  const query = new URLSearchParams({ indicatorId });
  const payload = await getJson<{ report: InternalForecastModelReport }>(
    `/api/internal-forecast-model?${query}`,
    signal,
  );
  return payload.report;
}

export async function fetchPersistedAlerts(
  signal?: AbortSignal,
): Promise<PersistedAlertRecord[]> {
  return getJson<PersistedAlertRecord[]>("/api/alerts", signal);
}

export async function fetchPersistedAlertEvents(
  signal?: AbortSignal,
): Promise<PersistedAlertEvent[]> {
  return getJson<PersistedAlertEvent[]>("/api/alert-events", signal);
}

export async function fetchAlertEvidence(
  eventId: number,
  signal?: AbortSignal,
): Promise<AlertEvidenceExplanation> {
  return getJson<AlertEvidenceExplanation>(
    `/api/mcp/tools/explain_alert_evidence?eventId=${encodeURIComponent(eventId)}`,
    signal,
  );
}

export async function fetchIngestionMetrics(
  signal?: AbortSignal,
): Promise<IngestionMetrics> {
  return getJson<IngestionMetrics>("/api/ingestion-metrics", signal);
}

export interface ResearchRunsPage {
  runs: ResearchRunRecord[];
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
    nextOffset: number | null;
  };
  filters: {
    indicatorId: string | null;
    calculationMethod: string | null;
    reviewDecisionStatus: string | null;
  };
}

export async function fetchResearchRuns(
  indicatorId?: string,
  signal?: AbortSignal,
  options: {
    limit?: number;
    offset?: number;
    calculationMethod?: string;
    reviewDecisionStatus?: string;
  } = {},
): Promise<ResearchRunsPage> {
  const params = new URLSearchParams();
  if (indicatorId) params.set("indicatorId", indicatorId);
  if (options.limit != null) params.set("limit", String(options.limit));
  if (options.offset != null) params.set("offset", String(options.offset));
  if (options.calculationMethod)
    params.set("calculationMethod", options.calculationMethod);
  if (options.reviewDecisionStatus)
    params.set("reviewDecisionStatus", options.reviewDecisionStatus);
  const payload = await getJson<ResearchRunsPage>(
    `/api/research-runs?${params}`,
    signal,
  );
  return payload;
}

export async function fetchFallbackReviews(
  signal?: AbortSignal,
): Promise<FallbackReviewResponse> {
  return getJson<FallbackReviewResponse>(
    "/api/fallback-reviews?limit=20",
    signal,
  );
}

export async function fetchResearchLineage(
  runId: string,
  signal?: AbortSignal,
): Promise<ResearchLineageRecord> {
  const payload = await getJson<{ lineage: ResearchLineageRecord }>(
    `/api/research-runs/${encodeURIComponent(runId)}/lineage`,
    signal,
  );
  return payload.lineage;
}

export async function fetchResearchRunLineageEvidence(
  runId: string,
  signal?: AbortSignal,
): Promise<ResearchLineageRecord> {
  const payload = await getJson<{ lineage: ResearchLineageRecord }>(
    `/api/mcp/tools/get_research_run_lineage?runId=${encodeURIComponent(runId)}`,
    signal,
  );
  return payload.lineage;
}

export async function fetchResearchRunExport(
  runId: string,
  signal?: AbortSignal,
): Promise<ResearchRunExportResponse> {
  return getJson<ResearchRunExportResponse>(
    `/api/research-runs/${encodeURIComponent(runId)}/export`,
    signal,
  );
}

export async function fetchOpenBBReview(
  runId: string,
  signal?: AbortSignal,
): Promise<OpenBBReviewResponse> {
  return getJson<OpenBBReviewResponse>(
    `/api/research-runs/${encodeURIComponent(runId)}/openbb-review`,
    signal,
  );
}

export async function fetchOpenBBReviewPackage(
  runId: string,
  signal?: AbortSignal,
): Promise<OpenBBReviewPackageResponse> {
  return getJson<OpenBBReviewPackageResponse>(
    `/api/research-runs/${encodeURIComponent(runId)}/openbb-review/export`,
    signal,
  );
}

export async function fetchIndicatorEvidence(
  indicatorId: string,
  signal?: AbortSignal,
): Promise<IndicatorEvidenceBundle> {
  return getJson<IndicatorEvidenceBundle>(
    `/api/evidence/indicator/${encodeURIComponent(indicatorId)}`,
    signal,
  );
}

export async function fetchComparisonEvidence(
  indicatorIds: string[],
  options?: { transformation?: string; maxLag?: number },
  signal?: AbortSignal,
): Promise<ComparisonEvidence> {
  const params = new URLSearchParams({
    indicatorIds: indicatorIds.join(","),
    ...(options?.transformation
      ? { transformation: options.transformation }
      : {}),
    ...(options?.maxLag ? { maxLag: String(options.maxLag) } : {}),
  });
  return getJson<ComparisonEvidence>(
    `/api/evidence/compare?${params.toString()}`,
    signal,
  );
}

export async function hydrateActualIndicators(
  baseIndicators: Indicator[],
  signal?: AbortSignal,
  onProgress?: (indicators: Indicator[]) => void,
): Promise<Indicator[]> {
  const hydrationStartedAt = Date.now();
  const hydrationSessionId = typeof window !== "undefined"
    ? (window.sessionStorage.getItem("macro_os_hydration_session") ?? (() => {
      const id = `hydration_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      window.sessionStorage.setItem("macro_os_hydration_session", id);
      return id;
    })())
    : "server";
  // The catalog contains bounded research series; requesting 10k points for
  // every indicator made first paint wait on a large fan-out. Keep the request
  // bounded while retaining enough history for the product's chart contract.
  const seriesLimit = 2000;
  const snapshots = await getJson<ApiObservation[]>("/api/snapshots", signal);
  const hydrateOne = async (snapshot: ApiObservation) => {
      const base = baseIndicators.find(
        (indicator) => indicator.id === snapshot.indicatorId,
      );
      if (!base) return null;
      const payload = await getJson<{
        indicatorId: string;
        series: ApiObservation[];
        operationAvailability?: ProviderOperationAvailability;
        researchEligibility?: { operation: "evidence"; operationSupported: boolean };
      }>(
        `/api/series/${encodeURIComponent(snapshot.indicatorId)}?limit=${seriesLimit}`,
        signal,
      );
      return resolveIndicatorSeries(base, payload.series, {
        status: snapshot.status,
        quality: snapshot.quality,
        sourceName: snapshot.sourceName,
        sourceSeriesId: snapshot.sourceSeriesId,
        sourceUrl: snapshot.sourceUrl ?? base.provenance?.sourceUrl,
        transformation: base.provenance?.transformation,
        seasonalAdjustment: base.provenance?.seasonalAdjustment,
        observedThrough: payload.series.at(-1)?.date,
        freshness: snapshot.freshness,
        ingestedAt: snapshot.ingestedAt,
      });
  };
  const actual: PromiseSettledResult<Indicator | null>[] = [];
  const resolved: Indicator[] = [];
  // Keep API fan-out below the server's synchronous transformation pressure.
  // Higher parallelism made static route chunks queue behind series work and
  // degraded first paint even though each endpoint eventually returned 200.
  // DECISION_002 candidate: lower fan-out keeps the local route responsive
  // under the current server workload. Promote only after browser evidence;
  // production configuration remains human-gated.
  const concurrency = 2;
  for (let offset = 0; offset < snapshots.length; offset += concurrency) {
    if (signal?.aborted) throw new DOMException("The operation was aborted", "AbortError");
    const batch = snapshots.slice(offset, offset + concurrency);
    const settled = await Promise.allSettled(batch.map(hydrateOne));
    actual.push(...settled);
    resolved.push(
      ...settled
        .filter((result): result is PromiseFulfilledResult<Indicator | null> => result.status === "fulfilled")
        .map((result) => result.value)
        .filter((indicator): indicator is Indicator => Boolean(indicator)),
    );
    trackUserTelemetry({
      eventType: "hydration_batch",
      sessionId: hydrationSessionId,
      durationMs: Date.now() - hydrationStartedAt,
      metadata: {
        resolvedCount: resolved.length,
        batchSize: batch.length,
        totalSnapshots: snapshots.length,
        source: "macro_os_runtime",
      },
    });
    onProgress?.(resolved);
  }
  trackUserTelemetry({
    eventType: "hydration_ready",
    sessionId: hydrationSessionId,
    durationMs: Date.now() - hydrationStartedAt,
    metadata: { resolvedCount: resolved.length, totalSnapshots: snapshots.length, source: "macro_os_runtime" },
  });
  return actual
    .filter((result): result is PromiseFulfilledResult<Indicator | null> => result.status === "fulfilled")
    .map((result) => result.value)
    .filter((indicator): indicator is Indicator => Boolean(indicator));
}

// ─── Macro Debate API ─────────────────────────────────────────────────────────
// Client interface for the multi-agent debate engine routes.
// Adapted from TradingAgents architecture for macro research context.

async function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) throw new Error(`Platform API ${response.status}: ${path}`);
  return response.json() as Promise<T>;
}

export interface DebateRunRequest {
  indicatorId: string;
  predictionValue: number;
  predictionHorizon: string;
  predictionSource: string;
  predictionDirection?: "higher" | "lower" | "flat";
  /** Set to true when prediction comes from ForecastCenter consensus */
  fromForecast?: boolean;
  /** Required when fromForecast=true to auto-infer direction */
  currentValue?: number;
}

export interface DebateHistoryRecord {
  id: string;
  indicatorId: string;
  indicatorName: string;
  predictionValue: number;
  predictionHorizon: string;
  predictionSource: string;
  predictionDirection: "higher" | "lower" | "flat";
  snapshotValue: number;
  snapshotDate: string;
  verdictSignal: string;
  verdictLabel: string;
  verdictSummary: string;
  verdictBullStrength: number;
  verdictBearStrength: number;
  verdictRiskCount: number;
  verdictLimitation: string;
  fingerprint: string;
  runAt: string;
}

export interface DebateHistoryPage {
  sessions: DebateHistoryRecord[];
  total: number;
}

/**
 * Run a multi-agent macro debate for an indicator's prediction.
 * Returns a full DebateSession with Bull/Bear/Risk analysis and verdict.
 */
export async function runDebate(
  request: DebateRunRequest,
  signal?: AbortSignal,
): Promise<{ session: import("../data/macroDebate").DebateSession }> {
  return postJson<{ session: import("../data/macroDebate").DebateSession }>(
    `/api/debate/run`,
    request,
    signal,
  );
}

/**
 * Retrieve debate history for an indicator (most recent first).
 */
export async function fetchDebateHistory(
  indicatorId: string,
  limit = 10,
  signal?: AbortSignal,
): Promise<DebateHistoryPage> {
  return getJson<DebateHistoryPage>(
    `/api/debate/${encodeURIComponent(indicatorId)}/history?limit=${limit}`,
    signal,
  );
}

/**
 * Retrieve a full debate session by ID (includes Bull/Bear/Risk detail).
 */
export async function fetchDebateSession(
  id: string,
  signal?: AbortSignal,
): Promise<{ session: import("../data/macroDebate").DebateSession }> {
  return getJson<{ session: import("../data/macroDebate").DebateSession }>(
    `/api/debate/session/${encodeURIComponent(id)}`,
    signal,
  );
}
