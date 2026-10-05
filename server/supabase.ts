import { randomUUID } from "node:crypto";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { DATA_SOURCES } from "../src/app/config/dataSources.js";
import type { InstitutionalOutlookInput } from "./institutionalOutlooks.js";
import type { ResearchMemoryRecord } from "./researchMemory.js";
import type { DebateCheckpoint } from "./debateOrchestrator.js";
import type { ForecastRevisionInput } from "./forecastInput.js";
import { selectLatestPerPeriod } from "./observationReadContract.js";

let client: SupabaseClient | null | undefined;

export type SupabaseConnectionErrorCode = "jwt-clock-or-credential" | "authentication" | "dns-or-network" | "unavailable";

export function classifySupabaseConnectionError(error: unknown): SupabaseConnectionErrorCode {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (message.includes("jwt issued at future") || message.includes("jwt") && message.includes("issued")) return "jwt-clock-or-credential";
  if (message.includes("401") || message.includes("403") || message.includes("authentication") || message.includes("unauthorized") || message.includes("forbidden")) return "authentication";
  if (message.includes("enotfound") || message.includes("eai_again") || message.includes("enetwork") || message.includes("enotreachable") || message.includes("could not resolve host") || message.includes("fetch failed")) return "dns-or-network";
  return "unavailable";
}

export function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

export function supabaseRequestTimeoutMs(env: Record<string, string | undefined> = process.env) {
  const configured = Number(env.SUPABASE_REQUEST_TIMEOUT_MS ?? 10_000);
  return Number.isFinite(configured) ? Math.min(60_000, Math.max(1_000, configured)) : 10_000;
}

async function fetchSupabase(input: RequestInfo | URL, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("supabase-request-timeout"), supabaseRequestTimeoutMs());
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`Supabase request timed out after ${supabaseRequestTimeoutMs()}ms`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function getSupabaseAdmin() {
  if (client !== undefined) return client;
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    client = null;
    return client;
  }
  client = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "X-Client-Info": "macro-research-platform-server" }, fetch: fetchSupabase },
  });
  return client;
}

export async function checkSupabaseConnection() {
  const startedAt = Date.now();
  const supabase = getSupabaseAdmin();
  if (!supabase) return { configured: false, connected: false, latencyMs: Date.now() - startedAt, errorCode: "unavailable" as const };
  const { error } = await supabase
    .from("ingestion_runs")
    .select("id", { count: "exact", head: true });
  return {
    configured: true,
    connected: !error,
    latencyMs: Date.now() - startedAt,
    ...(error ? { error: "Managed storage connection failed; inspect the diagnostic code and server logs without exposing credentials.", errorCode: classifySupabaseConnectionError(error) } : {}),
  };
}

/**
 * Read the PostgREST OpenAPI surface to verify that the ingestion claim RPC is
 * exposed without invoking it or creating a claim. This distinguishes a
 * repository migration from an actually deployed RPC.
 */
export async function checkSupabaseIngestionJobRpc() {
  const startedAt = Date.now();
  const requiredPaths = [
    "/rpc/claim_ingestion_job",
    "/rpc/heartbeat_ingestion_job",
    "/rpc/finish_ingestion_job",
  ] as const;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return { configured: false, available: false, missingPaths: [...requiredPaths], latencyMs: Date.now() - startedAt, errorCode: "unavailable" as const };
  try {
    const response = await fetchSupabase(`${url}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/openapi+json" },
    });
    if (!response.ok) {
      const text = await response.text();
      return { configured: true, available: false, missingPaths: [...requiredPaths], latencyMs: Date.now() - startedAt, errorCode: classifySupabaseConnectionError(new Error(`Supabase OpenAPI returned ${response.status}: ${text.slice(0, 120)}`)) };
    }
    const document = await response.json() as { paths?: Record<string, unknown> };
    const missingPaths = requiredPaths.filter((path) => !document.paths?.[path]);
    return { configured: true, available: missingPaths.length === 0, missingPaths, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return { configured: true, available: false, missingPaths: [...requiredPaths], latencyMs: Date.now() - startedAt, errorCode: classifySupabaseConnectionError(error) };
  }
}

export async function runSupabaseKeepalivePing() {
  return restPost<{ ok: boolean; touched_at: string }>("rpc/run_system_keepalive_ping", {});
}



export function shouldUseSupabaseStorage() {
  return Boolean(
    process.env.VERCEL || process.env.PRODUCTION_RUNTIME === "true" || process.env.SUPABASE_STORAGE_ENABLED === "true"
  );
}

async function restGet<T>(path: string): Promise<T> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase storage is not configured");
  const response = await fetchSupabase(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase storage returned ${response.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}

export async function supabaseClaimIngestionJob(indicatorId: string, workerId: string, now = new Date(), staleAfterMs = 30 * 60_000) {
  const claimedAt = now.toISOString();
  const staleBefore = new Date(now.getTime() - staleAfterMs).toISOString();
  const result = await restPost<Record<string, unknown> | null>("rpc/claim_ingestion_job", {
    p_indicator_id: indicatorId, p_worker_id: workerId, p_now: claimedAt, p_stale_before: staleBefore,
  });
  if (!result || result.claimed !== true) return null;
  return { id: String(result.id), indicatorId, workerId, claimedAt, attempts: Number(result.attempts) };
}

export async function supabaseHeartbeatIngestionJob(jobId: string, now = new Date()) {
  await restPost("rpc/heartbeat_ingestion_job", { p_id: jobId, p_heartbeat_at: now.toISOString() });
}

export async function supabaseFinishIngestionJob(jobId: string, status: "succeeded" | "failed", errorMessage?: string, now = new Date()) {
  await restPost("rpc/finish_ingestion_job", { p_id: jobId, p_status: status, p_error_message: errorMessage ?? null, p_completed_at: now.toISOString() });
}

export async function supabaseLatestObservations(indicatorId: string, limit = 300) {
  const fields = [
    "indicatorId:indicator_id", "date:period", "value", "status", "quality",
    "sourceName:source_name", "sourceSeriesId:source_series_id", "unit", "frequency",
    "transformation", "vintage", "ingestedAt:ingested_at",
  ].join(",");
  const rows = await restGet<Array<Record<string, unknown>>>(
    // Fetch the bounded source window before projection. Applying `limit` first
    // can leave multiple revisions for one period and hide its actual latest row.
    `observations?select=${fields}&indicator_id=eq.${encodeURIComponent(indicatorId)}&order=period.desc,vintage.desc&limit=10000`
  );
  return selectLatestPerPeriod(rows.reverse()).slice(-Math.min(limit, 10000));
}

export async function supabaseLatestSnapshots(indicatorIds: string[]) {
  const results = await Promise.all(indicatorIds.map(async (indicatorId) => {
    const rows = await supabaseLatestObservations(indicatorId, 1);
    return rows[0];
  }));
  return results.filter((item): item is NonNullable<typeof item> => Boolean(item));
}

export async function supabaseLatestFreshness(indicatorIds: string[]) {
  const results = await Promise.all(indicatorIds.map(async (indicatorId) => {
    const rows = await supabaseLatestObservations(indicatorId, 1);
    const row = rows[0];
    return row ? {
      indicatorId: row.indicatorId,
      observedThrough: row.date,
      ingestedAt: row.ingestedAt,
      sourceName: row.sourceName,
      sourceSeriesId: row.sourceSeriesId,
      frequency: row.frequency,
    } : null;
  }));
  return results.filter((item): item is NonNullable<typeof item> => Boolean(item));
}

export async function supabaseIngestVerifiedBatch(input: {
  indicatorId: string;
  sourceType: string;
  startedAt: string;
  completedAt: string;
  sourceUrl: string;
  statusCode: number;
  payloadSha256: string;
  payloadJson: string;
  observations: Array<Record<string, unknown>>;
  quarantine: Array<Record<string, unknown>>;
}) {
  return restPost<{ runId: number; inserted: number; quarantined: number }>("rpc/ingest_verified_batch", {
    p_indicator_id: input.indicatorId,
    p_source_type: input.sourceType,
    p_started_at: input.startedAt,
    p_completed_at: input.completedAt,
    p_source_url: input.sourceUrl,
    p_status_code: input.statusCode,
    p_payload_sha256: input.payloadSha256,
    p_payload_json: input.payloadJson,
    p_observations: input.observations,
    p_quarantine: input.quarantine,
  });
}

export async function supabaseListAlerts() {
  return restGet<Array<Record<string, unknown>>>("alerts?select=id,indicatorId:indicator_id,condition,threshold,active,note,createdAt:created_at,updatedAt:updated_at&order=created_at.desc");
}

export async function supabaseListAlertEvents() {
  return restGet<Array<Record<string, unknown>>>("alert_events?select=id,alertId:alert_id,indicatorId:indicator_id,observationPeriod:observation_period,observedValue:observed_value,triggeredAt:triggered_at,acknowledgedAt:acknowledged_at&order=triggered_at.desc&limit=500");
}

export async function supabaseCreateAlert(input: { indicatorId: string; condition: string; threshold: number; note?: string }) {
  const now = new Date().toISOString();
  const row = await restPost<Array<Record<string, unknown>>>("alerts?select=id,indicatorId:indicator_id,condition,threshold,active,note,createdAt:created_at,updatedAt:updated_at", {
    id: randomUUID(), indicator_id: input.indicatorId, condition: input.condition,
    threshold: input.threshold, active: true, note: input.note ?? null, created_at: now, updated_at: now,
  }, true);
  return row[0];
}

export async function supabaseDeleteAlert(id: string) {
  const events = await restDelete(`alert_events?alert_id=eq.${encodeURIComponent(id)}`);
  void events;
  return restDelete(`alerts?id=eq.${encodeURIComponent(id)}`);
}

export async function supabaseSetAlertActive(id: string, active: boolean) {
  return restPatch(`alerts?id=eq.${encodeURIComponent(id)}`, { active, updated_at: new Date().toISOString() });
}

export async function supabaseAcknowledgeAlertEvent(id: number) {
  return restPatch(`alert_events?id=eq.${id}&acknowledged_at=is.null`, { acknowledged_at: new Date().toISOString() });
}

export async function supabaseEvaluateAlerts(indicatorId: string) {
  const rows = await supabaseLatestObservations(indicatorId, 2) as Array<{ date: string; value: number; status: string; quality: string }>;
  const current = rows.at(-1);
  const previous = rows.at(-2);
  if (!current || current.status !== "actual" || current.quality !== "verified" || !DATA_SOURCES[indicatorId]?.sourceUrl) return [];
  const alerts = (await supabaseListAlerts()).filter((item) => item.indicatorId === indicatorId && item.active) as Array<{ id: string; condition: string; threshold: number }>;
  const triggered: string[] = [];
  for (const alert of alerts) {
    const match = alert.condition === "above" ? current.value > alert.threshold
      : alert.condition === "below" ? current.value < alert.threshold
      : Boolean(previous && ((previous.value <= alert.threshold && current.value > alert.threshold) || (previous.value >= alert.threshold && current.value < alert.threshold)));
    if (!match) continue;
    const existing = await restGet<Array<{ id: number }>>(`alert_events?select=id&alert_id=eq.${encodeURIComponent(alert.id)}&observation_period=eq.${encodeURIComponent(current.date)}&limit=1`);
    if (existing.length > 0) continue;
    await restPost("alert_events", {
      alert_id: alert.id, indicator_id: indicatorId, observation_period: current.date,
      observed_value: current.value, triggered_at: new Date().toISOString(),
    });
    triggered.push(alert.id);
  }
  return triggered;
}

export async function supabaseListForecasts(indicatorId?: string) {
  const filter = indicatorId ? `&indicator_id=eq.${encodeURIComponent(indicatorId)}` : "";
  return restGet<Array<Record<string, unknown>>>(`forecasts?select=id,indicatorId:indicator_id,country,forecastValue:forecast_value,forecastDate:forecast_date,targetDate:target_date,institution,analyst,methodology,confidence,version,status,sourceName:source_name,sourceUrl:source_url,createdAt:created_at,updatedAt:updated_at&order=target_date.asc,forecast_date.desc,institution.asc${filter}`);
}

export async function supabaseCreateForecast(input: ForecastRevisionInput & { id: string; createdAt: string; updatedAt: string }) {
  const rows = await restPost<Array<Record<string, unknown>>>("forecasts", {
    id: input.id, indicator_id: input.indicatorId, country: input.country,
    forecast_value: input.forecastValue, forecast_date: input.forecastDate,
    target_date: input.targetDate, institution: input.institution,
    analyst: input.analyst ?? null, methodology: input.methodology,
    confidence: input.confidence, version: input.version, status: input.status,
    source_name: input.sourceName, source_url: input.sourceUrl,
    created_at: input.createdAt, updated_at: input.updatedAt,
  }, true, true);
  return rows[0];
}

export async function supabaseCreateForecastBatch(inputs: Array<ForecastRevisionInput & { id: string; createdAt: string; updatedAt: string }>) {
  return restPost<Array<Record<string, unknown>>>("rpc/ingest_forecast_batch", {
    p_forecasts: inputs.map((input) => ({
      id: input.id, indicatorId: input.indicatorId, country: input.country,
      forecastValue: input.forecastValue, forecastDate: input.forecastDate,
      targetDate: input.targetDate, institution: input.institution,
      analyst: input.analyst ?? null, methodology: input.methodology,
      confidence: input.confidence, version: input.version, status: input.status,
      sourceName: input.sourceName, sourceUrl: input.sourceUrl,
      createdAt: input.createdAt, updatedAt: input.updatedAt,
    })),
  });
}

export async function supabaseListInstitutionalOutlooks(indicatorId?: string) {
  const filter = indicatorId ? `&indicator_id=eq.${encodeURIComponent(indicatorId)}` : "";
  return restGet<Array<Record<string, unknown>>>(`institutional_outlooks?select=id,indicatorId:indicator_id,country,institution,analyst,publicationDate:publication_date,targetDate:target_date,midpoint,rangeLow:range_low,rangeHigh:range_high,direction,thesis,methodology,sourceName:source_name,sourceUrl:source_url,version,createdAt:created_at,updatedAt:updated_at&order=target_date.asc,publication_date.desc,institution.asc${filter}`);
}

export async function supabaseCreateInstitutionalOutlook(input: InstitutionalOutlookInput) {
  const now = new Date().toISOString();
  const row = await restPost<Array<Record<string, unknown>>>("institutional_outlooks?select=id", {
    id: randomUUID(), indicator_id: input.indicatorId, country: input.country,
    institution: input.institution, analyst: input.analyst ?? null,
    publication_date: input.publicationDate, target_date: input.targetDate,
    midpoint: input.midpoint ?? null, range_low: input.rangeLow ?? null,
    range_high: input.rangeHigh ?? null, direction: input.direction ?? null,
    thesis: input.thesis, methodology: input.methodology,
    source_name: input.sourceName, source_url: input.sourceUrl,
    version: input.version ?? 1, created_at: now, updated_at: now,
  }, true);
  return row[0];
}

export async function supabaseForecastAccuracy(indicatorId?: string) {
  const forecasts = await supabaseListForecasts(indicatorId) as Array<Record<string, unknown>>;
  const results = await Promise.all(forecasts.map(async (forecast) => {
    const targetDate = String(forecast.targetDate);
    const rows = await supabaseLatestObservations(String(forecast.indicatorId), 10000) as Array<{ date: string; value: number }>;
    const actual = rows.find((row) => row.date === targetDate);
    const forecastValue = Number(forecast.forecastValue);
    const actualValue = actual?.value ?? null;
    return {
      id: forecast.id, indicatorId: forecast.indicatorId, targetDate,
      forecastValue, institution: forecast.institution,
      actualValue,
      accuracyState: actualValue === null ? "pending" : "available",
      error: actualValue === null ? null : actualValue - forecastValue,
      absolutePercentageError: actualValue === null || forecastValue === 0 ? null : Math.abs((actualValue - forecastValue) / forecastValue) * 100,
    };
  }));
  return results;
}

export async function supabaseListResearchMemory(indicatorId?: string) {
  const filter = indicatorId ? `&indicator_id=eq.${encodeURIComponent(indicatorId)}` : "";
  return restGet<Array<Record<string, unknown>>>(
    `research_memory?select=id,predictionId:prediction_id,indicatorId:indicator_id,institution,version,targetDate:target_date,predictionValue:prediction_value,actualValue:actual_value,actualDate:actual_date,actualStatus:actual_status,predictionSource:prediction_source,predictionFingerprint:prediction_fingerprint,debateSessionId:debate_session_id,debateFingerprint:debate_fingerprint,error,absolutePercentageError:absolute_percentage_error,predictedDirection:predicted_direction,actualDirection:actual_direction,directionCorrect:direction_correct,lesson,createdAt:created_at&order=target_date.desc,actual_date.desc,institution.asc${filter}`,
  );
}

export async function supabaseRecordResearchMemory(record: ResearchMemoryRecord) {
  const rows = await restPost<Array<Record<string, unknown>>>("research_memory?on_conflict=id&select=id", {
    id: record.id,
    prediction_id: record.predictionId,
    indicator_id: record.indicatorId,
    institution: record.institution,
    version: record.version,
    target_date: record.targetDate,
    prediction_value: record.predictionValue,
    actual_value: record.actualValue,
    actual_date: record.actualDate,
    actual_status: record.actualStatus,
    prediction_source: record.predictionSource,
    prediction_fingerprint: record.predictionFingerprint,
    debate_session_id: record.debateSessionId,
    debate_fingerprint: record.debateFingerprint,
    error: record.error,
    absolute_percentage_error: record.absolutePercentageError,
    predicted_direction: record.predictedDirection,
    actual_direction: record.actualDirection,
    direction_correct: record.directionCorrect,
    lesson: record.lesson,
  }, true, true);
  return rows[0] ?? { id: record.id };
}

export async function supabaseGetDebateCheckpoint(runId: string): Promise<DebateCheckpoint | null> {
  const rows = await restGet<Array<Record<string, unknown>>>(`debate_checkpoints?select=runId:run_id,sessionId:session_id,graphVersion:graph_version,inputFingerprint:input_fingerprint,state,completedNodes:completed_nodes,outputs,attemptCount:attempt_count,failureCode:failure_code,createdAt:created_at,updatedAt:updated_at&run_id=eq.${encodeURIComponent(runId)}&limit=1`);
  const row = rows[0];
  if (!row) return null;
  return {
    runId: String(row.runId), sessionId: String(row.sessionId), graphVersion: String(row.graphVersion), inputFingerprint: String(row.inputFingerprint),
    state: row.state as DebateCheckpoint["state"], completedNodes: Array.isArray(row.completedNodes) ? row.completedNodes.map(String) : [],
    outputs: row.outputs && typeof row.outputs === "object" ? row.outputs as Record<string, unknown> : {}, attemptCount: Number(row.attemptCount),
    failureCode: row.failureCode == null ? undefined : row.failureCode as DebateCheckpoint["failureCode"], createdAt: String(row.createdAt), updatedAt: String(row.updatedAt),
  };
}

export async function supabaseSaveDebateCheckpoint(checkpoint: DebateCheckpoint) {
  const rows = await restPost<Array<Record<string, unknown>>>("debate_checkpoints?on_conflict=run_id&select=run_id", {
    run_id: checkpoint.runId, session_id: checkpoint.sessionId, graph_version: checkpoint.graphVersion,
    input_fingerprint: checkpoint.inputFingerprint, state: checkpoint.state, completed_nodes: checkpoint.completedNodes,
    outputs: checkpoint.outputs, attempt_count: checkpoint.attemptCount, failure_code: checkpoint.failureCode ?? null,
    created_at: checkpoint.createdAt, updated_at: checkpoint.updatedAt,
  }, true, true);
  return rows[0] ?? { run_id: checkpoint.runId };
}

export async function supabaseForecastSummaries(indicatorId?: string) {
  const { hasCompleteForecastEvidence } = await import("./forecastTrust.js");
  const forecasts = await supabaseListForecasts(indicatorId) as Array<Record<string, unknown>>;
  const groups = new Map<string, Array<Record<string, unknown>>>();
  for (const row of forecasts) {
    const key = `${row.indicatorId}:${row.targetDate}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()].map((group) => {
    const eligible = group.filter(hasCompleteForecastEvidence);
    const values = eligible.map((row) => Number(row.forecastValue)).sort((a, b) => a - b);
    const evidenceState = eligible.length === group.length ? "complete" : eligible.length > 0 ? "partial" : "unavailable";
    if (!values.length) return { indicatorId: group[0].indicatorId, targetDate: group[0].targetDate, institutionCount: new Set(group.map((row) => row.institution)).size, recordCount: group.length, eligibleRecordCount: 0, evidenceState, latestVersion: Math.max(...group.map((row) => Number(row.version))) };
    const midpoint = Math.floor(values.length / 2);
    const median = values.length % 2 ? values[midpoint] : (values[midpoint - 1] + values[midpoint]) / 2;
    return {
      indicatorId: group[0].indicatorId, targetDate: group[0].targetDate,
      institutionCount: new Set(group.map((row) => row.institution)).size,
      recordCount: group.length, min: values[0], max: values.at(-1),
      eligibleRecordCount: eligible.length, evidenceState,
      average: values.reduce((sum, value) => sum + value, 0) / values.length,
      median, latestVersion: Math.max(...group.map((row) => Number(row.version))),
    };
  });
}

export async function supabaseListModelRuns(indicatorId?: string) {
  const filter = indicatorId ? `&indicator_id=eq.${encodeURIComponent(indicatorId)}` : "";
  return restGet<Array<Record<string, unknown>>>(`model_runs?select=id,indicatorId:indicator_id,modelId:model_id,modelVersion:model_version,methodology,status,eligibleObservationCount:eligible_observation_count,asOfPeriod:as_of_period,targetPeriod:target_period,forecastValue:forecast_value,backtestSampleSize:backtest_sample_size,backtestMae:backtest_mae,backtestMape:backtest_mape,limitation,createdAt:created_at&order=created_at.desc&limit=200${filter}`);
}

export async function supabaseRecordModelRun(input: {
  id: string; indicatorId: string; modelId: string; methodology: string;
  status: "ready" | "unavailable"; eligibleObservationCount: number;
  asOfPeriod: string | null; targetPeriod: string | null; forecastValue: number | null;
  backtest: { sampleSize: number; mae: number | null; mape: number | null };
  limitation: string;
}) {
  const row = {
    id: input.id, indicator_id: input.indicatorId, model_id: input.modelId,
    model_version: "1", methodology: input.methodology, status: input.status,
    eligible_observation_count: input.eligibleObservationCount,
    as_of_period: input.asOfPeriod, target_period: input.targetPeriod,
    forecast_value: input.forecastValue, backtest_sample_size: input.backtest.sampleSize,
    backtest_mae: input.backtest.mae, backtest_mape: input.backtest.mape,
    limitation: input.limitation, created_at: new Date().toISOString(),
  };
  await restPost("model_runs", row, true);
  return { ...input, modelVersion: "1", createdAt: row.created_at };
}

export async function supabaseQualitySummary() {
  return restPost<Record<string, unknown>>("rpc/quality_summary", {});
}

export async function supabaseListIngestionRuns() {
  return restGet<Array<Record<string, unknown>>>("ingestion_runs?select=id,indicatorId:indicator_id,sourceType:source_type,startedAt:started_at,completedAt:completed_at,status,observationCount:observation_count,errorMessage:error_message&order=id.desc&limit=200");
}

export async function supabaseListIngestionJobs() {
  return restGet<Array<Record<string, unknown>>>("ingestion_jobs?select=id,indicatorId:indicator_id,status,workerId:worker_id,claimedAt:claimed_at,heartbeatAt:heartbeat_at,completedAt:completed_at,attempts,errorMessage:error_message&order=claimed_at.desc&limit=200");
}

export async function supabaseListProviderTelemetrySnapshots(limit = 30) {
  return restGet<Array<Record<string, unknown>>>(`provider_telemetry_snapshots?select=id,capturedAt:captured_at,telemetry:telemetry_json,degradation:degradation_json,trends:trends_json&order=captured_at.desc&limit=${Math.min(500, Math.max(1, limit))}`);
}

export async function supabaseCreateProviderTelemetrySnapshot(input: { id: string; capturedAt: string; telemetry: unknown; degradation: unknown; trends: unknown }) {
  const rows = await restPost<Array<Record<string, unknown>>>("provider_telemetry_snapshots", { id: input.id, captured_at: input.capturedAt, telemetry_json: input.telemetry, degradation_json: input.degradation, trends_json: input.trends }, true);
  await restPost("rpc/prune_provider_telemetry_snapshots", { p_captured_at: input.capturedAt });
  return rows[0] ?? input;
}

export async function supabaseListResearchRuns(indicatorId?: string, options: { limit?: number; offset?: number; calculationMethod?: string; reviewDecisionStatus?: string } = {}) {
  const limit = Math.min(100, Math.max(1, options.limit ?? 50));
  const offset = Math.max(0, options.offset ?? 0);
  const filter = indicatorId ? `&indicator_ids_json=cs.%5B%22${encodeURIComponent(indicatorId)}%22%5D` : "";
  const calculationFilter = options.calculationMethod ? `&calculation_json->>method=eq.${encodeURIComponent(options.calculationMethod)}` : "";
  const decisionFilter = options.reviewDecisionStatus ? `&output_json->comparison->reviewDecision->>status=eq.${encodeURIComponent(options.reviewDecisionStatus)}` : "";
  return restGet<Array<Record<string, unknown>>>(`research_runs?select=id,title,question,indicatorIds:indicator_ids_json,sourceVintages:source_vintages_json,dateRange:date_range_json,transformations:transformations_json,calculation:calculation_json,output:output_json,evidence:evidence_json,limitations:limitations_json,createdAt:created_at&order=created_at.desc&limit=${limit + 1}&offset=${offset}${filter}${calculationFilter}${decisionFilter}`);
}

export async function supabaseCreateResearchRun(input: {
  id: string; title: string; question: string; indicatorIds: string[];
  sourceVintages: unknown; dateRange: unknown; transformations: unknown;
  calculation: unknown; output: unknown; evidence: unknown; limitations: unknown;
}) {
  const rows = await restPost<Array<Record<string, unknown>>>("research_runs", {
    id: input.id, title: input.title, question: input.question,
    indicator_ids_json: input.indicatorIds, source_vintages_json: input.sourceVintages,
    date_range_json: input.dateRange, transformations_json: input.transformations,
    calculation_json: input.calculation, output_json: input.output,
    evidence_json: input.evidence, limitations_json: input.limitations,
    created_at: new Date().toISOString(),
  }, true);
  return rows[0];
}

async function restPost<T>(path: string, body: unknown, preferRepresentation = false, upsert = false): Promise<T> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase storage is not configured");
  const response = await fetchSupabase(`${url}/rest/v1/${path}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...((preferRepresentation || upsert) ? { Prefer: [preferRepresentation ? "return=representation" : "return=minimal", ...(upsert ? ["resolution=merge-duplicates"] : [])].join(", ") } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase storage returned ${response.status}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : undefined) as T;
}

async function restPatch(path: string, body: unknown) {
  return restMutation(path, "PATCH", body);
}

async function restDelete(path: string) {
  return restMutation(path, "DELETE");
}

async function restMutation(path: string, method: "PATCH" | "DELETE", body?: unknown) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase storage is not configured");
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json", "Content-Type": "application/json", Prefer: "return=minimal" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error(`Supabase storage returned ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return response.status !== 204 ? response.json() : undefined;
}
