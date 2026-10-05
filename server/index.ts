import express from "express";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { DATA_SOURCES } from "../src/app/config/dataSources.js";
import {
  db,
  latestObservations,
  latestSnapshots,
  listForecasts,
  createForecast,
  createForecastBatch,
  listForecastAccuracy,
  listForecastSummaries,
  listInstitutionalOutlooks,
  listModelRuns,
  listResearchRuns,
  recordModelRun,
  recordResearchRun,
  listProviderTelemetrySnapshots,
  recordProviderTelemetrySnapshot,
  listResearchMemory,
  recordResearchMemory,
} from "./db.js";
import {
  persistInstitutionalOutlook,
  validateInstitutionalOutlook,
} from "./institutionalOutlooks.js";
import { buildForecastRevisionTimeline } from "./forecastRevisions.js";
import { ingestIndicator } from "./ingestion.js";
import {
  acknowledgeAlertEvent,
  createAlert,
  listAlertEvents,
  listAlerts,
  removeAlert,
  setAlertActive,
} from "./alerts.js";
import { freshnessSlo, freshnessStatus } from "./freshness.js";
import {
  explainEvidenceAvailability,
  isSourceBackedVerifiedObservation,
} from "./evidence.js";
import { buildManagedStorageErrorResponse } from "./storageErrors.js";
import { aggregateLLMDebateTelemetry } from "./llmDebateTelemetry.js";
import { boundedAuditTimeoutMs, resolveWithTimeout } from "./boundedDiagnostic.js";
import { getLLMProviderReadiness } from "./llmProviderReadiness.js";
import { listIngestionJobs } from "./ingestionJobs.js";
import {
  buildPersistedIngestionMetrics,
  getSchedulerMetrics,
} from "./schedulerMetrics.js";
import {
  runBoundedIngestionBatch,
  runScheduledIngestion,
  startIngestionScheduler,
  schedulerConfiguration,
} from "./scheduler.js";
import {
  classifySupabaseConnectionError,
  checkSupabaseConnection,
  checkSupabaseIngestionJobRpc,
  isSupabaseConfigured,
  shouldUseSupabaseStorage,
  supabaseAcknowledgeAlertEvent,
  supabaseCreateAlert,
  supabaseCreateInstitutionalOutlook,
  supabaseCreateResearchRun,
  supabaseDeleteAlert,
  supabaseForecastAccuracy,
  supabaseForecastSummaries,
  supabaseLatestFreshness,
  supabaseLatestObservations,
  supabaseLatestSnapshots,
  supabaseListAlertEvents,
  supabaseListAlerts,
  supabaseListForecasts,
  supabaseCreateForecast,
  supabaseCreateForecastBatch,
  supabaseListInstitutionalOutlooks,
  supabaseListIngestionJobs,
  supabaseListIngestionRuns,
  supabaseListModelRuns,
  supabaseListResearchRuns,
  supabaseQualitySummary,
  supabaseRecordModelRun,
  supabaseSetAlertActive,
  supabaseListProviderTelemetrySnapshots,
  supabaseCreateProviderTelemetrySnapshot,
  supabaseListResearchMemory,
  supabaseRecordResearchMemory,
  supabaseGetDebateCheckpoint,
  supabaseSaveDebateCheckpoint,
  runSupabaseKeepalivePing,
} from "./supabase.js";
import { buildResearchMemoryRecord, type ResearchMemoryRecord } from "./researchMemory.js";
import { OutcomeLedger, type OutcomeActor, type OutcomeVerdict } from "./aiCompany/outcomeLedger.js";
import { buildForecastRevision, validateForecastRevision, type ForecastRevisionInput } from "./forecastInput.js";
import { evaluateNaivePersistence } from "./internalForecastModel.js";
import {
  buildProviderRuntimeHealth,
  getIndicatorProviderCapability,
  PROVIDER_REGISTRY,
} from "../src/app/config/providerRegistry.js";
import { buildSourceMappingReport, SOURCE_MAPPINGS } from "./sourceMapping.js";
import { buildResearchLineage } from "./researchLineage.js";
import { createResearchRunExportArtifact } from "../src/app/data/researchRunExport.js";
import { createOpenBBReviewPackage } from "../src/app/data/openBBReviewExport.js";
import { buildMigrationAudit } from "./migrationManifest.js";
import { advanceDebateCheckpoint, createDebateCheckpoint, failDebateCheckpoint, InMemoryDebateCheckpointStore, resumeDebateCheckpoint, type DebateCheckpoint } from "./debateOrchestrator.js";
import { SqliteDebateCheckpointStore } from "./sqliteDebateCheckpointStore.js";
import {
  persistDebateSession,
  listDebateSessions,
  getDebateSessionFull,
} from "./macroDebate.js";
import {
  runMacroDebate,
  inferPredictionFromForecast,
} from "../src/app/data/macroDebate.js";
import {
  routeToVendor,
  routeMultipleToVendor,
} from "./macroDataRouter.js";
import { macroIndicatorCache } from "./macroIndicatorCache.js";
import { configuredLLMProvider, runOptionalLLMDebate } from "./llmDebateRunner.js";
import { buildQualitativeContext } from "./qualitativeEvidence.js";
import { selectLatestPerPeriod } from "./observationReadContract.js";
import { createForecastDebateExportArtifact, renderForecastDebateMarkdown } from "../src/app/data/forecastDebateExport.js";
import { evaluateForecastBatch, type EvaluationForecast, type EvaluationObservation } from "./batchForecastEvaluation.js";
import { buildForecastCoverage } from "./forecastCoverage.js";
import { assessForecastSubmission, buildForecastSourceRegistryAudit } from "./forecastSourceRegistry.js";


function repositoryMigrationAudit() {
  const directory = resolve(process.cwd(), "supabase/migrations");
  const existing = existsSync(directory) ? readdirSync(directory) : [];
  return buildMigrationAudit(existing);
}
import { buildChangeReport } from "./changeReport.js";
import { buildComparisonReport } from "./comparison.js";
import {
  buildOpenBBPilotGateReport,
  buildOpenBBPilotGateArtifact,
  buildOpenBBSidecarComparison,
  buildOpenBBSidecarStatus,
  getOpenBBComparisonReviewState,
  validateOpenBBSidecarPayload,
} from "./openbbSidecar.js";
import {
  buildOpenBBComparisonReviewArtifact,
  type OpenBBComparisonReviewArtifact,
} from "./openbbComparisonArtifact.js";
import {
  buildOpenBBReviewDiff,
  buildOpenBBReviewDiffArtifact,
} from "./openbbReviewDiff.js";
import { historicalCycles } from "../src/app/data/cycles.js";
import { indicatorCatalog } from "../src/app/data/index.js";
import type { Indicator } from "../src/app/data/types.js";
import { MVP_COUNTRY_OPTIONS } from "../src/app/data/countryScope.js";
import { buildCountryCoverage } from "./countryCoverage.js";
import {
  buildMvpReadinessArtifact,
  buildMvpReadinessReport,
} from "./mvpReadiness.js";
import { buildProductionPreflight } from "./productionPreflight.js";
import {
  buildProviderContractAudit,
  buildProviderEvidenceMatrix,
  buildProviderRightsAudit,
  buildProviderRightsReviewPackage,
  buildProviderOperationAvailability,
  PROVIDER_MANIFEST_VERSION,
} from "./providerContract.js";
import {
  evaluateProviderFailoverDrill,
  validateProviderFailoverDrillScenario,
} from "./failoverDrill.js";
import { buildProviderRedundancyReport } from "./providerRedundancy.js";
import { buildFallbackReadiness } from "./fallbackReadiness.js";
import {
  buildFallbackReviewRun,
  validateFallbackReviewInput,
  type FallbackReviewInput,
} from "./fallbackReview.js";
import {
  buildProviderTelemetry,
  buildProviderTelemetryTrend,
  evaluateProviderDegradation,
} from "./providerTelemetry.js";
import { otelTracingMiddleware } from "./otelMetrics.js";
import { registerModularRoutes } from "./routes/index.js";
import { CompanyStateStore } from "./aiCompany/stateStore.js";
import { TelegramControlPlane } from "./aiCompany/telegramControl.js";
import { handleTelegramWebhook } from "./aiCompany/telegramWebhook.js";
import { createProductCompanyRuntime, startCeoBriefRuntime } from "./aiCompany/runtime.js";
import { deriveCompanyOperatingStatus } from "./aiCompany/companyOperatingStatus.js";
import { createCompanyHealthProvider } from "./aiCompany/healthProvider.js";
import { UsageLedger } from "./aiCompany/usageLedger.js";
import { BacklogLedger } from "./aiCompany/backlogLedger.js";
import { DecisionLedger } from "./aiCompany/decisionLedger.js";
import { RoleWorkQueue } from "./aiCompany/roleWorkQueue.js";
import { evaluatePreReleaseReviewGate } from "./aiCompany/preReleaseReviewGate.js";
import { evaluatePromotion } from "./aiCompany/releasePromotion.js";
import { executeReleaseRollback } from "./aiCompany/releaseRollback.js";
import { evaluatePostReleaseHealth } from "./aiCompany/postReleaseMonitor.js";
import { strategySnapshot } from "./aiCompany/strategyLedger.js";
import { ceoMandateSnapshot } from "./aiCompany/ceoOperatingMandate.js";
import { cadencePolicySnapshot } from "./aiCompany/operatingCadence.js";
import { DiscoveryAttemptLedger } from "./aiCompany/discoveryAttemptLedger.js";
import { ensureBaselineIdeas, IdeaLedger, promoteAcceptedIdea } from "./aiCompany/ideaLedger.js";
import { CompetitiveEvidenceLedger } from "./aiCompany/competitiveEvidenceLedger.js";
import { reviewCompetitiveEvidence } from "./aiCompany/competitiveReview.js";
import { CeoReviewLedger } from "./aiCompany/ceoReviewLedger.js";
import { ResearchSignalLedger } from "./aiCompany/researchSignalLedger.js";
import { evaluateResearchQuorum } from "./aiCompany/researchSynthesis.js";
import { EscalationLedger } from "./aiCompany/escalationLedger.js";
import { RoleWorkExecutionLedger } from "./aiCompany/roleWorkExecutionLedger.js";
import { generateDiscoveryIdea } from "./aiCompany/localDiscoveryWorker.js";
import { validateRuntimeConfig } from "./aiCompany/runtimeConfig.js";
import { ProductCycleAttemptLedger } from "./aiCompany/productCycleAttemptLedger.js";
import { RoleEvidenceLedger } from "./aiCompany/roleEvidenceLedger.js";
import { RoleEvidenceResolver } from "./aiCompany/roleEvidenceResolver.js";
import { assertAdminQueueRuntimeRoot, mutateAdminRoleWorkQueue } from "./aiCompany/adminWorkQueueTransport.js";
import { evidenceProducingRoleWorkExecutor } from "./aiCompany/roleWorkExecutor.js";
import { createConfiguredRoleModelAdapter } from "./aiCompany/openaiCompatibleRoleAdapter.js";
import { ProviderAttemptLedger } from "./aiCompany/providerAttemptLedger.js";
import { ProviderDeadLetterLedger } from "./aiCompany/providerResilience.js";
import { getUserTelemetryInsights, getUserTelemetrySummary, hydrateUserTelemetry, setTelemetryWakeHandler } from "./userTelemetry.js";
import { UserInsightDecisionLedger } from "./userInsightDecisionLedger.js";

validateRuntimeConfig(process.env);

const app = express();
const aiCompanyStateDir = resolve(process.env.AI_COMPANY_STATE_DIR ?? ".ai-company/runtime");
const telegramControl = new TelegramControlPlane(Number(process.env.AI_COMPANY_TELEGRAM_USER_ID ?? 0), new CompanyStateStore(aiCompanyStateDir), new BacklogLedger(aiCompanyStateDir), new DecisionLedger(aiCompanyStateDir));
const companyRuntimeRoot = resolve(".ai-company/runtime/projects/macro-os");
const companyBacklogLedger = new BacklogLedger(resolve(".ai-company"));
// The runtime is canonical for executable company state. Keep the legacy
// root backlog for compatibility, but never read the role queue from a
// different namespace than the supervisor that mutates it.
const companyWorkQueue = new RoleWorkQueue(companyRuntimeRoot, new RoleEvidenceResolver(companyRuntimeRoot));
const companyIdeaLedger = new IdeaLedger(resolve(".ai-company"));
const competitiveEvidenceLedger = new CompetitiveEvidenceLedger(resolve(".ai-company"));
const ceoReviewLedger = new CeoReviewLedger(resolve(".ai-company"));
const researchSignalLedger = new ResearchSignalLedger(resolve(".ai-company"));
const escalationLedger = new EscalationLedger(resolve(".ai-company"));
const roleWorkExecutionLedger = new RoleWorkExecutionLedger(resolve(".ai-company/runtime/projects/macro-os"));
const productCycleAttemptLedger = new ProductCycleAttemptLedger(resolve(".ai-company/runtime/projects/macro-os"));
const companyProviderAttemptLedger = new ProviderAttemptLedger(resolve(".ai-company/runtime/projects/macro-os"));
const companyProviderDeadLetterLedger = new ProviderDeadLetterLedger(resolve(".ai-company/runtime/projects/macro-os"));
const companyDiscoveryAttemptLedger = new DiscoveryAttemptLedger(resolve(".ai-company/runtime/projects/macro-os"));
const userInsightDecisionLedger = new UserInsightDecisionLedger(resolve(".ai-company/runtime/projects/macro-os"));
const debateCheckpointStore = new SqliteDebateCheckpointStore();
const port = Number(process.env.PORT ?? 8787);
let productCompanyRuntimeStatus: () => { running: boolean; ticking: boolean; startedAt: string | null; lastTickAt: string | null; lastResults: unknown[]; readiness: { ready: boolean; blockers: string[]; checkedAt: string | null } } = () => ({ running: false, ticking: false, startedAt: null, lastTickAt: null, lastResults: [], readiness: { ready: false, blockers: ['company runtime is not started'], checkedAt: null } });
let productCompanyRuntimeTick: (() => Promise<unknown>) | null = null;
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((value) => value.trim()),
);

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));
app.use(otelTracingMiddleware());
app.post("/api/ai-company/telegram/webhook", async (request, response) => {
  const result = await handleTelegramWebhook({ headers: Object.fromEntries(Object.entries(request.headers).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])), body: request.body }, telegramControl);
  return response.status(result.status).json(result.body);
});
app.use((request, response, next) => {
  const requestId = request.headers["x-request-id"]?.toString() ?? randomUUID();
  const startedAt = performance.now();
  response.setHeader("X-Request-Id", requestId);
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'",
  );
  const origin = request.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  if (request.method === "OPTIONS") {
    response.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,DELETE,OPTIONS",
    );
    response.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type,Authorization",
    );
    return response.sendStatus(204);
  }
  response.on("finish", () => {
    if (process.env.NODE_ENV !== "test") {
      console.log(
        JSON.stringify({
          type: "http_request",
          requestId,
          method: request.method,
          path: request.path,
          status: response.statusCode,
          durationMs: Math.round(performance.now() - startedAt),
        }),
      );
    }
  });
  next();
});

import { adminTokenBucketLimiter } from "./rateLimit.js";

const adminRateLimit = adminTokenBucketLimiter;
const productOutcomeLedger = new OutcomeLedger(resolve(".ai-company/runtime/product-outcomes"));

function requireAdmin(
  request: express.Request,
  response: express.Response,
  next: express.NextFunction,
) {
  const configured = process.env.MACRO_ADMIN_KEY;
  if (!configured)
    return response.status(503).json({ error: "Admin API is disabled" });
  if (request.headers.authorization !== `Bearer ${configured}`) {
    return response.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// Protect the namespace before any admin route or domain router is mounted.
app.use("/api/admin", adminRateLimit, requireAdmin);

const platformHealthHandler = async (
  _request: express.Request,
  response: express.Response,
) => {
  const localLastRun = db
    .prepare(
      `
    SELECT indicator_id AS indicatorId, status, completed_at AS completedAt
    FROM ingestion_runs ORDER BY id DESC LIMIT 1
  `,
    )
    .get();
  const useManagedStorage = shouldUseSupabaseStorage();
  const healthTimeoutMs = boundedAuditTimeoutMs();
  const supabaseCheck = useManagedStorage && isSupabaseConfigured()
    ? resolveWithTimeout(
        checkSupabaseConnection(),
        healthTimeoutMs,
        () => ({
          configured: true,
          connected: false,
          latencyMs: healthTimeoutMs,
          error: "Managed storage health probe timed out; retry later or inspect provider DNS/health.",
          errorCode: "unavailable" as const,
          diagnosticCode: "HEALTH_PROBE_TIMEOUT" as const,
        }),
      )
    : Promise.resolve({
        configured: isSupabaseConfigured(),
        connected: false,
        latencyMs: 0,
        error: isSupabaseConfigured() ? "Managed storage is unavailable." : "Managed storage is not configured.",
        errorCode: "unavailable" as const,
      });
  // Health must not wait for the connection probe before starting its bounded
  // last-run read. If managed storage is slow, both requests share the same
  // adapter timeout and the diagnostic can still return a truthful degraded
  // response instead of serialising multiple timeout windows.
  const managedLastRun = useManagedStorage && isSupabaseConfigured()
    ? resolveWithTimeout(
        supabaseListIngestionRuns().then((runs) => runs[0] ?? null).catch(() => null),
        healthTimeoutMs,
        () => null,
      )
    : Promise.resolve(null);
  const [supabase, managedLastRunValue] = await Promise.all([
    supabaseCheck,
    managedLastRun,
  ]);
  const productionRuntime = Boolean(
    process.env.VERCEL || process.env.PRODUCTION_RUNTIME === "true",
  );
  const database = useManagedStorage ? "postgres" : "sqlite";
  const lastRun = useManagedStorage
    ? supabase.configured && supabase.connected
      ? managedLastRunValue
      : null
    : localLastRun;
  // Supabase health alone is not enough: db.ts still executes SQLite queries.
  // Do not claim durable production persistence until the repository uses the
  // managed Postgres adapter for reads and writes.
  // Every production API and ingestion path is routed through the Supabase
  // adapter. SQLite is retained only for local development and tests.
  const allStoragePathsMigrated = true;
  const durablePersistence =
    allStoragePathsMigrated &&
    database === "postgres" &&
    supabase.configured &&
    supabase.connected;
  const productionReadinessEvidence =
    process.env.REMOTE_MIGRATIONS_VERIFIED === "true" &&
    process.env.BACKUP_RESTORE_VERIFIED === "true";
  response.json({
    status:
      (supabase.configured && !supabase.connected) ||
      (productionRuntime && !durablePersistence)
        ? "degraded"
        : "ok",
    time: new Date().toISOString(),
    runtimeRevision: process.env.GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "local-unattested",
    database,
    durablePersistence,
    // A connected Postgres runtime proves durability only. Keep the broader
    // production-ready claim false until independent migration and backup
    // evidence is recorded; the full RPC/rights preflight remains separate.
    productionReady: durablePersistence && productionReadinessEvidence,
    supabase,
    fredConfigured: Boolean(process.env.FRED_API_KEY),
    scheduler: schedulerConfiguration(),
    lastIngestion: lastRun ?? null,
  });
};

app.get("/api/health", platformHealthHandler);
app.get("/api/mcp/tools/get_platform_health", platformHealthHandler);

// Supervisor probes: liveness is cheap and dependency-free; readiness only
// asserts that the API can execute its local storage path. Production approval
// remains a separate evidence gate and is never implied by HTTP 200 here.
app.get("/api/live", (_request, response) => {
  response.json({ status: "alive", time: new Date().toISOString(), runtimeRevision: process.env.GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "local-unattested" });
});

app.get("/api/ready", (_request, response) => {
  try {
    db.prepare("SELECT 1 AS ready").get();
    response.json({ status: "ready", database: shouldUseSupabaseStorage() ? "postgres" : "sqlite", productionReady: false });
  } catch {
    response.status(503).json({ status: "not-ready", code: "STORAGE_UNAVAILABLE" });
  }
});

app.get("/api/persistence-audit", async (_request, response) => {
  const supabase = await resolveWithTimeout(
    checkSupabaseConnection(),
    boundedAuditTimeoutMs(),
    () => ({ configured: isSupabaseConfigured(), connected: false, latencyMs: boundedAuditTimeoutMs(), error: "Managed storage audit probe timed out; retry later or inspect provider DNS/health.", errorCode: "unavailable" as const, diagnosticCode: "AUDIT_PROBE_TIMEOUT" as const }),
  );
  const runtimeUsesSupabase = shouldUseSupabaseStorage();
  const migrationAudit = repositoryMigrationAudit();
  const durablePersistence =
    runtimeUsesSupabase && supabase.configured && supabase.connected;
  const remoteMigrationsVerified =
    process.env.REMOTE_MIGRATIONS_VERIFIED === "true";
  const backupRestoreVerified = process.env.BACKUP_RESTORE_VERIFIED === "true";
  response.json({
    status: durablePersistence
      ? "durable-runtime"
      : runtimeUsesSupabase
        ? "degraded-runtime"
        : "local-development",
    runtime: {
      usesSupabase: runtimeUsesSupabase,
      database: runtimeUsesSupabase ? "postgres" : "sqlite",
      durablePersistence,
    },
    supabase: {
      configured: supabase.configured,
      connected: supabase.connected,
      errorCode: supabase.errorCode,
    },
    migrations: {
      ...migrationAudit,
      researchRunsTracked: migrationAudit.present.includes(
        "20260806080000_research_runs.sql",
      ),
      ingestionJobsTracked: migrationAudit.present.includes(
        "20260806090000_ingestion_job_claims.sql",
      ),
      providerTelemetrySnapshotsTracked: migrationAudit.present.includes(
        "20260806100000_provider_telemetry_snapshots.sql",
      ),
      criticalMigrationsTracked: migrationAudit.complete,
      appliedToProduction: "not-verifiable-from-source",
    },
    backupRestore: {
      status: backupRestoreVerified ? "verified" : "not-verifiable",
      evidence:
        backupRestoreVerified
          ? "External owner-approved backup/restore drill evidence is asserted by the deployment runtime flag; inspect the retained drill record separately."
          : "No backup/restore drill evidence is available to this runtime endpoint.",
    },
    productionReady:
      durablePersistence &&
      migrationAudit.complete &&
      remoteMigrationsVerified &&
      backupRestoreVerified,
    limitations: [
      "A connected database does not prove migrations are applied or backups are restorable.",
      "This endpoint reports runtime configuration and repository evidence; it does not perform destructive or backup operations.",
    ],
  });
});

app.get("/api/production-preflight", async (_request, response) => {
  const timeoutMs = boundedAuditTimeoutMs();
  const requiredIngestionRpcPaths = ["/rpc/claim_ingestion_job", "/rpc/heartbeat_ingestion_job", "/rpc/finish_ingestion_job"] as const;
  const [supabase, ingestionJobRpc] = await Promise.all([
    resolveWithTimeout(checkSupabaseConnection(), timeoutMs, () => ({ configured: isSupabaseConfigured(), connected: false, latencyMs: timeoutMs, error: "Managed storage preflight probe timed out; retry later or inspect provider DNS/health.", errorCode: "unavailable" as const, diagnosticCode: "PREFLIGHT_PROBE_TIMEOUT" as const })),
    resolveWithTimeout(checkSupabaseIngestionJobRpc(), timeoutMs, () => ({ configured: isSupabaseConfigured(), available: false, missingPaths: [...requiredIngestionRpcPaths], latencyMs: timeoutMs, errorCode: "unavailable" as const, diagnosticCode: "PREFLIGHT_PROBE_TIMEOUT" as const })),
  ]);
  const migrationAudit = repositoryMigrationAudit();
  const report = buildProductionPreflight({
      productionRuntime: Boolean(
        process.env.VERCEL || process.env.PRODUCTION_RUNTIME === "true",
      ),
      supabaseConfigured: supabase.configured,
      supabaseConnected: supabase.connected,
      supabaseErrorCode: supabase.errorCode,
      criticalMigrationsTracked: migrationAudit.complete,
      backupRestoreVerified: process.env.BACKUP_RESTORE_VERIFIED === "true",
      adminKeyConfigured: Boolean(process.env.MACRO_ADMIN_KEY),
      providerContractValid:
        buildProviderContractAudit(DATA_SOURCES).invalid === 0,
      providerRightsReviewed:
        buildProviderRightsAudit(PROVIDER_REGISTRY).reviewRequired === 0,
      providerEvidenceOperationsSupported: PROVIDER_REGISTRY.every((provider) => provider.supportedOperations.includes("evidence")),
      remoteMigrationsVerified:
        process.env.REMOTE_MIGRATIONS_VERIFIED === "true",
      ingestionJobRpcAvailable: ingestionJobRpc.available,
      ingestionJobRpcMissingPaths: ingestionJobRpc.missingPaths,
    });
  response.json({ ...report, llmProvider: getLLMProviderReadiness() });
});

app.use((request, response, next) => {
  const productionRuntime = Boolean(
    process.env.VERCEL || process.env.PRODUCTION_RUNTIME === "true",
  );
  if (productionRuntime && !isSupabaseConfigured()) {
    return response.status(503).json({
      error: "Durable production storage is not configured",
      code: "PRODUCTION_STORAGE_NOT_CONFIGURED",
    });
  }
  next();
});

function buildIndicatorCatalog() {
  return Object.entries(DATA_SOURCES).map(([indicatorId, source]) => ({
    indicatorId,
    type: source.type,
    source: source.source,
    seriesId: source.seriesId ?? source.coinId ?? null,
    sourceUrl: source.sourceUrl,
    frequency: source.frequencyLabel,
    providerId: getIndicatorProviderCapability(indicatorId)?.providerId ?? null,
    rightsStatus:
      getIndicatorProviderCapability(indicatorId)?.rightsStatus ?? null,
    adapterMode:
      getIndicatorProviderCapability(indicatorId)?.adapterMode ?? null,
    fetchable: [
      "fred",
      "worldbank",
      "worldbank-commodity",
      "worldbank-broad-money-basket",
      "ism-pdf",
      "mendeley-csv",
      "f-fin-json",
      "cbre-landed-price-pdf",
      "quanganh-vnindex-valuation-json",
      "quanganh-index-json",
      "coingecko",
    ].includes(source.type),
    acquisitionStatus: [
      "fred",
      "worldbank",
      "worldbank-commodity",
      "worldbank-broad-money-basket",
      "ism-pdf",
      "mendeley-csv",
      "f-fin-json",
      "cbre-landed-price-pdf",
      "quanganh-vnindex-valuation-json",
      "quanganh-index-json",
      "coingecko",
    ].includes(source.type)
      ? "adapter-available"
      : "rights-or-manual-ingestion-required",
    licenseReview: [
      "fred",
      "worldbank",
      "worldbank-commodity",
      "worldbank-broad-money-basket",
      "ism-pdf",
      "mendeley-csv",
      "f-fin-json",
      "cbre-landed-price-pdf",
      "quanganh-vnindex-valuation-json",
      "quanganh-index-json",
      "coingecko",
    ].includes(source.type)
      ? "public-api-terms-review-required-before-production"
      : "data-rights-required",
  }));
}

app.get("/api/catalog", (_request, response) =>
  response.json(buildIndicatorCatalog()),
);
app.get("/api/mcp/tools/get_indicator_catalog", (request, response) => {
  const query =
    typeof request.query.q === "string"
      ? request.query.q.trim().toLowerCase()
      : "";
  const providerId =
    typeof request.query.providerId === "string"
      ? request.query.providerId.trim()
      : "";
  const type =
    typeof request.query.type === "string" ? request.query.type.trim() : "";
  const catalog = buildIndicatorCatalog()
    .filter(
      (item) =>
        (!query ||
          `${item.indicatorId} ${item.source} ${item.seriesId ?? ""}`
            .toLowerCase()
            .includes(query)) &&
        (!providerId || item.providerId === providerId) &&
        (!type || item.type === type),
    )
    .slice(0, 100);
  response.json({
    catalog,
    count: catalog.length,
    evidence: "configuration",
    filters: {
      q: query || null,
      providerId: providerId || null,
      type: type || null,
    },
    limitations: [
      "Catalog entries are configuration metadata; they do not prove live availability, current observations, licensing or redistribution permission.",
      "Use get_indicator_evidence or get_verified_observations before treating an indicator as research evidence.",
    ],
  });
});

app.get("/api/providers", (_request, response) => {
  response.json({
    manifestVersion: PROVIDER_MANIFEST_VERSION,
    providers: PROVIDER_REGISTRY,
    generatedAt: new Date().toISOString(),
    evidence: "configuration",
    note: "Capability metadata is configuration-derived; it does not prove live health, rights approval or realtime availability.",
  });
});

const PROVIDER_OPERATIONS = ["catalog", "historical", "realtime", "revisions", "ingest", "evidence"] as const;
app.get("/api/providers/:providerId/operations/:operation", (request, response) => {
  const operation = request.params.operation as (typeof PROVIDER_OPERATIONS)[number];
  if (!PROVIDER_OPERATIONS.includes(operation)) {
    return response.status(400).json({ error: "Unknown provider operation", operation, supportedOperations: PROVIDER_OPERATIONS });
  }
  const provider = PROVIDER_REGISTRY.find((item) => item.providerId === request.params.providerId);
  if (!provider) return response.status(404).json({ error: "Provider not found", providerId: request.params.providerId });
  return response.json(buildProviderOperationAvailability(provider, operation));
});
app.get("/api/mcp/tools/check_provider_operation", (request, response) => {
  const operation = String(request.query.operation ?? "") as (typeof PROVIDER_OPERATIONS)[number];
  if (!PROVIDER_OPERATIONS.includes(operation)) {
    return response.status(400).json({ error: "Unknown provider operation", operation, supportedOperations: PROVIDER_OPERATIONS });
  }
  const provider = PROVIDER_REGISTRY.find((item) => item.providerId === String(request.query.providerId ?? ""));
  if (!provider) return response.status(404).json({ error: "Provider not found", providerId: String(request.query.providerId ?? "") });
  return response.json(buildProviderOperationAvailability(provider, operation));
});

app.get("/api/provider-contract", (_request, response) => {
  response.json({
    evidence: "configuration",
    audit: buildProviderContractAudit(DATA_SOURCES),
    limitations: [
      "This audit checks catalog completeness only; it does not prove provider reachability, rights or observation quality.",
    ],
  });
});
app.get("/api/provider-rights", (_request, response) => {
  response.json({
    evidence: "configuration",
    audit: buildProviderRightsAudit(PROVIDER_REGISTRY),
    limitations: [
      "Rights status is a review classification, not a legal determination or redistribution license.",
    ],
  });
});

app.get("/api/provider-rights/review-package", (_request, response) => {
  response.json(buildProviderRightsReviewPackage(PROVIDER_REGISTRY));
});
app.get("/api/provider-rights/:providerId", (request, response) => {
  const provider = buildProviderRightsAudit(PROVIDER_REGISTRY).records.find(
    (record) => record.providerId === request.params.providerId,
  );
  if (!provider)
    return response.status(404).json({
      error: "Unknown provider",
      providerId: request.params.providerId,
    });
  response.json({
    evidence: "configuration",
    provider,
    limitations: [
      "Rights status is a review classification, not a legal determination or redistribution license.",
      "Source URLs and adapter metadata do not prove contractual permission to redistribute data.",
    ],
  });
});
app.get("/api/provider-evidence-matrix", async (_request, response) => {
  try {
    const runs = shouldUseSupabaseStorage()
      ? await supabaseListIngestionRuns()
      : db
          .prepare(
            `SELECT indicator_id AS indicatorId, status, started_at AS startedAt, completed_at AS completedAt, error_message AS errorMessage FROM ingestion_runs ORDER BY id DESC LIMIT 500`,
          )
          .all();
    const health = buildProviderRuntimeHealth(
      PROVIDER_REGISTRY,
      runs as Array<{
        indicatorId: string;
        status: string;
        startedAt?: string | null;
        completedAt?: string | null;
        errorMessage?: string | null;
      }>,
    );
    const contract = buildProviderContractAudit(DATA_SOURCES);
    response.json({
      evidence: {
        contract: "configuration",
        rights: "configuration",
        runtime: "ingestion-run",
      },
      matrix: buildProviderEvidenceMatrix(
        PROVIDER_REGISTRY,
        health,
        contract.records,
      ),
      limitations: [
        "The matrix joins independent evidence channels; it does not create a production-ready or legally approved status.",
      ],
    });
  } catch (error) {
    response.status(503).json(buildManagedStorageErrorResponse(error));
  }
});
app.get("/api/openbb/status", (_request, response) =>
  response.json({
    evidence: "configuration",
    sidecar: buildOpenBBSidecarStatus(),
    limitations: [
      "Status is configuration evidence only; it does not prove a reachable OpenBB runtime or rights approval.",
    ],
  }),
);
const openBBPilotGateHandler = async (
  request: express.Request,
  response: express.Response,
) => {
  const sidecar = buildOpenBBSidecarStatus();
  let latestReview: unknown;
  try {
    const rows = (
      shouldUseSupabaseStorage()
        ? await supabaseListResearchRuns(undefined, {
            limit: 1,
            offset: 0,
            calculationMethod: "openbb-comparison-review",
          })
        : listResearchRuns(undefined, {
            limit: 1,
            offset: 0,
            calculationMethod: "openbb-comparison-review",
          })
    ) as Array<Record<string, unknown>>;
    latestReview = rows[0] ?? null;
  } catch (error) {
    return response.status(503).json(buildManagedStorageErrorResponse(error));
  }
  const report = buildOpenBBPilotGateReport({
      endpointConfigured: sidecar.endpointConfigured,
      rightsReviewRecorded: sidecar.rightsReviewRecorded,
      comparisonReview: getOpenBBComparisonReviewState(latestReview),
    });
  if (
    request.path.includes("/export") ||
    request.path.includes("pilot_gate_export")
  ) {
    return response.json({ evidence: "configuration-and-staging-review", artifact: buildOpenBBPilotGateArtifact(report), limitations: report.limitations });
  }
  response.json(report);
};
app.get("/api/openbb/pilot-gate", openBBPilotGateHandler);
app.get("/api/openbb/pilot-gate/export", openBBPilotGateHandler);
app.post(
  "/api/admin/provider-failover-drill",
  (request, response) => {
    const scenarios = Array.isArray(request.body?.scenarios)
      ? request.body.scenarios
      : [request.body];
    if (scenarios.length < 1 || scenarios.length > 20)
      return response
        .status(400)
        .json({ error: "Provide between 1 and 20 drill scenarios" });
    const results: Array<
      ReturnType<typeof evaluateProviderFailoverDrill> | { issues: string[] }
    > = scenarios.map((scenario: unknown) => {
      const issues = validateProviderFailoverDrillScenario(scenario);
      return issues.length
        ? { issues }
        : evaluateProviderFailoverDrill(
            scenario as Parameters<typeof evaluateProviderFailoverDrill>[0],
          );
    });
    if (results.some((result) => "issues" in result))
      return response
        .status(400)
        .json({ error: "Invalid drill scenario", results });
    response.json({
      evidence: "drill",
      results,
      limitations: [
        "Drill output is operational evidence only; it never writes or promotes observations.",
      ],
    });
  },
);
app.get("/api/mcp/tools/get_openbb_sidecar_status", (_request, response) =>
  response.json({
    evidence: "configuration",
    sidecar: buildOpenBBSidecarStatus(),
    limitations: [
      "Status is configuration evidence only; it does not prove a reachable OpenBB runtime or rights approval.",
    ],
  }),
);
app.get("/api/mcp/tools/get_openbb_pilot_gate", openBBPilotGateHandler);
app.get("/api/mcp/tools/get_openbb_pilot_gate_export", openBBPilotGateHandler);
app.get(
  "/api/mcp/tools/get_provider_evidence_matrix",
  async (request, response) => {
    const providerId =
      typeof request.query.providerId === "string"
        ? request.query.providerId
        : undefined;
    try {
      const runs = shouldUseSupabaseStorage()
        ? await supabaseListIngestionRuns()
        : db
            .prepare(
              `SELECT indicator_id AS indicatorId, status, started_at AS startedAt, completed_at AS completedAt, error_message AS errorMessage FROM ingestion_runs ORDER BY id DESC LIMIT 500`,
            )
            .all();
      const health = buildProviderRuntimeHealth(
        PROVIDER_REGISTRY,
        runs as Array<{
          indicatorId: string;
          status: string;
          startedAt?: string | null;
          completedAt?: string | null;
          errorMessage?: string | null;
        }>,
      );
      const contract = buildProviderContractAudit(DATA_SOURCES);
      const matrix = buildProviderEvidenceMatrix(
        PROVIDER_REGISTRY,
        health,
        contract.records,
      ).filter((row) => !providerId || row.providerId === providerId);
      if (providerId && matrix.length === 0)
        return response
          .status(404)
          .json({ error: "Unknown provider", providerId });
      response.json({
        evidence: {
          contract: "configuration",
          rights: "configuration",
          runtime: "ingestion-run",
        },
        matrix,
        limitations: [
          "The matrix joins independent evidence channels; it does not create a production-ready or legally approved status.",
        ],
      });
    } catch (error) {
      response.status(503).json(buildManagedStorageErrorResponse(error));
    }
  },
);

const providerHealthHandler = async (
  _request: express.Request,
  response: express.Response,
) => {
  try {
    const runs = shouldUseSupabaseStorage()
      ? await supabaseListIngestionRuns()
      : db
          .prepare(
            `
          SELECT indicator_id AS indicatorId, status,
                 started_at AS startedAt, completed_at AS completedAt,
                 error_message AS errorMessage
          FROM ingestion_runs ORDER BY id DESC LIMIT 500
        `,
          )
          .all();
    response.json({
      providers: buildProviderRuntimeHealth(
        PROVIDER_REGISTRY,
        runs as Array<{
          indicatorId: string;
          status: string;
          startedAt?: string | null;
          completedAt?: string | null;
          errorMessage?: string | null;
        }>,
      ),
      generatedAt: new Date().toISOString(),
      evidence: "ingestion-run",
      note: "Health reflects the latest recorded ingestion run per indicator; it does not prove source rights, current provider availability or observation correctness.",
    });
  } catch (error) {
    response.status(503).json(buildManagedStorageErrorResponse(error));
  }
};

app.get("/api/provider-health", providerHealthHandler);

app.get("/api/provider-health/history", async (request, response) => {
  const providerId =
    typeof request.query.providerId === "string"
      ? request.query.providerId
      : undefined;
  const limit = Math.min(
    50,
    Math.max(1, Number(request.query.limit ?? 20) || 20),
  );
  if (
    providerId &&
    !PROVIDER_REGISTRY.some((provider) => provider.providerId === providerId)
  )
    return response.status(404).json({ error: "Unknown provider", providerId });
  try {
    const runs = (
      shouldUseSupabaseStorage()
        ? await supabaseListIngestionRuns()
        : db
            .prepare(
              `SELECT indicator_id AS indicatorId, status, started_at AS startedAt, completed_at AS completedAt, error_message AS errorMessage FROM ingestion_runs ORDER BY id DESC LIMIT 500`,
            )
            .all()
    ) as Array<{
      indicatorId: string;
      status: string;
      startedAt?: string | null;
      completedAt?: string | null;
      errorMessage?: string | null;
    }>;
    const history = runs
      .filter(
        (run) =>
          !providerId ||
          getIndicatorProviderCapability(run.indicatorId)?.providerId ===
            providerId,
      )
      .slice(0, limit)
      .map((run) => {
        const durationMs =
          run.startedAt && run.completedAt
            ? Date.parse(run.completedAt) - Date.parse(run.startedAt)
            : null;
        return {
          providerId:
            getIndicatorProviderCapability(run.indicatorId)?.providerId ??
            "unknown",
          indicatorId: run.indicatorId,
          status: run.status,
          startedAt: run.startedAt ?? null,
          completedAt: run.completedAt ?? null,
          durationMs:
            durationMs != null && Number.isFinite(durationMs) && durationMs >= 0
              ? durationMs
              : null,
          errorMessage: run.errorMessage
            ? run.errorMessage.slice(0, 240)
            : null,
        };
      });
    response.json({
      history,
      limit,
      evidence: "ingestion-run",
      limitations: [
        "History describes recorded orchestration attempts; it does not prove source rights, observation correctness or production availability.",
      ],
    });
  } catch (error) {
    response.status(503).json(buildManagedStorageErrorResponse(error));
  }
});

app.get("/api/provider-health/telemetry", async (_request, response) => {
  try {
    const runs = (
      shouldUseSupabaseStorage()
        ? await supabaseListIngestionRuns()
        : db
            .prepare(
              `SELECT indicator_id AS indicatorId, status, started_at AS startedAt, completed_at AS completedAt FROM ingestion_runs ORDER BY id DESC LIMIT 500`,
            )
            .all()
    ) as Array<{
      indicatorId: string;
      status: string;
      startedAt?: string | null;
      completedAt?: string | null;
    }>;
    const telemetryRuns = runs.map((run) => ({
      providerId:
        getIndicatorProviderCapability(run.indicatorId)?.providerId ??
        "unknown",
      status: run.status,
      completedAt: run.completedAt ?? null,
      durationMs:
        run.startedAt && run.completedAt
          ? Date.parse(run.completedAt) - Date.parse(run.startedAt)
          : null,
    }));
    const telemetry = buildProviderTelemetry(
      telemetryRuns,
      PROVIDER_REGISTRY.map((provider) => provider.providerId),
    );
    response.json({
      evidence: "orchestration-telemetry",
      telemetry,
      degradation: telemetry.map((item) => evaluateProviderDegradation(item)),
      trends: buildProviderTelemetryTrend(
        telemetryRuns,
        PROVIDER_REGISTRY.map((provider) => provider.providerId),
      ),
      limitations: [
        "Telemetry summarizes recorded ingestion orchestration only; it does not prove source reachability, observation correctness, rights or freshness of published values.",
        "Degradation and trend signals are operational attention only; they do not authorize fallback, alert users about economic conditions or promote observations.",
      ],
    });
  } catch (error) {
    response.status(503).json(buildManagedStorageErrorResponse(error));
  }
});

app.get("/api/provider-health/telemetry/snapshots", (_request, response) => {
  if (shouldUseSupabaseStorage())
    return supabaseListProviderTelemetrySnapshots(30)
      .then((snapshots) =>
        response.json({
          evidence: "orchestration-telemetry-snapshot",
          snapshots,
          limitations: [
            "Snapshots are operational orchestration history only; durable storage does not prove data correctness, rights or availability.",
          ],
        }),
      )
      .catch((error) =>
        response.status(503).json(buildManagedStorageErrorResponse(error)),
      );
  response.json({
    evidence: "orchestration-telemetry-snapshot",
    snapshots: listProviderTelemetrySnapshots(30),
    limitations: [
      "Snapshots are operational orchestration history only; local SQLite persistence does not prove durable production storage, data correctness, rights or availability.",
    ],
  });
});

// Modular Domain Routers (Telemetry, Poller, Alerts)
registerModularRoutes(app);

app.post(
  "/api/admin/provider-health/telemetry/snapshot",
  async (_request, response) => {
    const runs = (
      shouldUseSupabaseStorage()
        ? await supabaseListIngestionRuns()
        : db
            .prepare(
              `SELECT indicator_id AS indicatorId, status, started_at AS startedAt, completed_at AS completedAt FROM ingestion_runs ORDER BY id DESC LIMIT 500`,
            )
            .all()
    ) as Array<{
      indicatorId: string;
      status: string;
      startedAt?: string | null;
      completedAt?: string | null;
    }>;
    const telemetryRuns = runs.map((run) => ({
      providerId:
        getIndicatorProviderCapability(run.indicatorId)?.providerId ??
        "unknown",
      status: run.status,
      completedAt: run.completedAt ?? null,
      durationMs:
        run.startedAt && run.completedAt
          ? Date.parse(run.completedAt) - Date.parse(run.startedAt)
          : null,
    }));
    const telemetry = buildProviderTelemetry(
      telemetryRuns,
      PROVIDER_REGISTRY.map((provider) => provider.providerId),
    );
    const degradation = telemetry.map((item) =>
      evaluateProviderDegradation(item),
    );
    const trends = buildProviderTelemetryTrend(
      telemetryRuns,
      PROVIDER_REGISTRY.map((provider) => provider.providerId),
    );
    const input = {
      id: randomUUID(),
      capturedAt: new Date().toISOString(),
      telemetry,
      degradation,
      trends,
    };
    if (shouldUseSupabaseStorage())
      return supabaseCreateProviderTelemetrySnapshot(input)
        .then((snapshot) =>
          response.status(201).json({
            evidence: "orchestration-telemetry-snapshot",
            snapshot,
            limitations: [
              "Snapshot persistence is operational telemetry only; it never writes observations or authorizes fallback.",
            ],
          }),
        )
        .catch((error) =>
          response.status(503).json({
            error: error instanceof Error ? error.message : String(error),
          }),
        );
    const snapshot = recordProviderTelemetrySnapshot(input);
    response.status(201).json({
      evidence: "orchestration-telemetry-snapshot",
      snapshot,
      limitations: [
        "Snapshot persistence is operational telemetry only; it never writes observations or authorizes fallback.",
      ],
    });
  },
);

app.get("/api/freshness-slos", (_request, response) => {
  const slos = [
    ...new Map(
      Object.values(DATA_SOURCES).map((source) => {
        const slo = freshnessSlo(source.frequencyLabel);
        return [slo.frequency, slo] as const;
      }),
    ).values(),
  ];
  response.json({
    evidence: "configuration",
    slos,
    limitations: [
      "SLOs are configured age tolerances, not a guarantee that a provider publishes on schedule or that an observation is correct.",
    ],
  });
});

app.get("/api/mcp/tools/get_provider_health", async (request, response) => {
  const providerId =
    typeof request.query.providerId === "string"
      ? request.query.providerId
      : undefined;
  try {
    const runs = shouldUseSupabaseStorage()
      ? await supabaseListIngestionRuns()
      : db
          .prepare(
            `SELECT indicator_id AS indicatorId, status, started_at AS startedAt, completed_at AS completedAt, error_message AS errorMessage FROM ingestion_runs ORDER BY id DESC LIMIT 500`,
          )
          .all();
    const providers = buildProviderRuntimeHealth(
      PROVIDER_REGISTRY,
      runs as Array<{
        indicatorId: string;
        status: string;
        startedAt?: string | null;
        completedAt?: string | null;
        errorMessage?: string | null;
      }>,
    );
    const filtered = providerId
      ? providers.filter((provider) => provider.providerId === providerId)
      : providers;
    if (providerId && filtered.length === 0)
      return response
        .status(404)
        .json({ error: "Unknown provider", providerId });
    response.json({
      providers: filtered,
      evidence: "ingestion-run",
      limitations: [
        "Runtime health reflects recorded ingestion runs only; it does not prove source rights, current provider availability or observation correctness.",
      ],
    });
  } catch (error) {
    response.status(503).json(buildManagedStorageErrorResponse(error));
  }
});

const loadCountryCoverage = async () => {
  const snapshots = shouldUseSupabaseStorage()
    ? await supabaseLatestSnapshots(Object.keys(DATA_SOURCES))
    : latestSnapshots();
  const coverageSnapshots = (
    snapshots as Array<{
      indicatorId: string;
      status?: string;
      quality?: string;
      sourceUrl?: string | null;
    }>
  ).map((snapshot) => ({
    ...snapshot,
    sourceUrl:
      snapshot.sourceUrl ??
      DATA_SOURCES[snapshot.indicatorId]?.sourceUrl ??
      null,
    freshness: freshnessStatus(
      String((snapshot as { date?: string }).date ?? ""),
      DATA_SOURCES[snapshot.indicatorId]?.frequencyLabel,
    ),
  }));
  return buildCountryCoverage(
    MVP_COUNTRY_OPTIONS,
    indicatorCatalog,
    coverageSnapshots,
  );
};
const countryCoverageHandler = async (
  _request: express.Request,
  response: express.Response,
) => {
  try {
    response.json({
      evidence: "catalog-and-snapshot",
      countries: await loadCountryCoverage(),
      limitations: [
        "Coverage counts do not prove rights, freshness, independent redundancy or full MVP breadth.",
      ],
    });
  } catch (error) {
    response.status(503).json(buildManagedStorageErrorResponse(error));
  }
};
const mvpReadinessHandler = async (
  _request: express.Request,
  response: express.Response,
) => {
  try {
    const countries = await loadCountryCoverage();
    const report = buildMvpReadinessReport(countries);
    const artifact = buildMvpReadinessArtifact(countries, report);
    response.json({ ...report, fingerprint: artifact.fingerprint, artifact });
  } catch (error) {
    response.status(503).json(buildManagedStorageErrorResponse(error));
  }
};
app.get("/api/mcp/tools/get_country_coverage", countryCoverageHandler);
app.get("/api/coverage/countries", countryCoverageHandler);
app.get("/api/mvp/readiness", mvpReadinessHandler);
app.get("/api/mcp/tools/get_mvp_readiness", mvpReadinessHandler);

app.get("/api/mcp/tools/get_provider_rights", (request, response) => {
  const providerId =
    typeof request.query.providerId === "string"
      ? request.query.providerId
      : undefined;
  const audit = buildProviderRightsAudit(PROVIDER_REGISTRY);
  if (
    providerId &&
    !audit.records.some((record) => record.providerId === providerId)
  )
    return response.status(404).json({ error: "Unknown provider", providerId });
  response.json({
    evidence: "configuration",
    providers: providerId
      ? audit.records.filter((record) => record.providerId === providerId)
      : audit.records,
    summary: {
      total: audit.total,
      publicSource: audit.publicSource,
      reviewRequired: audit.reviewRequired,
    },
    limitations: [
      "Rights status is a review classification, not a legal determination or redistribution license.",
      "Configuration does not prove contractual permission to redistribute data.",
    ],
  });
});

app.get(
  "/api/mcp/tools/get_provider_rights_review_package",
  (_request, response) => {
    response.json(buildProviderRightsReviewPackage(PROVIDER_REGISTRY));
  },
);

app.get("/api/source-mappings", (request, response) => {
  const requestedIndicator =
    typeof request.query.indicatorId === "string"
      ? request.query.indicatorId
      : undefined;
  const indicatorIds = requestedIndicator
    ? [requestedIndicator]
    : Object.keys(DATA_SOURCES);
  response.json({
    mappings: indicatorIds.map((indicatorId) =>
      buildSourceMappingReport(indicatorId),
    ),
    declaredMappingCount: SOURCE_MAPPINGS.length,
    evidence: "configuration",
    note: "No mapping is treated as no fallback. Source URLs or provider names alone do not establish independent redundancy.",
  });
});

app.get("/api/provider-redundancy", (request, response) => {
  const requestedIndicator =
    typeof request.query.indicatorId === "string"
      ? request.query.indicatorId
      : undefined;
  if (requestedIndicator && !DATA_SOURCES[requestedIndicator])
    return response
      .status(404)
      .json({ error: "Unknown indicator", indicatorId: requestedIndicator });
  const report = buildProviderRedundancyReport(
    requestedIndicator ? [requestedIndicator] : undefined,
  );
  response.json(report);
});

app.get("/api/provider-fallback-readiness", (request, response) => {
  const requestedIndicator =
    typeof request.query.indicatorId === "string"
      ? request.query.indicatorId
      : undefined;
  if (requestedIndicator && !DATA_SOURCES[requestedIndicator])
    return response
      .status(404)
      .json({ error: "Unknown indicator", indicatorId: requestedIndicator });
  const redundancy = buildProviderRedundancyReport(
    requestedIndicator ? [requestedIndicator] : undefined,
  );
  response.json(buildFallbackReadiness(redundancy.records));
});

const indicatorEvidenceHandler = async (
  request: express.Request,
  response: express.Response,
) => {
  const rawIndicatorId =
    request.params.indicatorId ?? request.query.indicatorId;
  const indicatorId = typeof rawIndicatorId === "string" ? rawIndicatorId : "";
  const source = DATA_SOURCES[indicatorId];
  if (!source)
    return response
      .status(404)
      .json({ error: "Unknown indicator", indicatorId });

  let observations: Awaited<ReturnType<typeof supabaseLatestObservations>>;
  let runs: Awaited<ReturnType<typeof supabaseListIngestionRuns>>;
  try {
    const rawObservations = shouldUseSupabaseStorage()
      ? await supabaseLatestObservations(indicatorId, 300)
      : latestObservations(indicatorId, 300);
    observations = selectLatestPerPeriod(rawObservations);
    runs = shouldUseSupabaseStorage()
      ? await supabaseListIngestionRuns()
      : db
          .prepare(
            `
          SELECT indicator_id AS indicatorId, status,
                 started_at AS startedAt, completed_at AS completedAt,
                 error_message AS errorMessage
          FROM ingestion_runs ORDER BY id DESC LIMIT 500
        `,
          )
          .all();
  } catch (error) {
    return response.status(503).json(buildManagedStorageErrorResponse(error));
  }
  const provider = getIndicatorProviderCapability(indicatorId);
  const evidenceOperation = provider
    ? buildProviderOperationAvailability(provider, "evidence")
    : null;
  const evidenceOperationSupported = evidenceOperation?.status === "configuration-supported";
  const providerHealth =
    buildProviderRuntimeHealth(
      PROVIDER_REGISTRY,
      runs as Array<{
        indicatorId: string;
        status: string;
        startedAt?: string | null;
        completedAt?: string | null;
        errorMessage?: string | null;
      }>,
    ).find((item) => item.providerId === provider?.providerId) ?? null;
  const eligibleObservationCount = observations.filter(
    isSourceBackedVerifiedObservation,
  ).length;
  const latest = observations.at(-1) ?? null;
  const latestObservationEligible = Boolean(
    latest && isSourceBackedVerifiedObservation(latest),
  );
  const freshness = latestObservationEligible
    ? freshnessStatus(String(latest?.date ?? ""), source.frequencyLabel)
    : ("unavailable" as const);
  const currentEligibleObservationCount =
    freshness === "fresh" && evidenceOperationSupported ? eligibleObservationCount : 0;
  const availability = explainEvidenceAvailability({
    observationCount: observations.length,
    eligibleObservationCount,
    freshness,
    providerType: source.type,
    providerStatus:
      providerHealth?.indicatorStatuses[indicatorId] ?? providerHealth?.status,
  });
  const changes = buildChangeReport(
    observations as Array<{
      date: string;
      value: number;
      vintage?: string | null;
    }>,
  );

  response.json({
    indicator: {
      indicatorId,
      source: source.source,
      agency: source.agency,
      type: source.type,
      seriesId: source.seriesId ?? source.coinId ?? null,
      sourceUrl: source.sourceUrl,
      frequency: source.frequencyLabel,
      unit: source.unit ?? null,
      notes: source.notes ?? null,
    },
    observations,
    latest,
    changes,
    availability: { ...availability, freshness },
    operationAvailability: evidenceOperation,
    provider,
    providerHealth,
    sourceMapping: buildSourceMappingReport(indicatorId),
    researchEligibility: {
      eligibleObservationCount: evidenceOperationSupported ? eligibleObservationCount : 0,
      currentEligibleObservationCount,
      hasVerifiedActual: evidenceOperationSupported && eligibleObservationCount > 0,
      hasCurrentEvidence: currentEligibleObservationCount > 0,
      requiresSourceBackedEvidence: true,
      operation: "evidence",
      operationSupported: evidenceOperationSupported,
    },
    evidence: {
      metadata: "configuration",
      observations: observations.length > 0 ? "ingestion" : "none",
      providerHealth: providerHealth?.evidence ?? "none",
      sourceMapping: "configuration",
    },
    limitations: [
      "This bundle is evidence for research inputs, not an investment recommendation.",
      "Configuration metadata does not prove live availability, licensing or realtime access.",
      ...(evidenceOperation && evidenceOperation.status !== "configuration-supported"
        ? [evidenceOperation.explanation, evidenceOperation.nextAction]
        : []),
      ...(freshness !== "fresh"
        ? [
            "Actual/verified observations remain inspectable, but current evidence is not asserted while freshness is not fresh.",
          ]
        : []),
      ...(observations.length === 0
        ? [
            "No ingested observations are currently available for this indicator.",
          ]
        : []),
    ],
  });
};

app.get("/api/evidence/indicator/:indicatorId", indicatorEvidenceHandler);

app.get("/api/mcp/tools", (_request, response) => {
  response.json({
    contractVersion: "1",
    evidence: "configuration-and-ingestion",
    tools: [
      {
        name: "get_indicator_metadata",
        method: "GET",
        path: "/api/mcp/tools/get_indicator_metadata",
        input: {
          indicatorId: {
            type: "string",
            required: true,
            description: "Known Macro OS indicator identifier",
          },
        },
        readOnly: true,
        returns: "IndicatorMetadata",
      },
      {
        name: "get_indicator_catalog",
        method: "GET",
        path: "/api/mcp/tools/get_indicator_catalog",
        input: {
          q: {
            type: "string",
            required: false,
            description:
              "Bounded text filter over indicator ID, source or series ID",
          },
          providerId: {
            type: "string",
            required: false,
            description: "Optional known provider identifier",
          },
          type: {
            type: "string",
            required: false,
            description: "Optional configured source type",
          },
        },
        readOnly: true,
        returns: "IndicatorCatalog",
      },
      {
        name: "get_indicator_evidence",
        method: "GET",
        path: "/api/mcp/tools/get_indicator_evidence",
        input: {
          indicatorId: {
            type: "string",
            required: true,
            description: "Known Macro OS indicator identifier",
          },
        },
        readOnly: true,
        returns: "IndicatorEvidenceBundle",
      },
      {
        name: "compare_indicators",
        method: "GET",
        path: "/api/mcp/tools/compare_indicators",
        input: {
          indicatorIds: {
            type: "string",
            required: true,
            description:
              "Exactly two comma-separated known indicator identifiers",
          },
          transformation: {
            type: "string",
            required: false,
            enum: ["level", "change", "pct_change"],
          },
          maxLag: { type: "integer", required: false, maximum: 12 },
        },
        readOnly: true,
        returns: "ComparisonEvidence",
      },
      {
        name: "get_relationship_evidence",
        method: "GET",
        path: "/api/mcp/tools/get_relationship_evidence",
        input: {
          indicatorIds: {
            type: "string",
            required: true,
            description:
              "Exactly two comma-separated known indicator identifiers",
          },
          transformation: {
            type: "string",
            required: false,
            enum: ["level", "change", "pct_change"],
          },
          maxLag: { type: "integer", required: false, maximum: 12 },
        },
        readOnly: true,
        returns: "RelationshipEvidence",
      },
      {
        name: "explain_alert_evidence",
        method: "GET",
        path: "/api/mcp/tools/explain_alert_evidence",
        input: {
          eventId: {
            type: "integer",
            required: true,
            description: "Recorded alert event identifier",
          },
        },
        readOnly: true,
        returns: "AlertEvidence",
      },
      {
        name: "get_historical_event_evidence",
        method: "GET",
        path: "/api/mcp/tools/get_historical_event_evidence",
        input: {
          cycleId: {
            type: "string",
            required: true,
            description: "Known historical cycle identifier",
          },
        },
        readOnly: true,
        returns: "HistoricalEventEvidence",
      },
      {
        name: "get_verified_observations",
        method: "GET",
        path: "/api/mcp/tools/get_verified_observations",
        input: {
          indicatorId: {
            type: "string",
            required: true,
            description: "Known Macro OS indicator identifier",
          },
          limit: { type: "integer", required: false, maximum: 1000 },
        },
        readOnly: true,
        returns: "VerifiedObservations",
      },
      {
        name: "get_evidence_commentary",
        method: "GET",
        path: "/api/mcp/tools/get_evidence_commentary",
        input: {
          indicatorIds: {
            type: "string",
            required: true,
            description:
              "One to five comma-separated known indicator identifiers",
          },
          limit: { type: "integer", required: false, maximum: 100 },
        },
        readOnly: true,
        returns: "EvidenceCommentary",
      },
      {
        name: "get_provider_health",
        method: "GET",
        path: "/api/mcp/tools/get_provider_health",
        input: {
          providerId: {
            type: "string",
            required: false,
            description: "Optional known provider identifier",
          },
        },
        readOnly: true,
        returns: "ProviderHealth",
      },
      {
        name: "get_user_telemetry_summary",
        method: "GET",
        path: "/api/mcp/tools/get_user_telemetry_summary",
        input: {},
        readOnly: true,
        returns: "UserTelemetrySummary",
      },
      {
        name: "get_company_operating_audit",
        method: "GET",
        path: "/api/mcp/tools/get_company_operating_audit",
        input: {},
        readOnly: true,
        returns: "AiCompanyOperatingAudit",
      },
      {
        name: "check_provider_operation",
        method: "GET",
        path: "/api/mcp/tools/check_provider_operation",
        input: {
          providerId: {
            type: "string",
            required: true,
            description: "Known provider identifier from the capability registry",
          },
          operation: {
            type: "string",
            required: true,
            description: "One of catalog, historical, realtime, revisions, ingest or evidence",
          },
        },
        readOnly: true,
        returns: "ProviderOperationAvailability",
      },
      {
        name: "get_platform_health",
        method: "GET",
        path: "/api/mcp/tools/get_platform_health",
        input: {},
        readOnly: true,
        returns: "PlatformHealth",
      },
      {
        name: "get_country_coverage",
        method: "GET",
        path: "/api/mcp/tools/get_country_coverage",
        input: {},
        readOnly: true,
        returns: "CountryCoverage",
      },
      {
        name: "get_mvp_readiness",
        method: "GET",
        path: "/api/mcp/tools/get_mvp_readiness",
        input: {},
        readOnly: true,
        returns: "MvpReadinessReport",
      },
      {
        name: "get_provider_rights",
        method: "GET",
        path: "/api/mcp/tools/get_provider_rights",
        input: {
          providerId: {
            type: "string",
            required: false,
            description: "Optional known provider identifier",
          },
        },
        readOnly: true,
        returns: "ProviderRightsAudit",
      },
      {
        name: "get_provider_rights_review_package",
        method: "GET",
        path: "/api/mcp/tools/get_provider_rights_review_package",
        input: {},
        readOnly: true,
        returns: "ProviderRightsReviewPackage",
      },
      {
        name: "get_provider_evidence_matrix",
        method: "GET",
        path: "/api/mcp/tools/get_provider_evidence_matrix",
        input: {
          providerId: {
            type: "string",
            required: false,
            description: "Optional known provider identifier",
          },
        },
        readOnly: true,
        returns: "ProviderEvidenceMatrix",
      },
      {
        name: "get_openbb_sidecar_status",
        method: "GET",
        path: "/api/mcp/tools/get_openbb_sidecar_status",
        input: {},
        readOnly: true,
        returns: "OpenBBSidecarStatus",
      },
      {
        name: "get_openbb_pilot_gate",
        method: "GET",
        path: "/api/mcp/tools/get_openbb_pilot_gate",
        input: {},
        readOnly: true,
        returns: "OpenBBPilotGateReport",
      },
      {
        name: "get_openbb_pilot_gate_export",
        method: "GET",
        path: "/api/mcp/tools/get_openbb_pilot_gate_export",
        input: {},
        readOnly: true,
        returns: "OpenBBPilotGateArtifact",
      },
      {
        name: "get_source_reconciliation",
        method: "GET",
        path: "/api/mcp/tools/get_source_reconciliation",
        input: {
          indicatorId: {
            type: "string",
            required: true,
            description:
              "Known indicator with an independently validated source mapping",
          },
        },
        readOnly: true,
        returns: "SourceReconciliation",
      },
      {
        name: "get_provider_redundancy",
        method: "GET",
        path: "/api/mcp/tools/get_provider_redundancy",
        input: {
          indicatorId: {
            type: "string",
            required: false,
            description: "Optional known Macro OS indicator identifier",
          },
        },
        readOnly: true,
        returns: "ProviderRedundancyReadiness",
      },
      {
        name: "get_provider_fallback_readiness",
        method: "GET",
        path: "/api/mcp/tools/get_provider_fallback_readiness",
        input: {
          indicatorId: {
            type: "string",
            required: false,
            description: "Optional known Macro OS indicator identifier",
          },
        },
        readOnly: true,
        returns: "ProviderFallbackReadiness",
      },
      {
        name: "get_forecast_revision_evidence",
        method: "GET",
        path: "/api/mcp/tools/get_forecast_revision_evidence",
        input: {
          indicatorId: {
            type: "string",
            required: false,
            description: "Optional known indicator identifier",
          },
        },
        readOnly: true,
        returns: "ForecastRevisionTimeline",
      },
      {
        name: "get_research_run_lineage",
        method: "GET",
        path: "/api/mcp/tools/get_research_run_lineage",
        input: {
          runId: {
            type: "string",
            required: true,
            description: "Persisted research run identifier",
          },
        },
        readOnly: true,
        returns: "ResearchLineage",
      },
      {
        name: "get_research_runs",
        method: "GET",
        path: "/api/mcp/tools/get_research_runs",
        input: {
          indicatorId: {
            type: "string",
            required: false,
            description: "Optional known indicator identifier",
          },
          calculationMethod: {
            type: "string",
            required: false,
            description: "Optional calculation method",
          },
          reviewDecisionStatus: {
            type: "string",
            required: false,
            enum: [
              "ready-for-human-review",
              "blocked",
              "insufficient-evidence",
            ],
          },
          limit: { type: "integer", required: false, maximum: 100 },
          offset: { type: "integer", required: false },
        },
        readOnly: true,
        returns: "ResearchRunsPage",
      },
      {
        name: "get_research_run_export",
        method: "GET",
        path: "/api/mcp/tools/get_research_run_export",
        input: {
          runId: {
            type: "string",
            required: true,
            description: "Persisted research run identifier",
          },
        },
        readOnly: true,
        returns: "ResearchRunExport",
      },
      {
        name: "get_openbb_review",
        method: "GET",
        path: "/api/mcp/tools/get_openbb_review",
        input: {
          runId: {
            type: "string",
            required: true,
            description: "Persisted OpenBB staging review run identifier",
          },
        },
        readOnly: true,
        returns: "OpenBBComparisonReview",
      },
      {
        name: "get_openbb_review_export",
        method: "GET",
        path: "/api/mcp/tools/get_openbb_review_export",
        input: {
          runId: {
            type: "string",
            required: true,
            description: "Persisted OpenBB staging review run identifier",
          },
        },
        readOnly: true,
        returns: "OpenBBReviewPackage",
      },
      {
        name: "get_openbb_review_diff",
        method: "GET",
        path: "/api/mcp/tools/get_openbb_review_diff",
        input: {
          olderRunId: {
            type: "string",
            required: true,
            description: "First persisted OpenBB review run identifier",
          },
          newerRunId: {
            type: "string",
            required: true,
            description: "Second persisted OpenBB review run identifier",
          },
        },
        readOnly: true,
        returns: "OpenBBReviewDiff",
      },
    ],
    boundary:
      "Tools return bounded evidence bundles with observations, provenance, availability and limitations; they do not expose raw providers or make investment recommendations.",
  });
});

app.get("/api/mcp/tools/get_indicator_evidence", indicatorEvidenceHandler);

app.get(
  "/api/mcp/tools/get_verified_observations",
  async (request, response) => {
    const indicatorId =
      typeof request.query.indicatorId === "string"
        ? request.query.indicatorId
        : "";
    const source = DATA_SOURCES[indicatorId];
    if (!source)
      return response
        .status(404)
        .json({ error: "Unknown indicator", indicatorId });
    const provider = getIndicatorProviderCapability(indicatorId);
    const operationAvailability = provider
      ? buildProviderOperationAvailability(provider, "evidence")
      : buildProviderOperationAvailability({ providerId: "unknown", supportedOperations: [] }, "evidence");
    const operationSupported = operationAvailability.status === "configuration-supported";
    const rawLimit =
      typeof request.query.limit === "string" &&
      /^\d+$/.test(request.query.limit)
        ? Number(request.query.limit)
        : 300;
    const limit = Math.min(Math.max(rawLimit, 1), 1000);
    let rows: Array<Record<string, unknown>>;
    try {
      rows = (
        shouldUseSupabaseStorage()
          ? await supabaseLatestObservations(indicatorId, 10_000)
          : latestObservations(indicatorId, 10_000)
      ) as Array<Record<string, unknown>>;
    } catch (error) {
      return response.status(503).json(buildManagedStorageErrorResponse(error));
    }
    const deduplicatedRows = selectLatestPerPeriod(rows);
    const observations = deduplicatedRows
      .filter(isSourceBackedVerifiedObservation)
      .slice(-limit);
    const latest = deduplicatedRows.at(-1);
    const latestObservationEligible = Boolean(
      latest && isSourceBackedVerifiedObservation(latest),
    );
    const freshness = latestObservationEligible
      ? freshnessStatus(
          latest?.date == null ? null : String(latest.date),
          source.frequencyLabel,
        )
      : ("unavailable" as const);
    const currentEligibleObservationCount =
      freshness === "fresh" && operationSupported ? observations.length : 0;
    response.json({
      indicatorId,
      observations,
      count: observations.length,
      evidence: observations.length ? "actual-verified-source-backed" : "none",
      freshness,
      operationAvailability,
      researchEligibility: {
        hasVerifiedActual: operationSupported && observations.length > 0,
        hasCurrentEvidence: currentEligibleObservationCount > 0,
        eligibleObservationCount: observations.length,
        currentEligibleObservationCount,
        freshness,
        latestObservationEligible,
        operation: "evidence",
        operationSupported,
      },
      source: {
        source: source.source,
        seriesId: source.seriesId ?? source.coinId ?? null,
        sourceUrl: source.sourceUrl,
        frequency: source.frequencyLabel,
        unit: source.unit ?? null,
      },
      limitations: [
        "Only actual, verified and source-backed observations are returned; excluded rows are not silently promoted.",
        ...(rows.length > 0 && observations.length === 0
          ? [
              "Observations exist but none currently meet the actual, verified and source-backed evidence gate.",
            ]
          : []),
        ...(rows.length === 0
          ? ["No observations currently exist for this indicator."]
          : []),
        ...(freshness !== "fresh"
          ? [
              "Verified observations may be delayed or outdated; freshness is reported separately from current evidence eligibility.",
            ]
          : []),
        ...(operationSupported
          ? []
          : [
              "The provider does not declare the governed evidence operation; observations remain diagnostic only.",
            ]),
      ],
    });
  },
);

app.get("/api/mcp/tools/get_evidence_commentary", async (request, response) => {
  const rawIds =
    typeof request.query.indicatorIds === "string"
      ? request.query.indicatorIds
      : "";
  const indicatorIds = [
    ...new Set(
      rawIds
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
  const limit = Math.min(
    100,
    Math.max(1, Number(request.query.limit ?? 20) || 20),
  );
  if (indicatorIds.length < 1 || indicatorIds.length > 5)
    return response
      .status(400)
      .json({ error: "indicatorIds must contain one to five identifiers" });
  const unknown = indicatorIds.find(
    (indicatorId) => !DATA_SOURCES[indicatorId],
  );
  if (unknown)
    return response
      .status(404)
      .json({ error: "Unknown indicator", indicatorId: unknown });
  let records: Array<{
    indicatorId: string;
    observations: Array<{
      date: string;
      value: number;
      status: "actual";
      quality: "verified";
    }>;
    freshness: string;
    latestObservationEligible: boolean;
    eligibleObservationCount: number;
    currentEligibleObservationCount: number;
    operationSupported: boolean;
    operationAvailability: ReturnType<typeof buildProviderOperationAvailability>;
    evidenceState: "current-eligible" | "historical-eligible" | "none";
    currentEvidence: boolean;
    source: {
      name: string;
      agency: string;
      seriesId: string | null;
      sourceUrl: string;
      unit: string | null;
      frequency: string;
    };
  }>;
  try {
    records = await Promise.all(
      indicatorIds.map(async (indicatorId) => {
        const source = DATA_SOURCES[indicatorId];
        const provider = getIndicatorProviderCapability(indicatorId);
        const operationAvailability = provider
          ? buildProviderOperationAvailability(provider, "evidence")
          : null;
        const operationSupported = operationAvailability?.status === "configuration-supported";
        const rows = (
          shouldUseSupabaseStorage()
            ? await supabaseLatestObservations(indicatorId, limit)
            : latestObservations(indicatorId, limit)
        ) as Array<Record<string, unknown>>;
        const deduplicatedRows = selectLatestPerPeriod(rows);
        const observations = deduplicatedRows
          .filter(isSourceBackedVerifiedObservation)
          .map((row) => ({
            date: String(row.date),
            value: Number(row.value),
            status: "actual" as const,
            quality: "verified" as const,
          }));
        const latest = deduplicatedRows.at(-1);
        const latestObservationEligible = Boolean(
          latest && isSourceBackedVerifiedObservation(latest),
        );
        const freshness = latestObservationEligible
          ? freshnessStatus(
              latest?.date == null ? null : String(latest.date),
              source.frequencyLabel,
            )
          : ("unavailable" as const);
        const currentEligibleObservationCount =
          freshness === "fresh" && operationSupported ? observations.length : 0;
        return {
          indicatorId,
          observations,
          freshness,
          latestObservationEligible,
          eligibleObservationCount: observations.length,
          currentEligibleObservationCount,
          operationSupported,
          operationAvailability: operationAvailability ?? buildProviderOperationAvailability({ providerId: "unknown", supportedOperations: [] }, "evidence"),
          evidenceState:
            operationSupported && currentEligibleObservationCount > 0
              ? ("current-eligible" as const)
              : operationSupported && observations.length > 0
                ? ("historical-eligible" as const)
                : ("none" as const),
          currentEvidence: currentEligibleObservationCount > 0,
          source: {
            name: source.source,
            agency: source.agency,
            seriesId: source.seriesId ?? source.coinId ?? null,
            sourceUrl: source.sourceUrl,
            unit: source.unit ?? null,
            frequency: source.frequencyLabel,
          },
        };
      }),
    );
  } catch (error) {
    return response.status(503).json(buildManagedStorageErrorResponse(error));
  }
  const eligibleRecords = records.filter((record) => record.operationSupported);
  const evidence = eligibleRecords.length === records.length && records.every((record) => record.observations.length > 0)
    ? "actual-verified-source-backed"
    : eligibleRecords.some((record) => record.observations.length > 0)
      ? "partial-actual-verified-source-backed"
      : "none";
  response.json({
    evidence,
    records,
    calculation: {
      method: "latest-direction",
      definition:
        "Compare the direction of each eligible indicator between its two latest observations.",
      causalInference: false,
      inputs: records.map((record) => record.indicatorId),
    },
    limitations: [
      "Commentary is bounded to actual, verified and source metadata.",
      "Direction between adjacent observations is descriptive and does not establish causality, forecast a future value or provide investment advice.",
      ...(records.every((record) => record.observations.length > 0)
        ? []
        : [
            "At least one requested indicator has no eligible source-backed observations.",
          ]),
      ...(records.every((record) => record.currentEvidence)
        ? []
        : [
            "Historical actual/verified observations may be returned, but current commentary is not asserted until each latest series is fresh.",
          ]),
      ...(records.every((record) => record.operationSupported)
        ? []
        : [
            "At least one provider does not declare the governed evidence operation; its stored rows are not commentary inputs.",
          ]),
    ],
  });
});

app.get("/api/mcp/tools/get_indicator_metadata", (request, response) => {
  const rawIndicatorId = request.query.indicatorId;
  const indicatorId = typeof rawIndicatorId === "string" ? rawIndicatorId : "";
  const source = DATA_SOURCES[indicatorId];
  if (!source)
    return response
      .status(404)
      .json({ error: "Unknown indicator", indicatorId });
  const provider = getIndicatorProviderCapability(indicatorId);
  response.json({
    indicatorId,
    metadata: {
      source: source.source,
      agency: source.agency,
      type: source.type,
      seriesId: source.seriesId ?? source.coinId ?? null,
      sourceUrl: source.sourceUrl,
      frequency: source.frequencyLabel,
      unit: source.unit ?? null,
      notes: source.notes ?? null,
      providerId: provider?.providerId ?? null,
      adapterMode: provider?.adapterMode ?? null,
      rightsStatus: provider?.rightsStatus ?? null,
    },
    evidence: "configuration",
    limitations: [
      "Metadata is configuration-derived and does not prove live availability, licensing or observation correctness.",
    ],
  });
});

app.get("/api/mcp/tools/get_source_reconciliation", (request, response) => {
  const indicatorId =
    typeof request.query.indicatorId === "string"
      ? request.query.indicatorId
      : "";
  if (!DATA_SOURCES[indicatorId])
    return response
      .status(404)
      .json({ error: "Unknown indicator", indicatorId });
  const report = buildSourceMappingReport(indicatorId);
  response.json({
    ...report,
    limitations: [
      report.limitation,
      "A reconciliation report does not authorize automatic fallback; rights, live health and semantic review remain separate gates.",
    ],
  });
});

app.get("/api/mcp/tools/get_provider_redundancy", (request, response) => {
  const requestedIndicator =
    typeof request.query.indicatorId === "string"
      ? request.query.indicatorId
      : undefined;
  if (requestedIndicator && !DATA_SOURCES[requestedIndicator])
    return response
      .status(404)
      .json({ error: "Unknown indicator", indicatorId: requestedIndicator });
  response.json(
    buildProviderRedundancyReport(
      requestedIndicator ? [requestedIndicator] : undefined,
    ),
  );
});

app.get(
  "/api/mcp/tools/get_provider_fallback_readiness",
  (request, response) => {
    const requestedIndicator =
      typeof request.query.indicatorId === "string"
        ? request.query.indicatorId
        : undefined;
    if (requestedIndicator && !DATA_SOURCES[requestedIndicator])
      return response
        .status(404)
        .json({ error: "Unknown indicator", indicatorId: requestedIndicator });
    const redundancy = buildProviderRedundancyReport(
      requestedIndicator ? [requestedIndicator] : undefined,
    );
    response.json(buildFallbackReadiness(redundancy.records));
  },
);

app.get("/api/mcp/tools/explain_alert_evidence", async (request, response) => {
  const eventId =
    typeof request.query.eventId === "string" &&
    /^\d+$/.test(request.query.eventId)
      ? Number(request.query.eventId)
      : NaN;
  if (!Number.isInteger(eventId))
    return response.status(400).json({ error: "eventId must be an integer" });
  try {
    const events = (
      shouldUseSupabaseStorage()
        ? await supabaseListAlertEvents()
        : listAlertEvents()
    ) as Array<Record<string, unknown>>;
    const event = events.find((item) => Number(item.id) === eventId);
    if (!event)
      return response
        .status(404)
        .json({ error: "Unknown alert event", eventId });
    const indicatorId = String(event.indicatorId);
    const source = DATA_SOURCES[indicatorId];
    const alerts = (
      shouldUseSupabaseStorage() ? await supabaseListAlerts() : listAlerts()
    ) as Array<Record<string, unknown>>;
    const alert = alerts.find(
      (item) => String(item.id) === String(event.alertId),
    );
    response.json({
      event: {
        id: eventId,
        indicatorId,
        observationPeriod: event.observationPeriod,
        observedValue: event.observedValue,
        triggeredAt: event.triggeredAt,
        acknowledgedAt: event.acknowledgedAt ?? null,
      },
      alert: alert
        ? {
            condition: alert.condition,
            threshold: alert.threshold,
            note: alert.note ?? null,
            active: alert.active,
          }
        : null,
      source: source
        ? {
            source: source.source,
            seriesId: source.seriesId ?? source.coinId ?? null,
            sourceUrl: source.sourceUrl,
          }
        : null,
      evidence: "recorded-alert-event",
      limitations: [
        "This explains a recorded threshold event; it is not a forecast, recommendation or causal explanation.",
        "Alert evaluation requires actual, verified, source-backed observations; review the linked observation and source before inference.",
      ],
    });
  } catch (error) {
    response.status(503).json(buildManagedStorageErrorResponse(error));
  }
});

app.get("/api/mcp/tools/get_historical_event_evidence", (request, response) => {
  const cycleId =
    typeof request.query.cycleId === "string" ? request.query.cycleId : "";
  const cycle = historicalCycles.find((item) => item.id === cycleId);
  if (!cycle)
    return response
      .status(404)
      .json({ error: "Unknown historical cycle", cycleId });
  response.json({
    cycle: {
      id: cycle.id,
      name: cycle.name,
      period: cycle.period,
      region: cycle.region,
      kind: cycle.kind,
      severity: cycle.severity,
      evidenceStatus: cycle.evidenceStatus ?? "unverified",
      context: cycle.context,
      policy: cycle.policy,
      impact: cycle.impact,
      lesson: cycle.lesson,
      nextResearchQuestion: cycle.whatIDo,
    },
    linkedIndicators: cycle.keyIndicators.map((indicatorId) => ({
      indicatorId,
      metadata: DATA_SOURCES[indicatorId]
        ? {
            source: DATA_SOURCES[indicatorId].source,
            seriesId:
              DATA_SOURCES[indicatorId].seriesId ??
              DATA_SOURCES[indicatorId].coinId ??
              null,
            sourceUrl: DATA_SOURCES[indicatorId].sourceUrl,
          }
        : null,
    })),
    evidence:
      cycle.evidenceStatus === "verified"
        ? "historical-narrative"
        : "configuration-narrative",
    limitations: [
      "Historical narrative evidence is separate from linked indicator observations and does not prove causal relationships.",
      "Verify each linked indicator's observations, vintage and source before treating the narrative as research evidence.",
    ],
  });
});

const compareEvidenceHandler = async (
  request: express.Request,
  response: express.Response,
) => {
  const rawIds =
    typeof request.query.indicatorIds === "string"
      ? request.query.indicatorIds
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : [];
  const indicatorIds = [...new Set(rawIds)];
  if (indicatorIds.length !== 2)
    return response
      .status(400)
      .json({ error: "indicatorIds must contain exactly two indicators" });
  const unknown = indicatorIds.filter(
    (indicatorId) => !DATA_SOURCES[indicatorId],
  );
  if (unknown.length)
    return response
      .status(404)
      .json({ error: "Unknown indicator", indicatorIds: unknown });
  const transformation =
    typeof request.query.transformation === "string" &&
    ["level", "change", "pct_change"].includes(request.query.transformation)
      ? (request.query.transformation as "level" | "change" | "pct_change")
      : "level";
  const maxLag =
    typeof request.query.maxLag === "string" &&
    /^\d+$/.test(request.query.maxLag)
      ? Math.min(12, Number(request.query.maxLag))
      : 0;
  let series: Array<readonly [string, unknown[]]>;
  try {
    series = await Promise.all(
      indicatorIds.map(
        async (indicatorId) =>
          [
            indicatorId,
            shouldUseSupabaseStorage()
              ? await supabaseLatestObservations(indicatorId, 10_000)
              : latestObservations(indicatorId, 10_000),
          ] as const,
      ),
    );
  } catch (error) {
    return response.status(503).json(buildManagedStorageErrorResponse(error));
  }
  const eligibleCounts: Record<string, number> = {};
  const currentEligibleCounts: Record<string, number> = {};
  const freshnessByIndicator: Record<string, string> = {};
  const excludedCounts: Record<string, number> = {};
  const operationAvailabilityByIndicator = Object.fromEntries(indicatorIds.map((indicatorId) => {
    const provider = getIndicatorProviderCapability(indicatorId);
    return [indicatorId, provider
      ? buildProviderOperationAvailability(provider, "evidence")
      : buildProviderOperationAvailability({ providerId: "unknown", supportedOperations: [] }, "evidence")];
  }));
  const eligibleSeries = Object.fromEntries(
    series.map(([indicatorId, rows]) => {
      const typedRows = rows as Array<{
        date: string;
        value: number;
        status?: string;
        quality?: string;
        sourceName?: string;
        sourceSeriesId?: string | null;
      }>;
      const operationSupported = operationAvailabilityByIndicator[indicatorId].status === "configuration-supported";
      const eligible = operationSupported ? typedRows.filter(isSourceBackedVerifiedObservation) : [];
      eligibleCounts[indicatorId] = eligible.length;
      const latest = typedRows.at(-1);
      const freshness =
        latest && isSourceBackedVerifiedObservation(latest)
          ? freshnessStatus(
              latest.date ?? null,
              DATA_SOURCES[indicatorId].frequencyLabel,
            )
          : ("unavailable" as const);
      freshnessByIndicator[indicatorId] = freshness;
      currentEligibleCounts[indicatorId] =
        freshness === "fresh" && operationSupported ? eligible.length : 0;
      excludedCounts[indicatorId] = rows.length - eligible.length;
      return [
        indicatorId,
        eligible.map((row) => ({ date: row.date, value: row.value })),
      ];
    }),
  );
  const report = buildComparisonReport(eligibleSeries, {
    transformation,
    maxLag,
  });
  const limitations = [
    ...report.limitations,
    ...(Object.values(excludedCounts).some((count) => count > 0)
      ? [
          "Some stored rows were excluded because they were not actual, verified and source-backed.",
        ]
      : []),
  ];
  const currentEvidence = indicatorIds.every(
    (indicatorId) => currentEligibleCounts[indicatorId] > 0,
  );
  response.json({
    indicators: indicatorIds.map((indicatorId) => ({
      indicatorId,
      source: DATA_SOURCES[indicatorId].source,
      seriesId:
        DATA_SOURCES[indicatorId].seriesId ??
        DATA_SOURCES[indicatorId].coinId ??
        null,
      sourceUrl: DATA_SOURCES[indicatorId].sourceUrl,
      frequency: DATA_SOURCES[indicatorId].frequencyLabel,
      freshness: freshnessByIndicator[indicatorId],
      operationAvailability: operationAvailabilityByIndicator[indicatorId],
    })),
    report: {
      ...report,
      evidenceState: "actual-verified-source-backed",
      currentEvidenceState: currentEvidence
        ? "current-actual-verified-source-backed"
        : "historical-only-or-current-evidence-unavailable",
      eligibleCounts,
      currentEligibleCounts,
      excludedCounts,
      operationAvailability: operationAvailabilityByIndicator,
    },
    evidence: "ingestion",
    limitations: [
      ...limitations,
      ...(currentEvidence
        ? []
        : [
            "The comparison may contain historical actual/verified observations, but current evidence is not asserted until both latest series are fresh.",
          ]),
      ...(Object.values(operationAvailabilityByIndicator).every((item) => item.status === "configuration-supported")
        ? []
        : ["At least one provider does not declare the governed evidence operation; its observations were excluded from comparison."]),
    ],
  });
};

app.get("/api/evidence/compare", compareEvidenceHandler);
app.get("/api/mcp/tools/compare_indicators", compareEvidenceHandler);
app.get("/api/mcp/tools/get_relationship_evidence", compareEvidenceHandler);

app.get("/api/quality", async (_request, response) => {
  try {
    if (shouldUseSupabaseStorage()) {
      const summary = (await supabaseQualitySummary()) as {
        observations: number;
        quarantined: number;
        runSummary: unknown[];
        freshness: Array<Record<string, unknown>>;
      };
      const freshness = (
        await supabaseLatestFreshness(Object.keys(DATA_SOURCES))
      ).map((item) => {
        const source = DATA_SOURCES[String(item.indicatorId)];
        return {
          ...item,
          sourceUrl: source?.sourceUrl ?? null,
          status: freshnessStatus(
            String(item.observedThrough ?? ""),
            String(item.frequency ?? source?.frequencyLabel ?? ""),
          ),
        };
      });
      return response.json({ ...summary, freshness });
    }
    const observations = db
      .prepare("SELECT COUNT(*) AS count FROM observations")
      .get() as { count: number };
    const quarantined = db
      .prepare("SELECT COUNT(*) AS count FROM quarantine")
      .get() as { count: number };
    const runSummary = db
      .prepare(
        `
    SELECT status, COUNT(*) AS count FROM ingestion_runs GROUP BY status ORDER BY status
  `,
      )
      .all();
    const freshnessRows = db
      .prepare(
        `
    WITH ranked AS (
      SELECT indicator_id, period, ingested_at, source_name,
             source_series_id, frequency,
             ROW_NUMBER() OVER (
               PARTITION BY indicator_id
               ORDER BY period DESC, vintage DESC, ingested_at DESC
             ) AS rank
      FROM observations
    )
    SELECT indicator_id AS indicatorId, period AS observedThrough,
           ingested_at AS ingestedAt, source_name AS sourceName,
           source_series_id AS sourceSeriesId, frequency
    FROM ranked
    WHERE rank = 1
    ORDER BY indicator_id
  `,
      )
      .all();
    const freshness = freshnessRows.map((row) => {
      const item = row as {
        indicatorId: string;
        observedThrough: string | null;
        ingestedAt: string | null;
        sourceName: string | null;
        sourceSeriesId: string | null;
        frequency: string | null;
      };
      const source = DATA_SOURCES[item.indicatorId];
      return {
        ...item,
        sourceUrl: source?.sourceUrl ?? null,
        status: freshnessStatus(
          item.observedThrough,
          item.frequency ?? source?.frequencyLabel,
        ),
      };
    });
    response.json({
      observations: observations.count,
      quarantined: quarantined.count,
      runSummary,
      freshness,
    });
  } catch (error) {
    response.status(503).json(buildManagedStorageErrorResponse(error));
  }
});

// Short-lived request coalescing protects the local read path when the UI and
// hydration sampler ask for the same series at once. The TTL is intentionally
// brief so ingestion freshness semantics remain authoritative.
type LatestSeriesRows = ReturnType<typeof latestObservations>;
const seriesReadCache = new Map<string, { expiresAt: number; series: LatestSeriesRows }>();
const seriesReadInFlight = new Map<string, Promise<LatestSeriesRows>>();

async function readLatestSeries(indicatorId: string, limit: number): Promise<LatestSeriesRows> {
  const key = `${indicatorId}:${limit}`;
  const cached = seriesReadCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.series;
  const inFlight = seriesReadInFlight.get(key);
  if (inFlight) return inFlight;
  const promise = Promise.resolve(
    shouldUseSupabaseStorage()
      ? supabaseLatestObservations(indicatorId, limit) as Promise<LatestSeriesRows>
      : latestObservations(indicatorId, limit),
  ).then((series) => {
    seriesReadCache.set(key, { expiresAt: Date.now() + 1_000, series });
    return series;
  }).finally(() => seriesReadInFlight.delete(key));
  seriesReadInFlight.set(key, promise);
  return promise;
}

app.get("/api/series/:indicatorId", async (request, response) => {
  const source = DATA_SOURCES[request.params.indicatorId];
  if (!source) return response.status(404).json({ error: "Unknown indicator", indicatorId: request.params.indicatorId });
  const limit = Math.min(
    Math.max(Number(request.query.limit ?? 300), 1),
    10000,
  );
  let series;
  try {
    series = await readLatestSeries(request.params.indicatorId, limit);
  } catch (error) {
    return response.status(503).json(buildManagedStorageErrorResponse(error));
  }
  if (series.length === 0)
    return response.status(404).json({ error: "No ingested observations" });
  const provider = getIndicatorProviderCapability(request.params.indicatorId);
  const operationAvailability = provider
    ? buildProviderOperationAvailability(provider, "evidence")
    : buildProviderOperationAvailability({ providerId: "unknown", supportedOperations: [] }, "evidence");
  response.json({
    indicatorId: request.params.indicatorId,
    series: series.map((row) => ({
      ...row,
      sourceUrl: row.sourceUrl ?? source.sourceUrl,
      unit: row.unit ?? source.unit ?? null,
    })),
    operationAvailability,
    researchEligibility: { operation: "evidence", operationSupported: operationAvailability.status === "configuration-supported" },
  });
});

app.get("/api/snapshots", async (_request, response) => {
  let snapshots;
  try {
    snapshots = shouldUseSupabaseStorage()
      ? await supabaseLatestSnapshots(Object.keys(DATA_SOURCES))
      : latestSnapshots();
  } catch (error) {
    return response.status(503).json(buildManagedStorageErrorResponse(error));
  }
  response.json(
    (
      snapshots as Array<{ indicatorId: string; sourceUrl?: string | null }>
    ).map((snapshot) => ({
      ...snapshot,
      sourceUrl:
        snapshot.sourceUrl ??
        DATA_SOURCES[snapshot.indicatorId]?.sourceUrl ??
        null,
      freshness: freshnessStatus(
        String((snapshot as { date?: string }).date ?? ""),
        DATA_SOURCES[snapshot.indicatorId]?.frequencyLabel,
      ),
      operationAvailability: getIndicatorProviderCapability(snapshot.indicatorId)
        ? buildProviderOperationAvailability(getIndicatorProviderCapability(snapshot.indicatorId)!, "evidence")
        : buildProviderOperationAvailability({ providerId: "unknown", supportedOperations: [] }, "evidence"),
    })),
  );
});

app.get("/api/forecasts", async (request, response) => {
  const indicatorId =
    typeof request.query.indicatorId === "string"
      ? request.query.indicatorId
      : undefined;
  try {
    response.json({
      forecasts: shouldUseSupabaseStorage()
        ? await supabaseListForecasts(indicatorId)
        : listForecasts(indicatorId),
    });
  } catch (error) {
    response.status(503).json(buildManagedStorageErrorResponse(error));
  }
});

app.get("/api/forecast-debates", async (request, response) => {
  const indicatorId = typeof request.query.indicatorId === "string" ? request.query.indicatorId : undefined;
  try {
    const forecasts = (shouldUseSupabaseStorage() ? await supabaseListForecasts(indicatorId) : listForecasts(indicatorId)) as Array<Record<string, unknown>>;
    const debateIndicatorIds = new Set<string>();
    for (const forecast of forecasts) {
      const base = indicatorCatalog.find((item) => item.id === String(forecast.indicatorId));
      if (!base) continue;
      debateIndicatorIds.add(base.id);
      base.relationships.forEach((relationship) => debateIndicatorIds.add(relationship.indicatorId));
    }
    const hydratedIndicators = new Map<string, Indicator>();
    await Promise.all([...debateIndicatorIds].map(async (id) => {
      const base = indicatorCatalog.find((item) => item.id === id);
      if (!base) return;
      const rows = (shouldUseSupabaseStorage() ? await supabaseLatestObservations(id, 300) : latestObservations(id, 300)) as Array<Record<string, unknown>>;
      const eligibleRows = rows.filter((row) => row.status === "actual" && row.quality === "verified" && Number.isFinite(Number(row.value)));
      if (eligibleRows.length === 0) return;
      const last = eligibleRows.at(-1)!;
      const previous = eligibleRows.at(-2);
      const value = Number(last.value);
      const previousValue = previous ? Number(previous.value) : value;
      const change = value - previousValue;
      const changePct = previousValue === 0 ? 0 : (change / Math.abs(previousValue)) * 100;
      const source = DATA_SOURCES[id];
      const frequency = String(last.frequency ?? source?.frequencyLabel ?? "");
      hydratedIndicators.set(id, {
        ...base,
        series: eligibleRows.map((row) => ({ date: String(row.date), value: Number(row.value), status: "actual" as const, vintage: row.vintage == null ? undefined : String(row.vintage) })),
        snapshot: { value, date: String(last.date), change, changePct },
        trend: change > 0 ? "up" : change < 0 ? "down" : "flat",
        provenance: {
          ...base.provenance,
          status: "actual",
          quality: "verified",
          sourceName: String(last.sourceName ?? source?.source ?? base.source),
          sourceSeriesId: last.sourceSeriesId == null ? source?.seriesId : String(last.sourceSeriesId),
          sourceUrl: source?.sourceUrl ?? base.provenance?.sourceUrl,
          observedThrough: String(last.date),
          freshness: freshnessStatus(String(last.date), frequency, new Date(), id),
        },
      } as Indicator);
    }));
    const debateCatalog: Indicator[] = indicatorCatalog.map((base) => hydratedIndicators.get(base.id) ?? base as Indicator);
    const debates = forecasts.flatMap((row) => {
      const indicator = debateCatalog.find((item) => item.id === String(row.indicatorId));
      if (!indicator) return [];
      const prediction = inferPredictionFromForecast(Number(row.forecastValue), indicator.snapshot.value, String(row.targetDate), String(row.institution));
      return [{ forecastId: String(row.id), session: runMacroDebate(indicator as never, prediction, debateCatalog as never[]) }];
    });
    return response.json({ debates, evidence: "server-deterministic-debate", limitations: ["The read projection is descriptive research opinion; it does not invoke LLMs or authorize investment/trading decisions."] });
  } catch (error) {
    return response.status(503).json(buildManagedStorageErrorResponse(error));
  }
});

app.get("/api/forecast-coverage", async (_request, response) => {
  try {
    const forecasts = (shouldUseSupabaseStorage()
      ? await supabaseListForecasts()
      : listForecasts()) as Array<{
        id?: string;
        indicatorId: string;
        institution?: string;
        targetDate: string;
        forecastDate: string;
        version?: number;
        sourceName?: string;
        sourceUrl?: string;
      }>;
    return response.json(buildForecastCoverage(indicatorCatalog, forecasts, forecasts.map((item) => String(item.id ?? ""))));
  } catch (error) {
    return response.status(503).json(buildManagedStorageErrorResponse(error));
  }
});

app.get("/api/forecast-sources", (_request, response) => {
  response.json(buildForecastSourceRegistryAudit());
});

app.get("/api/institutional-outlooks", (request, response) => {
  const indicatorId = request.query.indicatorId
    ? String(request.query.indicatorId)
    : undefined;
  if (shouldUseSupabaseStorage())
    return supabaseListInstitutionalOutlooks(indicatorId)
      .then((outlooks) => response.json({ outlooks }))
      .catch((error) =>
        response.status(503).json({
          error: error instanceof Error ? error.message : String(error),
        }),
      );
  response.json({ outlooks: listInstitutionalOutlooks(indicatorId) });
});

app.post(
  "/api/admin/institutional-outlooks",
  (request, response) => {
    try {
      const validationIssues = validateInstitutionalOutlook(request.body);
      if (validationIssues.length)
        return response.status(400).json({
          error: `Institutional outlook rejected: ${validationIssues.join(", ")}`,
        });
      if (shouldUseSupabaseStorage())
        return supabaseCreateInstitutionalOutlook(request.body)
          .then((row) => response.status(201).json(row))
          .catch((error) =>
            response.status(400).json({
              error: error instanceof Error ? error.message : String(error),
            }),
          );
      const id = persistInstitutionalOutlook(db, request.body);
      return response.status(201).json({ id });
    } catch (error) {
      return response.status(400).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
);

app.get("/api/forecast-accuracy", async (request, response) => {
  const indicatorId =
    typeof request.query.indicatorId === "string"
      ? request.query.indicatorId
      : undefined;
  try {
    response.json({
      forecasts: shouldUseSupabaseStorage()
        ? await supabaseForecastAccuracy(indicatorId)
        : listForecastAccuracy(indicatorId),
    });
  } catch (error) {
    response.status(503).json(buildManagedStorageErrorResponse(error));
  }
});

app.get("/api/research-memory", async (request, response) => {
  const indicatorId = typeof request.query.indicatorId === "string" ? request.query.indicatorId : undefined;
  try {
    const memory = shouldUseSupabaseStorage() ? await supabaseListResearchMemory(indicatorId) : listResearchMemory(indicatorId);
    response.json({ memory, evidence: memory.length ? "actual-verified-source-backed" : "none", limitations: ["Accuracy is descriptive for a target-date forecast revision; it does not establish causality or investment advice."] });
  } catch (error) {
    response.status(503).json(buildManagedStorageErrorResponse(error));
  }
});

app.get("/api/forecast-summaries", async (request, response) => {
  const indicatorId =
    typeof request.query.indicatorId === "string"
      ? request.query.indicatorId
      : undefined;
  try {
    response.json({
      summaries: shouldUseSupabaseStorage()
        ? await supabaseForecastSummaries(indicatorId)
        : listForecastSummaries(indicatorId),
    });
  } catch (error) {
    response.status(503).json(buildManagedStorageErrorResponse(error));
  }
});

const forecastRevisionHandler = async (
  request: express.Request,
  response: express.Response,
) => {
  const indicatorId =
    typeof request.query.indicatorId === "string"
      ? request.query.indicatorId
      : undefined;
  let forecasts: Array<Record<string, unknown>>;
  let accuracyRows: Array<Record<string, unknown>>;
  try {
    forecasts = (
      shouldUseSupabaseStorage()
        ? await supabaseListForecasts(indicatorId)
        : listForecasts(indicatorId)
    ) as Array<Record<string, unknown>>;
    accuracyRows = (
      shouldUseSupabaseStorage()
        ? await supabaseForecastAccuracy(indicatorId)
        : listForecastAccuracy(indicatorId)
    ) as Array<Record<string, unknown>>;
  } catch (error) {
    return response.status(503).json(buildManagedStorageErrorResponse(error));
  }
  const accuracyById = new Map(
    accuracyRows.map((row) => [String(row.id), row]),
  );
  const rows = forecasts.map((row) => {
    const accuracy = accuracyById.get(String(row.id));
    return {
      id: String(row.id),
      indicatorId: String(row.indicatorId),
      targetDate: String(row.targetDate),
      forecastDate: String(row.forecastDate),
      forecastValue: Number(row.forecastValue),
      institution: String(row.institution),
      version: Number(row.version ?? 1),
      sourceName: row.sourceName == null ? null : String(row.sourceName),
      sourceUrl: row.sourceUrl == null ? null : String(row.sourceUrl),
      sourceGovernance: assessForecastSubmission({ sourceName: row.sourceName == null ? null : String(row.sourceName), sourceUrl: row.sourceUrl == null ? null : String(row.sourceUrl), indicatorId: String(row.indicatorId) }),
      methodology: row.methodology == null ? null : String(row.methodology),
      actualValue:
        accuracy?.actualValue == null ? null : Number(accuracy.actualValue),
      accuracyState:
        accuracy?.accuracyState === "available"
          ? ("available" as const)
          : ("pending" as const),
      error: accuracy?.error == null ? null : Number(accuracy.error),
      absolutePercentageError:
        accuracy?.absolutePercentageError == null
          ? null
          : Number(accuracy.absolutePercentageError),
    };
  });
  const timelines = buildForecastRevisionTimeline(rows);
  if (request.path.includes("/mcp/tools/"))
    return response.json({
      timelines,
      evidence: "forecast-lifecycle",
      limitations: [
        "Lifecycle ordering describes publication history; it does not rank forecast quality or establish causality.",
        ...(timelines.length === 0
          ? ["No provider-backed forecast revisions are currently available."]
          : []),
      ],
    });
  response.json({ timelines });
};

app.get("/api/forecast-revisions", forecastRevisionHandler);
app.get(
  "/api/mcp/tools/get_forecast_revision_evidence",
  async (request, response) => {
    await forecastRevisionHandler(request, response);
  },
);

app.get("/api/internal-forecast-model", async (request, response) => {
  const indicatorId =
    typeof request.query.indicatorId === "string"
      ? request.query.indicatorId
      : undefined;
  if (!indicatorId)
    return response.status(400).json({ error: "indicatorId is required" });
  const source = DATA_SOURCES[indicatorId];
  const observations = (
    shouldUseSupabaseStorage()
      ? await supabaseLatestObservations(indicatorId, 10_000)
      : latestObservations(indicatorId, 10_000)
  ) as Array<{
    date: string;
    value: number;
    status: string;
    quality: string;
  }>;
  const datedObservations = observations.map((observation) => ({
    ...observation,
    freshness: freshnessStatus(observation.date, source?.frequencyLabel),
  }));
  response.json({
    indicatorId,
    operationAvailability: getIndicatorProviderCapability(indicatorId)
      ? buildProviderOperationAvailability(getIndicatorProviderCapability(indicatorId)!, "evidence")
      : buildProviderOperationAvailability({ providerId: "unknown", supportedOperations: [] }, "evidence"),
    report: evaluateNaivePersistence(datedObservations, source?.frequencyLabel, {
      operationSupported: getIndicatorProviderCapability(indicatorId)?.supportedOperations.includes("evidence") === true,
    }),
  });
});

app.get("/api/model-runs", async (request, response) => {
  const indicatorId =
    typeof request.query.indicatorId === "string"
      ? request.query.indicatorId
      : undefined;
  response.json({
    runs: shouldUseSupabaseStorage()
      ? await supabaseListModelRuns(indicatorId)
      : listModelRuns(indicatorId),
  });
});

const researchRunsHandler = async (
  request: express.Request,
  response: express.Response,
) => {
  const indicatorId =
    typeof request.query.indicatorId === "string"
      ? request.query.indicatorId
      : undefined;
  const calculationMethod =
    typeof request.query.calculationMethod === "string" &&
    request.query.calculationMethod.length <= 100
      ? request.query.calculationMethod
      : undefined;
  const requestedDecision =
    typeof request.query.reviewDecisionStatus === "string"
      ? request.query.reviewDecisionStatus
      : undefined;
  const validDecisionStatuses = [
    "ready-for-human-review",
    "blocked",
    "insufficient-evidence",
  ] as const;
  if (
    requestedDecision &&
    !validDecisionStatuses.includes(
      requestedDecision as (typeof validDecisionStatuses)[number],
    )
  )
    return response.status(400).json({
      error: "Invalid reviewDecisionStatus",
      allowed: validDecisionStatuses,
    });
  const reviewDecisionStatus = requestedDecision as
    (typeof validDecisionStatuses)[number] | undefined;
  const rawLimit =
    typeof request.query.limit === "string" && /^\d+$/.test(request.query.limit)
      ? Number(request.query.limit)
      : 50;
  const rawOffset =
    typeof request.query.offset === "string" &&
    /^\d+$/.test(request.query.offset)
      ? Number(request.query.offset)
      : 0;
  const limit = Math.min(100, Math.max(1, rawLimit));
  const offset = Math.min(100_000, Math.max(0, rawOffset));
  let queried: Array<Record<string, unknown>>;
  try {
    queried = (
      shouldUseSupabaseStorage()
        ? await supabaseListResearchRuns(indicatorId, {
            limit,
            offset,
            calculationMethod,
            reviewDecisionStatus,
          })
        : listResearchRuns(indicatorId, {
            limit,
            offset,
            calculationMethod,
            reviewDecisionStatus,
          })
    ) as Array<Record<string, unknown>>;
  } catch (error) {
    return response.status(503).json(buildManagedStorageErrorResponse(error));
  }
  const hasMore = queried.length > limit;
  response.json({
    runs: queried.slice(0, limit),
    pagination: {
      limit,
      offset,
      hasMore,
      nextOffset: hasMore ? offset + limit : null,
    },
    filters: {
      indicatorId: indicatorId ?? null,
      calculationMethod: calculationMethod ?? null,
      reviewDecisionStatus: reviewDecisionStatus ?? null,
    },
  });
};

app.get("/api/research-runs", researchRunsHandler);
app.get("/api/mcp/tools/get_research_runs", researchRunsHandler);

const researchLineageHandler = async (
  request: express.Request,
  response: express.Response,
) => {
  let rows: Array<Record<string, unknown>>;
  try {
    rows = (
      shouldUseSupabaseStorage()
        ? await supabaseListResearchRuns()
        : listResearchRuns()
    ) as Array<Record<string, unknown>>;
  } catch (error) {
    return response.status(503).json(buildManagedStorageErrorResponse(error));
  }
  const run = rows.find(
    (item) => String((item as { id?: unknown }).id) === request.params.id,
  ) as Parameters<typeof buildResearchLineage>[0] | undefined;
  if (!run)
    return response
      .status(404)
      .json({ error: "Research run not found", id: request.params.id });
  const capabilities = Object.fromEntries(
    PROVIDER_REGISTRY.flatMap((provider) =>
      provider.sourceTypes.map((type) => [type, provider]),
    ),
  );
  const lineage = buildResearchLineage(run, DATA_SOURCES, capabilities);
  if (request.path.includes("/mcp/tools/"))
    return response.json({
      lineage,
      evidence: "persisted-research-run",
      limitations: lineage.limitations,
    });
  response.json({ lineage });
};

const researchRunExportHandler = async (
  request: express.Request,
  response: express.Response,
) => {
  let rows: Array<Record<string, unknown>>;
  try {
    rows = (
      shouldUseSupabaseStorage()
        ? await supabaseListResearchRuns()
        : listResearchRuns()
    ) as Array<Record<string, unknown>>;
  } catch (error) {
    return response.status(503).json(buildManagedStorageErrorResponse(error));
  }
  const run = rows.find(
    (item) => String((item as { id?: unknown }).id) === request.params.id,
  );
  if (!run)
    return response
      .status(404)
      .json({ error: "Research run not found", id: request.params.id });
  const artifact = createResearchRunExportArtifact(
    run as unknown as Parameters<typeof createResearchRunExportArtifact>[0],
  );
  response.json({ evidence: "persisted-research-artifact", artifact, limitations: artifact.limitations });
};

const openBBReviewHandler = async (
  request: express.Request,
  response: express.Response,
) => {
  let rows: Array<Record<string, unknown>>;
  try {
    rows = (
      shouldUseSupabaseStorage()
        ? await supabaseListResearchRuns()
        : listResearchRuns()
    ) as Array<Record<string, unknown>>;
  } catch (error) {
    return response.status(503).json(buildManagedStorageErrorResponse(error));
  }
  const run = rows.find(
    (item) => String((item as { id?: unknown }).id) === request.params.id,
  ) as
    | {
        id?: string;
        calculation?: { method?: string };
        output?: unknown;
        createdAt?: string;
      }
    | undefined;
  if (!run)
    return response
      .status(404)
      .json({ error: "OpenBB review run not found", id: request.params.id });
  if (
    run.calculation?.method !== "openbb-comparison-review" ||
    !run.output ||
    typeof run.output !== "object"
  )
    return response.status(409).json({
      error: "Research run is not an OpenBB comparison review",
      id: request.params.id,
    });
  response.json({
    evidence: "persisted-staging-review",
    reviewRunId: run.id,
    createdAt: run.createdAt ?? null,
    reviewArtifact: run.output,
    limitations: [
      "Persistence of this bounded artifact does not promote OpenBB values to Macro OS observations or prove managed production durability.",
    ],
  });
};

const openBBReviewExportHandler = async (
  request: express.Request,
  response: express.Response,
) => {
  let rows: Array<Record<string, unknown>>;
  try {
    rows = (
      shouldUseSupabaseStorage()
        ? await supabaseListResearchRuns()
        : listResearchRuns()
    ) as Array<Record<string, unknown>>;
  } catch (error) {
    return response.status(503).json(buildManagedStorageErrorResponse(error));
  }
  const run = rows.find(
    (item) => String((item as { id?: unknown }).id) === request.params.id,
  ) as Record<string, unknown> | undefined;
  if (!run)
    return response
      .status(404)
      .json({ error: "OpenBB review run not found", id: request.params.id });
  if (
    (run.calculation as { method?: string } | undefined)?.method !==
      "openbb-comparison-review" ||
    !run.output ||
    typeof run.output !== "object"
  )
    return response.status(409).json({
      error: "Research run is not an OpenBB comparison review",
      id: request.params.id,
    });
  const capabilities = Object.fromEntries(
    PROVIDER_REGISTRY.flatMap((provider) =>
      provider.sourceTypes.map((type) => [type, provider]),
    ),
  );
  const lineage = buildResearchLineage(
    run as unknown as Parameters<typeof buildResearchLineage>[0],
    DATA_SOURCES,
    capabilities,
  );
  const artifact = createOpenBBReviewPackage(
    run as unknown as Parameters<typeof createOpenBBReviewPackage>[0],
    run.output as Parameters<typeof createOpenBBReviewPackage>[1],
    lineage,
  );
  response.json({
    evidence: "persisted-staging-review-package",
    artifact,
    limitations: artifact.limitations,
  });
};

const openBBReviewDiffHandler = async (
  request: express.Request,
  response: express.Response,
) => {
  const olderRunId = String(
    request.query.olderRunId ?? request.params.olderRunId ?? "",
  );
  const newerRunId = String(
    request.query.newerRunId ?? request.params.newerRunId ?? "",
  );
  if (!olderRunId || !newerRunId || olderRunId === newerRunId)
    return response
      .status(400)
      .json({ error: "Two distinct OpenBB review run ids are required" });
  let rows: Array<Record<string, unknown>>;
  try {
    rows = (
      shouldUseSupabaseStorage()
        ? await supabaseListResearchRuns()
        : listResearchRuns()
    ) as Array<Record<string, unknown>>;
  } catch (error) {
    return response.status(503).json(buildManagedStorageErrorResponse(error));
  }
  const findReview = (id: string) =>
    rows.find(
      (item) =>
        String((item as { id?: unknown }).id) === id &&
        (item as { calculation?: { method?: string } }).calculation?.method ===
          "openbb-comparison-review",
    ) as
      | { id: string; createdAt: string; output?: { comparison?: unknown } }
      | undefined;
  const older = findReview(olderRunId);
  const newer = findReview(newerRunId);
  if (!older || !newer)
    return response
      .status(404)
      .json({ error: "Both ids must reference persisted OpenBB review runs" });
  const olderArtifact = older.output as
    | Pick<OpenBBComparisonReviewArtifact, "exportedAt" | "comparison">
    | undefined;
  const newerArtifact = newer.output as
    | Pick<OpenBBComparisonReviewArtifact, "exportedAt" | "comparison">
    | undefined;
  if (!olderArtifact?.comparison || !newerArtifact?.comparison)
    return response
      .status(409)
      .json({ error: "OpenBB review artifact is incomplete" });
  const diff = buildOpenBBReviewDiff(
    olderArtifact.comparison,
    newerArtifact.comparison,
    olderArtifact.exportedAt ?? older.createdAt,
    newerArtifact.exportedAt ?? newer.createdAt,
  );
  const artifact = buildOpenBBReviewDiffArtifact(older.id, newer.id, diff);
  response.json({
    evidence: "persisted-staging-review-diff",
    runIds: { older: older.id, newer: newer.id },
    diff,
    artifact,
    limitations: diff.limitations,
  });
};

app.get("/api/research-runs/:id/lineage", researchLineageHandler);
app.get("/api/research-runs/:id/export", researchRunExportHandler);
app.get("/api/research-runs/:id/openbb-review", openBBReviewHandler);
app.get(
  "/api/research-runs/:id/openbb-review/export",
  openBBReviewExportHandler,
);
app.get(
  "/api/mcp/tools/get_research_run_lineage",
  async (request, response) => {
    if (typeof request.query.runId !== "string" || !request.query.runId)
      return response.status(400).json({ error: "runId is required" });
    (request.params as { id?: string }).id = request.query.runId;
    await researchLineageHandler(request, response);
  },
);
app.get("/api/mcp/tools/get_openbb_review", async (request, response) => {
  if (typeof request.query.runId !== "string" || !request.query.runId)
    return response.status(400).json({ error: "runId is required" });
  (request.params as { id?: string }).id = request.query.runId;
  await openBBReviewHandler(request, response);
});
app.get(
  "/api/mcp/tools/get_openbb_review_export",
  async (request, response) => {
    if (typeof request.query.runId !== "string" || !request.query.runId)
      return response.status(400).json({ error: "runId is required" });
    (request.params as { id?: string }).id = request.query.runId;
    await openBBReviewExportHandler(request, response);
  },
);
app.get("/api/mcp/tools/get_research_run_export", async (request, response) => {
  if (typeof request.query.runId !== "string" || !request.query.runId)
    return response.status(400).json({ error: "runId is required" });
  (request.params as { id?: string }).id = request.query.runId;
  await researchRunExportHandler(request, response);
});
app.get("/api/openbb/reviews/diff", openBBReviewDiffHandler);
app.get("/api/mcp/tools/get_openbb_review_diff", openBBReviewDiffHandler);

app.get("/api/product-outcomes", async (request, response) => {
  const projectId = typeof request.query.projectId === "string" ? request.query.projectId : undefined;
  try {
    const outcomes = await productOutcomeLedger.records(projectId);
    return response.json({ outcomes, evidence: "persisted-product-outcome-ledger" });
  } catch (error) {
    return response.status(503).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/company/runtime", (_request, response) => {
  return response.json({ evidence: "in-process-company-supervisor", ...productCompanyRuntimeStatus() });
});

app.get("/api/company/operating-status", async (_request, response) => {
  try {
    const attempts = await productCycleAttemptLedger.records("macro-os");
    const work = await companyWorkQueue.records("macro-os");
    const runtime = productCompanyRuntimeStatus();
    const roleCoverage = Object.fromEntries([...new Set(work.map((item) => item.role))].sort().map((role) => {
      const items = work.filter((item) => item.role === role);
      return [role, { total: items.length, ready: items.filter((item) => item.state === "READY").length, done: items.filter((item) => item.state === "DONE").length, blocked: items.filter((item) => item.state === "BLOCKED").length }];
    }));
    return response.json({ evidence: "derived-company-operating-status", project_id: "macro-os", ...deriveCompanyOperatingStatus({ runtime, latestCycle: attempts.at(-1), governance: { work_items: work.length, blocked_work_items: work.filter((item) => item.state === "BLOCKED").length, ready_work_items: work.filter((item) => item.state === "READY").length } }), governance: { work_items: work.length, roles_with_work: Object.keys(roleCoverage).length, role_coverage: roleCoverage } });
  } catch (error) {
    return response.status(503).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/company/operating-audit", (_request, response) => {
  const file = resolve(".ai-company/reports/ai-company-operating-audit-latest.json");
  try {
    if (!existsSync(file)) return response.status(404).json({ error: "operating audit artifact not found" });
    return response.json({ ...JSON.parse(readFileSync(file, "utf8")), evidence: "ai-company-operating-model-audit-read-model" });
  } catch (error) {
    return response.status(503).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/mcp/tools/get_company_operating_audit", (_request, response) => {
  const file = resolve(".ai-company/reports/ai-company-operating-audit-latest.json");
  try {
    if (!existsSync(file)) return response.status(404).json({ error: "operating audit artifact not found" });
    return response.json({ ...JSON.parse(readFileSync(file, "utf8")), evidence: "ai-company-operating-model-audit-read-model" });
  } catch (error) {
    return response.status(503).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/company/executive-snapshot", async (_request, response) => {
  try {
    const [health, backlog, work, executions, ideas, escalations, cycleAttempts, providerAttempts, discoveryAttempts] = await Promise.all([
      createCompanyHealthProvider(new CompanyStateStore(aiCompanyStateDir), new UsageLedger(aiCompanyStateDir))(),
      companyBacklogLedger.items(),
      companyWorkQueue.records("macro-os"),
      roleWorkExecutionLedger.records("macro-os"),
      companyIdeaLedger.records("macro-os"),
      escalationLedger.records("macro-os"),
      productCycleAttemptLedger.records("macro-os"),
      companyProviderAttemptLedger.records("macro-os"),
      companyDiscoveryAttemptLedger.records("macro-os"),
    ]);
    const runtime = productCompanyRuntimeStatus();
    const openBacklog = backlog.filter((item) => item.status === "PROPOSED" || item.status === "planned");
    const normalizedPriority = (item: typeof backlog[number]) => { const legacy = item as typeof item & { severity?: string }; return item.priority ?? (legacy.severity === "blocker" || legacy.severity === "critical" ? "P0" : legacy.severity === "major" ? "P1" : "P2"); };
    return response.json({ evidence: "ceo-executive-snapshot", generated_at: new Date().toISOString(), project_id: "macro-os", health, runtime, readiness: runtime.readiness, backlog: { total: backlog.length, open: openBacklog.length, p0: openBacklog.filter((item) => normalizedPriority(item) === "P0").length }, work_queue: { total: work.length, byState: Object.fromEntries(["READY", "CLAIMED", "IN_REVIEW", "DONE", "BLOCKED"].map((state) => [state, work.filter((item) => item.state === state).length])) }, executions: { total: executions.length, done: executions.filter((item) => item.status === "DONE").length, blocked: executions.filter((item) => item.status === "BLOCKED").length }, cycle_attempts: { total: cycleAttempts.length, done: cycleAttempts.filter((item) => item.status === "DONE").length, blocked: cycleAttempts.filter((item) => item.status === "BLOCKED").length, failed: cycleAttempts.filter((item) => item.status === "FAILED").length, latest: cycleAttempts.at(-1) ?? null }, provider_attempts: { total: providerAttempts.length, success: providerAttempts.filter((item) => item.outcome === "SUCCESS").length, failure: providerAttempts.filter((item) => item.outcome === "FAILURE").length, retries: providerAttempts.filter((item) => item.attempt > 1).length, latest: providerAttempts.at(-1) ?? null }, discovery_attempts: { total: discoveryAttempts.length, succeeded: discoveryAttempts.filter((item) => item.status === "SUCCEEDED").length, failed: discoveryAttempts.filter((item) => item.status === "FAILED").length, latest: discoveryAttempts.at(-1) ?? null }, user_telemetry: getUserTelemetrySummary(), user_insights: getUserTelemetryInsights(), opportunities: { total: ideas.length, unscored: ideas.filter((item) => item.opportunity_score === undefined).length }, escalations: { open: escalations.filter((item) => item.status === "OPEN").length, acknowledged: escalations.filter((item) => item.status === "ACKNOWLEDGED").length, resolved: escalations.filter((item) => item.status === "RESOLVED").length } });
  } catch (error) { return response.status(503).json({ error: error instanceof Error ? error.message : String(error) }); }
});
app.get("/api/company/user-insight-decisions", async (request, response) => {
  const projectId = typeof request.query.projectId === "string" ? request.query.projectId : "macro-os";
  try { return response.json({ evidence: "persisted-user-insight-decision-ledger", decisions: await userInsightDecisionLedger.records(projectId) }); }
  catch (error) { return response.status(503).json({ error: error instanceof Error ? error.message : String(error) }); }
});

app.get("/api/company/post-release-monitor", async (_request, response) => {
  try {
    const health = await createCompanyHealthProvider(new CompanyStateStore(aiCompanyStateDir), new UsageLedger(aiCompanyStateDir))();
    return response.json({ evidence: "post-release-health-monitor", ...evaluatePostReleaseHealth(health) });
  } catch (error) { return response.status(503).json({ error: error instanceof Error ? error.message : String(error) }); }
});

app.get("/api/company/strategy", (_request, response) => response.json({ evidence: "macro-os-strategy-ledger", ...strategySnapshot() }));
app.get("/api/company/ceo-mandate", (_request, response) => response.json({ evidence: "macro-os-ceo-operating-mandate", ...ceoMandateSnapshot() }));
app.get("/api/company/cadence-policy", (_request, response) => response.json(cadencePolicySnapshot()));
app.get("/api/company/ideas", async (request, response) => {
  const projectId = typeof request.query.projectId === "string" ? request.query.projectId : undefined;
  try { return response.json({ evidence: "persisted-product-idea-ledger", ideas: await companyIdeaLedger.records(projectId) }); }
  catch (error) { return response.status(503).json({ error: error instanceof Error ? error.message : String(error) }); }
});
app.get("/api/company/opportunities", async (request, response) => {
  const projectId = typeof request.query.projectId === "string" ? request.query.projectId : undefined;
  try {
    const ideas = await companyIdeaLedger.records(projectId);
    const opportunities = [...ideas].sort((a, b) => (b.opportunity_score ?? -1) - (a.opportunity_score ?? -1));
    return response.json({ evidence: "scored-opportunity-portfolio", opportunities, summary: { total: opportunities.length, scored: opportunities.filter((item) => item.opportunity_score !== undefined).length, prioritized: opportunities.filter((item) => item.opportunity_decision === "PRIORITIZE").length, unscored: opportunities.filter((item) => item.opportunity_score === undefined).length } });
  } catch (error) { return response.status(503).json({ error: error instanceof Error ? error.message : String(error) }); }
});
app.get("/api/company/ceo-reviews", async (request, response) => {
  const projectId = typeof request.query.projectId === "string" ? request.query.projectId : undefined;
  try { return response.json({ evidence: "persisted-ceo-review-ledger", reviews: await ceoReviewLedger.records(projectId) }); }
  catch (error) { return response.status(503).json({ error: error instanceof Error ? error.message : String(error) }); }
});
app.get("/api/company/research-signals", async (request, response) => { const projectId = typeof request.query.projectId === "string" ? request.query.projectId : undefined; try { return response.json({ evidence: "persisted-research-signal-ledger", signals: await researchSignalLedger.records(projectId) }); } catch (error) { return response.status(503).json({ error: error instanceof Error ? error.message : String(error) }); } });
app.get("/api/company/research-quorum", async (request, response) => { const ideaId = typeof request.query.ideaId === "string" ? request.query.ideaId : ""; if (!ideaId) return response.status(400).json({ error: "ideaId is required" }); try { return response.json({ evidence: "research-quorum-evaluation", idea_id: ideaId, ...evaluateResearchQuorum(await researchSignalLedger.records("macro-os"), ideaId, .6, "macro-os", await companyWorkQueue.currentAuthority("macro-os")) }); } catch (error) { return response.status(503).json({ error: error instanceof Error ? error.message : String(error) }); } });
app.get("/api/company/escalations", async (request, response) => { const projectId = typeof request.query.projectId === "string" ? request.query.projectId : undefined; try { return response.json({ evidence: "persisted-ceo-escalation-ledger", escalations: await escalationLedger.records(projectId) }); } catch (error) { return response.status(503).json({ error: error instanceof Error ? error.message : String(error) }); } });
app.post("/api/admin/company/escalations", async (request, response) => { const body = request.body as Record<string, unknown>; try { const status = body.status as "ACKNOWLEDGED" | "RESOLVED"; if (status !== "ACKNOWLEDGED" && status !== "RESOLVED") return response.status(400).json({ error: "status must be ACKNOWLEDGED or RESOLVED" }); return response.json({ evidence: "ceo-escalation-lifecycle", escalation: await escalationLedger.transition(String(body.escalation_id ?? ""), status, body.owner_role as "ceo" | "pm", Array.isArray(body.evidence_ids) ? body.evidence_ids.map(String) : []) }); } catch (error) { return response.status(409).json({ error: error instanceof Error ? error.message : String(error) }); } });
app.get("/api/company/competitive-evidence", async (request, response) => {
  const projectId = typeof request.query.projectId === "string" ? request.query.projectId : undefined;
  try { return response.json({ evidence: "persisted-competitive-evidence-ledger", records: await competitiveEvidenceLedger.records(projectId) }); }
  catch (error) { return response.status(503).json({ error: error instanceof Error ? error.message : String(error) }); }
});
app.get("/api/company/competitive-review", async (request, response) => {
  const projectId = typeof request.query.projectId === "string" ? request.query.projectId : undefined;
  try { return response.json({ evidence: "scheduled-competitive-evidence-review", ...reviewCompetitiveEvidence(await competitiveEvidenceLedger.records(projectId)) }); }
  catch (error) { return response.status(503).json({ error: error instanceof Error ? error.message : String(error) }); }
});

app.get("/api/company/backlog", async (request, response) => {
  const projectId = typeof request.query.projectId === "string" ? request.query.projectId : undefined;
  try {
    const rawItems = await companyBacklogLedger.items();
    const items = rawItems.filter((item) => !projectId || !item.project_id || item.project_id === projectId).map((item) => {
      const legacy = item as typeof item & { id?: string; problem?: string; severity?: string; owner_role?: string };
      const priority = legacy.priority ?? (legacy.severity === "blocker" || legacy.severity === "critical" ? "P0" : legacy.severity === "major" ? "P1" : "P2");
      return { ...item, backlog_id: item.backlog_id ?? legacy.id ?? "unknown", title: item.title, priority, rationale: item.rationale ?? legacy.problem ?? "", owner_role: legacy.owner_role ?? "unassigned" };
    });
    const openItems = items.filter((item) => item.status === "PROPOSED" || item.status === "planned");
    return response.json({
      evidence: "persisted-ai-company-backlog-ledger",
      items: openItems,
      summary: {
        total: items.length,
        open: openItems.length,
        byPriority: Object.fromEntries(["P0", "P1", "P2", "P3"].map((priority) => [priority, openItems.filter((item) => item.priority === priority).length])),
      },
    });
  } catch (error) {
    return response.status(503).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/company/work-queue", async (request, response) => {
  const projectId = typeof request.query.projectId === "string" ? request.query.projectId : undefined;
  try {
    return response.json({ evidence: "persisted-role-work-queue", items: await companyWorkQueue.records(projectId), summary: await companyWorkQueue.summary(projectId), triage: await companyWorkQueue.triage(projectId) });
  } catch (error) {
    return response.status(503).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/company/work-executions", async (request, response) => {
  const projectId = typeof request.query.projectId === "string" ? request.query.projectId : "macro-os";
  try {
    const records = await roleWorkExecutionLedger.records(projectId);
    return response.json({ evidence: "persisted-role-work-execution-ledger", records, summary: { total: records.length, done: records.filter((item) => item.status === "DONE").length, blocked: records.filter((item) => item.status === "BLOCKED").length } });
  } catch (error) { return response.status(503).json({ error: error instanceof Error ? error.message : String(error) }); }
});

app.get("/api/company/cycle-attempts", async (request, response) => {
  const projectId = typeof request.query.projectId === "string" ? request.query.projectId : "macro-os";
  const requestedLimit = Number(request.query.limit ?? 20);
  const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, Math.floor(requestedLimit))) : 20;
  try {
    const attempts = await productCycleAttemptLedger.records(projectId);
    const newestFirst = [...attempts].reverse();
    return response.json({ evidence: "persisted-product-cycle-attempt-ledger", attempts: newestFirst.slice(0, limit), summary: { total: attempts.length, done: attempts.filter((item) => item.status === "DONE").length, blocked: attempts.filter((item) => item.status === "BLOCKED").length, failed: attempts.filter((item) => item.status === "FAILED").length, limit } });
  } catch (error) { return response.status(503).json({ error: error instanceof Error ? error.message : String(error) }); }
});

app.get("/api/company/provider-attempts", async (request, response) => {
  const projectId = typeof request.query.projectId === "string" ? request.query.projectId : "macro-os";
  const requestedLimit = Number(request.query.limit ?? 20);
  const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, Math.floor(requestedLimit))) : 20;
  try {
    const attempts = await companyProviderAttemptLedger.records(projectId);
    const newestFirst = [...attempts].reverse();
    return response.json({ evidence: "persisted-provider-attempt-ledger", attempts: newestFirst.slice(0, limit), summary: { total: attempts.length, success: attempts.filter((item) => item.outcome === "SUCCESS").length, failure: attempts.filter((item) => item.outcome === "FAILURE").length, retries: attempts.filter((item) => item.attempt > 1).length, limit } });
  } catch (error) { return response.status(503).json({ error: error instanceof Error ? error.message : String(error) }); }
});
app.get("/api/company/provider-circuit", async (request, response) => {
  const projectId = typeof request.query.projectId === "string" ? request.query.projectId : "macro-os";
  const providerId = typeof request.query.providerId === "string" ? request.query.providerId : "openai-compatible";
  const threshold = Math.max(1, Number(request.query.threshold ?? process.env.AI_COMPANY_PROVIDER_FAILURE_THRESHOLD ?? 3));
  const cooldownMs = Math.max(1_000, Number(request.query.cooldownMs ?? process.env.AI_COMPANY_PROVIDER_COOLDOWN_MS ?? 60_000));
  try { return response.json({ evidence: "durable-provider-circuit-read-model", project_id: projectId, provider_id: providerId, threshold, cooldown_ms: cooldownMs, ...(await companyProviderAttemptLedger.circuitState({ projectId, providerId, threshold, cooldownMs })) }); }
  catch (error) { return response.status(503).json({ error: error instanceof Error ? error.message : String(error) }); }
});
app.get("/api/company/discovery-attempts", async (request, response) => {
  const projectId = typeof request.query.projectId === "string" ? request.query.projectId : "macro-os";
  try { const attempts = await companyDiscoveryAttemptLedger.records(projectId); return response.json({ evidence: "persisted-discovery-attempt-ledger", attempts: [...attempts].reverse() }); }
  catch (error) { return response.status(503).json({ error: error instanceof Error ? error.message : String(error) }); }
});

app.get("/api/company/release-gate", async (request, response) => {
  const backlogId = typeof request.query.backlogId === "string" ? request.query.backlogId : "";
  if (!backlogId) return response.status(400).json({ error: "backlogId is required" });
  try { return response.json({ evidence: "independent-pre-release-review-gate", backlog_id: backlogId, ...evaluatePreReleaseReviewGate(await companyWorkQueue.currentAuthority("macro-os"), backlogId) }); }
  catch (error) { return response.status(503).json({ error: error instanceof Error ? error.message : String(error) }); }
});


app.post("/api/admin/company/user-insight-decisions", async (request, response) => {
  const body = request.body as Record<string, unknown>;
  const action = body.action;
  if (action !== "ACCEPT" && action !== "REJECT") return response.status(400).json({ error: "action must be ACCEPT or REJECT" });
  const insight = getUserTelemetryInsights().find((item) => item.insight_id === String(body.insight_id ?? ""));
  if (!insight) return response.status(404).json({ error: "user insight not found in current evidence window" });
  try {
    const decision = await userInsightDecisionLedger.record({ insight_id: insight.insight_id, project_id: "macro-os", action, actor_role: "pm", rationale: String(body.rationale ?? ""), evidence_ids: insight.event_ids });
    let backlogCreated = false;
    if (action === "ACCEPT") {
      const marker = `USER-INSIGHT:${insight.insight_id}`;
      const existing = (await companyBacklogLedger.items("macro-os")).some((item) => item.source_feedback_ids.includes(marker));
      if (!existing) { await companyBacklogLedger.add([{ backlog_id: `INSIGHT-${insight.insight_id}`, project_id: "macro-os", task_id: insight.insight_id, title: `Validate ${insight.workflow} demand`, priority: "P1", rationale: `${insight.observation} PM accepted for discovery.`, source_feedback_ids: [marker, ...insight.event_ids], acceptance_criteria: ["validate with user research", "define outcome metric", "complete independent review"], status: "PROPOSED" }]); backlogCreated = true; }
    }
    return response.status(201).json({ evidence: "pm-disposed-user-insight", decision, backlog_created: backlogCreated });
  } catch (error) { return response.status(409).json({ error: error instanceof Error ? error.message : String(error) }); }
});

app.post("/api/admin/company/tick", async (_request, response) => {
  if (!productCompanyRuntimeTick) return response.status(503).json({ error: "company runtime is not started" });
  try {
    return response.json({ evidence: "admin-triggered-company-tick", results: await productCompanyRuntimeTick() });
  } catch (error) {
    return response.status(503).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/admin/company/discovery", async (request, response) => {
  const body = request.body as { project_id?: string; product_goal?: string; evidence?: Array<{ evidence_id: string; summary: string; source_url?: string | null }>; endpoint?: string; model?: string };
  try {
    const endpoint = String(body.endpoint ?? process.env.AI_COMPANY_DISCOVERY_ENDPOINT ?? "").trim();
    const model = String(body.model ?? process.env.AI_COMPANY_DISCOVERY_MODEL ?? "").trim();
    if (!endpoint || !model) return response.status(503).json({ error: "discovery provider is not configured" });
    const idea = await generateDiscoveryIdea({ endpoint, model }, { projectId: String(body.project_id ?? "macro-os"), productGoal: String(body.product_goal ?? "trusted macro research"), evidence: Array.isArray(body.evidence) ? body.evidence : [] });
    const saved = await companyIdeaLedger.add(idea);
    return response.status(201).json({ evidence: "local-ai-discovery-with-server-evidence", idea: saved });
  } catch (error) { return response.status(400).json({ error: error instanceof Error ? error.message : String(error) }); }
});

app.post("/api/admin/company/work-queue", async (request, response) => {
  const body = request.body as Record<string, unknown>;
  try {
    assertAdminQueueRuntimeRoot(companyRuntimeRoot, aiCompanyStateDir);
    const result = await mutateAdminRoleWorkQueue(companyWorkQueue, body);
    return response.status(result.status).json({ evidence: "persisted-role-work-queue", item: result.item });
  } catch (error) {
    return response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/admin/company/ideas", async (request, response) => {
  const body = request.body as Record<string, unknown>;
  try {
    const ideaId = String(body.idea_id ?? "");
    if (body.action === "promote") return response.status(201).json({ evidence: "idea-to-backlog-promotion", item: await promoteAcceptedIdea(companyIdeaLedger, companyBacklogLedger, ideaId) });
    if (body.action === "score") return response.json({ evidence: "ceo-pm-opportunity-score", idea: await companyIdeaLedger.score(ideaId, { user_value: Number(body.user_value), strategic_fit: Number(body.strategic_fit), defensibility: Number(body.defensibility), feasibility: Number(body.feasibility), evidence_confidence: Number(body.evidence_confidence), risk: Number(body.risk) }) });
    if (body.action === "score-with-research") return response.json({ evidence: "ceo-pm-opportunity-score-with-research", idea: await companyIdeaLedger.scoreWithResearch(ideaId, { user_value: Number(body.user_value), strategic_fit: Number(body.strategic_fit), defensibility: Number(body.defensibility), feasibility: Number(body.feasibility), evidence_confidence: Number(body.evidence_confidence), risk: Number(body.risk) }, await researchSignalLedger.records(String(body.project_id ?? "macro-os")), await companyWorkQueue.currentAuthority(String(body.project_id ?? "macro-os"))) });
    if (body.action === "decide") return response.json({ evidence: "pm-ceo-idea-decision", idea: await companyIdeaLedger.decide(ideaId, body.status as "VALIDATING" | "ACCEPTED" | "REJECTED") });
    return response.status(400).json({ error: "unknown idea action" });
  } catch (error) { return response.status(400).json({ error: error instanceof Error ? error.message : String(error) }); }
});

app.post("/api/admin/company/competitive-evidence", async (request, response) => {
  try { return response.status(201).json({ evidence: "persisted-competitive-evidence-ledger", record: await competitiveEvidenceLedger.record(request.body) }); }
  catch (error) { return response.status(400).json({ error: error instanceof Error ? error.message : String(error) }); }
});
app.post("/api/admin/company/ceo-review", async (request, response) => {
  const body = request.body as Record<string, unknown>;
  try { const ideas = await companyIdeaLedger.records(String(body.project_id ?? "macro-os")); return response.status(201).json({ evidence: "persisted-ceo-review-ledger", review: await ceoReviewLedger.review({ projectId: String(body.project_id ?? "macro-os"), period: String(body.period ?? new Date().toISOString().slice(0, 10)), ideas }) }); }
  catch (error) { return response.status(400).json({ error: error instanceof Error ? error.message : String(error) }); }
});
app.post("/api/admin/company/research-signals", async (request, response) => { try { return response.status(201).json({ evidence: "persisted-research-signal-ledger", signal: await researchSignalLedger.record(request.body) }); } catch (error) { return response.status(400).json({ error: error instanceof Error ? error.message : String(error) }); } });

app.post("/api/admin/company/promote", async (request, response) => {
  const backlogId = String((request.body as Record<string, unknown>).backlog_id ?? "");
  if (!backlogId) return response.status(400).json({ error: "backlog_id is required" });
  try {
    const result = evaluatePromotion(await companyWorkQueue.currentAuthority("macro-os"), backlogId);
    if (!result.ready) return response.status(409).json({ evidence: "release-promotion-gate", ...result });
    return response.json({ evidence: "release-promotion-gate", ...result });
  } catch (error) { return response.status(503).json({ error: error instanceof Error ? error.message : String(error) }); }
});

app.post("/api/admin/company/rollback", async (request, response) => {
  const body = request.body as Record<string, unknown>;
  try {
    const result = await executeReleaseRollback({ store: new CompanyStateStore(aiCompanyStateDir), aggregateId: String(body.aggregate_id ?? ""), reason: String(body.reason ?? ""), evidenceIds: Array.isArray(body.evidence_ids) ? body.evidence_ids.map(String) : [], idempotencyKey: String(body.idempotency_key ?? "") });
    return response.json({ evidence: "durable-release-rollback", result });
  } catch (error) { return response.status(409).json({ error: error instanceof Error ? error.message : String(error) }); }
});

app.post("/api/admin/product-outcomes", async (request, response) => {
  const body = request.body as Record<string, unknown>;
  const actors: OutcomeActor[] = ["user-persona", "ux-research", "stakeholder-panel", "domain-expert", "pm"];
  const verdicts: OutcomeVerdict[] = ["SUCCESS", "PARTIAL", "FAILURE", "BLOCKED"];
  if (!actors.includes(body.actor as OutcomeActor) || !verdicts.includes(body.verdict as OutcomeVerdict)) {
    return response.status(400).json({ error: "actor and verdict are invalid" });
  }
  try {
    const outcome = await productOutcomeLedger.record({
      project_id: String(body.project_id ?? "macro-os"),
      task_id: String(body.task_id ?? "unspecified"),
      actor: body.actor as OutcomeActor,
      persona: String(body.persona ?? ""),
      workflow: String(body.workflow ?? ""),
      verdict: body.verdict as OutcomeVerdict,
      metric: body.metric as { name: string; value: number; target?: number; unit?: string },
      evidence_ids: Array.isArray(body.evidence_ids) ? body.evidence_ids.map(String) : [],
      findings: Array.isArray(body.findings) ? body.findings.map(String) : [],
    });
    return response.status(201).json({ outcome, evidence: "persisted-product-outcome-ledger" });
  } catch (error) {
    return response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

function createForecastDebate(input: ForecastRevisionInput) {
  const indicator = indicatorCatalog.find((item) => item.id === input.indicatorId);
  if (!indicator) throw new Error(`Indicator '${input.indicatorId}' not found in catalog`);
  // Forecast creation may be immediately followed by an ingestion write in
  // the same process. Use the authoritative local observation ledger for the
  // debate snapshot when available; the static catalog is only a fallback.
  const stored = shouldUseSupabaseStorage() ? [] : latestObservations(input.indicatorId, 300);
  const latestStored = stored.at(-1) as { date?: string; value?: number; status?: string; quality?: string; sourceName?: string; sourceSeriesId?: string; unit?: string; frequency?: string; ingestedAt?: string } | undefined;
  const debateIndicator = latestStored
    ? { ...indicator, snapshot: { ...indicator.snapshot, date: String(latestStored.date ?? indicator.snapshot.date), value: Number(latestStored.value ?? indicator.snapshot.value), unit: String(latestStored.unit ?? indicator.unit) }, series: stored.map((row: any) => ({ date: String(row.date), value: Number(row.value), status: row.status })), provenance: { ...indicator.provenance, status: latestStored.status === 'actual' ? 'actual' : indicator.provenance?.status, quality: latestStored.quality === 'verified' ? 'verified' : indicator.provenance?.quality, sourceName: latestStored.sourceName ?? indicator.provenance?.sourceName, sourceSeriesId: latestStored.sourceSeriesId ?? indicator.provenance?.sourceSeriesId, observedThrough: latestStored.date ?? indicator.provenance?.observedThrough, freshness: 'fresh' as const } }
    : indicator;
  const prediction = inferPredictionFromForecast(input.forecastValue, indicator.snapshot.value, input.targetDate, input.institution);
  const session = runMacroDebate(debateIndicator as never, prediction, indicatorCatalog as never[]);
  persistDebateSession(session).catch(() => undefined);
  return session;
}

app.post("/api/admin/forecasts", async (request, response) => {
  try {
    const body = request.body ?? {};
    const indicatorId = String(body.indicatorId ?? "");
    if (!indicatorCatalog.some((indicator) => indicator.id === indicatorId)) return response.status(404).json({ error: `Indicator '${indicatorId}' not found in catalog` });
    const input: ForecastRevisionInput = {
      indicatorId, country: String(body.country ?? ""), forecastValue: Number(body.forecastValue),
      forecastDate: String(body.forecastDate ?? ""), targetDate: String(body.targetDate ?? ""),
      institution: String(body.institution ?? ""), analyst: body.analyst == null ? null : String(body.analyst),
      methodology: String(body.methodology ?? ""), confidence: Number(body.confidence),
      version: Number(body.version), status: body.status as ForecastRevisionInput["status"],
      sourceName: String(body.sourceName ?? ""), sourceUrl: String(body.sourceUrl ?? ""),
    };
    const built = buildForecastRevision(input);
    let saved;
    try {
      saved = shouldUseSupabaseStorage()
        ? await supabaseCreateForecast(built)
        : createForecast(built);
    } catch (error) {
      return response.status(503).json(buildManagedStorageErrorResponse(error));
    }
    const debate = createForecastDebate(input);
    return response.status(201).json({ forecast: saved, fingerprint: built.fingerprint, debate, sourceGovernance: assessForecastSubmission(input), evidence: "source-backed-metadata-required", limitation: "This is a forecast revision, not an actual observation or investment recommendation." });
  } catch (error) {
    return response.status(400).json({ error: error instanceof Error ? error.message : "Invalid forecast revision" });
  }
});

app.post("/api/admin/forecasts/batch", async (request, response) => {
  try {
    const items = request.body?.forecasts;
    if (!Array.isArray(items) || items.length === 0) return response.status(400).json({ error: "Required: forecasts array" });
    if (items.length > 100) return response.status(400).json({ error: "Maximum 100 forecast revisions per batch" });
    const parsed = items.map((body: Record<string, unknown>): { input: ForecastRevisionInput; indicatorExists: boolean } => {
      const indicatorId = String(body.indicatorId ?? "");
      return {
        indicatorExists: indicatorCatalog.some((indicator) => indicator.id === indicatorId),
        input: {
          indicatorId, country: String(body.country ?? ""), forecastValue: Number(body.forecastValue),
          forecastDate: String(body.forecastDate ?? ""), targetDate: String(body.targetDate ?? ""),
          institution: String(body.institution ?? ""), analyst: body.analyst == null ? null : String(body.analyst),
          methodology: String(body.methodology ?? ""), confidence: Number(body.confidence), version: Number(body.version),
          status: body.status as ForecastRevisionInput["status"], sourceName: String(body.sourceName ?? ""), sourceUrl: String(body.sourceUrl ?? ""),
        },
      };
    });
    const invalid = parsed.map(({ input, indicatorExists }, index) => ({ index, issues: [...(indicatorExists ? [] : ["indicator-not-found"]), ...validateForecastRevision(input)] })).filter((item) => item.issues.length > 0);
    if (invalid.length) return response.status(400).json({ error: "Batch validation failed; nothing was persisted", invalid });
    const builtItems = parsed.map(({ input }) => buildForecastRevision(input));
    let savedItems;
    try {
      if (shouldUseSupabaseStorage()) {
        savedItems = await supabaseCreateForecastBatch(builtItems);
      } else {
        savedItems = createForecastBatch(builtItems);
      }
    } catch (error) {
      return response.status(503).json(buildManagedStorageErrorResponse(error));
    }
    const forecasts = builtItems.map((built, index) => ({
      forecast: savedItems[index],
      fingerprint: built.fingerprint,
      debate: createForecastDebate(parsed[index].input),
      sourceGovernance: assessForecastSubmission(parsed[index].input),
    }));
    return response.status(201).json({ forecasts, count: forecasts.length, limitation: "Forecast revisions are source-backed expectations, not actual observations or investment recommendations." });
  } catch (error) {
    return response.status(400).json({ error: error instanceof Error ? error.message : "Invalid forecast batch" });
  }
});

app.post("/api/admin/debate/run-llm", async (request, response) => {
  try {
    const body = request.body ?? {};
    if (!body.indicatorId || body.predictionValue === undefined || !body.predictionHorizon || !body.predictionSource) return response.status(400).json({ error: "Required: indicatorId, predictionValue, predictionHorizon, predictionSource" });
    const provider = configuredLLMProvider();
    if (!provider) return response.status(503).json({ error: "LLM debate provider is not configured", code: "LLM_PROVIDER_UNAVAILABLE", backend: "deterministic" });
    const indicator = indicatorCatalog.find((item) => item.id === body.indicatorId);
    if (!indicator) return response.status(404).json({ error: `Indicator '${body.indicatorId}' not found in catalog` });
    const prediction = body.fromForecast && body.currentValue !== undefined
      ? inferPredictionFromForecast(Number(body.predictionValue), Number(body.currentValue), String(body.predictionHorizon), String(body.predictionSource))
      : { value: Number(body.predictionValue), horizon: String(body.predictionHorizon), source: String(body.predictionSource), impliedDirection: (body.predictionDirection ?? "flat") as "higher" | "lower" | "flat" };
    const qualitativeContext = buildQualitativeContext(Array.isArray(body.qualitativeEvidence) ? body.qualitativeEvidence : [], typeof body.researchCutoff === "string" ? body.researchCutoff : new Date().toISOString(), Array.isArray(body.qualitativeProviderIds) ? body.qualitativeProviderIds.filter((value: unknown): value is string => typeof value === "string") : []);
    const memoryIndicatorIds = [String(body.indicatorId), ...indicator.relationships.map((relationship) => relationship.indicatorId)]
      .filter((id, index, ids) => ids.indexOf(id) === index)
      .slice(0, 6);
    const researchMemory = (await Promise.all(memoryIndicatorIds.map(async (indicatorId) => (shouldUseSupabaseStorage()
      ? await supabaseListResearchMemory(indicatorId)
      : listResearchMemory(indicatorId)) as ResearchMemoryRecord[])))
      .flat()
      .sort((a, b) => String(b.targetDate).localeCompare(String(a.targetDate)) || String(a.indicatorId).localeCompare(String(b.indicatorId)) || String(a.id).localeCompare(String(b.id)))
      .filter((record, index, records) => records.findIndex((candidate) => candidate.id === record.id) === index)
      .slice(0, 15);
    const result = await runOptionalLLMDebate(indicator as never, prediction, indicatorCatalog as never[], provider, fetch, qualitativeContext.items, researchMemory);
    persistDebateSession(result.session).catch(() => undefined);
    return response.status(201).json({ session: result.session, backend: result.backend, roleFallbacks: result.roleFallbacks, roleMetadata: result.roleMetadata, telemetry: aggregateLLMDebateTelemetry(result.roleMetadata), qualitativeEvidence: { evidence: qualitativeContext.evidence, itemCount: qualitativeContext.items.length, excludedCount: qualitativeContext.excludedCount, sourceSummaries: qualitativeContext.sourceSummaries, fingerprint: qualitativeContext.fingerprint, limitations: qualitativeContext.limitations }, researchMemory: { itemCount: researchMemory.length, evidence: researchMemory.length ? "actual-verified-source-backed" : "none", limitations: ["Historical outcomes are descriptive context only; they do not rank a model or prove causality."] }, limitation: result.limitation });
  } catch (error) {
    return response.status(503).json({ error: "LLM debate unavailable", code: error instanceof Error && "code" in error ? (error as { code: string }).code : "LLM_PROVIDER_ERROR", detail: "Provider call failed or returned invalid structured output; deterministic debate remains available." });
  }
});

app.post("/api/admin/debate/run-llm-batch", async (request, response) => {
  try {
    const items = request.body?.items;
    if (!Array.isArray(items) || items.length < 1 || items.length > 10) {
      return response.status(400).json({ error: "items must contain between 1 and 10 debate requests" });
    }
    const provider = configuredLLMProvider();
    if (!provider) return response.status(503).json({ error: "LLM debate provider is not configured", code: "LLM_PROVIDER_UNAVAILABLE", backend: "deterministic" });
    const invalid = items.map((item: Record<string, unknown>, index: number) => ({
      index,
      issues: [
        ...(!item.indicatorId || item.predictionValue === undefined || !item.predictionHorizon || !item.predictionSource ? ["Required: indicatorId, predictionValue, predictionHorizon, predictionSource"] : []),
        ...(item.indicatorId && !indicatorCatalog.some((candidate) => candidate.id === item.indicatorId) ? [`Indicator '${String(item.indicatorId)}' not found in catalog`] : []),
      ],
    })).filter((item) => item.issues.length > 0);
    if (invalid.length) return response.status(400).json({ error: "Batch validation failed; no provider calls were made", invalid });
    const results = [];
    const telemetryMetadata = [];
    for (const item of items as Array<Record<string, unknown>>) {
      try {
        const indicator = indicatorCatalog.find((candidate) => candidate.id === item.indicatorId)!;
        const prediction = item.fromForecast && item.currentValue !== undefined
          ? inferPredictionFromForecast(Number(item.predictionValue), Number(item.currentValue), String(item.predictionHorizon), String(item.predictionSource))
          : { value: Number(item.predictionValue), horizon: String(item.predictionHorizon), source: String(item.predictionSource), impliedDirection: (item.predictionDirection ?? "flat") as "higher" | "lower" | "flat" };
        const qualitativeContext = buildQualitativeContext(Array.isArray(item.qualitativeEvidence) ? item.qualitativeEvidence : [], typeof item.researchCutoff === "string" ? item.researchCutoff : new Date().toISOString(), Array.isArray(item.qualitativeProviderIds) ? item.qualitativeProviderIds.filter((value: unknown): value is string => typeof value === "string") : []);
        const memoryIndicatorIds = [String(item.indicatorId), ...indicator.relationships.map((relationship) => relationship.indicatorId)].filter((id, index, ids) => ids.indexOf(id) === index).slice(0, 6);
        const researchMemory = (await Promise.all(memoryIndicatorIds.map(async (indicatorId) => (shouldUseSupabaseStorage() ? await supabaseListResearchMemory(indicatorId) : listResearchMemory(indicatorId)) as ResearchMemoryRecord[]))).flat().sort((a, b) => String(b.targetDate).localeCompare(String(a.targetDate)) || String(a.indicatorId).localeCompare(String(b.indicatorId)) || String(a.id).localeCompare(String(b.id))).filter((record, index, records) => records.findIndex((candidate) => candidate.id === record.id) === index).slice(0, 15);
        const result = await runOptionalLLMDebate(indicator as never, prediction, indicatorCatalog as never[], provider, fetch, qualitativeContext.items, researchMemory);
        await persistDebateSession(result.session);
        telemetryMetadata.push(result.roleMetadata);
        results.push({ status: "fulfilled", indicatorId: indicator.id, session: result.session, backend: result.backend, roleFallbacks: result.roleFallbacks, roleMetadata: result.roleMetadata, telemetry: aggregateLLMDebateTelemetry(result.roleMetadata), limitation: result.limitation, researchMemoryCount: researchMemory.length });
      } catch (error) {
        results.push({ status: "failed", indicatorId: String(item.indicatorId), error: "LLM debate unavailable", code: error instanceof Error && "code" in error ? (error as { code: string }).code : "LLM_PROVIDER_ERROR", detail: "Provider call failed or returned invalid structured output; deterministic debate remains available." });
      }
    }
    return response.status(201).json({ results, count: results.length, fulfilledCount: results.filter((result) => result.status === "fulfilled").length, failedCount: results.filter((result) => result.status === "failed").length, telemetry: aggregateLLMDebateTelemetry(telemetryMetadata), limitation: "Batch LLM reviews are supplementary macro research opinions; deterministic verdicts and evidence boundaries remain authoritative." });
  } catch (error) {
    return response.status(503).json({ error: "LLM batch debate unavailable", code: error instanceof Error && "code" in error ? (error as { code: string }).code : "LLM_PROVIDER_ERROR", detail: "Provider call failed or returned invalid structured output; deterministic debate remains available." });
  }
});

async function loadDebateCheckpoint(runId: string): Promise<DebateCheckpoint | null> {
  return shouldUseSupabaseStorage() ? await supabaseGetDebateCheckpoint(runId) : debateCheckpointStore.get(runId);
}

async function saveDebateCheckpoint(checkpoint: DebateCheckpoint) {
  if (shouldUseSupabaseStorage()) return supabaseSaveDebateCheckpoint(checkpoint);
  debateCheckpointStore.save(checkpoint);
  return checkpoint;
}

function checkpointStoreFor(checkpoint: DebateCheckpoint) {
  const store = new InMemoryDebateCheckpointStore();
  store.save(checkpoint);
  return store;
}

app.post("/api/admin/debate/checkpoints", async (request, response) => {
  try {
    const body = request.body ?? {};
    const existing = typeof body.runId === "string" ? await loadDebateCheckpoint(body.runId) : null;
    if (existing) {
      if (existing.inputFingerprint !== body.inputFingerprint || existing.graphVersion !== (body.graphVersion ?? "macro-debate-v1")) return response.status(409).json({ error: "checkpoint identity mismatch" });
      return response.status(200).json({ checkpoint: existing, idempotent: true });
    }
    const checkpoint = createDebateCheckpoint(body);
    await saveDebateCheckpoint(checkpoint);
    return response.status(201).json({ checkpoint, idempotent: false });
  } catch (error) {
    return response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/admin/debate/checkpoints/:runId", async (request, response) => {
  const checkpoint = await loadDebateCheckpoint(request.params.runId);
  return checkpoint ? response.json({ checkpoint }) : response.status(404).json({ error: "checkpoint-not-found" });
});

app.post("/api/admin/debate/checkpoints/:runId/resume", async (request, response) => {
  try {
    const checkpoint = await loadDebateCheckpoint(request.params.runId);
    if (!checkpoint) return response.status(404).json({ error: "checkpoint-not-found" });
    return response.json({ checkpoint: resumeDebateCheckpoint(checkpointStoreFor(checkpoint), request.params.runId, request.body ?? {}) });
  } catch (error) {
    return response.status(409).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/admin/debate/checkpoints/:runId/advance", async (request, response) => {
  try {
    const checkpoint = await loadDebateCheckpoint(request.params.runId);
    if (!checkpoint) return response.status(404).json({ error: "checkpoint-not-found" });
    const advanced = advanceDebateCheckpoint(checkpointStoreFor(checkpoint), request.params.runId, request.body ?? {});
    await saveDebateCheckpoint(advanced);
    return response.json({ checkpoint: advanced });
  } catch (error) {
    return response.status(409).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/admin/debate/checkpoints/:runId/fail", async (request, response) => {
  try {
    const checkpoint = await loadDebateCheckpoint(request.params.runId);
    if (!checkpoint) return response.status(404).json({ error: "checkpoint-not-found" });
    const failed = failDebateCheckpoint(checkpointStoreFor(checkpoint), request.params.runId, request.body?.failureCode);
    await saveDebateCheckpoint(failed);
    return response.json({ checkpoint: failed });
  } catch (error) {
    return response.status(409).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/admin/research-memory/evaluate", async (request, response) => {
  try {
    const record = buildResearchMemoryRecord(request.body ?? {});
    if (!record) return response.status(409).json({ error: "Verified actual is required before a memory record can be created", state: "pending" });
    const saved = shouldUseSupabaseStorage() ? await supabaseRecordResearchMemory(record) : recordResearchMemory(record);
    return response.status(201).json({ memory: saved, state: "available" });
  } catch (error) {
    return response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/admin/research-memory/evaluate-batch", async (request, response) => {
  try {
    const requestedIds = Array.isArray(request.body?.forecastIds) ? request.body.forecastIds.filter((value: unknown): value is string => typeof value === "string") : null;
    const allForecasts = (shouldUseSupabaseStorage() ? await supabaseListForecasts() : listForecasts()) as Array<Record<string, unknown>>;
    const selected = requestedIds ? allForecasts.filter((forecast) => requestedIds.includes(String(forecast.id))) : allForecasts;
    if (selected.length > 100) return response.status(400).json({ error: "Maximum 100 forecasts per evaluation batch" });
    const forecasts = selected.map((forecast): EvaluationForecast => ({ id: String(forecast.id), indicatorId: String(forecast.indicatorId), institution: String(forecast.institution), version: Number(forecast.version), targetDate: String(forecast.targetDate), forecastDate: String(forecast.forecastDate), forecastValue: Number(forecast.forecastValue), sourceName: String(forecast.sourceName), sourceUrl: String(forecast.sourceUrl) }));
    const indicatorIds = [...new Set(forecasts.map((forecast) => forecast.indicatorId))];
    const rowsByIndicator = Object.fromEntries(await Promise.all(indicatorIds.map(async (indicatorId) => [indicatorId, ((shouldUseSupabaseStorage() ? await supabaseLatestObservations(indicatorId, 10_000) : latestObservations(indicatorId, 10_000)) as unknown as EvaluationObservation[])]))) as Record<string, EvaluationObservation[]>;
    const result = evaluateForecastBatch(forecasts, rowsByIndicator);
    const saved = shouldUseSupabaseStorage() ? await Promise.all(result.evaluated.map((record) => supabaseRecordResearchMemory(record))) : result.evaluated.map((record) => recordResearchMemory(record));
    return response.status(200).json({ evaluated: saved, evaluatedCount: saved.length, pending: result.pending, pendingCount: result.pending.length, evidence: "exact-target-date-actual-verified" });
  } catch (error) {
    return response.status(503).json(buildManagedStorageErrorResponse(error));
  }
});

app.post("/api/admin/openbb/compare", async (request, response) => {
  const indicatorId =
    typeof request.body?.indicatorId === "string"
      ? request.body.indicatorId
      : "";
  const source = DATA_SOURCES[indicatorId];
  if (!source)
    return response.status(400).json({ error: "Unknown Macro OS indicator" });
  const issues = validateOpenBBSidecarPayload(
    request.body,
    indicatorId,
    source.unit ?? null,
    source.frequencyLabel ?? null,
  );
  if (issues.length)
    return response
      .status(400)
      .json({ error: "Invalid OpenBB sidecar payload", issues });
  const macroRows = (
    shouldUseSupabaseStorage()
      ? await supabaseLatestObservations(indicatorId, 10_000)
      : latestObservations(indicatorId, 10_000)
  ) as Array<{ date: string; value: number }>;
  const comparison = buildOpenBBSidecarComparison(request.body, macroRows);
  const reviewArtifact = buildOpenBBComparisonReviewArtifact(comparison);
  const reviewRun = {
    id: randomUUID(),
    title: `OpenBB comparison review: ${indicatorId}`,
    question: `Is the bounded OpenBB comparison for ${indicatorId} ready for human review?`,
    indicatorIds: [indicatorId],
    sourceVintages: [
      {
        indicatorId,
        sourceSeriesId: comparison.sidecar.seriesId,
        vintage: comparison.sidecar.runtime?.latestObservationDate ?? null,
      },
    ],
    dateRange: {
      start: comparison.overlap.first,
      end: comparison.overlap.last,
    },
    transformations: ["openbb-comparison-review:v1"],
    calculation: {
      method: "openbb-comparison-review",
      version: "1",
      decision: comparison.reviewDecision.status,
    },
    output: reviewArtifact,
    evidence: [
      {
        indicatorId,
        sourceUrl: comparison.sidecar.sourceUrl,
        periods: comparison.aligned.map((row) => row.period),
      },
    ],
    limitations: [
      ...reviewArtifact.limitations,
      "Persistence records the bounded review artifact only; it does not establish managed production durability.",
    ],
  };
  try {
    const saved = shouldUseSupabaseStorage()
      ? await supabaseCreateResearchRun(reviewRun)
      : recordResearchRun(reviewRun);
    response.status(200).json({
      ...comparison,
      reviewArtifact,
      reviewRunId: saved.id,
      persistence: "persisted-staging-review",
    });
  } catch (error) {
    response.status(503).json({
      error: "OpenBB review artifact could not be persisted",
      detail: error instanceof Error ? error.message : String(error),
      ...comparison,
      reviewArtifact,
    });
  }
});

app.post("/api/admin/research-runs", async (request, response) => {
  const body = request.body ?? {};
  if (
    typeof body.title !== "string" ||
    !body.title.trim() ||
    typeof body.question !== "string" ||
    !body.question.trim() ||
    !Array.isArray(body.indicatorIds) ||
    body.indicatorIds.some((value: unknown) => typeof value !== "string") ||
    !Array.isArray(body.limitations)
  )
    return response.status(400).json({ error: "Invalid research run payload" });
  const input = {
    id: randomUUID(),
    title: body.title.trim(),
    question: body.question.trim(),
    indicatorIds: body.indicatorIds as string[],
    sourceVintages: body.sourceVintages ?? [],
    dateRange: body.dateRange ?? { start: null, end: null },
    transformations: body.transformations ?? [],
    calculation: body.calculation ?? { method: "unspecified", version: "1" },
    output: body.output ?? null,
    evidence: body.evidence ?? [],
    limitations: body.limitations as string[],
  };
  try {
    const saved = shouldUseSupabaseStorage()
      ? await supabaseCreateResearchRun(input)
      : recordResearchRun(input);
    response.status(201).json(saved);
  } catch (error) {
    response
      .status(400)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/admin/research-runs/comparison", async (request, response) => {
  const body = request.body ?? {};
  const indicatorIds: string[] = Array.isArray(body.indicatorIds)
    ? Array.from(
        new Set<string>(
          body.indicatorIds.filter(
            (value: unknown): value is string =>
              typeof value === "string" && Boolean(DATA_SOURCES[value]),
          ),
        ),
      )
    : [];
  if (indicatorIds.length !== 2)
    return response
      .status(400)
      .json({ error: "Exactly two known indicatorIds are required" });
  const transformation = ["level", "change", "pct_change"].includes(
    body.transformation,
  )
    ? body.transformation
    : "level";
  const maxLag = Number.isInteger(body.maxLag)
    ? Math.min(12, Math.max(0, body.maxLag))
    : 0;
  try {
    const series = await Promise.all(
      indicatorIds.map(
        async (indicatorId) =>
          [
            indicatorId,
            shouldUseSupabaseStorage()
              ? await supabaseLatestObservations(indicatorId, 10_000)
              : latestObservations(indicatorId, 10_000),
          ] as const,
      ),
    );
    const eligibleSeries = Object.fromEntries(
      series.map(([indicatorId, rows]) => [
        indicatorId,
        (
          rows as Array<{
            date: string;
            value: number;
            status?: string;
            quality?: string;
            sourceName?: string;
            sourceSeriesId?: string | null;
            vintage?: string | null;
          }>
        )
          .filter(
            (row) =>
              row.status === "actual" &&
              row.quality === "verified" &&
              row.sourceName &&
              row.sourceSeriesId,
          )
          .map((row) => ({ date: row.date, value: row.value })),
      ]),
    );
    const report = buildComparisonReport(eligibleSeries, {
      transformation,
      maxLag,
    });
    const sourceVintages = series.map(([indicatorId, rows]) => {
      const row = (
        rows as Array<{
          sourceSeriesId?: string | null;
          vintage?: string | null;
        }>
      ).find((item) => item.sourceSeriesId);
      return {
        indicatorId,
        sourceSeriesId:
          row?.sourceSeriesId ??
          DATA_SOURCES[indicatorId].seriesId ??
          DATA_SOURCES[indicatorId].coinId ??
          null,
        vintage: row?.vintage ?? null,
      };
    });
    const input = {
      id: randomUUID(),
      title:
        typeof body.title === "string" && body.title.trim()
          ? body.title.trim()
          : `Comparison: ${indicatorIds.join(" vs ")}`,
      question:
        typeof body.question === "string" && body.question.trim()
          ? body.question.trim()
          : `How do ${indicatorIds[0]} and ${indicatorIds[1]} move together descriptively?`,
      indicatorIds,
      sourceVintages,
      dateRange: {
        start: report.overlap.periods[0] ?? null,
        end: report.overlap.periods.at(-1) ?? null,
      },
      transformations: [
        transformation,
        ...(maxLag > 0 ? [`maxLag:${maxLag}`] : []),
      ],
      calculation: { method: "evidence-comparison", version: "1" },
      output: report,
      evidence: indicatorIds.map((indicatorId) => ({
        indicatorId,
        sourceUrl: DATA_SOURCES[indicatorId].sourceUrl,
        periods: report.overlap.periods,
      })),
      limitations: [
        ...report.limitations,
        "Only actual, verified and source-backed observations were eligible for this persisted comparison.",
      ],
    };
    const saved = shouldUseSupabaseStorage()
      ? await supabaseCreateResearchRun(input)
      : recordResearchRun(input);
    response.status(201).json(saved);
  } catch (error) {
    response
      .status(400)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/admin/alerts", (request, response) => {
  const { indicatorId, condition, threshold, note } = request.body ?? {};
  if (
    typeof indicatorId !== "string" ||
    !["above", "below", "crossover"].includes(condition) ||
    typeof threshold !== "number" ||
    !Number.isFinite(threshold)
  ) {
    return response.status(400).json({ error: "Invalid alert payload" });
  }
  if (shouldUseSupabaseStorage()) {
    return supabaseCreateAlert({
      indicatorId,
      condition,
      threshold,
      note,
    }).then((alert) => response.status(201).json(alert));
  }
  response
    .status(201)
    .json(createAlert({ indicatorId, condition, threshold, note }));
});

app.delete("/api/admin/alerts/:id", async (request, response) => {
  if (shouldUseSupabaseStorage()) {
    await supabaseDeleteAlert(String(request.params.id));
    return response.status(204).end();
  }
  const removed = removeAlert(String(request.params.id));
  response.status(removed ? 204 : 404).end();
});

app.patch("/api/admin/alerts/:id", async (request, response) => {
  if (typeof request.body?.active !== "boolean") {
    return response.status(400).json({ error: "active must be a boolean" });
  }
  if (shouldUseSupabaseStorage()) {
    await supabaseSetAlertActive(
      String(request.params.id),
      request.body.active,
    );
    return response.status(204).end();
  }
  response
    .status(
      setAlertActive(String(request.params.id), request.body.active)
        ? 204
        : 404,
    )
    .end();
});

app.post(
  "/api/admin/alert-events/:id/acknowledge",
  async (request, response) => {
    const id = Number(request.params.id);
    if (!Number.isSafeInteger(id) || id < 1)
      return response.status(400).json({ error: "Invalid alert event id" });
    if (shouldUseSupabaseStorage()) {
      await supabaseAcknowledgeAlertEvent(id);
      return response.status(204).end();
    }
    response.status(acknowledgeAlertEvent(id) ? 204 : 404).end();
  },
);

app.post("/api/admin/ingest-batch", async (request, response) => {
  const indicatorIds = request.body?.indicatorIds;
  if (
    !Array.isArray(indicatorIds) ||
    indicatorIds.some((indicatorId: unknown) => typeof indicatorId !== "string")
  ) {
    return response
      .status(400)
      .json({ error: "indicatorIds must be an array of strings" });
  }
  try {
    response.status(202).json(await runBoundedIngestionBatch(indicatorIds));
  } catch (error) {
    response
      .status(400)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/admin/fallback-reviews", async (request, response) => {
  const issues = validateFallbackReviewInput(request.body);
  const input = request.body as FallbackReviewInput;
  for (const field of [
    "indicatorId",
    "primaryIndicatorId",
    "fallbackIndicatorId",
  ] as const) {
    if (!issues.length && !DATA_SOURCES[input[field]])
      issues.push(`${field} references an unknown indicator`);
  }
  if (issues.length)
    return response
      .status(400)
      .json({ error: "Invalid fallback review", issues });
  try {
    const review = buildFallbackReviewRun(input);
    const saved = shouldUseSupabaseStorage()
      ? await supabaseCreateResearchRun(review)
      : recordResearchRun(review);
    response.status(201).json(saved);
  } catch (error) {
    response
      .status(503)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/admin/fallback-reviews", async (request, response) => {
  const limit = Math.min(100, Math.max(1, Number(request.query.limit ?? 50)));
  try {
    const reviews = shouldUseSupabaseStorage()
      ? await supabaseListResearchRuns(undefined, {
          limit,
          offset: 0,
          calculationMethod: "provider-fallback-review",
        })
      : listResearchRuns(undefined, {
          limit,
          offset: 0,
          calculationMethod: "provider-fallback-review",
        });
    response.json({
      reviews,
      evidence: "persisted-provider-fallback-review",
      limitations: [
        "Persisted review records document human evidence only; they do not authorize automatic fallback or publish observations.",
      ],
    });
  } catch (error) {
    response.status(503).json(buildManagedStorageErrorResponse(error));
  }
});

app.get("/api/fallback-reviews", async (request, response) => {
  const limit = Math.min(50, Math.max(1, Number(request.query.limit ?? 20)));
  try {
    const reviews = shouldUseSupabaseStorage()
      ? await supabaseListResearchRuns(undefined, {
          limit,
          offset: 0,
          calculationMethod: "provider-fallback-review",
        })
      : listResearchRuns(undefined, {
          limit,
          offset: 0,
          calculationMethod: "provider-fallback-review",
        });
    response.json({
      reviews,
      evidence: "persisted-provider-fallback-review",
      limitations: [
        "This read surface exposes bounded review artifacts only; it does not expose credentials, raw provider payloads or fallback controls.",
        "Persisted approval is human evidence and does not authorize automatic fallback.",
      ],
    });
  } catch (error) {
    response.status(503).json(buildManagedStorageErrorResponse(error));
  }
});

app.post("/api/admin/ingest/:indicatorId", async (request, response) => {
  try {
    response
      .status(202)
      .json(await ingestIndicator(String(request.params.indicatorId)));
  } catch (error) {
    response
      .status(502)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/cron/ingest", async (request, response) => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.authorization !== `Bearer ${cronSecret}`) {
    return response.status(401).json({ error: "Unauthorized" });
  }
  response.status(200).json(await runScheduledIngestion());
});

app.post("/api/cron/supabase-keepalive", async (request, response) => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.authorization !== `Bearer ${cronSecret}`) {
    return response.status(401).json({ error: "Unauthorized" });
  }
  if (!isSupabaseConfigured()) {
    return response.status(503).json({ error: "Supabase storage is not configured" });
  }
  try {
    const result = await runSupabaseKeepalivePing();
    return response.status(200).json({ ok: result.ok, touchedAt: result.touched_at, evidence: "disposable-supabase-activity" });
  } catch (error) {
    return response.status(503).json({ error: "Supabase keep-alive failed", code: classifySupabaseConnectionError(error) });
  }
});

app.get("/api/ingestion-metrics", async (_request, response) => {
  const persistedJobs = shouldUseSupabaseStorage()
    ? await supabaseListIngestionJobs()
    : listIngestionJobs();
  response.json({
    runtime: getSchedulerMetrics(),
    persisted: buildPersistedIngestionMetrics(
      persistedJobs as Array<Record<string, unknown>>,
    ),
  });
});

app.post(
  "/api/admin/internal-forecast-model/:indicatorId/run",
  async (request, response) => {
    const indicatorId = String(request.params.indicatorId);
    const source = DATA_SOURCES[indicatorId];
    const observations = (
      shouldUseSupabaseStorage()
        ? await supabaseLatestObservations(indicatorId, 10_000)
        : latestObservations(indicatorId, 10_000)
    ) as Array<{
      date: string;
      value: number;
      status: string;
      quality: string;
    }>;
    const report = evaluateNaivePersistence(
      observations,
      source?.frequencyLabel,
      { operationSupported: getIndicatorProviderCapability(indicatorId)?.supportedOperations.includes("evidence") === true },
    );
    const input = { id: randomUUID(), indicatorId, ...report };
    response
      .status(201)
      .json(
        shouldUseSupabaseStorage()
          ? await supabaseRecordModelRun(input)
          : recordModelRun(input),
      );
  },
);

app.get("/api/admin/ingestion-runs", async (_request, response) => {
  if (shouldUseSupabaseStorage())
    return response.json(await supabaseListIngestionRuns());
  response.json(
    db
      .prepare(
        `
      SELECT id, indicator_id AS indicatorId, source_type AS sourceType,
             started_at AS startedAt, completed_at AS completedAt, status,
             observation_count AS observationCount, error_message AS errorMessage
      FROM ingestion_runs ORDER BY id DESC LIMIT 200
    `,
      )
      .all(),
  );
});

app.get("/api/admin/ingestion-jobs", async (_request, response) => {
  if (shouldUseSupabaseStorage()) {
    try {
      return response.json({ jobs: await supabaseListIngestionJobs() });
    } catch (error) {
      return response.status(503).json({
        error: error instanceof Error ? error.message : String(error),
        code: "DURABLE_INGESTION_JOB_READ_FAILED",
      });
    }
  }
  response.json({ jobs: listIngestionJobs() });
});

// ─── Macro Debate API ────────────────────────────────────────────────────────
// Adapted from TradingAgents multi-agent debate architecture.
// POST /api/debate/run — Run a debate session for an indicator+prediction
// GET  /api/debate/:indicatorId/history — List past debate sessions
// GET  /api/debate/session/:id — Get full debate session with Bull/Bear/Risk details

app.post("/api/debate/run", async (request, response) => {
  try {
    const body = request.body as {
      indicatorId?: string;
      predictionValue?: number;
      predictionHorizon?: string;
      predictionSource?: string;
      predictionDirection?: string;
      fromForecast?: boolean;
      currentValue?: number;
    };

    if (
      !body.indicatorId ||
      body.predictionValue === undefined ||
      !body.predictionHorizon ||
      !body.predictionSource
    ) {
      return response.status(400).json({
        error: "Required: indicatorId, predictionValue, predictionHorizon, predictionSource",
      });
    }

    // Build the indicator list from the catalog + live observations
    const catalog = indicatorCatalog;
    const indicator = catalog.find((i) => i.id === body.indicatorId);
    if (!indicator) {
      return response.status(404).json({ error: `Indicator '${body.indicatorId}' not found in catalog` });
    }

    // Infer direction if not provided (fromForecast mode)
    const prediction =
      body.fromForecast && body.currentValue !== undefined
        ? inferPredictionFromForecast(
            body.predictionValue,
            body.currentValue,
            body.predictionHorizon,
            body.predictionSource,
          )
        : {
            value: body.predictionValue,
            horizon: body.predictionHorizon,
            source: body.predictionSource,
            impliedDirection: (body.predictionDirection ?? "flat") as "higher" | "lower" | "flat",
          };

    const session = runMacroDebate(indicator as never, prediction, catalog as never[]);

    // Persist async (don't block response)
    persistDebateSession(session).catch(() => {
      // Persistence failure is non-fatal; session is returned to client
    });

    return response.status(201).json({ session });
  } catch (error) {
    return response.status(500).json({
      error: "Debate engine error",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/api/forecast-debates/:forecastId/export", async (request, response) => {
  try {
    const forecasts = (shouldUseSupabaseStorage() ? await supabaseListForecasts() : listForecasts()) as Array<Record<string, unknown>>;
    const forecast = forecasts.find((item) => String(item.id) === request.params.forecastId);
    if (!forecast) return response.status(404).json({ error: "Forecast not found" });
    const indicator = indicatorCatalog.find((item) => item.id === String(forecast.indicatorId));
    if (!indicator) return response.status(404).json({ error: "Forecast indicator not found" });
    const prediction = inferPredictionFromForecast(Number(forecast.forecastValue), indicator.snapshot.value, String(forecast.targetDate), String(forecast.institution));
    const session = runMacroDebate(indicator as never, prediction, indicatorCatalog as never[]);
    const artifact = createForecastDebateExportArtifact(session);
    if (request.query.format === "markdown") return response.type("text/markdown").send(renderForecastDebateMarkdown(artifact));
    return response.json({ artifact, evidence: "server-deterministic-debate" });
  } catch (error) {
    return response.status(503).json(buildManagedStorageErrorResponse(error));
  }
});

app.get("/api/debate/:indicatorId/history", async (request, response) => {
  const { indicatorId } = request.params;
  const limit = Math.min(Number(request.query.limit ?? 10), 50);
  try {
    const page = await listDebateSessions(indicatorId, limit);
    return response.json(page);
  } catch (error) {
    return response.status(503).json({
      error: "Debate history unavailable",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/api/debate/session/:id", async (request, response) => {
  const { id } = request.params;
  try {
    const session = await getDebateSessionFull(id);
    if (!session) {
      return response.status(404).json({ error: "Debate session not found" });
    }
    return response.json({ session });
  } catch (error) {
    return response.status(503).json({
      error: "Debate session retrieval failed",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/api/debate/session/:id/export", async (request, response) => {
  try {
    const session = await getDebateSessionFull(request.params.id);
    if (!session) return response.status(404).json({ error: "Debate session not found" });
    const artifact = createForecastDebateExportArtifact(session);
    if (request.query.format === "markdown") {
      response.type("text/markdown").send(renderForecastDebateMarkdown(artifact));
      return;
    }
    return response.json({ artifact });
  } catch (error) {
    return response.status(503).json(buildManagedStorageErrorResponse(error));
  }
});

// ─── Macro Data Router API ────────────────────────────────────────────────────
// Implements route_to_vendor() pattern from TradingAgents.
// GET  /api/macro/route?indicator=cpi&lookbackDays=365
// POST /api/macro/route/batch — Batch fetch multiple indicators
// GET  /api/macro/cache-stats — Cache health monitoring

app.get("/api/macro/route", async (request, response) => {
  const indicator = request.query.indicator as string;
  const lookbackDays = Number(request.query.lookbackDays ?? 365);
  const asOf = (request.query.asOf as string | undefined) ?? new Date().toISOString().slice(0, 10);

  if (!indicator) {
    return response.status(400).json({ error: "Required: indicator query param" });
  }

  try {
    const result = await routeToVendor({ indicator, lookbackDays, asOf });
    return response.json(result);
  } catch (error) {
    return response.status(503).json({
      error: "Macro data router error",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/macro/route/batch", async (request, response) => {
  const body = request.body as { indicators?: Array<{ indicator: string; lookbackDays?: number }> };
  if (!Array.isArray(body.indicators) || body.indicators.length === 0) {
    return response.status(400).json({ error: "Required: indicators array" });
  }
  if (body.indicators.length > 20) {
    return response.status(400).json({ error: "Max 20 indicators per batch request" });
  }

  try {
    const results = await routeMultipleToVendor(body.indicators);
    return response.json({ results });
  } catch (error) {
    return response.status(503).json({
      error: "Batch route error",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/api/macro/cache-stats", (_request, response) => {
  return response.json(macroIndicatorCache.stats());
});

// ─────────────────────────────────────────────────────────────────────────────

const dist = resolve("dist");
if (existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: "1h" }));
  app.get("/{*splat}", (_request, response) =>
    response.sendFile(resolve(dist, "index.html")),
  );
}

if (process.env.NODE_ENV !== "test" && !process.env.VERCEL) {
  app.listen(port, "127.0.0.1", () => {
    console.log(`Macro Research API listening on http://127.0.0.1:${port}`);
  });
  startIngestionScheduler();
  const companyStateDir = resolve(process.env.AI_COMPANY_STATE_DIR ?? ".ai-company/runtime");
  void hydrateUserTelemetry().catch(() => undefined);
  const companyStore = new CompanyStateStore(companyStateDir);
  const companyUsage = new UsageLedger(companyStateDir);
  const roleEvidenceLedger = new RoleEvidenceLedger(resolve(companyStateDir, "projects/macro-os"));
  const configuredRoleModelAdapter = createConfiguredRoleModelAdapter(process.env, fetch, companyProviderAttemptLedger, companyProviderDeadLetterLedger);
  const roleWorkExecutor = process.env.AI_COMPANY_ROLE_EXECUTOR_ENABLED === "true" && configuredRoleModelAdapter ? evidenceProducingRoleWorkExecutor(configuredRoleModelAdapter, roleEvidenceLedger, new RoleWorkQueue(resolve(companyStateDir, "projects/macro-os"), roleEvidenceLedger)) : undefined;
  const discoveryEnabled = process.env.AI_COMPANY_DISCOVERY_ENABLED === "true";
  const discoveryEndpoint = process.env.AI_COMPANY_DISCOVERY_ENDPOINT?.trim();
  const discoveryModel = process.env.AI_COMPANY_DISCOVERY_MODEL?.trim();
  void ensureBaselineIdeas(companyIdeaLedger).catch(() => undefined);
  startCeoBriefRuntime({ health: createCompanyHealthProvider(companyStore, companyUsage), env: process.env });
  const productRuntime = createProductCompanyRuntime({
    projectId: "macro-os",
    stateDir: companyStateDir,
    intervalMs: 60_000,
    readinessGate: async () => {
      const storage = await checkSupabaseConnection();
      const llm = getLLMProviderReadiness(process.env);
      const productionMode = process.env.NODE_ENV === "production";
      const roleReady = process.env.AI_COMPANY_ROLE_EXECUTOR_ENABLED === "true" && Boolean(configuredRoleModelAdapter);
      return {
        ready: (productionMode ? storage.connected && process.env.BACKUP_RESTORE_VERIFIED === "true" : true) && llm.status === "configured" && roleReady,
        blockers: [
          ...(productionMode && !storage.connected ? ["managed storage is not connected"] : []),
          ...(productionMode && process.env.BACKUP_RESTORE_VERIFIED !== "true" ? ["backup/restore evidence is missing"] : []),
          ...(llm.status !== "configured" ? [`LLM provider is ${llm.status}`] : []),
          ...(!roleReady && process.env.AI_COMPANY_ROLE_EXECUTOR_ENABLED !== "true" ? ["role executor is not enabled"] : []),
          ...(!roleReady && process.env.AI_COMPANY_ROLE_EXECUTOR_ENABLED === "true" && !configuredRoleModelAdapter ? ["role executor provider adapter is unavailable"] : []),
        ],
      };
    },
    health: createCompanyHealthProvider(companyStore, companyUsage),
    roleWorkExecutor,
    evidenceResolver: new RoleEvidenceResolver(resolve(companyStateDir, "projects/macro-os")),
    discovery: discoveryEnabled && discoveryEndpoint && discoveryModel ? { config: { endpoint: discoveryEndpoint, model: discoveryModel }, productGoal: "Macro OS trustworthy global macro research workflow", evidence: async () => (await roleEvidenceLedger.records("macro-os")).map((item) => ({ evidence_id: item.evidence_id, summary: item.output.slice(0, 500), source_url: null })) } : undefined,
  });
  productCompanyRuntimeStatus = () => ({ ...productRuntime.supervisor.status(), readiness: productRuntime.readiness() });
  productCompanyRuntimeTick = () => productRuntime.tick();
  setTelemetryWakeHandler((event) => productRuntime.wake(event));
  productRuntime.start();
}

export { app };
