export type SchedulerResult = { indicatorId: string; ok: boolean; attempts: number; error?: string; retryDecisions?: unknown[] };
type SchedulerRun = { completedAt: string; results: SchedulerResult[] };

const state = {
  runs: 0,
  successfulIndicators: 0,
  failedIndicators: 0,
  retriedIndicators: 0,
  attempts: 0,
  lastRun: null as SchedulerRun | null,
  recentRuns: [] as SchedulerRun[],
};

export function recordSchedulerRun(results: SchedulerResult[], completedAt = new Date().toISOString()) {
  const run = { completedAt, results: results.map((result) => ({ ...result })) };
  state.runs += 1;
  state.successfulIndicators += results.filter((result) => result.ok).length;
  state.failedIndicators += results.filter((result) => !result.ok).length;
  state.retriedIndicators += results.filter((result) => result.attempts > 1).length;
  state.attempts += results.reduce((total, result) => total + result.attempts, 0);
  state.lastRun = run;
  state.recentRuns.unshift(run);
  state.recentRuns = state.recentRuns.slice(0, 20);
}

export function getSchedulerMetrics() {
  return {
    evidence: "runtime-scheduler",
    counters: {
      runs: state.runs,
      successfulIndicators: state.successfulIndicators,
      failedIndicators: state.failedIndicators,
      retriedIndicators: state.retriedIndicators,
      attempts: state.attempts,
    },
    lastRun: state.lastRun,
    recentRuns: state.recentRuns,
    limitations: [
      "Metrics are process-local runtime telemetry and are not durable across restarts unless exported to an external monitoring system.",
      "Scheduler health does not prove observation correctness, provider rights or production readiness.",
    ],
  };
}

export function buildPersistedIngestionMetrics(jobs: Array<{ status?: unknown; attempts?: unknown; indicatorId?: unknown; claimedAt?: unknown; completedAt?: unknown; errorMessage?: unknown }>, now = new Date(), staleAfterMs = 30 * 60_000) {
  const numericAttempts = jobs.map((job) => Number(job.attempts)).filter(Number.isFinite);
  const failed = jobs.filter((job) => job.status === "failed");
  const staleBefore = now.getTime() - staleAfterMs;
  const claimed = jobs.filter((job) => job.status === "claimed");
  const stale = claimed.filter((job) => typeof job.claimedAt === "string" && Date.parse(job.claimedAt) <= staleBefore);
  return {
    evidence: "persisted-ingestion-jobs",
    counters: {
      jobs: jobs.length,
      active: claimed.length - stale.length,
      stale: stale.length,
      succeeded: jobs.filter((job) => job.status === "succeeded").length,
      failed: failed.length,
      recovered: jobs.filter((job) => job.status === "recovered").length,
      retried: numericAttempts.filter((attempts) => attempts > 1).length,
      attempts: numericAttempts.reduce((sum, attempts) => sum + attempts, 0),
    },
    latestFailures: [...failed, ...stale.map((job) => ({ ...job, errorMessage: job.errorMessage ?? "stale claim requires recovery" }))].slice(0, 20).map((job) => ({ indicatorId: job.indicatorId, claimedAt: job.claimedAt, completedAt: job.completedAt, errorMessage: job.errorMessage })),
    limitations: ["Persisted job metrics show orchestration state, not observation correctness, provider rights or research eligibility."],
  };
}

export function resetSchedulerMetricsForTests() {
  state.runs = 0;
  state.successfulIndicators = 0;
  state.failedIndicators = 0;
  state.retriedIndicators = 0;
  state.attempts = 0;
  state.lastRun = null;
  state.recentRuns = [];
}
