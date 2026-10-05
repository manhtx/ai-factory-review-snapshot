import { freshnessSlo, freshnessStatus } from "./freshness.js";
import { deterministicFingerprint } from "../src/app/data/deterministicFingerprint.js";

export type SidecarObservation = { date: string; value: number; vintage?: string | null };
export type SidecarRuntimeMeasurement = { observedAt: string; latestObservationDate: string | null; latencyMs: number };
export type OpenBBSidecarStatus = { configured: boolean; status: "not-configured" | "staging-configured" | "pilot-gate-pending"; endpointConfigured: boolean; rightsReviewRecorded: boolean; runtimeEvidence: "not-probed"; promotion: "staging-only"; limitations: string[] };

export function buildOpenBBSidecarStatus(env: Record<string, string | undefined> = process.env): OpenBBSidecarStatus {
  const endpointConfigured = Boolean(env.OPENBB_SIDECAR_URL?.trim());
  const rightsReviewRecorded = env.OPENBB_RIGHTS_REVIEWED === "true";
  const configured = endpointConfigured;
  return {
    configured,
    status: !configured ? "not-configured" : rightsReviewRecorded ? "staging-configured" : "pilot-gate-pending",
    endpointConfigured,
    rightsReviewRecorded,
    runtimeEvidence: "not-probed",
    promotion: "staging-only",
    limitations: ["The status contract does not probe or install an OpenBB runtime.", "OpenBB licensing, provider terms and deployment isolation require external review.", "Sidecar output cannot be promoted to Macro OS observations through this status surface."],
  };
}

export type OpenBBPilotGateReport = {
  decision: "pilot-gate-pending" | "retain-isolated-sidecar";
  checks: {
    endpointConfigured: boolean;
    rightsReviewRecorded: boolean;
    runtimeProbe: "not-probed" | "reachable" | "unreachable";
    comparisonReview: "not-run" | "reviewable" | "blocked";
    promotion: "staging-only";
  };
  reasonCodes: Array<"endpoint-not-configured" | "rights-review-missing" | "runtime-not-probed" | "comparison-not-run" | "comparison-blocked">;
  nextActions: string[];
  evidence: "configuration-and-staging-review";
  limitations: string[];
};

export type OpenBBPilotGateArtifact = {
  schema: "macro-os.openbb-pilot-gate";
  version: 1;
  exportedAt: string;
  fingerprint: string;
  boundary: "bounded-staging-governance-report";
  report: OpenBBPilotGateReport;
  limitations: string[];
};

export function buildOpenBBPilotGateArtifact(
  report: OpenBBPilotGateReport,
  exportedAt = new Date().toISOString(),
): OpenBBPilotGateArtifact {
  const boundedReport: OpenBBPilotGateReport = {
    ...report,
    checks: { ...report.checks },
    reasonCodes: [...report.reasonCodes],
    nextActions: [...report.nextActions],
    limitations: [...report.limitations],
  };
  const limitations = [
    "This artifact contains bounded pilot-gate governance evidence; it does not install, probe or promote OpenBB data.",
    ...boundedReport.limitations,
  ];
  return {
    schema: "macro-os.openbb-pilot-gate",
    version: 1,
    exportedAt,
    fingerprint: deterministicFingerprint({ report: boundedReport, boundary: "bounded-staging-governance-report", limitations }),
    boundary: "bounded-staging-governance-report",
    report: boundedReport,
    limitations,
  };
}

export function buildOpenBBPilotGateReport(input: {
  endpointConfigured: boolean;
  rightsReviewRecorded?: boolean;
  runtimeProbe?: "not-probed" | "reachable" | "unreachable";
  comparisonReview?: "not-run" | "reviewable" | "blocked";
}): OpenBBPilotGateReport {
  const runtimeProbe = input.runtimeProbe ?? "not-probed";
  const comparisonReview = input.comparisonReview ?? "not-run";
  const reasonCodes: OpenBBPilotGateReport["reasonCodes"] = [];
  const nextActions: string[] = [];
  if (!input.endpointConfigured) {
    reasonCodes.push("endpoint-not-configured");
    nextActions.push("Configure an isolated staging sidecar endpoint before running a pilot probe.");
  }
  if (!input.rightsReviewRecorded) {
    reasonCodes.push("rights-review-missing");
    nextActions.push("Record provider terms, licensing and redistribution review for the intended connectors.");
  }
  if (runtimeProbe === "not-probed") {
    reasonCodes.push("runtime-not-probed");
    nextActions.push("Run and retain a bounded staging runtime probe with observed-at and latency evidence.");
  }
  if (comparisonReview === "not-run") {
    reasonCodes.push("comparison-not-run");
    nextActions.push("Run a bounded comparison review with overlap, semantics, freshness and revision evidence.");
  } else if (comparisonReview === "blocked") {
    reasonCodes.push("comparison-blocked");
    nextActions.push("Resolve the comparison review blockers before deciding whether the sidecar is useful.");
  }
  const ready = reasonCodes.length === 0 && runtimeProbe === "reachable" && comparisonReview === "reviewable";
  return {
    decision: ready ? "retain-isolated-sidecar" : "pilot-gate-pending",
    checks: { endpointConfigured: input.endpointConfigured, rightsReviewRecorded: Boolean(input.rightsReviewRecorded), runtimeProbe, comparisonReview, promotion: "staging-only" },
    reasonCodes,
    nextActions: nextActions.length > 0 ? nextActions : ["Retain the sidecar as an isolated staging connector; promotion, fallback and provider substitution remain disallowed."],
    evidence: "configuration-and-staging-review",
    limitations: ["This report does not install, probe or reach an OpenBB runtime.", "Configuration and a recorded rights review do not prove licensing approval or data correctness.", "A positive pilot gate only supports retaining an isolated sidecar for further human-reviewed testing; it does not authorize production promotion, fallback or replacement of canonical Macro OS data."],
  };
}

export function getOpenBBComparisonReviewState(run: unknown): "not-run" | "reviewable" | "blocked" {
  const record = run as { calculation?: { method?: unknown }; output?: { comparison?: { reviewability?: { status?: unknown } } } } | null;
  if (!record || record.calculation?.method !== "openbb-comparison-review") return "not-run";
  return record.output?.comparison?.reviewability?.status === "reviewable" ? "reviewable" : "blocked";
}

export type OpenBBSidecarPayload = {
  indicatorId: string;
  source: string;
  seriesId: string;
  sourceUrl: string;
  unit: string;
  frequency: string;
  rightsStatus: "public-source" | "review-required" | "manual-review";
  observations: SidecarObservation[];
  runtime?: SidecarRuntimeMeasurement;
};

export type OpenBBReviewDecision = {
  status: "ready-for-human-review" | "blocked" | "insufficient-evidence";
  reasonCodes: Array<"no-overlapping-periods" | "freshness-unavailable" | "freshness-not-measured" | "latency-not-measured" | "semantics-not-validated">;
  nextActions: string[];
  limitation: string;
};

export function buildOpenBBComparisonAudit(payload: OpenBBSidecarPayload, freshness: ReturnType<typeof freshnessStatus>, revisedPeriodCount: number) {
  return {
    semantics: { status: "validated-at-boundary" as const, unit: payload.unit, frequency: payload.frequency, seriesId: payload.seriesId },
    revisions: { status: payload.observations.some((row) => row.vintage) ? "versioned" as const : "not-provided" as const, revisedPeriodCount },
    freshness: { status: freshness, measured: Boolean(payload.runtime?.latestObservationDate), latestObservationDate: payload.runtime?.latestObservationDate ?? null },
    rights: { status: payload.rightsStatus === "public-source" ? "classified-public-source" as const : "review-required" as const, classification: payload.rightsStatus },
    operationalCost: { status: payload.runtime ? "measured" as const : "not-measured" as const, latencyMs: payload.runtime?.latencyMs ?? null },
    limitations: ["Boundary validation confirms declared unit/frequency/provenance shape; it does not prove economic semantic equivalence.", "Rights classification is not legal approval or redistribution permission.", "Latency is a single runtime measurement, not a service-level objective or cost estimate."],
  };
}

export function buildOpenBBReviewDecision(input: {
  overlapCount: number;
  semanticsStatus: "validated-at-boundary" | "not-validated";
  freshness: ReturnType<typeof freshnessStatus>;
  latencyMeasured: boolean;
}): OpenBBReviewDecision {
  const reasonCodes: OpenBBReviewDecision["reasonCodes"] = [];
  const nextActions: string[] = [];
  if (input.overlapCount === 0) {
    reasonCodes.push("no-overlapping-periods");
    nextActions.push("Align the provider calendars or supply a comparable sample before review.");
  }
  if (input.semanticsStatus !== "validated-at-boundary") {
    reasonCodes.push("semantics-not-validated");
    nextActions.push("Validate unit, frequency, series identity and transformation metadata.");
  }
  if (input.freshness === "unavailable") {
    reasonCodes.push("freshness-unavailable");
    nextActions.push("Record the sidecar's latest observation date and probe time.");
  }
  if (!input.latencyMeasured) {
    reasonCodes.push("latency-not-measured");
    nextActions.push("Record bounded runtime latency for operational comparison.");
  }
  const blocking = reasonCodes.includes("no-overlapping-periods") || reasonCodes.includes("semantics-not-validated");
  const insufficient = reasonCodes.some((reason) => ["freshness-unavailable", "freshness-not-measured", "latency-not-measured"].includes(reason));
  return {
    status: blocking ? "blocked" : insufficient ? "insufficient-evidence" : "ready-for-human-review",
    reasonCodes,
    nextActions: nextActions.length > 0 ? nextActions : ["Review semantic parity, revisions, rights and provider terms manually; no promotion follows from this status."],
    limitation: "This is a review-readiness projection, not a correctness ranking, legal approval, production eligibility decision or automatic fallback authorization.",
  };
}

export function validateOpenBBSidecarPayload(input: unknown, expectedIndicatorId: string, expectedUnit?: string | null, expectedFrequency?: string | null): string[] {
  const payload = input as Partial<OpenBBSidecarPayload> | null;
  const issues: string[] = [];
  if (!payload || typeof payload !== "object") return ["payload must be an object"];
  if (payload.indicatorId !== expectedIndicatorId) issues.push("indicatorId does not match the requested Macro OS indicator");
  for (const field of ["source", "seriesId", "sourceUrl", "unit", "frequency", "rightsStatus"] as const) if (typeof payload[field] !== "string" || !payload[field]?.trim()) issues.push(`${field} is required`);
  if (payload.rightsStatus && !["public-source", "review-required", "manual-review"].includes(payload.rightsStatus)) issues.push("rightsStatus is invalid");
  if (typeof payload.sourceUrl === "string" && !/^https?:\/\//.test(payload.sourceUrl)) issues.push("sourceUrl must be an http(s) URL");
  if (expectedUnit && payload.unit !== expectedUnit) issues.push("unit mismatch");
  if (expectedFrequency && payload.frequency !== expectedFrequency) issues.push("frequency mismatch");
  if (payload.runtime != null) {
    if (typeof payload.runtime !== "object" || typeof payload.runtime.observedAt !== "string" || Number.isNaN(Date.parse(payload.runtime.observedAt))) issues.push("runtime.observedAt must be a valid date");
    if (payload.runtime.latestObservationDate != null && (typeof payload.runtime.latestObservationDate !== "string" || Number.isNaN(Date.parse(payload.runtime.latestObservationDate)))) issues.push("runtime.latestObservationDate must be a valid date");
    if (typeof payload.runtime.latencyMs !== "number" || !Number.isFinite(payload.runtime.latencyMs) || payload.runtime.latencyMs < 0) issues.push("runtime.latencyMs must be a non-negative finite number");
  }
  if (!Array.isArray(payload.observations) || payload.observations.length > 10000) issues.push("observations must be an array of at most 10000 rows");
  const observations = Array.isArray(payload.observations) ? payload.observations : [];
  const dates = observations.map((row) => row?.date);
  if (dates.some((date) => typeof date !== "string" || Number.isNaN(Date.parse(date)))) issues.push("all observation dates must be valid dates");
  if (observations.some((row) => typeof row?.value !== "number" || !Number.isFinite(row.value))) issues.push("all observation values must be finite numbers");
  const duplicateDates = new Set(dates.filter((date, index) => dates.indexOf(date) !== index));
  if ([...duplicateDates].some((date) => observations.filter((row) => row?.date === date).some((row) => typeof row?.vintage !== "string" || !row.vintage.trim()))) issues.push("duplicate observation periods require a vintage on every revision");
  const revisionKeys = observations.map((row) => `${row?.date}|${row?.vintage ?? ""}`);
  if (new Set(revisionKeys).size !== revisionKeys.length) issues.push("duplicate observation vintages are not allowed");
  if (observations.some((row) => row?.vintage != null && (typeof row.vintage !== "string" || Number.isNaN(Date.parse(row.vintage))))) issues.push("vintage must be a valid date when provided");
  if (observations.some((row, index) => index > 0 && `${row?.date}|${row?.vintage ?? ""}` <= `${observations[index - 1]?.date}|${observations[index - 1]?.vintage ?? ""}`)) issues.push("observations must be strictly chronological by date and vintage");
  return issues;
}

export function buildOpenBBSidecarComparison(payload: OpenBBSidecarPayload, macroRows: Array<{ date: string; value: number }>) {
  const periodKey = (date: string) => {
    const normalized = payload.frequency.toLowerCase();
    if (normalized.includes("month")) return date.slice(0, 7);
    if (normalized.includes("quarter")) return `${date.slice(0, 4)}-Q${Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1}`;
    if (normalized.includes("annual") || normalized.includes("year")) return date.slice(0, 4);
    return date;
  };
  const macroByPeriod = new Map(macroRows.map((row) => [periodKey(row.date), row]));
  const sidecarByPeriod = new Map<string, SidecarObservation[]>();
  for (const row of payload.observations) sidecarByPeriod.set(periodKey(row.date), [...(sidecarByPeriod.get(periodKey(row.date)) ?? []), row]);
  const latestSidecarByPeriod = new Map([...sidecarByPeriod.entries()].map(([period, rows]) => [period, [...rows].sort((a, b) => String(a.vintage ?? a.date).localeCompare(String(b.vintage ?? b.date))).at(-1)!]));
  const aligned = [...latestSidecarByPeriod.values()].filter((row) => macroByPeriod.has(periodKey(row.date))).map((row) => {
    const macro = macroByPeriod.get(periodKey(row.date))!;
    return { period: periodKey(row.date), sidecarDate: row.date, macroOsDate: macro.date, sidecarValue: row.value, macroOsValue: macro.value, difference: row.value - macro.value };
  });
  const sidecarPeriods = new Set(payload.observations.map((row) => periodKey(row.date)));
  const macroPeriods = new Set(macroRows.map((row) => periodKey(row.date)));
  const revisions = [...sidecarByPeriod.entries()].filter(([, rows]) => rows.length > 1).map(([period, rows]) => ({ period, revisions: rows.map((row) => ({ date: row.date, vintage: row.vintage ?? null, value: row.value })) }));
  const freshness = payload.runtime?.latestObservationDate ? freshnessStatus(payload.runtime.latestObservationDate, payload.frequency) : "unavailable" as const;
  const reviewabilityReasons: string[] = [];
  if (aligned.length === 0) reviewabilityReasons.push("no-overlapping-periods");
  if (freshness === "unavailable") reviewabilityReasons.push("sidecar-latest-observation-unavailable");
  const reviewability = {
    status: reviewabilityReasons.length === 0 ? "reviewable" as const : "blocked" as const,
    reasons: reviewabilityReasons,
    evidence: "staging-comparison-inputs" as const,
    limitation: "Reviewability only means the bounded comparison has enough declared inputs for human inspection; it does not establish source correctness, causality, rights or promotion eligibility.",
  };
  const absoluteDifferences = aligned.map((row) => Math.abs(row.difference)).filter((value) => Number.isFinite(value));
  const discrepancySummary = {
    count: absoluteDifferences.length,
    meanAbsoluteDifference: absoluteDifferences.length === 0 ? null : absoluteDifferences.reduce((sum, value) => sum + value, 0) / absoluteDifferences.length,
    maxAbsoluteDifference: absoluteDifferences.length === 0 ? null : Math.max(...absoluteDifferences),
    evidence: "aligned-descriptive-diagnostic" as const,
    limitation: "Differences are expressed in the declared payload unit and do not identify which source is correct or comparable after unrecorded transformations.",
  };
  const reviewDecision = buildOpenBBReviewDecision({
    overlapCount: aligned.length,
    semanticsStatus: "validated-at-boundary",
    freshness,
    latencyMeasured: payload.runtime != null,
  });
  return {
    promotion: "staging-only" as const,
    indicatorId: payload.indicatorId,
    sidecar: { source: payload.source, seriesId: payload.seriesId, sourceUrl: payload.sourceUrl, unit: payload.unit, frequency: payload.frequency, rightsStatus: payload.rightsStatus, observationCount: payload.observations.length, runtime: payload.runtime ?? null, freshness, freshnessSlo: freshnessSlo(payload.frequency) },
    macroOs: { observationCount: macroRows.length },
    revisions: { revisedPeriodCount: revisions.length, revisedPeriods: revisions },
    comparisonAudit: buildOpenBBComparisonAudit(payload, freshness, revisions.length),
    overlap: { count: aligned.length, first: aligned[0]?.period ?? null, last: aligned.at(-1)?.period ?? null },
    reviewability,
    reviewDecision,
    discrepancySummary,
    aligned,
    missingFromSidecar: macroRows.filter((row) => !sidecarPeriods.has(periodKey(row.date))).map((row) => row.date),
    missingFromMacroOs: payload.observations.filter((row) => !macroPeriods.has(periodKey(row.date))).map((row) => row.date),
    limitations: ["Sidecar output is staging-only and is never promoted to Macro OS observations.", "Difference reports do not establish which source is correct; review semantics, revisions, rights and provider terms separately."],
  };
}
