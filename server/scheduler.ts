import { DATA_SOURCES } from "../src/app/config/dataSources.js";
import { ingestIndicator } from "./ingestion.js";
import { runWithRetry } from "./retryPolicy.js";
import { recordSchedulerRun } from "./schedulerMetrics.js";
import { runForecastOutcomeFeedback } from "./forecastOutcomeFeedback.js";

let running = false;

export type CadenceTier = "daily" | "monthly" | "quarterly" | "annual" | "weekly" | "irregular";

function configuredIds(frequencyFilter?: string) {
  return (process.env.INGESTION_SCHEDULE_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value in DATA_SOURCES)
    .filter((id) => {
      if (!frequencyFilter) return true;
      const freq = (DATA_SOURCES[id]?.frequencyLabel ?? "monthly").toLowerCase();
      return freq === frequencyFilter.toLowerCase();
    });
}

export function schedulerConfiguration(options?: { frequency?: string } | string) {
  const frequencyFilter = typeof options === "string" ? options : options?.frequency;
  const intervalMinutes = Number(process.env.INGESTION_INTERVAL_MINUTES ?? 0);
  const indicatorIds = configuredIds(frequencyFilter);
  return {
    enabled: Number.isFinite(intervalMinutes) && intervalMinutes > 0 && indicatorIds.length > 0,
    intervalMinutes: Number.isFinite(intervalMinutes) && intervalMinutes > 0 ? intervalMinutes : null,
    indicatorCount: indicatorIds.length,
    indicatorIds,
    frequency: frequencyFilter ?? null,
  };
}

export type BoundedIngestionResult = {
  indicatorId: string;
  ok: boolean;
  attempts: number;
  error?: string;
  retryDecisions?: unknown[];
};

export async function runBoundedIngestionBatch(
  indicatorIds: string[],
  options: {
    maxBatchSize?: number;
    maxAttempts?: number;
    baseDelayMs?: number;
    cadenceFilter?: string;
    ingest?: (indicatorId: string) => Promise<unknown>;
  } = {},
) {
  const maxBatchSize = Math.max(1, Math.floor(options.maxBatchSize ?? 20));
  let candidateIds = indicatorIds;
  if (options.cadenceFilter) {
    const filter = options.cadenceFilter.toLowerCase();
    candidateIds = candidateIds.filter((id) => {
      const freq = (DATA_SOURCES[id.trim()]?.frequencyLabel ?? "monthly").toLowerCase();
      return freq === filter;
    });
  }
  const ids = [...new Set(candidateIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) throw new Error("indicatorIds must contain at least one indicator");
  if (ids.length > maxBatchSize) throw new Error(`indicatorIds exceeds the maximum batch size of ${maxBatchSize}`);
  const maxAttempts = Math.max(1, Number(options.maxAttempts ?? process.env.INGESTION_MAX_ATTEMPTS ?? 3));
  const baseDelayMs = Math.max(0, Number(options.baseDelayMs ?? process.env.INGESTION_RETRY_BASE_MS ?? 1_000));
  const ingest = options.ingest ?? ingestIndicator;
  const results: BoundedIngestionResult[] = [];
  for (const indicatorId of ids) {
    try {
      const outcome = await runWithRetry(() => ingest(indicatorId), { maxAttempts, baseDelayMs });
      results.push({ indicatorId, ok: true, attempts: outcome.attempts, retryDecisions: outcome.decisions });
    } catch (error) {
      const retryError = error as Error & { ingestionAttempts?: number; retryDecisions?: unknown[] };
      results.push({ indicatorId, ok: false, attempts: retryError.ingestionAttempts ?? maxAttempts, error: retryError.message, retryDecisions: retryError.retryDecisions });
    }
  }
  return {
    accepted: ids.length,
    succeeded: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    results,
    evidence: "ingestion-orchestration",
    limitations: ["Batch results describe bounded ingestion attempts; they do not prove source rights, current freshness or production availability."],
  };
}

export async function runScheduledIngestion(options?: { frequency?: string }) {
  if (running) return { skipped: true, reason: "previous-run-active" };
  const ids = configuredIds(options?.frequency);
  if (ids.length === 0) return { skipped: true, reason: "no-indicators-configured" };
  running = true;
  const results: Array<{ indicatorId: string; ok: boolean; attempts: number; error?: string; retryDecisions?: unknown[]; feedback?: unknown }> = [];
  const maxAttempts = Math.max(1, Number(process.env.INGESTION_MAX_ATTEMPTS ?? 3));
  const baseDelayMs = Math.max(0, Number(process.env.INGESTION_RETRY_BASE_MS ?? 1_000));
  try {
    for (const indicatorId of ids) {
      try {
        const outcome = await runWithRetry(() => ingestIndicator(indicatorId), { maxAttempts, baseDelayMs });
        let feedback;
        try {
          feedback = await runForecastOutcomeFeedback(indicatorId);
        } catch (error) {
          feedback = { error: error instanceof Error ? error.message : String(error) };
        }
        results.push({ indicatorId, ok: true, attempts: outcome.attempts, retryDecisions: outcome.decisions, feedback });
      } catch (error) {
        const retryError = error as Error & { ingestionAttempts?: number; retryDecisions?: unknown[] };
        results.push({
          indicatorId,
          ok: false,
          attempts: retryError.ingestionAttempts ?? maxAttempts,
          error: retryError.message,
          retryDecisions: retryError.retryDecisions,
        });
      }
    }
    recordSchedulerRun(results);
    console.log(JSON.stringify({ type: "scheduled_ingestion", results, frequency: options?.frequency ?? null }));
    return { skipped: false, results };
  } finally {
    running = false;
  }
}

export function startIngestionScheduler(options?: { frequency?: string }) {
  const minutes = Number(process.env.INGESTION_INTERVAL_MINUTES ?? 0);
  const ids = configuredIds(options?.frequency);
  if (!Number.isFinite(minutes) || minutes <= 0 || ids.length === 0) return;
  const interval = setInterval(() => void runScheduledIngestion(options), minutes * 60_000);
  interval.unref();
  console.log(JSON.stringify({
    type: "scheduler_started",
    intervalMinutes: minutes,
    indicatorIds: ids,
    frequency: options?.frequency ?? null,
  }));
}
