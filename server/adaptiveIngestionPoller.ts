import { DATA_SOURCES } from "../src/app/config/dataSources.js";
import { ingestIndicator } from "./ingestion.js";
import { classifyIngestionError } from "./retryPolicy.js";
import { defaultPrometheusRegistry } from "./otelMetrics.js";

export type PollerCircuitState = "closed" | "open" | "half-open";

export interface PollerIndicatorStatus {
  indicatorId: string;
  providerId: string;
  frequency: string;
  circuitState: PollerCircuitState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  totalPolls: number;
  totalSuccesses: number;
  totalFailures: number;
  lastPolledAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastErrorReason: string | null;
  nextEligiblePollAt: string | null;
  currentBackoffMs: number;
  freshnessStatus: "fresh" | "stale" | "unknown";
  freshnessLagDays: number | null;
}

export interface PollerCycleResult {
  indicatorId: string;
  status: "success" | "failure" | "skipped_circuit_open" | "skipped_backoff" | "skipped_cadence_window";
  attempts: number;
  error?: string;
  errorReason?: string;
  delayMs?: number;
  durationMs: number;
}

export interface PollerCycleSummary {
  cycleId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  totalConfigured: number;
  attempted: number;
  succeeded: number;
  failed: number;
  skipped: number;
  results: PollerCycleResult[];
  alertsTriggered: string[];
}

export interface PollerConfig {
  pollIntervalMs?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  backoffMultiplier?: number;
  circuitBreakerFailureThreshold?: number;
  circuitBreakerSuccessThreshold?: number;
  circuitBreakerResetTimeoutMs?: number;
  jitter?: "full" | "none";
  indicatorIds?: string[];
  ingestFn?: (indicatorId: string) => Promise<unknown>;
  nowFn?: () => number;
  enableCadenceGating?: boolean;
  minCadenceIntervalMs?: Partial<Record<string, number>>;
}

export const DEFAULT_CADENCE_INTERVAL_MS: Record<string, number> = {
  daily: 60 * 60 * 1000, // 1 hour min interval
  weekly: 24 * 60 * 60 * 1000, // 24 hours min interval
  monthly: 24 * 60 * 60 * 1000, // 24 hours min interval
  quarterly: 7 * 24 * 60 * 60 * 1000, // 7 days min interval
  annual: 30 * 24 * 60 * 60 * 1000, // 30 days min interval
  irregular: 24 * 60 * 60 * 1000,
};

const DEFAULT_STALE_LAG_DAYS: Record<string, number> = {
  daily: 5,
  monthly: 45,
  quarterly: 110,
  annual: 400,
  irregular: 90,
};

export function calculateBackoffDelay(
  consecutiveFailures: number,
  baseBackoffMs = 1000,
  maxBackoffMs = 300_000,
  backoffMultiplier = 2,
  jitter: "full" | "none" = "full",
): number {
  if (consecutiveFailures <= 0) return 0;
  const rawBackoff = Math.min(
    maxBackoffMs,
    baseBackoffMs * Math.pow(backoffMultiplier, Math.max(0, consecutiveFailures - 1)),
  );
  if (jitter === "none") {
    return rawBackoff;
  }
  // Full jitter: uniform random in [baseBackoffMs / 2, rawBackoff]
  const minJitter = Math.floor(baseBackoffMs / 2);
  return Math.floor(minJitter + Math.random() * Math.max(0, rawBackoff - minJitter));
}

export class AdaptiveIngestionPoller {
  private config: Required<PollerConfig>;
  private indicatorStates = new Map<string, PollerIndicatorStatus>();
  private recentCycles: PollerCycleSummary[] = [];
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;
  private currentCyclePromise: Promise<PollerCycleSummary> | null = null;
  private cycleCounter = 0;

  constructor(config: PollerConfig = {}) {
    this.config = {
      pollIntervalMs: config.pollIntervalMs ?? 60_000,
      baseBackoffMs: config.baseBackoffMs ?? 1000,
      maxBackoffMs: config.maxBackoffMs ?? 300_000,
      backoffMultiplier: config.backoffMultiplier ?? 2,
      circuitBreakerFailureThreshold: config.circuitBreakerFailureThreshold ?? 3,
      circuitBreakerSuccessThreshold: config.circuitBreakerSuccessThreshold ?? 2,
      circuitBreakerResetTimeoutMs: config.circuitBreakerResetTimeoutMs ?? 60_000,
      jitter: config.jitter ?? "full",
      indicatorIds: config.indicatorIds ?? Object.keys(DATA_SOURCES),
      ingestFn: config.ingestFn ?? ingestIndicator,
      nowFn: config.nowFn ?? (() => Date.now()),
      enableCadenceGating: config.enableCadenceGating ?? true,
      minCadenceIntervalMs: { ...DEFAULT_CADENCE_INTERVAL_MS, ...config.minCadenceIntervalMs },
    };

    this.initIndicators(this.config.indicatorIds);
  }

  public initIndicators(indicatorIds: string[]): void {
    for (const id of indicatorIds) {
      const sourceMeta = DATA_SOURCES[id];
      const providerId = sourceMeta?.type ?? "unknown";
      const frequency = (sourceMeta?.frequencyLabel ?? "monthly").toLowerCase();

      if (!this.indicatorStates.has(id)) {
        this.indicatorStates.set(id, {
          indicatorId: id,
          providerId,
          frequency,
          circuitState: "closed",
          consecutiveFailures: 0,
          consecutiveSuccesses: 0,
          totalPolls: 0,
          totalSuccesses: 0,
          totalFailures: 0,
          lastPolledAt: null,
          lastSuccessAt: null,
          lastError: null,
          lastErrorReason: null,
          nextEligiblePollAt: null,
          currentBackoffMs: 0,
          freshnessStatus: "unknown",
          freshnessLagDays: null,
        });
      }
    }
  }

  public getStatus() {
    const indicators = Array.from(this.indicatorStates.values());
    const totalConfigured = indicators.length;
    const circuitsOpen = indicators.filter((i) => i.circuitState === "open").length;
    const circuitsHalfOpen = indicators.filter((i) => i.circuitState === "half-open").length;
    const circuitsClosed = indicators.filter((i) => i.circuitState === "closed").length;
    const staleCount = indicators.filter((i) => i.freshnessStatus === "stale").length;

    return {
      isRunning: this.isRunning,
      pollerConfig: {
        pollIntervalMs: this.config.pollIntervalMs,
        baseBackoffMs: this.config.baseBackoffMs,
        maxBackoffMs: this.config.maxBackoffMs,
        backoffMultiplier: this.config.backoffMultiplier,
        circuitBreakerFailureThreshold: this.config.circuitBreakerFailureThreshold,
        circuitBreakerResetTimeoutMs: this.config.circuitBreakerResetTimeoutMs,
        enableCadenceGating: this.config.enableCadenceGating,
      },
      summary: {
        totalConfigured,
        circuitsClosed,
        circuitsOpen,
        circuitsHalfOpen,
        staleCount,
        totalCompletedCycles: this.recentCycles.length,
      },
      indicators,
      lastCycle: this.recentCycles[0] ?? null,
    };
  }

  public getRecentCycles(limit = 20): PollerCycleSummary[] {
    return this.recentCycles.slice(0, limit);
  }

  public getIndicatorStatus(indicatorId: string): PollerIndicatorStatus | undefined {
    return this.indicatorStates.get(indicatorId);
  }

  public evaluateFreshness(now = this.config.nowFn()): void {
    for (const state of this.indicatorStates.values()) {
      if (!state.lastSuccessAt) {
        state.freshnessStatus = "unknown";
        state.freshnessLagDays = null;
        continue;
      }
      const lastSuccessTime = Date.parse(state.lastSuccessAt);
      if (Number.isNaN(lastSuccessTime)) {
        state.freshnessStatus = "unknown";
        continue;
      }
      const lagMs = now - lastSuccessTime;
      const lagDays = Math.max(0, Math.floor(lagMs / (1000 * 60 * 60 * 24)));
      state.freshnessLagDays = lagDays;

      const thresholdDays =
        DEFAULT_STALE_LAG_DAYS[state.frequency] ?? DEFAULT_STALE_LAG_DAYS.monthly;

      state.freshnessStatus = lagDays > thresholdDays ? "stale" : "fresh";
    }
  }

  public async runPollCycle(targetIndicatorIds?: string[]): Promise<PollerCycleSummary> {
    const cycleId = `cycle-${Date.now()}-${++this.cycleCounter}`;
    const startedAtMs = this.config.nowFn();
    const startedAt = new Date(startedAtMs).toISOString();

    const idsToProcess = targetIndicatorIds ?? Array.from(this.indicatorStates.keys());
    const results: PollerCycleResult[] = [];
    const alertsTriggered: string[] = [];

    // Evaluate freshness at start of cycle
    this.evaluateFreshness(startedAtMs);
    for (const st of this.indicatorStates.values()) {
      if (st.freshnessStatus === "stale") {
        alertsTriggered.push(
          `[FreshnessAlert] Indicator ${st.indicatorId} is STALE (lag: ${st.freshnessLagDays} days, frequency: ${st.frequency})`,
        );
      }
    }

    let succeeded = 0;
    let failed = 0;
    let skipped = 0;

    for (const id of idsToProcess) {
      let state = this.indicatorStates.get(id);
      if (!state) {
        this.initIndicators([id]);
        state = this.indicatorStates.get(id)!;
      }

      const now = this.config.nowFn();

      // Check Circuit Breaker & Backoff / Cadence Eligibility
      if (state.circuitState === "open") {
        const nextEligibleTime = state.nextEligiblePollAt ? Date.parse(state.nextEligiblePollAt) : 0;
        if (now < nextEligibleTime) {
          skipped += 1;
          results.push({
            indicatorId: id,
            status: "skipped_circuit_open",
            attempts: 0,
            durationMs: 0,
          });
          continue;
        }
        // Timeout expired: transition circuit to half-open to test canary call
        state.circuitState = "half-open";
      } else if (state.circuitState === "closed" && state.nextEligiblePollAt) {
        const nextEligibleTime = Date.parse(state.nextEligiblePollAt);
        if (now < nextEligibleTime) {
          skipped += 1;
          const status = state.consecutiveFailures > 0 ? "skipped_backoff" : "skipped_cadence_window";
          results.push({
            indicatorId: id,
            status,
            attempts: 0,
            durationMs: 0,
          });
          continue;
        }
      }

      // Execute Ingestion with Adaptive Timing
      state.totalPolls += 1;
      state.lastPolledAt = new Date(now).toISOString();
      const opStart = this.config.nowFn();

      try {
        await this.config.ingestFn(id);
        const durationMs = this.config.nowFn() - opStart;

        state.totalSuccesses += 1;
        state.consecutiveSuccesses += 1;
        state.consecutiveFailures = 0;
        state.lastSuccessAt = new Date(this.config.nowFn()).toISOString();
        state.lastError = null;
        state.lastErrorReason = null;
        state.currentBackoffMs = 0;

        if (
          state.circuitState === "half-open" &&
          state.consecutiveSuccesses >= this.config.circuitBreakerSuccessThreshold
        ) {
          state.circuitState = "closed";
        }

        if (this.config.enableCadenceGating && state.circuitState === "closed") {
          const minInterval =
            this.config.minCadenceIntervalMs[state.frequency] ??
            DEFAULT_CADENCE_INTERVAL_MS[state.frequency] ??
            DEFAULT_CADENCE_INTERVAL_MS.monthly;
          const nextTime = this.config.nowFn() + minInterval;
          state.nextEligiblePollAt = new Date(nextTime).toISOString();
        } else {
          state.nextEligiblePollAt = null;
        }

        succeeded += 1;
        results.push({
          indicatorId: id,
          status: "success",
          attempts: 1,
          durationMs,
        });

        // Record metrics
        defaultPrometheusRegistry.incrementCounter("ingestion_pipeline_jobs_total", {
          status: "success",
          indicator: id,
        });
      } catch (error) {
        const durationMs = this.config.nowFn() - opStart;
        const errMessage = error instanceof Error ? error.message : String(error);
        const classification = classifyIngestionError(error, 1, 3, this.config.baseBackoffMs);

        state.totalFailures += 1;
        state.consecutiveFailures += 1;
        state.consecutiveSuccesses = 0;
        state.lastError = errMessage;
        state.lastErrorReason = classification.reason;

        // Calculate next adaptive backoff delay with jitter
        const backoffMs = calculateBackoffDelay(
          state.consecutiveFailures,
          this.config.baseBackoffMs,
          this.config.maxBackoffMs,
          this.config.backoffMultiplier,
          this.config.jitter,
        );
        state.currentBackoffMs = backoffMs;
        const nextTime = this.config.nowFn() + backoffMs;
        state.nextEligiblePollAt = new Date(nextTime).toISOString();

        // Circuit breaker tripping check
        if (state.consecutiveFailures >= this.config.circuitBreakerFailureThreshold) {
          state.circuitState = "open";
          const alert = `[CircuitBreaker] Indicator ${id} tripped OPEN after ${state.consecutiveFailures} consecutive failures (reason: ${classification.reason})`;
          alertsTriggered.push(alert);
        }

        failed += 1;
        results.push({
          indicatorId: id,
          status: "failure",
          attempts: 1,
          error: errMessage,
          errorReason: classification.reason,
          delayMs: backoffMs,
          durationMs,
        });

        defaultPrometheusRegistry.incrementCounter("ingestion_pipeline_jobs_total", {
          status: "failure",
          indicator: id,
        });
      }
    }

    // Re-evaluate freshness after batch completion
    this.evaluateFreshness(this.config.nowFn());

    const completedAtMs = this.config.nowFn();
    const completedAt = new Date(completedAtMs).toISOString();
    const totalDurationMs = completedAtMs - startedAtMs;

    const summary: PollerCycleSummary = {
      cycleId,
      startedAt,
      completedAt,
      durationMs: totalDurationMs,
      totalConfigured: idsToProcess.length,
      attempted: succeeded + failed,
      succeeded,
      failed,
      skipped,
      results,
      alertsTriggered,
    };

    this.recentCycles.unshift(summary);
    if (this.recentCycles.length > 50) {
      this.recentCycles.pop();
    }

    defaultPrometheusRegistry.incrementCounter("scheduler_runs_total", {
      type: "adaptive_poller",
    });

    return summary;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const scheduleNext = () => {
      if (!this.isRunning) return;
      this.timer = setTimeout(async () => {
        if (!this.isRunning) return;
        try {
          this.currentCyclePromise = this.runPollCycle();
          await this.currentCyclePromise;
        } catch {
          // Keep worker running despite unexpected cycle error
        } finally {
          this.currentCyclePromise = null;
          scheduleNext();
        }
      }, this.config.pollIntervalMs);
    };

    scheduleNext();
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.currentCyclePromise) {
      await this.currentCyclePromise;
    }
  }

  public reset(): void {
    this.indicatorStates.clear();
    this.recentCycles = [];
    this.cycleCounter = 0;
    this.initIndicators(this.config.indicatorIds);
  }
}

export const defaultAdaptivePoller = new AdaptiveIngestionPoller();
