import { execFileSync } from "node:child_process";
import fs from "node:fs";

const baseUrl = (process.env.AUDIT_BASE_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const useVercelProtectionBypass = process.env.AUDIT_VERCEL_PROTECTED === "true";
const failures = [];

function persistAudit(result) {
  const serialized = JSON.stringify(result, null, 2);
  console.log(serialized);
  const outputFile = process.env.AUDIT_JSON_FILE;
  if (outputFile) fs.writeFileSync(outputFile, `${serialized}\n`, "utf8");
  if (process.env.AUDIT_DISABLE_ARTIFACT !== "true") {
    const stamp = new Date().toISOString().replaceAll(':', '').replaceAll('.', '');
    const dir = process.env.AUDIT_ARTIFACT_DIR ?? ".ai-company/reports";
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(`${dir}/real-data-audit-${stamp}.json`, `${serialized}\n`, "utf8");
  }
  return serialized;
}

async function getJson(path) {
  try {
    if (useVercelProtectionBypass) {
      const output = execFileSync("npx", ["--yes", "vercel@58.0.0", "curl", "-s", `${baseUrl}${path}`, "--protection-bypass"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      return JSON.parse(output);
    }
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      let body = null;
      try { body = await response.json(); } catch { /* keep bounded diagnostic */ }
      failures.push({ path, status: response.status, code: body?.code ?? null, error: body?.error ?? `HTTP ${response.status}` });
      return null;
    }
    return response.json();
  } catch (error) {
    failures.push({ path, status: null, code: null, error: String(error).slice(0, 240) });
    return null;
  }
}

const [health, catalog, snapshots, coverage] = await Promise.all([
  getJson("/api/health"),
  getJson("/api/catalog"),
  getJson("/api/snapshots"),
  getJson("/api/coverage/countries"),
]);

if (!health || !catalog || !snapshots || !coverage) {
  const result = {
    baseUrl,
    auditStatus: "blocked",
    failures,
    nextActions: [
      "Resolve the unavailable managed-storage endpoint and rerun this read-only audit.",
      "Do not interpret missing snapshots as zero coverage or replace them with local fallback data.",
    ],
    limitations: ["The audit could not evaluate observation provenance because one or more bounded API reads were unavailable."],
    preflightSummary: {
      LOCAL_BACKEND_CHECK: "FAIL",
      LOCAL_REAL_DATA_AUDIT: "BLOCKED",
      PRODUCTION_PERSISTENCE: "NOT_CONFIGURED",
      PRODUCTION_PREFLIGHT: "NO-GO",
    },
  };
  console.log("\n=== AUDIT PREFLIGHT SUMMARY ===");
  console.log("LOCAL_BACKEND_CHECK: FAIL");
  console.log("LOCAL_REAL_DATA_AUDIT: BLOCKED");
  console.log("PRODUCTION_PERSISTENCE: NOT_CONFIGURED");
  console.log("PRODUCTION_PREFLIGHT: NO-GO");
  console.log("===============================\n");
  persistAudit(result);
  process.exitCode = 1;
} else {

if (process.env.AUDIT_REQUIRE_ATTESTATION === "true" && (!health.runtimeRevision || health.runtimeRevision === "local-unattested")) {
  failures.push({ path: "/api/health", status: null, code: "UNATTESTED_RUNTIME", error: "runtime revision attestation is required" });
}
if (process.env.AUDIT_REQUIRE_SCHEDULER === "true" && (!health.scheduler?.enabled || health.scheduler.indicatorCount < 1)) {
  failures.push({ path: "/api/health", status: null, code: "SCHEDULER_NOT_CONFIGURED", error: "a non-empty enabled ingestion scheduler is required" });
}

const catalogById = new Map(catalog.map((item) => [item.indicatorId, item]));
const violations = [];
let observations = 0;

if (process.env.AUDIT_REQUIRE_DURABLE === "true" && health.durablePersistence !== true) {
  violations.push("runtime is not using durable production persistence");
}
if (process.env.AUDIT_REQUIRE_NO_OPEN_BLOCKERS === "true") {
  const backlog = fs.readFileSync(process.env.AUDIT_BACKLOG_PATH ?? ".ai-company/backlog.jsonl", "utf8")
    .split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  const openBlockers = backlog.filter((item) => item.severity === "blocker" && item.status !== "done");
  if (openBlockers.length > 0) violations.push(`open product blockers: ${openBlockers.length}`);
}

for (const snapshot of snapshots) {
  const catalogItem = catalogById.get(snapshot.indicatorId);
  const operationQuarantined = snapshot.operationAvailability?.status === "configuration-unsupported";
  if (!catalogItem) {
    violations.push(`${snapshot.indicatorId}: snapshot is absent from catalog`);
  }
  if (snapshot.status !== "actual" || snapshot.quality !== "verified") {
    violations.push(`${snapshot.indicatorId}: snapshot state is ${snapshot.status}/${snapshot.quality}`);
  }
  if (!snapshot.sourceName || !snapshot.sourceSeriesId || !catalogItem?.sourceUrl) {
    violations.push(`${snapshot.indicatorId}: snapshot provenance is incomplete`);
  }
  if (!operationQuarantined && (snapshot.operationAvailability?.status !== "configuration-supported" || snapshot.operationAvailability?.operation !== "evidence")) {
    violations.push(`${snapshot.indicatorId}: evidence operation capability is not declared`);
  }

  const payload = await getJson(`/api/series/${encodeURIComponent(snapshot.indicatorId)}?limit=10000`);
  if (!operationQuarantined && (!payload || payload.researchEligibility?.operationSupported !== true)) {
    violations.push(`${snapshot.indicatorId}: series endpoint does not prove evidence-operation eligibility`);
  }
  if (!payload?.series) continue;
  for (const row of payload.series) {
    observations += 1;
    if (row.status !== "actual" || row.quality !== "verified") {
      violations.push(`${snapshot.indicatorId}/${row.date}: row state is ${row.status}/${row.quality}`);
    }
    if (!row.sourceName || !row.sourceSeriesId || !Number.isFinite(row.value)) {
      violations.push(`${snapshot.indicatorId}/${row.date}: row provenance/value is invalid`);
    }
  }
}

const hydratedIds = new Set(snapshots.map((snapshot) => snapshot.indicatorId));
const unhydratedIndicators = catalog
  .filter((item) => !hydratedIds.has(item.indicatorId))
  .map((item) => item.indicatorId);

const result = {
  baseUrl,
  auditStatus: failures.length > 0 || violations.length > 0 ? "blocked" : "pass",
  health: {
    status: health.status,
    database: health.database,
    durablePersistence: health.durablePersistence,
    productionReady: health.productionReady,
    runtimeRevision: health.runtimeRevision ?? "unattested",
    scheduler: health.scheduler ?? { enabled: false, intervalMinutes: null, indicatorCount: 0, indicatorIds: [] },
  },
  catalogIndicators: catalog.length,
  hydratedIndicators: snapshots.length,
  unhydratedIndicators,
  observations,
  freshnessAudit: snapshots.map((snapshot) => ({
    indicatorId: snapshot.indicatorId,
    latestObservedDate: snapshot.date ?? null,
    freshness: snapshot.freshness ?? null,
    freshnessState: snapshot.freshness ?? "unknown",
  })),
  countryCoverage: Array.isArray(coverage.countries)
    ? coverage.countries.map((country) => ({
      country: country.country,
      registered: country.registeredCount,
      hydrated: country.hydratedCount,
      current: country.currentHydratedCount,
      state: country.state,
    }))
    : [],
  violations: violations.length,
  violationDetails: violations.slice(0, 20),
  failures,
};

const localBackendOk = Boolean(health && health.status === "ok");
const nonDurableViolations = violations.filter(v => v !== "runtime is not using durable production persistence" && !v.includes("runtime revision attestation"));
const nonDurableFailures = failures.filter(f => f.code !== "UNATTESTED_RUNTIME");
const localRealDataOk = nonDurableViolations.length === 0 && nonDurableFailures.length === 0;
const durableConfigured = Boolean(health.durablePersistence === true);
// A real-data read can be locally useful while still being unsafe for
// production. Production preflight must remain fail-closed unless the health
// contract explicitly proves durable persistence.
const productionPreflightPass = durableConfigured && failures.length === 0 && violations.length === 0;

result.preflightSummary = {
  LOCAL_BACKEND_CHECK: localBackendOk ? "PASS" : "FAIL",
  LOCAL_REAL_DATA_AUDIT: localRealDataOk ? "PASS" : "FAIL",
  PRODUCTION_PERSISTENCE: durableConfigured ? "CONFIGURED" : "NOT_CONFIGURED",
  PRODUCTION_PREFLIGHT: productionPreflightPass ? "PASS" : "NO-GO",
};

console.log("\n=== AUDIT PREFLIGHT SUMMARY ===");
console.log(`LOCAL_BACKEND_CHECK: ${localBackendOk ? "PASS" : "FAIL"}`);
console.log(`LOCAL_REAL_DATA_AUDIT: ${localRealDataOk ? "PASS" : "FAIL"}`);
console.log(`PRODUCTION_PERSISTENCE: ${durableConfigured ? "CONFIGURED" : "NOT_CONFIGURED"}`);
console.log(`PRODUCTION_PREFLIGHT: ${productionPreflightPass ? "PASS" : "NO-GO"}`);
console.log("===============================\n");

persistAudit(result);

if (violations.length > 0 || failures.length > 0) {
  console.error(violations.slice(0, 20).join("\n"));
  process.exitCode = 1;
}
}
