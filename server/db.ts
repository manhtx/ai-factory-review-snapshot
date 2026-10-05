import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hasCompleteForecastEvidence } from "./forecastTrust.js";
import type { ResearchMemoryRecord } from "./researchMemory.js";
import type { DebateCheckpoint } from "./debateOrchestrator.js";
import type { ForecastRevisionInput } from "./forecastInput.js";

const serverDir = dirname(fileURLToPath(import.meta.url));
const configuredDbPath =
  process.env.MACRO_DB_PATH ??
  (process.env.VERCEL ? "/tmp/macro-platform.sqlite" : "./data/macro-platform.sqlite");
const dbPath = configuredDbPath === ":memory:" ? configuredDbPath : resolve(configuredDbPath);
if (dbPath !== ":memory:") mkdirSync(dirname(dbPath), { recursive: true });

export const db = new DatabaseSync(dbPath);
db.exec(
  readFileSync(resolve(serverDir, "migrations/001_initial.sql"), "utf8")
);
// Never rewrite or delete historical observations during process startup.
// Read projections enforce period uniqueness; the raw ledger remains an audit
// trail and can contain multiple provider revisions.
db.exec(`
  CREATE INDEX IF NOT EXISTS observations_indicator_period_value_idx
    ON observations(indicator_id, period, value);
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS institutional_outlooks (
    id TEXT PRIMARY KEY,
    indicator_id TEXT NOT NULL,
    country TEXT NOT NULL,
    institution TEXT NOT NULL,
    analyst TEXT,
    publication_date TEXT NOT NULL,
    target_date TEXT NOT NULL,
    midpoint REAL,
    range_low REAL,
    range_high REAL,
    direction TEXT CHECK (direction IN ('stronger', 'weaker', 'range-bound', 'mixed')),
    thesis TEXT NOT NULL,
    methodology TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    version INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(indicator_id, institution, target_date, version)
  );
  CREATE INDEX IF NOT EXISTS idx_institutional_outlooks_lookup
    ON institutional_outlooks(indicator_id, target_date, publication_date DESC);
  CREATE TABLE IF NOT EXISTS research_runs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    question TEXT NOT NULL,
    indicator_ids_json TEXT NOT NULL,
    source_vintages_json TEXT NOT NULL,
    date_range_json TEXT NOT NULL,
    transformations_json TEXT NOT NULL,
    calculation_json TEXT NOT NULL,
    output_json TEXT NOT NULL,
    evidence_json TEXT NOT NULL,
    limitations_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_research_runs_created_at ON research_runs(created_at DESC);
  CREATE TABLE IF NOT EXISTS ingestion_jobs (
    id TEXT PRIMARY KEY,
    indicator_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('claimed', 'succeeded', 'failed', 'recovered')),
    worker_id TEXT NOT NULL,
    claimed_at TEXT NOT NULL,
    heartbeat_at TEXT NOT NULL,
    completed_at TEXT,
    attempts INTEGER NOT NULL DEFAULT 1,
    error_message TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_indicator
    ON ingestion_jobs(indicator_id, claimed_at DESC);
  CREATE TABLE IF NOT EXISTS provider_telemetry_snapshots (
    id TEXT PRIMARY KEY,
    captured_at TEXT NOT NULL,
    telemetry_json TEXT NOT NULL,
    degradation_json TEXT NOT NULL,
    trends_json TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_provider_telemetry_snapshots_captured
    ON provider_telemetry_snapshots(captured_at DESC);
  CREATE TABLE IF NOT EXISTS research_memory (
    id TEXT PRIMARY KEY,
    prediction_id TEXT NOT NULL,
    indicator_id TEXT NOT NULL,
    institution TEXT NOT NULL,
    version INTEGER NOT NULL,
    target_date TEXT NOT NULL,
    prediction_value REAL NOT NULL,
    actual_value REAL NOT NULL,
    actual_date TEXT NOT NULL,
    actual_status TEXT NOT NULL CHECK (actual_status = 'actual-verified-source-backed'),
    prediction_source TEXT NOT NULL,
    prediction_fingerprint TEXT NOT NULL,
    debate_session_id TEXT,
    debate_fingerprint TEXT,
    error REAL NOT NULL,
    absolute_percentage_error REAL,
    predicted_direction TEXT NOT NULL CHECK (predicted_direction IN ('higher', 'lower', 'flat')),
    actual_direction TEXT NOT NULL CHECK (actual_direction IN ('higher', 'lower', 'flat')),
    direction_correct INTEGER NOT NULL,
    lesson TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(prediction_id, indicator_id, institution, target_date, version)
  );
  CREATE INDEX IF NOT EXISTS idx_research_memory_lookup
    ON research_memory(indicator_id, target_date DESC, created_at DESC);
  CREATE TABLE IF NOT EXISTS debate_checkpoints (
    run_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    graph_version TEXT NOT NULL,
    input_fingerprint TEXT NOT NULL,
    state TEXT NOT NULL,
    completed_nodes_json TEXT NOT NULL,
    outputs_json TEXT NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    failure_code TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_debate_checkpoints_session ON debate_checkpoints(session_id, updated_at DESC);
  CREATE TABLE IF NOT EXISTS debate_sessions (
    id TEXT PRIMARY KEY,
    indicator_id TEXT NOT NULL,
    indicator_name TEXT NOT NULL,
    prediction_value REAL NOT NULL,
    prediction_horizon TEXT NOT NULL,
    prediction_source TEXT NOT NULL,
    prediction_direction TEXT NOT NULL CHECK (prediction_direction IN ('higher', 'lower', 'flat')),
    snapshot_value REAL NOT NULL,
    snapshot_date TEXT NOT NULL,
    snapshot_unit TEXT NOT NULL,
    bull_case_json TEXT NOT NULL,
    bear_case_json TEXT NOT NULL,
    risk_analysis_json TEXT NOT NULL,
    risk_flags_json TEXT NOT NULL,
    verdict_signal TEXT NOT NULL,
    verdict_label TEXT NOT NULL,
    verdict_summary TEXT NOT NULL,
    verdict_bull_strength INTEGER NOT NULL,
    verdict_bear_strength INTEGER NOT NULL,
    verdict_risk_count INTEGER NOT NULL,
    verdict_limitation TEXT NOT NULL,
    debate_rounds INTEGER NOT NULL,
    eligible_indicator_ids_json TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    run_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_debate_sessions_indicator ON debate_sessions(indicator_id, run_at DESC);
`);

export function recordProviderTelemetrySnapshot(snapshot: { id: string; capturedAt: string; telemetry: unknown; degradation: unknown; trends: unknown }) {
  db.prepare(`INSERT INTO provider_telemetry_snapshots(id, captured_at, telemetry_json, degradation_json, trends_json) VALUES (?, ?, ?, ?, ?)`).run(snapshot.id, snapshot.capturedAt, JSON.stringify(snapshot.telemetry), JSON.stringify(snapshot.degradation), JSON.stringify(snapshot.trends));
  db.prepare(`DELETE FROM provider_telemetry_snapshots WHERE captured_at < datetime(?, '-90 days') OR id NOT IN (SELECT id FROM provider_telemetry_snapshots ORDER BY captured_at DESC LIMIT 500)`).run(snapshot.capturedAt);
  return snapshot;
}

export function listProviderTelemetrySnapshots(limit = 30) {
  return db.prepare(`SELECT id, captured_at AS capturedAt, telemetry_json AS telemetryJson, degradation_json AS degradationJson, trends_json AS trendsJson FROM provider_telemetry_snapshots ORDER BY captured_at DESC LIMIT ?`).all(Math.min(500, Math.max(1, limit))).map((row) => {
    const value = row as { id: string; capturedAt: string; telemetryJson: string; degradationJson: string; trendsJson: string };
    return { id: value.id, capturedAt: value.capturedAt, telemetry: JSON.parse(value.telemetryJson), degradation: JSON.parse(value.degradationJson), trends: JSON.parse(value.trendsJson) };
  });
}

export function listInstitutionalOutlooks(indicatorId?: string) {
  const query = `
    SELECT id, indicator_id AS indicatorId, country, institution, analyst,
           publication_date AS publicationDate, target_date AS targetDate,
           midpoint, range_low AS rangeLow, range_high AS rangeHigh, direction,
           thesis, methodology, source_name AS sourceName, source_url AS sourceUrl,
           version, created_at AS createdAt, updated_at AS updatedAt
    FROM institutional_outlooks
    ${indicatorId ? "WHERE indicator_id = ?" : ""}
    ORDER BY target_date ASC, publication_date DESC, institution ASC
  `;
  return indicatorId ? db.prepare(query).all(indicatorId) : db.prepare(query).all();
}

export function latestObservations(indicatorId: string, limit = 300) {
  return db.prepare(`
    SELECT indicator_id AS indicatorId, period AS date, value, status, quality,
           source_name AS sourceName, source_series_id AS sourceSeriesId,
           unit, frequency, transformation, vintage, ingested_at AS ingestedAt
    FROM (
      SELECT observations.*, ROW_NUMBER() OVER (
        PARTITION BY indicator_id, period
        ORDER BY vintage DESC, ingested_at DESC, rowid DESC
      ) AS revision_rank
      FROM observations WHERE indicator_id = ?
    )
    WHERE revision_rank = 1
    ORDER BY period DESC
    LIMIT ?
  `).all(indicatorId, limit).reverse();
}

export function latestSnapshots() {
  return db.prepare(`
    WITH ranked AS (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY indicator_id ORDER BY period DESC, vintage DESC
      ) AS rank
      FROM observations
    )
    SELECT indicator_id AS indicatorId, period AS date, value, status, quality,
           source_name AS sourceName, source_series_id AS sourceSeriesId,
           unit, frequency, transformation, vintage, ingested_at AS ingestedAt
    FROM ranked WHERE rank = 1 ORDER BY indicator_id
  `).all();
}

export function listForecasts(indicatorId?: string) {
  const query = `
    SELECT id, indicator_id AS indicatorId, country, forecast_value AS forecastValue,
           forecast_date AS forecastDate, target_date AS targetDate,
           institution, analyst, methodology, confidence, version, status,
           source_name AS sourceName, source_url AS sourceUrl,
           created_at AS createdAt, updated_at AS updatedAt
    FROM forecasts
    ${indicatorId ? "WHERE indicator_id = ?" : ""}
    ORDER BY target_date ASC, forecast_date DESC, institution ASC
  `;
  return indicatorId ? db.prepare(query).all(indicatorId) : db.prepare(query).all();
}

export function createForecast(input: ForecastRevisionInput & { id: string; createdAt: string; updatedAt: string }) {
  db.prepare(`
    INSERT INTO forecasts (id, indicator_id, country, forecast_value, forecast_date, target_date, institution, analyst, methodology, confidence, version, status, source_name, source_url, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(indicator_id, institution, target_date, version) DO UPDATE SET
      forecast_value=excluded.forecast_value, forecast_date=excluded.forecast_date,
      country=excluded.country, analyst=excluded.analyst, methodology=excluded.methodology,
      confidence=excluded.confidence, status=excluded.status, source_name=excluded.source_name,
      source_url=excluded.source_url, updated_at=excluded.updated_at
  `).run(input.id, input.indicatorId, input.country, input.forecastValue, input.forecastDate, input.targetDate, input.institution, input.analyst ?? null, input.methodology, input.confidence, input.version, input.status, input.sourceName, input.sourceUrl, input.createdAt, input.updatedAt);
  return listForecasts(input.indicatorId).find((row) => String((row as { id?: unknown }).id) === input.id) ?? listForecasts(input.indicatorId).find((row) => String((row as { institution?: unknown }).institution) === input.institution && String((row as { targetDate?: unknown }).targetDate) === input.targetDate && Number((row as { version?: unknown }).version) === input.version);
}

export function createForecastBatch(
  inputs: Array<ForecastRevisionInput & { id: string; createdAt: string; updatedAt: string }>,
) {
  db.exec("BEGIN");
  try {
    const saved = inputs.map((input) => createForecast(input));
    db.exec("COMMIT");
    return saved;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function listForecastAccuracy(indicatorId?: string) {
  const query = `
    WITH target_observations AS (
      SELECT o.indicator_id, o.period, o.value,
             ROW_NUMBER() OVER (
               PARTITION BY o.indicator_id, o.period ORDER BY o.vintage DESC, o.ingested_at DESC
             ) AS rank
      FROM observations o
    )
    SELECT f.id, f.indicator_id AS indicatorId, f.target_date AS targetDate,
           f.forecast_value AS forecastValue, f.institution,
           o.value AS actualValue,
           CASE WHEN o.value IS NULL THEN 'pending' ELSE 'available' END AS accuracyState,
           CASE WHEN o.value IS NULL THEN NULL ELSE o.value - f.forecast_value END AS error,
           CASE WHEN o.value IS NULL OR f.forecast_value = 0 THEN NULL
                ELSE ABS((o.value - f.forecast_value) / f.forecast_value) * 100 END AS absolutePercentageError
    FROM forecasts f
    LEFT JOIN target_observations o
      ON o.indicator_id = f.indicator_id AND o.period = f.target_date AND o.rank = 1
    ${indicatorId ? "WHERE f.indicator_id = ?" : ""}
    ORDER BY f.target_date ASC, f.forecast_date DESC, f.institution ASC
  `;
  return indicatorId ? db.prepare(query).all(indicatorId) : db.prepare(query).all();
}

export function listForecastSummaries(indicatorId?: string) {
  const rows = listForecasts(indicatorId) as Array<{
    indicatorId: string;
    targetDate: string;
    forecastValue: number;
    version: number;
    institution: string;
    methodology?: string;
    confidence?: number;
    sourceUrl?: string;
  }>;
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = `${row.indicatorId}:${row.targetDate}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()].map((group) => {
    const eligible = group.filter(hasCompleteForecastEvidence);
    const values = eligible.map((row) => row.forecastValue).sort((a, b) => a - b);
    const evidenceState = eligible.length === group.length ? "complete" : eligible.length > 0 ? "partial" : "unavailable";
    if (!values.length) return { indicatorId: group[0].indicatorId, targetDate: group[0].targetDate, institutionCount: new Set(group.map((row) => row.institution)).size, recordCount: group.length, eligibleRecordCount: 0, evidenceState, latestVersion: Math.max(...group.map((row) => row.version)) };
    const midpoint = Math.floor(values.length / 2);
    const median = values.length % 2 ? values[midpoint] : (values[midpoint - 1] + values[midpoint]) / 2;
    return {
      indicatorId: group[0].indicatorId,
      targetDate: group[0].targetDate,
      institutionCount: new Set(group.map((row) => row.institution)).size,
      recordCount: group.length,
      eligibleRecordCount: eligible.length,
      evidenceState,
      min: values[0],
      max: values.at(-1),
      average: values.reduce((sum, value) => sum + value, 0) / values.length,
      median,
      latestVersion: Math.max(...group.map((row) => row.version)),
    };
  });
}

export function recordResearchMemory(record: ResearchMemoryRecord) {
  db.prepare(`
    INSERT INTO research_memory (
      id, prediction_id, indicator_id, institution, version, target_date,
      prediction_value, actual_value, actual_date, actual_status,
      prediction_source, prediction_fingerprint, debate_session_id,
      debate_fingerprint, error, absolute_percentage_error,
      predicted_direction, actual_direction, direction_correct, lesson
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      actual_value = excluded.actual_value,
      actual_date = excluded.actual_date,
      error = excluded.error,
      absolute_percentage_error = excluded.absolute_percentage_error,
      actual_direction = excluded.actual_direction,
      direction_correct = excluded.direction_correct,
      lesson = excluded.lesson
  `).run(
    record.id, record.predictionId, record.indicatorId, record.institution, record.version,
    record.targetDate, record.predictionValue, record.actualValue, record.actualDate,
    record.actualStatus, record.predictionSource, record.predictionFingerprint,
    record.debateSessionId, record.debateFingerprint, record.error,
    record.absolutePercentageError, record.predictedDirection, record.actualDirection,
    record.directionCorrect ? 1 : 0, record.lesson,
  );
  return record;
}

export function listResearchMemory(indicatorId?: string) {
  const query = `
    SELECT id, prediction_id AS predictionId, indicator_id AS indicatorId,
      institution, version, target_date AS targetDate,
      prediction_value AS predictionValue, actual_value AS actualValue,
      actual_date AS actualDate, actual_status AS actualStatus,
      prediction_source AS predictionSource, prediction_fingerprint AS predictionFingerprint,
      debate_session_id AS debateSessionId, debate_fingerprint AS debateFingerprint,
      error, absolute_percentage_error AS absolutePercentageError,
      predicted_direction AS predictedDirection, actual_direction AS actualDirection,
      direction_correct AS directionCorrect, lesson, created_at AS createdAt
    FROM research_memory ${indicatorId ? "WHERE indicator_id = ?" : ""}
    ORDER BY target_date DESC, actual_date DESC, institution ASC
  `;
  const rows = indicatorId ? db.prepare(query).all(indicatorId) : db.prepare(query).all();
  return rows.map((row) => ({ ...row, directionCorrect: Boolean((row as { directionCorrect: number }).directionCorrect) }));
}

export function saveDebateCheckpoint(checkpoint: DebateCheckpoint) {
  db.prepare(`
    INSERT INTO debate_checkpoints (
      run_id, session_id, graph_version, input_fingerprint, state,
      completed_nodes_json, outputs_json, attempt_count, failure_code,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(run_id) DO UPDATE SET
      state = excluded.state,
      completed_nodes_json = excluded.completed_nodes_json,
      outputs_json = excluded.outputs_json,
      attempt_count = excluded.attempt_count,
      failure_code = excluded.failure_code,
      updated_at = excluded.updated_at
  `).run(checkpoint.runId, checkpoint.sessionId, checkpoint.graphVersion, checkpoint.inputFingerprint, checkpoint.state, JSON.stringify(checkpoint.completedNodes), JSON.stringify(checkpoint.outputs), checkpoint.attemptCount, checkpoint.failureCode ?? null, checkpoint.createdAt, checkpoint.updatedAt);
  return checkpoint;
}

export function getDebateCheckpoint(runId: string): DebateCheckpoint | null {
  const row = db.prepare(`SELECT run_id AS runId, session_id AS sessionId, graph_version AS graphVersion, input_fingerprint AS inputFingerprint, state, completed_nodes_json AS completedNodesJson, outputs_json AS outputsJson, attempt_count AS attemptCount, failure_code AS failureCode, created_at AS createdAt, updated_at AS updatedAt FROM debate_checkpoints WHERE run_id = ?`).get(runId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return { runId: String(row.runId), sessionId: String(row.sessionId), graphVersion: String(row.graphVersion), inputFingerprint: String(row.inputFingerprint), state: row.state as DebateCheckpoint["state"], completedNodes: JSON.parse(String(row.completedNodesJson)), outputs: JSON.parse(String(row.outputsJson)), attemptCount: Number(row.attemptCount), failureCode: row.failureCode == null ? undefined : row.failureCode as DebateCheckpoint["failureCode"], createdAt: String(row.createdAt), updatedAt: String(row.updatedAt) };
}

export function deleteDebateCheckpoint(runId: string) {
  db.prepare("DELETE FROM debate_checkpoints WHERE run_id = ?").run(runId);
}

export function recordModelRun(input: {
  id: string;
  indicatorId: string;
  modelId: string;
  methodology: string;
  status: "ready" | "unavailable";
  eligibleObservationCount: number;
  asOfPeriod: string | null;
  targetPeriod: string | null;
  forecastValue: number | null;
  backtest: { sampleSize: number; mae: number | null; mape: number | null };
  limitation: string;
}) {
  const createdAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO model_runs(
      id, indicator_id, model_id, model_version, methodology, status,
      eligible_observation_count, as_of_period, target_period, forecast_value,
      backtest_sample_size, backtest_mae, backtest_mape, limitation, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.id, input.indicatorId, input.modelId, "1", input.methodology, input.status,
    input.eligibleObservationCount, input.asOfPeriod, input.targetPeriod, input.forecastValue,
    input.backtest.sampleSize, input.backtest.mae, input.backtest.mape, input.limitation, createdAt
  );
  return { ...input, createdAt };
}

export function listModelRuns(indicatorId?: string) {
  const query = `
    SELECT id, indicator_id AS indicatorId, model_id AS modelId,
           model_version AS modelVersion, methodology, status,
           eligible_observation_count AS eligibleObservationCount,
           as_of_period AS asOfPeriod, target_period AS targetPeriod,
           forecast_value AS forecastValue,
           backtest_sample_size AS backtestSampleSize, backtest_mae AS backtestMae,
           backtest_mape AS backtestMape, limitation, created_at AS createdAt
    FROM model_runs ${indicatorId ? "WHERE indicator_id = ?" : ""}
    ORDER BY created_at DESC LIMIT 200
  `;
  return indicatorId ? db.prepare(query).all(indicatorId) : db.prepare(query).all();
}

export interface ResearchRunInput {
  id: string;
  title: string;
  question: string;
  indicatorIds: string[];
  sourceVintages: Array<{ indicatorId: string; sourceSeriesId: string | null; vintage: string | null }>;
  dateRange: { start: string | null; end: string | null };
  transformations: string[];
  calculation: { method: string; version: string };
  output: unknown;
  evidence: Array<{ indicatorId: string; sourceUrl: string; periods: string[] }>;
  limitations: string[];
}

export function recordResearchRun(input: ResearchRunInput) {
  const createdAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO research_runs(
      id, title, question, indicator_ids_json, source_vintages_json,
      date_range_json, transformations_json, calculation_json, output_json,
      evidence_json, limitations_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.id, input.title, input.question, JSON.stringify(input.indicatorIds),
    JSON.stringify(input.sourceVintages), JSON.stringify(input.dateRange),
    JSON.stringify(input.transformations), JSON.stringify(input.calculation),
    JSON.stringify(input.output), JSON.stringify(input.evidence),
    JSON.stringify(input.limitations), createdAt,
  );
  return { ...input, createdAt };
}

export function listResearchRuns(indicatorId?: string, options: { limit?: number; offset?: number; calculationMethod?: string; reviewDecisionStatus?: string } = {}) {
  const limit = Math.min(100, Math.max(1, options.limit ?? 50));
  const offset = Math.max(0, options.offset ?? 0);
  const filters: string[] = [];
  const params: Array<string | number> = [];
  if (indicatorId) { filters.push("EXISTS (SELECT 1 FROM json_each(indicator_ids_json) WHERE value = ?)"); params.push(indicatorId); }
  if (options.calculationMethod) { filters.push("json_extract(calculation_json, '$.method') = ?"); params.push(options.calculationMethod); }
  if (options.reviewDecisionStatus) { filters.push("json_extract(output_json, '$.comparison.reviewDecision.status') = ?"); params.push(options.reviewDecisionStatus); }
  params.push(limit + 1, offset);
  const rows = db.prepare(`
    SELECT id, title, question, indicator_ids_json AS indicatorIds,
           source_vintages_json AS sourceVintages, date_range_json AS dateRange,
           transformations_json AS transformations, calculation_json AS calculation,
           output_json AS output, evidence_json AS evidence,
           limitations_json AS limitations, created_at AS createdAt
    FROM research_runs ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""} ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(...params) as Array<Record<string, unknown>>;
  return rows
    .map((row) => ({
      ...row,
      indicatorIds: JSON.parse(String(row.indicatorIds)),
      sourceVintages: JSON.parse(String(row.sourceVintages)),
      dateRange: JSON.parse(String(row.dateRange)),
      transformations: JSON.parse(String(row.transformations)),
      calculation: JSON.parse(String(row.calculation)),
      output: JSON.parse(String(row.output)),
      evidence: JSON.parse(String(row.evidence)),
      limitations: JSON.parse(String(row.limitations)),
    }))
    .slice(0, limit);
}
