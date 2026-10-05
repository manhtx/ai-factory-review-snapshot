import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";

let app: Express;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.MACRO_DB_PATH = ":memory:";
  process.env.MACRO_ADMIN_KEY = "test-admin";
  ({ app } = await import("./index"));
});

afterEach(() => {
  // Tests temporarily emulate durable runtime; never let a failed assertion
  // leak production storage flags into the next API case.
  delete process.env.PRODUCTION_RUNTIME;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.MACRO_LLM_ENDPOINT;
  delete process.env.MACRO_LLM_MODEL;
  delete process.env.MACRO_LLM_API_KEY;
});

describe("platform API", () => {
  it("exposes cheap liveness and storage readiness probes", async () => {
    const live = await request(app).get("/api/live").expect(200);
    expect(live.body).toMatchObject({ status: "alive", runtimeRevision: expect.any(String) });
    const ready = await request(app).get("/api/ready").expect(200);
    expect(ready.body).toMatchObject({ status: "ready", database: "sqlite", productionReady: false });
  });

  it("reports health without exposing secrets", async () => {
    const response = await request(app).get("/api/health").expect(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.durablePersistence).toBe(false);
    expect(response.body.productionReady).toBe(false);
    expect(response.body.scheduler).toMatchObject({ enabled: expect.any(Boolean), indicatorCount: expect.any(Number), indicatorIds: expect.any(Array) });
    expect(response.body).not.toHaveProperty("adminKey");
  });

  it("exposes the durable provider circuit read model without secrets", async () => {
    const response = await request(app).get("/api/company/provider-circuit?projectId=macro-os&providerId=local").expect(200);
    expect(response.body).toMatchObject({ evidence: "durable-provider-circuit-read-model", project_id: "macro-os", provider_id: "local", state: expect.any(String), consecutive_failures: expect.any(Number), cooldown_ms: expect.any(Number) });
    expect(JSON.stringify(response.body)).not.toContain("API_KEY");
    expect(response.body).not.toHaveProperty("apiKey");
  });

  it("bounds the managed health probe when the configured provider is unreachable", async () => {
    process.env.PRODUCTION_RUNTIME = "true";
    process.env.SUPABASE_URL = "https://unresolvable.invalid";
    process.env.SUPABASE_SECRET_KEY = "test-secret";
    process.env.SUPABASE_AUDIT_TIMEOUT_MS = "1000";
    const startedAt = Date.now();
    const response = await request(app).get("/api/health").expect(200);
    expect(Date.now() - startedAt).toBeLessThan(2500);
    expect(response.body).toMatchObject({
      status: "degraded",
      durablePersistence: false,
      productionReady: false,
      supabase: {
        configured: true,
        connected: false,
        diagnosticCode: expect.any(String),
      },
    });
    expect(JSON.stringify(response.body)).not.toContain("test-secret");
  });

  it("reports persistence evidence without overstating production readiness", async () => {
    const response = await request(app)
      .get("/api/persistence-audit")
      .expect(200);
    expect(response.body.runtime).toMatchObject({
      usesSupabase: false,
      database: "sqlite",
      durablePersistence: false,
    });
    expect(response.body.supabase).toMatchObject({
      configured: false,
      connected: false,
      errorCode: "unavailable",
    });
    expect(response.body.migrations.researchRunsTracked).toBe(true);
    expect(response.body.migrations.ingestionJobsTracked).toBe(true);
    expect(response.body.migrations.criticalMigrationsTracked).toBe(true);
    expect(response.body.migrations.appliedToProduction).toBe(
      "not-verifiable-from-source",
    );
    expect(response.body.backupRestore.status).toBe("not-verifiable");
    expect(response.body.productionReady).toBe(false);
  });

  it("exposes a bounded provider rights review package", async () => {
    const rest = await request(app)
      .get("/api/provider-rights/review-package")
      .expect(200);
    expect(rest.body).toMatchObject({
      schema: "macro-os.provider-rights-review-package",
      evidence: "configuration",
      summary: {
        total: expect.any(Number),
        reviewRequired: expect.any(Number),
      },
      fingerprint: expect.stringMatching(/^fnv1a32-/),
      limitations: expect.any(Array),
    });
    const mcp = await request(app)
      .get("/api/mcp/tools/get_provider_rights_review_package")
      .expect(200);
    expect(mcp.body.records).toEqual(rest.body.records);
    expect(mcp.body.fingerprint).toBe(rest.body.fingerprint);
  });

  it("publishes bounded country coverage without inventing uncovered data", async () => {
    const response = await request(app)
      .get("/api/coverage/countries")
      .expect(200);
    expect(response.body).toMatchObject({
      evidence: "catalog-and-snapshot",
      countries: expect.any(Array),
    });
    expect(response.body.countries).toHaveLength(13);
    expect(
      response.body.countries.every(
        (country: {
          registeredCount: number;
          hydratedCount: number;
          state: string;
        }) => country.hydratedCount <= country.registeredCount,
      ),
    ).toBe(true);
  });

  it("reports production preflight checks without exposing secrets", async () => {
    const response = await request(app)
      .get("/api/production-preflight")
      .expect(200);
    expect(response.body.productionReady).toBe(false);
    expect(response.body.llmProvider).toMatchObject({ status: "unconfigured", deterministicFallback: true });
    expect(
      response.body.checks.some(
        (check: { id: string; status: string }) =>
          check.id === "backup-restore" && check.status === "attention",
      ),
    ).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain("test-admin");
  });

  it("fails closed for production runtime without durable persistence", async () => {
    process.env.PRODUCTION_RUNTIME = "true";
    const response = await request(app).get("/api/health").expect(200);
    delete process.env.PRODUCTION_RUNTIME;
    expect(response.body).toMatchObject({
      status: "degraded",
      productionReady: false,
      durablePersistence: false,
    });
  });

  it("does not expose SQLite-backed data routes when production storage is missing", async () => {
    process.env.PRODUCTION_RUNTIME = "true";
    const response = await request(app).get("/api/series/gold").expect(503);
    delete process.env.PRODUCTION_RUNTIME;
    expect(response.body).toMatchObject({
      code: "PRODUCTION_STORAGE_NOT_CONFIGURED",
    });
  });

  it("publishes a complete source catalog", async () => {
    const response = await request(app).get("/api/catalog").expect(200);
    expect(response.body).toHaveLength(133);
    expect(
      response.body.some(
        (item: { indicatorId: string }) => item.indicatorId === "cpi-us",
      ),
    ).toBe(true);
    expect(response.body[0]).toHaveProperty("acquisitionStatus");
    expect(response.headers["content-security-policy"]).toContain(
      "frame-ancestors 'none'",
    );
    expect(response.headers["x-request-id"]).toBeTruthy();
  });

  it("projects operation capability into runtime snapshots", async () => {
    const response = await request(app).get("/api/snapshots").expect(200);
    expect(Array.isArray(response.body)).toBe(true);
    if (response.body.length > 0) {
      expect(response.body[0].operationAvailability).toMatchObject({ operation: "evidence" });
    }
  });

  it("publishes provider capabilities with an explicit configuration evidence state", async () => {
    const response = await request(app).get("/api/providers").expect(200);
    expect(response.body.evidence).toBe("configuration");
    expect(
      response.body.providers.some(
        (provider: { providerId: string }) => provider.providerId === "fred",
      ),
    ).toBe(true);
    const fred = response.body.providers.find(
      (provider: { providerId: string }) => provider.providerId === "fred",
    );
    expect(fred.indicatorIds).toContain("cpi-us");
    expect(fred.rightsStatus).toBe("public-source");
    expect(fred.supportedOperations).toEqual(expect.arrayContaining(["catalog", "historical", "ingest", "evidence"]));
    expect(response.body.note).toContain("does not prove live health");
  });

  it("answers provider operation capability queries without probing or implying live support", async () => {
    const supported = await request(app).get("/api/providers/fred/operations/historical").expect(200);
    expect(supported.body).toMatchObject({ providerId: "fred", operation: "historical", status: "configuration-supported", evidence: "configuration" });
    const unsupported = await request(app).get("/api/providers/mendeley-csv/operations/realtime").expect(200);
    expect(unsupported.body).toHaveProperty("limitations");
    const invalid = await request(app).get("/api/providers/fred/operations/not-a-real-operation").expect(400);
    expect(invalid.body.supportedOperations).toContain("historical");
    await request(app).get("/api/mcp/tools/check_provider_operation?providerId=fred&operation=historical").expect(200);
  });

  it("publishes provider contract audit as configuration evidence", async () => {
    const response = await request(app)
      .get("/api/provider-contract")
      .expect(200);
    expect(response.body).toMatchObject({
      evidence: "configuration",
      audit: {
        total: expect.any(Number),
        valid: expect.any(Number),
        invalid: expect.any(Number),
      },
    });
  });

  it("publishes provider rights classification as configuration evidence", async () => {
    const response = await request(app).get("/api/provider-rights").expect(200);
    expect(response.body).toMatchObject({
      evidence: "configuration",
      audit: {
        total: expect.any(Number),
        publicSource: expect.any(Number),
        reviewRequired: expect.any(Number),
      },
    });
    const detail = await request(app)
      .get("/api/provider-rights/fred")
      .expect(200);
    expect(detail.body).toMatchObject({
      evidence: "configuration",
      provider: { providerId: "fred", rightsStatus: "public-source" },
    });
    await request(app).get("/api/provider-rights/not-real").expect(404);
    const mcpRights = await request(app)
      .get("/api/mcp/tools/get_provider_rights?providerId=fred")
      .expect(200);
    expect(mcpRights.body).toMatchObject({
      evidence: "configuration",
      providers: [
        expect.objectContaining({
          providerId: "fred",
          rightsStatus: "public-source",
        }),
      ],
    });
    const matrix = await request(app)
      .get("/api/provider-evidence-matrix")
      .expect(200);
    expect(
      matrix.body.matrix.find(
        (row: { providerId: string }) => row.providerId === "fred",
      ),
    ).toMatchObject({
      contract: { invalid: 0 },
      rights: { reviewRequired: false },
      operations: { evidence: "configuration-supported", ingest: "configuration-supported" },
      runtime: { status: expect.any(String) },
    });
    const mcpMatrix = await request(app)
      .get("/api/mcp/tools/get_provider_evidence_matrix?providerId=fred")
      .expect(200);
    expect(mcpMatrix.body.matrix).toEqual([
      expect.objectContaining({ providerId: "fred" }),
    ]);
  });

  it("publishes freshness SLO thresholds as configuration, not live proof", async () => {
    const response = await request(app).get("/api/freshness-slos").expect(200);
    expect(response.body.evidence).toBe("configuration");
    expect(response.body.slos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ frequency: "monthly", freshWithinDays: 45 }),
      ]),
    );
    expect(
      new Set(
        response.body.slos.map((slo: { frequency: string }) => slo.frequency),
      ).size,
    ).toBe(response.body.slos.length);
    expect(response.body.limitations[0]).toContain("not a guarantee");
  });

  it("publishes fail-closed provider health when no ingestion has run", async () => {
    const response = await request(app).get("/api/provider-health").expect(200);
    expect(response.body.evidence).toBe("ingestion-run");
    expect(response.body.providers.length).toBeGreaterThan(0);
    expect(
      response.body.providers.every(
        (provider: { status: string; evidence: string }) =>
          provider.status === "never-run" && provider.evidence === "none",
      ),
    ).toBe(true);
    expect(response.body.note).toContain("does not prove source rights");
  });

  it("publishes source mappings as no-mapping until independent evidence exists", async () => {
    const response = await request(app)
      .get("/api/source-mappings?indicatorId=cpi-us")
      .expect(200);
    expect(response.body.declaredMappingCount).toBe(0);
    expect(response.body.mappings).toEqual([
      expect.objectContaining({
        indicatorId: "cpi-us",
        status: "no-mapping",
        evidence: "none",
      }),
    ]);
    expect(response.body.note).toContain(
      "do not establish independent redundancy",
    );
  });

  it("publishes provider redundancy readiness without authorizing fallback", async () => {
    const response = await request(app)
      .get("/api/provider-redundancy?indicatorId=cpi-us")
      .expect(200);
    expect(response.body).toMatchObject({
      automaticFallback: false,
      counts: { "no-mapping": 1 },
      records: [
        expect.objectContaining({ indicatorId: "cpi-us", state: "no-mapping" }),
      ],
    });
    const mcp = await request(app)
      .get("/api/mcp/tools/get_provider_redundancy?indicatorId=cpi-us")
      .expect(200);
    expect(mcp.body.automaticFallback).toBe(false);
  });

  it("publishes fallback readiness with missing runtime evidence explicit", async () => {
    const response = await request(app)
      .get("/api/provider-fallback-readiness?indicatorId=cpi-us")
      .expect(200);
    expect(response.body).toMatchObject({
      automaticFallback: false,
      evidence: "redundancy-rights-runtime-freshness",
      counts: { "no-mapping": 1 },
    });
    expect(response.body.records[0]).toMatchObject({
      state: "no-mapping",
      reasonCodes: ["NO_INDEPENDENT_MAPPING"],
    });
    await request(app)
      .get("/api/mcp/tools/get_provider_fallback_readiness?indicatorId=cpi-us")
      .expect(200);
  });

  it("publishes a bounded evidence bundle without inventing observations", async () => {
    const response = await request(app)
      .get("/api/evidence/indicator/cpi-us")
      .expect(200);
    expect(response.body.indicator).toMatchObject({
      indicatorId: "cpi-us",
      seriesId: "CPIAUCSL",
      source: "FRED",
    });
    expect(response.body.observations).toEqual([]);
    expect(response.body.researchEligibility).toMatchObject({
      eligibleObservationCount: 0,
      hasVerifiedActual: false,
    });
    expect(response.body.operationAvailability).toMatchObject({
      operation: "evidence",
      status: "configuration-supported",
      evidence: "configuration",
    });
    expect(response.body.researchEligibility).toMatchObject({
      operation: "evidence",
      operationSupported: true,
    });
    expect(response.body.evidence).toMatchObject({
      metadata: "configuration",
      observations: "none",
      providerHealth: "none",
    });
    expect(response.body.limitations).toContain(
      "No ingested observations are currently available for this indicator.",
    );
  });

  it("rejects an unknown indicator evidence request", async () => {
    await request(app).get("/api/evidence/indicator/not-real").expect(404);
  });

  it("publishes a bounded read-only MCP tool manifest and reuses evidence contract", async () => {
    const manifest = await request(app).get("/api/mcp/tools").expect(200);
    expect(manifest.body.contractVersion).toBe("1");
    expect(
      manifest.body.tools.map((tool: { name: string }) => tool.name),
    ).toEqual([
      "get_indicator_metadata",
      "get_indicator_catalog",
      "get_indicator_evidence",
      "compare_indicators",
      "get_relationship_evidence",
      "explain_alert_evidence",
      "get_historical_event_evidence",
      "get_verified_observations",
      "get_evidence_commentary",
      "get_provider_health",
      "get_user_telemetry_summary",
      "get_company_operating_audit",
      "check_provider_operation",
      "get_platform_health",
      "get_country_coverage",
      "get_mvp_readiness",
      "get_provider_rights",
      "get_provider_rights_review_package",
      "get_provider_evidence_matrix",
      "get_openbb_sidecar_status",
      "get_openbb_pilot_gate",
      "get_openbb_pilot_gate_export",
      "get_source_reconciliation",
      "get_provider_redundancy",
      "get_provider_fallback_readiness",
      "get_forecast_revision_evidence",
      "get_research_run_lineage",
      "get_research_runs",
      "get_research_run_export",
      "get_openbb_review",
      "get_openbb_review_export",
      "get_openbb_review_diff",
    ]);
    expect(
      manifest.body.tools.every(
        (tool: { method: string; readOnly: boolean }) =>
          tool.method === "GET" && tool.readOnly,
      ),
    ).toBe(true);
    expect(manifest.body.boundary).toContain("bounded evidence bundles");
    const platformHealth = await request(app)
      .get("/api/mcp/tools/get_platform_health")
      .expect(200);
    expect(platformHealth.body).toMatchObject({
      status: "ok",
      database: "sqlite",
      durablePersistence: false,
      productionReady: false,
      supabase: {
        configured: false,
        connected: false,
        errorCode: "unavailable",
      },
    });
    const catalog = await request(app)
      .get("/api/mcp/tools/get_indicator_catalog?q=cpi&providerId=fred")
      .expect(200);
    expect(catalog.body).toMatchObject({
      evidence: "configuration",
      count: expect.any(Number),
      filters: { q: "cpi", providerId: "fred" },
    });
    expect(
      catalog.body.catalog.every(
        (item: { indicatorId: string; providerId: string }) =>
          item.indicatorId.includes("cpi") && item.providerId === "fred",
      ),
    ).toBe(true);
    const coverage = await request(app)
      .get("/api/mcp/tools/get_country_coverage")
      .expect(200);
    expect(coverage.body).toMatchObject({
      evidence: "catalog-and-snapshot",
      countries: expect.any(Array),
    });
    const mvpReadiness = await request(app)
      .get("/api/mcp/tools/get_mvp_readiness")
      .expect(200);
    expect(mvpReadiness.body).toMatchObject({
      evidence: "catalog-and-snapshot",
      target: { countryCount: 9, indicatorRange: { min: 80, max: 120 } },
      observed: expect.any(Object),
      fingerprint: expect.stringMatching(/^fnv1a32-/),
      artifact: {
        schema: "macro-os.mvp-readiness",
        version: 1,
        fingerprint: expect.stringMatching(/^fnv1a32-/),
        countries: expect.any(Array),
      },
      state: expect.stringMatching(/partial|on-track|unavailable/),
    });
    expect(mvpReadiness.body.artifact.fingerprint).toBe(
      mvpReadiness.body.fingerprint,
    );
    const mvpReadinessMcp = await request(app)
      .get("/api/mcp/tools/get_mvp_readiness")
      .expect(200);
    expect(mvpReadinessMcp.body.fingerprint).toBe(
      mvpReadiness.body.fingerprint,
    );
    const evidence = await request(app)
      .get("/api/mcp/tools/get_indicator_evidence?indicatorId=cpi-us")
      .expect(200);
    expect(evidence.body).toMatchObject({
      indicator: { indicatorId: "cpi-us" },
      observations: [],
      researchEligibility: { hasVerifiedActual: false },
    });
    const commentaryProbe = await request(app)
      .get("/api/mcp/tools/get_evidence_commentary?indicatorIds=cpi-us")
      .expect(200);
    expect(commentaryProbe.body.records[0]).toMatchObject({
      freshness: "unavailable",
      latestObservationEligible: false,
      eligibleObservationCount: 0,
      currentEligibleObservationCount: 0,
      evidenceState: "none",
      currentEvidence: false,
    });
    expect(commentaryProbe.body.limitations).toContain(
      "Historical actual/verified observations may be returned, but current commentary is not asserted until each latest series is fresh.",
    );
    await request(app)
      .get("/api/mcp/tools/get_indicator_evidence?indicatorId=not-real")
      .expect(404);
    const metadata = await request(app)
      .get("/api/mcp/tools/get_indicator_metadata?indicatorId=cpi-us")
      .expect(200);
    expect(metadata.body).toMatchObject({
      indicatorId: "cpi-us",
      evidence: "configuration",
      metadata: {
        seriesId: "CPIAUCSL",
        providerId: "fred",
        adapterMode: "server-adapter",
        rightsStatus: "public-source",
      },
    });
    const comparison = await request(app)
      .get(
        "/api/mcp/tools/compare_indicators?indicatorIds=cpi-us,gdp-vn&transformation=pct_change&maxLag=2",
      )
      .expect(200);
    expect(comparison.body.report).toMatchObject({
      evidenceState: "actual-verified-source-backed",
      currentEvidenceState: "historical-only-or-current-evidence-unavailable",
      transformation: "pct_change",
      currentEligibleCounts: expect.any(Object),
    });
    expect(comparison.body.limitations).toContain(
      "Lag correlations are descriptive alignment tests; lag selection does not establish temporal causality.",
    );
    await request(app)
      .get(
        "/api/mcp/tools/get_relationship_evidence?indicatorIds=cpi-us,gdp-vn",
      )
      .expect(200);
    const alertManifest = await request(app).get("/api/mcp/tools").expect(200);
    expect(
      alertManifest.body.tools.map((tool: { name: string }) => tool.name),
    ).toContain("explain_alert_evidence");
    await request(app)
      .get("/api/mcp/tools/explain_alert_evidence?eventId=1")
      .expect(404);
    const cycle = await request(app)
      .get("/api/mcp/tools/get_historical_event_evidence?cycleId=gfc-2008")
      .expect(200);
    expect(cycle.body).toMatchObject({
      cycle: { id: "gfc-2008", kind: "historical" },
      evidence: "configuration-narrative",
    });
    await request(app)
      .get("/api/mcp/tools/get_historical_event_evidence?cycleId=not-real")
      .expect(404);
    const verified = await request(app)
      .get(
        "/api/mcp/tools/get_verified_observations?indicatorId=cpi-us&limit=10",
      )
      .expect(200);
    expect(verified.body).toMatchObject({
      indicatorId: "cpi-us",
      count: 0,
      evidence: "none",
      freshness: "unavailable",
      researchEligibility: {
        hasVerifiedActual: false,
        hasCurrentEvidence: false,
        eligibleObservationCount: 0,
        currentEligibleObservationCount: 0,
      },
    });
    expect(verified.body.limitations).toContain(
      "No observations currently exist for this indicator.",
    );
    await request(app)
      .get("/api/mcp/tools/get_verified_observations?indicatorId=not-real")
      .expect(404);
    const commentary = await request(app)
      .get(
        "/api/mcp/tools/get_evidence_commentary?indicatorIds=cpi-us,gdp-vn&limit=5",
      )
      .expect(200);
    expect(commentary.body).toMatchObject({
      evidence: "none",
      calculation: {
        method: "latest-direction",
        definition:
          "Compare the direction of each eligible indicator between its two latest observations.",
        causalInference: false,
      },
      records: expect.any(Array),
    });
    expect(commentary.body.records.every((record: { operationSupported: boolean; operationAvailability: { operation: string } }) => record.operationSupported && record.operationAvailability.operation === "evidence")).toBe(true);
    expect(
      commentary.body.records.every(
        (record: {
          eligibleObservationCount: number;
          currentEligibleObservationCount: number;
          evidenceState: string;
        }) =>
          record.eligibleObservationCount === 0 &&
          record.currentEligibleObservationCount === 0 &&
          record.evidenceState === "none",
      ),
    ).toBe(true);
    await request(app)
      .get("/api/mcp/tools/get_evidence_commentary?indicatorIds=not-real")
      .expect(404);
    const health = await request(app)
      .get("/api/mcp/tools/get_provider_health?providerId=fred")
      .expect(200);
    expect(health.body).toMatchObject({
      evidence: "ingestion-run",
      providers: [
        expect.objectContaining({ providerId: "fred", status: "never-run" }),
      ],
    });
    await request(app)
      .get("/api/mcp/tools/get_provider_health?providerId=not-real")
      .expect(404);
    const healthHistory = await request(app)
      .get("/api/provider-health/history?providerId=fred&limit=2")
      .expect(200);
    expect(healthHistory.body).toMatchObject({
      evidence: "ingestion-run",
      limit: 2,
      history: expect.any(Array),
    });
    const telemetry = await request(app)
      .get("/api/provider-health/telemetry")
      .expect(200);
    expect(telemetry.body).toMatchObject({
      evidence: "orchestration-telemetry",
      telemetry: expect.arrayContaining([
        expect.objectContaining({
          providerId: "fred",
          attempts: 0,
          successRate: null,
          p50DurationMs: null,
        }),
      ]),
      degradation: expect.arrayContaining([
        expect.objectContaining({
          providerId: "fred",
          status: "insufficient-evidence",
        }),
      ]),
      trends: expect.arrayContaining([
        expect.objectContaining({
          providerId: "fred",
          direction: "insufficient-evidence",
        }),
      ]),
    });
    await request(app)
      .get("/api/provider-health/history?providerId=not-real")
      .expect(404);
    await request(app)
      .post("/api/admin/provider-health/telemetry/snapshot")
      .send({})
      .expect(401);
    const snapshot = await request(app)
      .post("/api/admin/provider-health/telemetry/snapshot")
      .set("Authorization", "Bearer test-admin")
      .send({})
      .expect(201);
    expect(snapshot.body).toMatchObject({
      evidence: "orchestration-telemetry-snapshot",
      snapshot: { telemetry: expect.any(Array) },
    });
    const snapshots = await request(app)
      .get("/api/provider-health/telemetry/snapshots")
      .expect(200);
    expect(snapshots.body).toMatchObject({
      evidence: "orchestration-telemetry-snapshot",
      snapshots: expect.arrayContaining([
        expect.objectContaining({ id: snapshot.body.snapshot.id }),
      ]),
    });
    const reconciliation = await request(app)
      .get("/api/mcp/tools/get_source_reconciliation?indicatorId=cpi-us")
      .expect(200);
    expect(reconciliation.body).toMatchObject({
      indicatorId: "cpi-us",
      status: "no-mapping",
      evidence: "none",
    });
    expect(reconciliation.body.limitations[1]).toContain(
      "does not authorize automatic fallback",
    );
    const forecastRevision = await request(app)
      .get("/api/mcp/tools/get_forecast_revision_evidence?indicatorId=cpi-us")
      .expect(200);
    expect(forecastRevision.body).toMatchObject({
      timelines: [],
      evidence: "forecast-lifecycle",
    });
    expect(forecastRevision.body.limitations[1]).toContain(
      "No provider-backed",
    );
    await request(app)
      .get("/api/mcp/tools/get_research_run_lineage?runId=not-real")
      .expect(404);
  });

  it("enforces MCP manifest safety invariants for every declared tool", async () => {
    const manifest = await request(app).get("/api/mcp/tools").expect(200);
    expect(manifest.body.tools.length).toBeGreaterThanOrEqual(10);
    for (const tool of manifest.body.tools as Array<{
      name: string;
      method: string;
      path: string;
      input: unknown;
      readOnly: boolean;
      returns: string;
    }>) {
      expect(tool.name).toMatch(/^[a-z][a-z0-9_]+$/);
      expect(tool.method).toBe("GET");
      expect(tool.readOnly).toBe(true);
      expect(tool.input).toBeDefined();
      expect(tool.returns).toBeTruthy();
      expect(tool.path).toMatch(/^\/api\/mcp\/tools\/[a-z0-9_]+$/);
      expect(tool.path).not.toMatch(/\/raw|secret/i);
    }
    expect(manifest.body.boundary).toContain("bounded evidence bundles");
  });

  it("keeps OpenBB sidecar comparison admin-only, bounded and staging-only", async () => {
    const payload = {
      indicatorId: "cpi-us",
      source: "OpenBB/FRED",
      seriesId: "CPIAUCSL",
      sourceUrl: "https://fred.stlouisfed.org/series/CPIAUCSL",
      unit: "%",
      frequency: "Monthly",
      rightsStatus: "review-required",
      observations: [{ date: "2026-01-01", value: 1 }],
    };
    await request(app)
      .post("/api/admin/openbb/compare")
      .send(payload)
      .expect(401);
    const response = await request(app)
      .post("/api/admin/openbb/compare")
      .set("Authorization", "Bearer test-admin")
      .send(payload)
      .expect(200);
    expect(response.body).toMatchObject({
      promotion: "staging-only",
      indicatorId: "cpi-us",
      sidecar: { seriesId: "CPIAUCSL" },
      reviewRunId: expect.any(String),
      persistence: "persisted-staging-review",
      reviewArtifact: {
        schema: "macro-os.openbb-comparison-review",
        version: 1,
        boundary: "staging-only-review-artifact",
        comparison: { indicatorId: "cpi-us" },
      },
    });
    expect(response.body.reviewArtifact.limitations.join(" ")).toContain(
      "does not promote",
    );
    const review = await request(app)
      .get(`/api/research-runs/${response.body.reviewRunId}/openbb-review`)
      .expect(200);
    expect(review.body).toMatchObject({
      evidence: "persisted-staging-review",
      reviewRunId: response.body.reviewRunId,
      reviewArtifact: {
        schema: "macro-os.openbb-comparison-review",
        comparison: { reviewDecision: { status: expect.any(String) } },
      },
    });
    const mcpReview = await request(app)
      .get(
        `/api/mcp/tools/get_openbb_review?runId=${response.body.reviewRunId}`,
      )
      .expect(200);
    expect(mcpReview.body.reviewRunId).toBe(response.body.reviewRunId);
    const exportResponse = await request(app)
      .get(`/api/research-runs/${response.body.reviewRunId}/export`)
      .expect(200);
    expect(exportResponse.body).toMatchObject({
      evidence: "persisted-research-artifact",
      artifact: {
        schema: "macro-os.research-run",
        version: 1,
        fingerprint: expect.stringMatching(/^fnv1a32-/),
        run: { id: response.body.reviewRunId },
      },
    });
    const mcpExport = await request(app)
      .get(`/api/mcp/tools/get_research_run_export?runId=${response.body.reviewRunId}`)
      .expect(200);
    expect(mcpExport.body.artifact.fingerprint).toBe(
      exportResponse.body.artifact.fingerprint,
    );
    const reviewPackage = await request(app)
      .get(
        `/api/research-runs/${response.body.reviewRunId}/openbb-review/export`,
      )
      .expect(200);
    expect(reviewPackage.body).toMatchObject({
      evidence: "persisted-staging-review-package",
      artifact: {
        schema: "macro-os.openbb-review-package",
        boundary: "bounded-persisted-staging-review",
        run: { id: response.body.reviewRunId },
        lineage: { runId: response.body.reviewRunId },
        fingerprint: expect.stringMatching(/^fnv1a32-/),
      },
    });
    const mcpReviewPackage = await request(app)
      .get(
        `/api/mcp/tools/get_openbb_review_export?runId=${response.body.reviewRunId}`,
      )
      .expect(200);
    expect(mcpReviewPackage.body.artifact.fingerprint).toBe(
      reviewPackage.body.artifact.fingerprint,
    );
  });

  it("exposes the same bounded OpenBB review diff through REST and MCP", async () => {
    const base = {
      indicatorId: "cpi-us",
      source: "OpenBB/FRED",
      seriesId: "CPIAUCSL",
      sourceUrl: "https://fred.stlouisfed.org/series/CPIAUCSL",
      unit: "%",
      frequency: "Monthly",
      rightsStatus: "review-required",
      observations: [{ date: "2026-01-01", value: 1 }],
    };
    const first = await request(app)
      .post("/api/admin/openbb/compare")
      .set("Authorization", "Bearer test-admin")
      .send(base)
      .expect(200);
    const second = await request(app)
      .post("/api/admin/openbb/compare")
      .set("Authorization", "Bearer test-admin")
      .send({
        ...base,
        observations: [
          { date: "2026-01-01", value: 2 },
          { date: "2026-02-01", value: 3 },
        ],
      })
      .expect(200);
    const rest = await request(app)
      .get(
        `/api/openbb/reviews/diff?olderRunId=${first.body.reviewRunId}&newerRunId=${second.body.reviewRunId}`,
      )
      .expect(200);
    expect(rest.body).toMatchObject({
      evidence: "persisted-staging-review-diff",
      runIds: { older: first.body.reviewRunId, newer: second.body.reviewRunId },
      diff: { overlap: expect.any(Object), limitations: expect.any(Array) },
      artifact: {
        schema: "macro-os.openbb-review-diff",
        version: 1,
        boundary: "bounded-persisted-staging-review-diff",
      },
    });
    const mcp = await request(app)
      .get(
        `/api/mcp/tools/get_openbb_review_diff?olderRunId=${first.body.reviewRunId}&newerRunId=${second.body.reviewRunId}`,
      )
      .expect(200);
    expect(mcp.body.diff.overlap).toEqual(rest.body.diff.overlap);
    expect(mcp.body.artifact.schema).toBe("macro-os.openbb-review-diff");
    expect(mcp.body.artifact.fingerprint).toBe(rest.body.artifact.fingerprint);
  });

  it("reports OpenBB sidecar readiness as configuration evidence only", async () => {
    const response = await request(app).get("/api/openbb/status").expect(200);
    expect(response.body).toMatchObject({
      evidence: "configuration",
      sidecar: {
        status: "not-configured",
        runtimeEvidence: "not-probed",
        promotion: "staging-only",
      },
    });
    const mcp = await request(app)
      .get("/api/mcp/tools/get_openbb_sidecar_status")
      .expect(200);
    expect(mcp.body).toMatchObject({
      evidence: "configuration",
      sidecar: { status: "not-configured", runtimeEvidence: "not-probed" },
    });
  });

  it("keeps the OpenBB pilot-gate decision parity and staging boundary explicit", async () => {
    const rest = await request(app).get("/api/openbb/pilot-gate").expect(200);
    const mcp = await request(app)
      .get("/api/mcp/tools/get_openbb_pilot_gate")
      .expect(200);
    expect(rest.body).toMatchObject({
      decision: "pilot-gate-pending",
      evidence: "configuration-and-staging-review",
      checks: {
        runtimeProbe: "not-probed",
        comparisonReview: "blocked",
        promotion: "staging-only",
      },
      reasonCodes: expect.arrayContaining([
        "runtime-not-probed",
        "comparison-blocked",
      ]),
    });
    expect(mcp.body).toEqual(rest.body);
    const exportResponse = await request(app)
      .get("/api/openbb/pilot-gate/export")
      .expect(200);
    const mcpExport = await request(app)
      .get("/api/mcp/tools/get_openbb_pilot_gate_export")
      .expect(200);
    expect(exportResponse.body.artifact).toMatchObject({
      schema: "macro-os.openbb-pilot-gate",
      fingerprint: expect.stringMatching(/^fnv1a32-/),
      report: { decision: rest.body.decision },
    });
    expect(mcpExport.body.artifact.fingerprint).toBe(
      exportResponse.body.artifact.fingerprint,
    );
  });

  it("persists reproducible research runs with their evidence inputs", async () => {
    const created = await request(app)
      .post("/api/admin/research-runs")
      .set("Authorization", "Bearer test-admin")
      .send({
        title: "CPI review",
        question: "What changed?",
        indicatorIds: ["cpi-us"],
        sourceVintages: [
          {
            indicatorId: "cpi-us",
            sourceSeriesId: "CPIAUCSL",
            vintage: "2026-08-05T00:00:00Z",
          },
        ],
        dateRange: { start: "2020-01-01", end: "2026-08-01" },
        transformations: ["yoy"],
        calculation: { method: "latest-change", version: "1" },
        output: { change: 0.2 },
        evidence: [
          {
            indicatorId: "cpi-us",
            sourceUrl: "https://fred.stlouisfed.org/series/CPIAUCSL",
            periods: ["2026-08-01"],
          },
        ],
        limitations: ["No causal conclusion"],
      })
      .expect(201);
    const listed = await request(app)
      .get("/api/research-runs?indicatorId=cpi-us")
      .expect(200);
    expect(listed.body.pagination).toMatchObject({
      limit: 50,
      offset: 0,
      hasMore: false,
      nextOffset: null,
    });
    expect(listed.body.runs[0]).toMatchObject({
      id: created.body.id,
      title: "CPI review",
      indicatorIds: ["cpi-us"],
    });
    expect(listed.body.runs[0].evidence[0].sourceUrl).toContain(
      "fred.stlouisfed.org",
    );
    const mcpRuns = await request(app)
      .get("/api/mcp/tools/get_research_runs?indicatorId=cpi-us&limit=1")
      .expect(200);
    expect(mcpRuns.body).toMatchObject({
      pagination: { limit: 1, offset: 0 },
      filters: { indicatorId: "cpi-us" },
    });
    const filtered = await request(app)
      .get(
        "/api/research-runs?indicatorId=cpi-us&calculationMethod=latest-change&limit=1&offset=0",
      )
      .expect(200);
    expect(filtered.body).toMatchObject({
      filters: { indicatorId: "cpi-us", calculationMethod: "latest-change" },
      pagination: { limit: 1, offset: 0 },
    });
    const decisionFiltered = await request(app)
      .get(
        "/api/research-runs?calculationMethod=openbb-comparison-review&reviewDecisionStatus=insufficient-evidence&limit=2",
      )
      .expect(200);
    expect(decisionFiltered.body.filters.reviewDecisionStatus).toBe(
      "insufficient-evidence",
    );
    const invalidFilter = await request(app)
      .get("/api/research-runs?reviewDecisionStatus=unknown")
      .expect(400);
    expect(invalidFilter.body).toMatchObject({
      error: "Invalid reviewDecisionStatus",
      allowed: ["ready-for-human-review", "blocked", "insufficient-evidence"],
    });
    const lineage = await request(app)
      .get(`/api/research-runs/${created.body.id}/lineage`)
      .expect(200);
    expect(
      lineage.body.lineage.nodes.some(
        (node: { type: string }) => node.type === "vintage",
      ),
    ).toBe(true);
    expect(
      lineage.body.lineage.edges.some(
        (edge: { relation: string }) => edge.relation === "produces",
      ),
    ).toBe(true);
  });

  it("persists a reproducible comparison run behind admin authentication", async () => {
    await request(app)
      .post("/api/admin/research-runs/comparison")
      .send({
        indicatorIds: ["cpi-us", "gdp-vn"],
        transformation: "pct_change",
        maxLag: 2,
      })
      .expect(401);
    const created = await request(app)
      .post("/api/admin/research-runs/comparison")
      .set("Authorization", "Bearer test-admin")
      .send({
        indicatorIds: ["cpi-us", "gdp-vn"],
        transformation: "pct_change",
        maxLag: 2,
      })
      .expect(201);
    expect(created.body).toMatchObject({
      indicatorIds: ["cpi-us", "gdp-vn"],
      calculation: { method: "evidence-comparison", version: "1" },
      transformations: ["pct_change", "maxLag:2"],
    });
    expect(created.body.output).toHaveProperty("overlap");
  });

  it("rejects research-run writes without admin authentication", async () => {
    await request(app)
      .post("/api/admin/research-runs")
      .send({ title: "x" })
      .expect(401);
  });

  it("returns a bounded failover drill without publishing observations", async () => {
    await request(app)
      .post("/api/admin/provider-failover-drill")
      .send({})
      .expect(401);
    const response = await request(app)
      .post("/api/admin/provider-failover-drill")
      .set("Authorization", "Bearer test-admin")
      .send({
        indicatorId: "cpi-us",
        primaryProviderId: "fred",
        fallbackProviderId: "world-bank",
        primaryStatus: "failed",
        fallbackStatus: "succeeded",
        fallbackFreshness: "fresh",
        fallbackRightsStatus: "public-source",
        semanticParity: true,
        sourceUrlAvailable: true,
      })
      .expect(200);
    expect(response.body).toMatchObject({
      evidence: "drill",
      results: [{ decision: "safe-fallback", publishObservation: false }],
    });
    expect(response.body.results[0]).not.toHaveProperty("value");
  });

  it("returns 404 for an unknown research-run lineage", async () => {
    await request(app).get("/api/research-runs/not-real/lineage").expect(404);
  });

  it("publishes aggregate quality and freshness metadata", async () => {
    const response = await request(app).get("/api/quality").expect(200);
    expect(response.body).toMatchObject({
      observations: 0,
      quarantined: 0,
      runSummary: [],
      freshness: [],
    });
  });

  it("returns an empty, explicit forecast collection until a provider is connected", async () => {
    const response = await request(app).get("/api/forecasts").expect(200);
    expect(response.body).toEqual({ forecasts: [] });
  });

  it("exposes an explicit empty research-memory state", async () => {
    const response = await request(app).get("/api/research-memory").expect(200);
    expect(response.body).toMatchObject({ memory: [], evidence: "none", limitations: expect.any(Array) });
  });

  it("fails closed for unsafe or future macro data query bounds", async () => {
    await request(app).get("/api/macro/route?indicator=CPI%2F..%2Fsecret").expect(503);
    await request(app).get("/api/macro/route?indicator=cpi&lookbackDays=0").expect(503);
  });

  it("requires verified actual evidence before persisting research memory", async () => {
    const payload = {
      predictionId: "forecast-memory-test",
      indicatorId: "cpi-us",
      institution: "Example",
      version: 1,
      targetDate: "2026-09-01",
      predictionValue: 110,
      snapshotValue: 100,
      actualValue: 120,
      actualDate: "2026-09-02",
      actualStatus: "estimated",
      predictionSource: "Example source",
      predictionFingerprint: "forecast-fp",
    };
    await request(app).post("/api/admin/research-memory/evaluate").expect(401);
    await request(app).post("/api/admin/research-memory/evaluate").set("Authorization", "Bearer test-admin").send(payload).expect(409);
    const created = await request(app).post("/api/admin/research-memory/evaluate").set("Authorization", "Bearer test-admin").send({ ...payload, actualStatus: "actual-verified-source-backed" }).expect(201);
    expect(created.body).toMatchObject({ state: "available", memory: { id: "forecast-memory-test:cpi-us:Example:2026-09-01:1", directionCorrect: true } });
    const listed = await request(app).get("/api/research-memory?indicatorId=cpi-us").expect(200);
    expect(listed.body.memory).toHaveLength(1);
    expect(listed.body.memory[0].id).toBe(created.body.memory.id);
  });

  it("protects and bounds batch forecast outcome evaluation", async () => {
    await request(app).post("/api/admin/research-memory/evaluate-batch").send({}).expect(401);
    const response = await request(app).post("/api/admin/research-memory/evaluate-batch").set("Authorization", "Bearer test-admin").send({ forecastIds: [] }).expect(200);
    expect(response.body).toMatchObject({ evaluated: [], evaluatedCount: 0, pending: [], pendingCount: 0, evidence: "exact-target-date-actual-verified" });
  });

  it("explains why an evidence bundle is unavailable", async () => {
    const response = await request(app)
      .get("/api/evidence/indicator/cpi-us")
      .expect(200);
    expect(response.body.availability).toMatchObject({
      status: "unavailable",
      reasonCode: "provider-never-run",
      freshness: "unavailable",
    });
    expect(response.body.availability.nextAction).toContain("ingestion");
  });

  it("includes a descriptive change report in the evidence bundle", async () => {
    const response = await request(app)
      .get("/api/evidence/indicator/cpi-us")
      .expect(200);
    expect(response.body.changes).toMatchObject({
      periodChanges: [],
      vintageChanges: [],
      limitations: expect.arrayContaining([
        expect.stringContaining("causality"),
      ]),
    });
  });

  it("keeps historical eligible rows separate from an ineligible latest row", async () => {
    const { db } = await import("./db.js");
    const now = new Date().toISOString();
    const run = db
      .prepare(
        `INSERT INTO ingestion_runs(indicator_id, source_type, started_at, completed_at, status, observation_count) VALUES (?, ?, ?, ?, 'succeeded', 2)`,
      )
      .run("cpi-us", "test", now, now);
    const insert = db.prepare(
      `INSERT INTO observations(indicator_id, period, vintage, value, status, quality, source_name, source_series_id, unit, frequency, transformation, observed_at, ingested_at, ingestion_run_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    insert.run(
      "cpi-us",
      "2020-01-01",
      now,
      100,
      "actual",
      "verified",
      "FRED",
      "CPIAUCSL",
      "%",
      "Monthly",
      "level",
      "2020-01-01",
      now,
      run.lastInsertRowid,
    );
    insert.run(
      "cpi-us",
      "2099-01-01",
      now,
      200,
      "actual",
      "verified",
      "FRED",
      null,
      "%",
      "Monthly",
      "level",
      "2099-01-01",
      now,
      run.lastInsertRowid,
    );
    try {
      const evidence = await request(app)
        .get("/api/evidence/indicator/cpi-us")
        .expect(200);
      expect(evidence.body.researchEligibility).toMatchObject({
        eligibleObservationCount: 1,
        currentEligibleObservationCount: 0,
        hasVerifiedActual: true,
        hasCurrentEvidence: false,
      });
      expect(evidence.body.availability.freshness).toBe("unavailable");

      const verified = await request(app)
        .get(
          "/api/mcp/tools/get_verified_observations?indicatorId=cpi-us&limit=10",
        )
        .expect(200);
      expect(verified.body).toMatchObject({
        count: 1,
        freshness: "unavailable",
        researchEligibility: {
          eligibleObservationCount: 1,
          currentEligibleObservationCount: 0,
          latestObservationEligible: false,
          operation: "evidence",
          operationSupported: true,
        },
      });

      const commentary = await request(app)
        .get("/api/mcp/tools/get_evidence_commentary?indicatorIds=cpi-us")
        .expect(200);
      expect(commentary.body.records[0]).toMatchObject({
        eligibleObservationCount: 1,
        currentEligibleObservationCount: 0,
        latestObservationEligible: false,
        evidenceState: "historical-eligible",
        currentEvidence: false,
        operationSupported: true,
        operationAvailability: { status: "configuration-supported", operation: "evidence" },
      });
    } finally {
      db.prepare(
        "DELETE FROM observations WHERE indicator_id = ? AND vintage = ?",
      ).run("cpi-us", now);
      db.prepare("DELETE FROM ingestion_runs WHERE id = ?").run(
        run.lastInsertRowid,
      );
    }
  });

  it("bounds comparison evidence to two known indicators", async () => {
    await request(app).get("/api/evidence/compare").expect(400);
    const response = await request(app)
      .get("/api/evidence/compare?indicatorIds=cpi-us,gdp-vn")
      .expect(200);
    expect(response.body.report).toMatchObject({
      indicatorIds: ["cpi-us", "gdp-vn"],
      overlap: { status: "insufficient" },
      relationship: null,
    });
    expect(response.body.limitations[0]).toContain("causality");
    expect(response.body.report.evidenceState).toBe(
      "actual-verified-source-backed",
    );
    expect(response.body.indicators[0]).toHaveProperty("seriesId");
    expect(response.body.indicators[0].operationAvailability).toMatchObject({ operation: "evidence", status: "configuration-supported" });
    expect(response.body.report.operationAvailability["cpi-us"]).toMatchObject({ operation: "evidence" });
  });

  it("accepts bounded comparison transformation and lag parameters", async () => {
    const response = await request(app)
      .get(
        "/api/evidence/compare?indicatorIds=cpi-us,gdp-vn&transformation=pct_change&maxLag=2",
      )
      .expect(200);
    expect(response.body.report.transformation).toBe("pct_change");
    if (response.body.report.relationship)
      expect(response.body.report.relationship.lagSweep).toEqual(
        expect.any(Array),
      );
  });

  it("accepts an optional forecast indicator filter", async () => {
    const response = await request(app)
      .get("/api/forecasts?indicatorId=gdp-us")
      .expect(200);
    expect(response.body).toEqual({ forecasts: [] });
  });

  it("returns explicit pending forecast accuracy until a target-date actual exists", async () => {
    const response = await request(app)
      .get("/api/forecast-accuracy")
      .expect(200);
    expect(response.body).toEqual({ forecasts: [] });
  });

  it("returns an empty forecast summary collection until provider records are connected", async () => {
    const response = await request(app)
      .get("/api/forecast-summaries")
      .expect(200);
    expect(response.body).toEqual({ summaries: [] });
  });

  it("returns an explicit empty forecast revision timeline until provider records are connected", async () => {
    const response = await request(app)
      .get("/api/forecast-revisions")
      .expect(200);
    expect(response.body).toEqual({ timelines: [] });
  });

  it("returns explicit institutional outlook state and validates admin writes", async () => {
    expect(
      (await request(app).get("/api/institutional-outlooks").expect(200)).body,
    ).toEqual({ outlooks: [] });
    await request(app).post("/api/admin/institutional-outlooks").expect(401);
    await request(app)
      .post("/api/admin/institutional-outlooks")
      .set("Authorization", "Bearer test-admin")
      .send({
        indicatorId: "usd-cny",
        country: "CN",
        institution: "Test",
        publicationDate: "2026-03-01",
        targetDate: "2026-12-31",
        midpoint: 6.7,
        rangeLow: 6.6,
        rangeHigh: 6.8,
        thesis: "Test thesis",
        methodology: "Test method",
        sourceName: "Test source",
        sourceUrl: "https://example.com/source.pdf",
      })
      .expect(201);
    expect(
      (
        await request(app)
          .get("/api/institutional-outlooks?indicatorId=usd-cny")
          .expect(200)
      ).body.outlooks,
    ).toHaveLength(1);
  });

  it("exposes an explicit unavailable internal-model report without eligible history", async () => {
    const response = await request(app)
      .get("/api/internal-forecast-model?indicatorId=cpi-us")
      .expect(200);
    expect(response.body.report).toMatchObject({
      status: "unavailable",
      forecastValue: null,
      eligibleObservationCount: 0,
    });
    expect(response.body.operationAvailability).toMatchObject({ operation: "evidence", status: "configuration-supported" });
  });

  it("requires an indicator before evaluating the internal model", async () => {
    await request(app).get("/api/internal-forecast-model").expect(400);
  });

  it("keeps internal-model run persistence behind admin authentication", async () => {
    await request(app)
      .post("/api/admin/internal-forecast-model/cpi-us/run")
      .expect(401);
    const created = await request(app)
      .post("/api/admin/internal-forecast-model/cpi-us/run")
      .set("Authorization", "Bearer test-admin")
      .expect(201);
    expect(created.body).toMatchObject({
      indicatorId: "cpi-us",
      status: "unavailable",
      modelId: "naive-persistence-v1",
    });
    const runs = await request(app)
      .get("/api/model-runs?indicatorId=cpi-us")
      .expect(200);
    expect(runs.body.runs[0]).toMatchObject({
      id: created.body.id,
      indicatorId: "cpi-us",
    });
  });

  it("persists and resumes admin debate checkpoints without exposing an unauthenticated mutation", async () => {
    const payload = { runId: "checkpoint-api-test", sessionId: "session-api-test", inputFingerprint: "input-fp", now: "2026-08-20T00:00:00Z" };
    await request(app).post("/api/admin/debate/checkpoints").send(payload).expect(401);
    const created = await request(app).post("/api/admin/debate/checkpoints").set("Authorization", "Bearer test-admin").send(payload).expect(201);
    expect(created.body.checkpoint).toMatchObject({ runId: payload.runId, state: "created" });
    await request(app).post(`/api/admin/debate/checkpoints/${payload.runId}/advance`).set("Authorization", "Bearer test-admin").send({ from: "created", output: { locked: true } }).expect(200);
    const resumed = await request(app).post(`/api/admin/debate/checkpoints/${payload.runId}/resume`).set("Authorization", "Bearer test-admin").send({ inputFingerprint: payload.inputFingerprint }).expect(200);
    expect(resumed.body.checkpoint).toMatchObject({ state: "evidence_locked", completedNodes: ["evidence"] });
    await request(app).post(`/api/admin/debate/checkpoints/${payload.runId}/resume`).set("Authorization", "Bearer test-admin").send({ inputFingerprint: "wrong" }).expect(409);
  });

  it("keeps the optional LLM debate route fail-closed when no provider is configured", async () => {
    delete process.env.MACRO_LLM_ENDPOINT;
    delete process.env.MACRO_LLM_MODEL;
    const response = await request(app).post("/api/admin/debate/run-llm").set("Authorization", "Bearer test-admin").send({ indicatorId: "cpi-us", predictionValue: 3.2, predictionHorizon: "next month", predictionSource: "Example" }).expect(503);
    expect(response.body).toMatchObject({ code: "LLM_PROVIDER_UNAVAILABLE", backend: "deterministic" });
  });

  it("persists a validated new forecast revision behind admin authentication", async () => {
    const payload = { indicatorId: "cpi-us", country: "US", forecastValue: 3.2, forecastDate: "2026-08-20", targetDate: "2026-09-01", institution: "Revision Test", methodology: "Published survey median", confidence: 0.7, version: 1, status: "consensus", sourceName: "Example Research", sourceUrl: "https://example.com/forecast" };
    await request(app).post("/api/admin/forecasts").send(payload).expect(401);
    const created = await request(app).post("/api/admin/forecasts").set("Authorization", "Bearer test-admin").send(payload).expect(201);
    expect(created.body).toMatchObject({ evidence: "source-backed-metadata-required", sourceGovernance: { state: "review-required", reason: "unknown-source" }, forecast: { indicatorId: "cpi-us", institution: "Revision Test", forecastValue: 3.2 }, debate: { indicatorId: "cpi-us", verdict: { boundary: "bounded-research-opinion" } } });
    const repeated = await request(app).post("/api/admin/forecasts").set("Authorization", "Bearer test-admin").send(payload).expect(201);
    expect(repeated.body.forecast.id).toBe(created.body.forecast.id);
    expect(repeated.body.fingerprint).toBe(created.body.fingerprint);
    const listed = await request(app).get("/api/forecasts").expect(200);
    expect(listed.body.forecasts).toEqual(expect.arrayContaining([expect.objectContaining({ institution: "Revision Test", targetDate: "2026-09-01", version: 1 })]));
    const revisionEvidence = await request(app).get("/api/forecast-revisions?indicatorId=cpi-us").expect(200);
    expect(revisionEvidence.body.timelines).toEqual(expect.arrayContaining([expect.objectContaining({ current: expect.objectContaining({ sourceGovernance: expect.objectContaining({ state: "review-required", reason: "unknown-source" }) }) })]));
    const { db } = await import("./db");
    db.prepare("INSERT INTO ingestion_runs (indicator_id, source_type, started_at, completed_at, status, observation_count) VALUES (?, ?, ?, ?, ?, ?)").run("cpi-us", "test", "2026-08-20T00:00:00Z", "2026-08-20T00:00:01Z", "succeeded", 1);
    const run = db.prepare("SELECT id FROM ingestion_runs ORDER BY id DESC LIMIT 1").get() as { id: number };
    db.prepare("INSERT INTO observations (indicator_id, period, vintage, value, status, quality, source_name, source_series_id, unit, frequency, transformation, observed_at, ingested_at, ingestion_run_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run("cpi-us", "2026-08-01", "2026-08-20T00:00:01Z", 3.1, "actual", "verified", "FRED", "CPIAUCSL", "Index", "Monthly", "level", "2026-08-01", "2026-08-20T00:00:01Z", run.id);
    const debates = await request(app).get("/api/forecast-debates?indicatorId=cpi-us").expect(200);
    expect(debates.body.evidence).toBe("server-deterministic-debate");
    expect(debates.body.debates).toEqual(expect.arrayContaining([expect.objectContaining({ forecastId: created.body.forecast.id, session: expect.objectContaining({ indicatorId: "cpi-us", currentSnapshot: expect.objectContaining({ value: 3.1, date: "2026-08-01" }), eligibleIndicatorIds: expect.arrayContaining(["cpi-us"]), verdict: expect.objectContaining({ boundary: "bounded-research-opinion" }) }) })]));
    const coverage = await request(app).get("/api/forecast-coverage").expect(200);
    expect(coverage.body).toMatchObject({ totalIndicators: 133, coveredIndicators: expect.any(Number), uncoveredIndicators: expect.any(Number), evidence: "persisted-forecast-revisions" });
    expect(coverage.body.coveredIndicators + coverage.body.uncoveredIndicators).toBe(coverage.body.totalIndicators);
    expect(coverage.body.rows).toEqual(expect.arrayContaining([expect.objectContaining({ indicatorId: "cpi-us", covered: true, latest: expect.objectContaining({ debateAvailable: true }) })]));
    const sourceRegistry = await request(app).get("/api/forecast-sources").expect(200);
    expect(sourceRegistry.body).toMatchObject({ schema: "macro-os.forecast-source-registry", entries: expect.arrayContaining([expect.objectContaining({ sourceId: "macro-os-operator", eligibility: "eligible" })]) });
    const exported = await request(app).get(`/api/forecast-debates/${created.body.forecast.id}/export`).expect(200);
    expect(exported.body.artifact).toMatchObject({ schema: "macro-os.forecast-debate", boundary: "persisted-debate-research-artifact", session: { indicatorId: "cpi-us" } });
    const markdown = await request(app).get(`/api/forecast-debates/${created.body.forecast.id}/export?format=markdown`).expect(200);
    expect(markdown.text).toContain("## Bull Case");
    const persisted = await request(app).get(`/api/debate/session/${created.body.debate.id}/export`).expect(200);
    expect(persisted.body.artifact.session.id).toBe(created.body.debate.id);
    const history = await request(app).get("/api/debate/cpi-us/history").expect(200);
    expect(history.body.sessions).toEqual(expect.arrayContaining([expect.objectContaining({ id: created.body.debate.id })]));
  });

  it("reports managed-storage failures as 503 instead of invalid input", async () => {
    process.env.PRODUCTION_RUNTIME = "true";
    process.env.SUPABASE_URL = "https://storage.example.test";
    process.env.SUPABASE_SECRET_KEY = "test-secret";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("provider unavailable"));
    const payload = { indicatorId: "cpi-us", country: "US", forecastValue: 3.2, forecastDate: "2026-08-20", targetDate: "2026-12-01", institution: "Storage Failure Test", methodology: "Published survey median", confidence: 0.7, version: 1, status: "consensus", sourceName: "Example Research", sourceUrl: "https://example.com/forecast" };
    const response = await request(app).post("/api/admin/forecasts").set("Authorization", "Bearer test-admin").send(payload).expect(503);
    expect(response.body).toMatchObject({ error: "Managed storage unavailable", code: "MANAGED_STORAGE_UNAVAILABLE", diagnosticCode: "unavailable" });
  });

  it("validates the complete forecast batch before persisting any item", async () => {
    const base = { indicatorId: "cpi-us", country: "US", forecastValue: 3.2, forecastDate: "2026-08-20", targetDate: "2026-10-01", institution: "Batch Test", methodology: "Survey", confidence: 0.6, version: 1, status: "consensus", sourceName: "Example", sourceUrl: "https://example.com/batch" };
    await request(app).post("/api/admin/forecasts/batch").set("Authorization", "Bearer test-admin").send({ forecasts: [base, { ...base, indicatorId: "not-in-catalog" }] }).expect(400);
    const absent = await request(app).get("/api/forecasts?indicatorId=not-in-catalog").expect(200);
    expect(absent.body.forecasts).toEqual([]);
    const created = await request(app).post("/api/admin/forecasts/batch").set("Authorization", "Bearer test-admin").send({ forecasts: [base, { ...base, institution: "Batch Test 2" }] }).expect(201);
    expect(created.body.count).toBe(2);
    expect(created.body.forecasts).toHaveLength(2);
    expect(created.body.forecasts.some((item: { forecast?: { institution?: string }; debate?: { indicatorId?: string }; sourceGovernance?: { state?: string; reason?: string } }) => item.forecast?.institution === "Batch Test" && item.debate?.indicatorId === "cpi-us" && item.sourceGovernance?.state === "review-required" && item.sourceGovernance?.reason === "unknown-source")).toBe(true);
  });

  it("rolls back the complete local forecast batch when a write fails", async () => {
    const { createForecastBatch, listForecasts } = await import("./db");
    const { buildForecastRevision } = await import("./forecastInput");
    const base = { indicatorId: "cpi-us", country: "US", forecastValue: 3.4, forecastDate: "2026-08-20", targetDate: "2026-11-01", institution: "Rollback Test", analyst: null, methodology: "Survey", confidence: 0.6, version: 1, status: "consensus" as const, sourceName: "Example", sourceUrl: "https://example.com/rollback" };
    const first = buildForecastRevision(base);
    const invalid = { ...buildForecastRevision({ ...base, institution: "Rollback Test 2" }), status: "invalid" };
    expect(() => createForecastBatch([first, invalid as never])).toThrow();
    expect(listForecasts("cpi-us")).not.toEqual(expect.arrayContaining([expect.objectContaining({ institution: "Rollback Test" }), expect.objectContaining({ institution: "Rollback Test 2" })]));
  });

  it("feeds verified research memory into a new LLM review and reports its bounded context", async () => {
    const payload = {
      predictionId: "prompt-memory-test",
      indicatorId: "cpi-us",
      institution: "Example",
      version: 1,
      targetDate: "2026-09-01",
      predictionValue: 110,
      snapshotValue: 100,
      actualValue: 120,
      actualDate: "2026-09-02",
      actualStatus: "actual-verified-source-backed",
      predictionSource: "Example source",
      predictionFingerprint: "prompt-memory-fp",
    };
    await request(app).post("/api/admin/research-memory/evaluate").set("Authorization", "Bearer test-admin").send(payload).expect(201);
    process.env.MACRO_LLM_ENDPOINT = "https://llm.example.test";
    process.env.MACRO_LLM_MODEL = "test-model";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      const requestBody = JSON.parse(String(init?.body));
      const role = requestBody.messages[1].content.match(/"role":"(bull|bear|risk)"/)?.[1] ?? "bull";
      expect(requestBody.messages[1].content).toContain("prompt-memory-test:cpi-us:Example:2026-09-01:1");
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ role, thesis: `${role} thesis`, bullets: [], strength: "weak", limitation: "bounded" }) } }] }), { status: 200 });
    });
    const response = await request(app).post("/api/admin/debate/run-llm").set("Authorization", "Bearer test-admin").send({ indicatorId: "cpi-us", predictionValue: 3.2, predictionHorizon: "next month", predictionSource: "Example" }).expect(201);
    expect(response.body.researchMemory).toMatchObject({ evidence: "actual-verified-source-backed" });
    expect(response.body.researchMemory.itemCount).toBeGreaterThanOrEqual(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    fetchMock.mockRestore();
  });

  it("bounds batch LLM review and fails closed before provider calls", async () => {
    const oversized = Array.from({ length: 11 }, () => ({ indicatorId: "cpi-us", predictionValue: 3.2, predictionHorizon: "next month", predictionSource: "Example" }));
    await request(app)
      .post("/api/admin/debate/run-llm-batch")
      .set("Authorization", "Bearer test-admin")
      .send({ items: oversized })
      .expect(400);
    const unavailable = await request(app)
      .post("/api/admin/debate/run-llm-batch")
      .set("Authorization", "Bearer test-admin")
      .send({ items: [{ indicatorId: "cpi-us", predictionValue: 3.2, predictionHorizon: "next month", predictionSource: "Example" }] })
      .expect(503);
    expect(unavailable.body).toMatchObject({ code: "LLM_PROVIDER_UNAVAILABLE", backend: "deterministic" });
  });

  it("protects ingestion and alert mutations", async () => {
    await request(app).post("/api/admin/ingest/cpi-us").expect(401);
    await request(app)
      .post("/api/admin/alerts")
      .send({ indicatorId: "cpi-us", condition: "above", threshold: 5 })
      .expect(401);
    await request(app)
      .patch("/api/admin/alerts/example")
      .send({ active: false })
      .expect(401);
    await request(app)
      .post("/api/admin/alert-events/1/acknowledge")
      .expect(401);
  });

  it("protects ingestion-job diagnostics", async () => {
    await request(app).get("/api/admin/ingestion-jobs").expect(401);
    const response = await request(app)
      .get("/api/admin/ingestion-jobs")
      .set("Authorization", "Bearer test-admin")
      .expect(200);
    expect(response.body).toHaveProperty("jobs");
  });

  it("exposes a bounded admin ingestion batch contract", async () => {
    await request(app)
      .post("/api/admin/ingest-batch")
      .send({ indicatorIds: ["cpi-us"] })
      .expect(401);
    await request(app)
      .post("/api/admin/ingest-batch")
      .set("Authorization", "Bearer test-admin")
      .send({ indicatorIds: "cpi-us" })
      .expect(400);
    const response = await request(app)
      .post("/api/admin/ingest-batch")
      .set("Authorization", "Bearer test-admin")
      .send({
        indicatorIds: Array.from(
          { length: 21 },
          (_, index) => `indicator-${index}`,
        ),
      })
      .expect(400);
    expect(response.body.error).toContain("maximum batch size of 20");
  });

  it("persists fallback reviews behind admin authentication", async () => {
    const payload = {
      indicatorId: "cpi-us",
      primaryIndicatorId: "cpi-us",
      fallbackIndicatorId: "core-cpi-us",
      decision: "approved",
      reviewer: "owner@example.test",
      rationale: "Bounded review evidence",
      evidence: [{ kind: "rights", reference: "https://example.test/rights" }],
    };
    await request(app)
      .post("/api/admin/fallback-reviews")
      .send(payload)
      .expect(401);
    const created = await request(app)
      .post("/api/admin/fallback-reviews")
      .set("Authorization", "Bearer test-admin")
      .send(payload)
      .expect(201);
    expect(created.body.output).toMatchObject({
      schema: "macro-os.provider-fallback-review",
      automaticFallback: false,
      decision: "approved",
    });
    const listed = await request(app)
      .get("/api/admin/fallback-reviews")
      .set("Authorization", "Bearer test-admin")
      .expect(200);
    expect(listed.body.reviews).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.body.id,
          calculation: { method: "provider-fallback-review", version: "1" },
        }),
      ]),
    );
  });

  it("reads ingestion-job diagnostics from Supabase in durable runtime", async () => {
    const previousRuntime = process.env.PRODUCTION_RUNTIME;
    const previousUrl = process.env.SUPABASE_URL;
    const previousKey = process.env.SUPABASE_SECRET_KEY;
    process.env.PRODUCTION_RUNTIME = "true";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "test-secret";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify([
            { id: "job-1", indicatorId: "cpi-us", status: "claimed" },
          ]),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    try {
      const response = await request(app)
        .get("/api/admin/ingestion-jobs")
        .set("Authorization", "Bearer test-admin")
        .expect(200);
      expect(response.body.jobs).toEqual([
        { id: "job-1", indicatorId: "cpi-us", status: "claimed" },
      ]);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/rest/v1/ingestion_jobs?"),
        expect.any(Object),
      );
    } finally {
      fetchMock.mockRestore();
      if (previousRuntime === undefined) delete process.env.PRODUCTION_RUNTIME;
      else process.env.PRODUCTION_RUNTIME = previousRuntime;
      if (previousUrl === undefined) delete process.env.SUPABASE_URL;
      else process.env.SUPABASE_URL = previousUrl;
      if (previousKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
      else process.env.SUPABASE_SECRET_KEY = previousKey;
    }
  });

  it("exposes bounded scheduler metrics with runtime limitations", async () => {
    const response = await request(app)
      .get("/api/ingestion-metrics")
      .expect(200);
    expect(response.body).toMatchObject({
      runtime: {
        evidence: "runtime-scheduler",
        counters: { runs: 0 },
        limitations: expect.arrayContaining([
          expect.stringContaining("process-local"),
        ]),
      },
      persisted: {
        evidence: "persisted-ingestion-jobs",
        counters: { jobs: expect.any(Number) },
      },
    });
  });

  it("protects the scheduled ingestion trigger and fails closed without configured ids", async () => {
    await request(app).post("/api/cron/ingest").expect(401);
    process.env.CRON_SECRET = "test-cron-secret";
    const response = await request(app)
      .post("/api/cron/ingest")
      .set("Authorization", "Bearer test-cron-secret")
      .expect(200);
    delete process.env.CRON_SECRET;
    expect(response.body).toMatchObject({
      skipped: true,
      reason: "no-indicators-configured",
    });
  });

  it("allows authenticated alert policies to be paused and resumed", async () => {
    const created = await request(app)
      .post("/api/admin/alerts")
      .set("Authorization", "Bearer test-admin")
      .send({ indicatorId: "cpi-us", condition: "above", threshold: 5 })
      .expect(201);
    await request(app)
      .patch(`/api/admin/alerts/${created.body.id}`)
      .set("Authorization", "Bearer test-admin")
      .send({ active: false })
      .expect(204);
    const policies = await request(app).get("/api/alerts").expect(200);
    expect(policies.body[0]).toMatchObject({ id: created.body.id, active: 0 });
  });

  it("captures institutional user telemetry and exposes summary & MCP tool", async () => {
    await request(app)
      .post("/api/telemetry/events")
      .send({
        eventType: "indicator_compare",
        sessionId: "sess-integ-1",
        durationMs: 950,
        metadata: { journey: "cross-country-deepdive" },
      })
      .expect(201);

    const summary = await request(app).get("/api/telemetry/summary").expect(200);
    expect(summary.body.totalEvents).toBeGreaterThanOrEqual(1);
    expect(summary.body.eventsByType.indicator_compare).toBeGreaterThanOrEqual(1);
    expect(summary.body.scorecardAdoptionMetric.evidence).toBe("institutional-user-telemetry");

    const mcpToolRes = await request(app)
      .get("/api/mcp/tools/get_user_telemetry_summary")
      .expect(200);
    expect(mcpToolRes.body.metadata.evidence).toBe("institutional-user-telemetry");
  });

  it("exposes Prometheus metrics and OpenTelemetry distributed tracing spans (BACKLOG-011)", async () => {
    // 1. Send an HTTP request with W3C traceparent header
    const traceParentHeader = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
    const res = await request(app)
      .get("/api/health")
      .set("traceparent", traceParentHeader)
      .expect(200);

    expect(res.headers["x-trace-id"]).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
    expect(res.headers["traceparent"]).toMatch(/^00-4bf92f3577b34da6a3ce929d0e0e4736-[0-9a-f]{16}-01$/);

    // 2. Query Prometheus /metrics endpoint
    const metricsRes = await request(app).get("/metrics").expect(200);
    expect(metricsRes.headers["content-type"]).toContain("text/plain");
    expect(metricsRes.text).toContain("# HELP http_requests_total");
    expect(metricsRes.text).toContain("# TYPE http_requests_total counter");
    expect(metricsRes.text).toContain("http_request_duration_ms");
    expect(metricsRes.text).toContain("process_memory_heap_bytes");

    // 3. Query /api/traces endpoint
    const tracesRes = await request(app)
      .get("/api/traces?traceId=4bf92f3577b34da6a3ce929d0e0e4736")
      .expect(200);
    expect(tracesRes.body.evidence).toBe("institutional-opentelemetry-traces");
    expect(tracesRes.body.totalSpans).toBeGreaterThanOrEqual(1);
    expect(tracesRes.body.spans[0].traceId).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
  });

  it("exposes continuous ingestion poller status and allows manual poll triggers (BACKLOG-012)", async () => {
    const statusRes = await request(app).get("/api/poller/status").expect(200);
    expect(statusRes.body.summary).toBeDefined();
    expect(statusRes.body.summary.totalConfigured).toBeGreaterThan(0);
    expect(statusRes.body.indicators).toBeInstanceOf(Array);

    const mcpStatusRes = await request(app).get("/api/mcp/tools/get_poller_status").expect(200);
    expect(mcpStatusRes.body.summary).toBeDefined();

    const triggerRes = await request(app)
      .post("/api/poller/trigger")
      .send({ indicatorIds: ["cpi-us"] })
      .expect(200);
    expect(triggerRes.body.cycleId).toBeDefined();
    expect(triggerRes.body.totalConfigured).toBe(1);
  });

  it("exposes the persisted legacy backlog through the company read model", async () => {
    const response = await request(app).get("/api/company/backlog?projectId=macro-os").expect(200);
    expect(response.body.evidence).toBe("persisted-ai-company-backlog-ledger");
    expect(response.body.summary.open).toBeGreaterThan(0);
    expect(response.body.summary.byPriority.P0).toBeGreaterThan(0);
    expect(response.body.items[0]).toEqual(expect.objectContaining({ backlog_id: expect.any(String), priority: expect.stringMatching(/^P[0-3]$/), owner_role: expect.any(String) }));
  });

  it("exposes the scored opportunity portfolio without inventing scores", async () => {
    const response = await request(app).get("/api/company/opportunities?projectId=macro-os").expect(200);
    expect(response.body).toMatchObject({ evidence: "scored-opportunity-portfolio", opportunities: expect.any(Array), summary: { total: expect.any(Number), scored: expect.any(Number), unscored: expect.any(Number) } });
  });

  it("exposes the role work queue read model", async () => {
    const response = await request(app).get("/api/company/work-queue?projectId=macro-os").expect(200);
    expect(response.body).toMatchObject({ evidence: "persisted-role-work-queue", items: expect.any(Array), summary: { total: expect.any(Number), byState: expect.any(Object) } });
  });

  it("protects the on-demand company cycle control plane", async () => {
    await request(app).post("/api/admin/company/tick").expect(401);
    const runtime = await request(app).get("/api/company/runtime").expect(200);
    expect(runtime.body.evidence).toBe("in-process-company-supervisor");
    await request(app).post("/api/admin/company/tick").set("Authorization", "Bearer test-admin").expect(503);
  });

  it("exposes the latest read-only operating audit without authorizing production", async () => {
    const response = await request(app).get("/api/company/operating-audit").expect(200);
    expect(response.body).toMatchObject({ evidence: "ai-company-operating-model-audit-read-model", status: "PASS", production_ready: false, checks: expect.any(Array) });
    const mcp = await request(app).get("/api/mcp/tools/get_company_operating_audit").expect(200);
    expect(mcp.body).toMatchObject({ evidence: "ai-company-operating-model-audit-read-model", status: "PASS", production_ready: false });
  });

  it("requires PM disposition before turning observed usage into backlog", async () => {
    await request(app).post("/api/telemetry/events").send([
      { eventType: "indicator_compare", sessionId: "insight-test-1" },
      { eventType: "indicator_compare", sessionId: "insight-test-2" },
      { eventType: "indicator_compare", sessionId: "insight-test-3" },
    ]).expect(200);
    await request(app).post("/api/admin/company/user-insight-decisions").send({ insight_id: "USAGE-indicator_compare", action: "ACCEPT", rationale: "PM validates this as a discovery hypothesis" }).expect(401);
    const accepted = await request(app).post("/api/admin/company/user-insight-decisions").set("Authorization", "Bearer test-admin").send({ insight_id: "USAGE-indicator_compare", action: "ACCEPT", rationale: "PM validates this as a discovery hypothesis" }).expect(201);
    expect(accepted.body).toMatchObject({ evidence: "pm-disposed-user-insight", backlog_created: expect.any(Boolean), decision: { actor_role: "pm", action: "ACCEPT" } });
  });
});
