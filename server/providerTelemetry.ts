export type ProviderTelemetryInput = { providerId: string; status: string; durationMs?: number | null; completedAt?: string | null };

export type ProviderTelemetry = {
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
};

export type ProviderDegradationThresholds = { minimumAttempts: number; failureRate: number; p95DurationMs: number; maxFreshnessBreaches: number };
export const DEFAULT_PROVIDER_DEGRADATION_THRESHOLDS: ProviderDegradationThresholds = { minimumAttempts: 3, failureRate: 0.25, p95DurationMs: 5_000, maxFreshnessBreaches: 0 };
export type ProviderDegradation = { providerId: string; status: "ok" | "attention" | "insufficient-evidence"; reasons: string[]; evidence: "orchestration-telemetry"; thresholds: ProviderDegradationThresholds };
export type ProviderTelemetryTrend = { providerId: string; windowDays: number; current: { attempts: number; failureRate: number | null; p95DurationMs: number | null }; previous: { attempts: number; failureRate: number | null; p95DurationMs: number | null }; direction: "improving" | "worsening" | "stable" | "insufficient-evidence"; evidence: "orchestration-telemetry" };

function percentile(values: number[], fraction: number): number | null {
  if (!values.length) return null;
  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * fraction) - 1));
  return values[index];
}

export function buildProviderTelemetry(runs: ProviderTelemetryInput[], providerIds?: string[]): ProviderTelemetry[] {
  const ids = [...new Set([...(providerIds ?? []), ...runs.map((run) => run.providerId)])].sort();
  return ids.map((providerId) => {
    const providerRuns = runs.filter((run) => run.providerId === providerId);
    const durations = providerRuns.map((run) => run.durationMs).filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
    const succeeded = providerRuns.filter((run) => run.status === "succeeded").length;
    const failed = providerRuns.filter((run) => ["failed", "quarantined"].includes(run.status)).length;
    const attempts = providerRuns.length;
    return {
      providerId,
      attempts,
      succeeded,
      failed,
      successRate: attempts ? succeeded / attempts : null,
      failureRate: attempts ? failed / attempts : null,
      freshnessBreachCount: providerRuns.filter((run) => ["stale", "outdated"].includes(run.status)).length,
      durationSamples: durations.length,
      p50DurationMs: percentile(durations, 0.5),
      p95DurationMs: percentile(durations, 0.95),
      evidence: "orchestration-telemetry" as const,
    };
  });
}

export function evaluateProviderDegradation(telemetry: ProviderTelemetry, thresholds = DEFAULT_PROVIDER_DEGRADATION_THRESHOLDS): ProviderDegradation {
  if (telemetry.attempts < thresholds.minimumAttempts) return { providerId: telemetry.providerId, status: "insufficient-evidence", reasons: [`requires at least ${thresholds.minimumAttempts} recorded attempts`], evidence: "orchestration-telemetry", thresholds };
  const reasons: string[] = [];
  if (telemetry.failureRate != null && telemetry.failureRate > thresholds.failureRate) reasons.push(`failure rate ${Math.round(telemetry.failureRate * 100)}% exceeds ${Math.round(thresholds.failureRate * 100)}%`);
  if (telemetry.p95DurationMs != null && telemetry.p95DurationMs > thresholds.p95DurationMs) reasons.push(`p95 duration ${telemetry.p95DurationMs}ms exceeds ${thresholds.p95DurationMs}ms`);
  if (telemetry.freshnessBreachCount > thresholds.maxFreshnessBreaches) reasons.push(`${telemetry.freshnessBreachCount} freshness breach(es) recorded`);
  return { providerId: telemetry.providerId, status: reasons.length ? "attention" : "ok", reasons, evidence: "orchestration-telemetry", thresholds };
}

export function buildProviderTelemetryTrend(runs: ProviderTelemetryInput[], providerIds?: string[], now = new Date(), windowDays = 7): ProviderTelemetryTrend[] {
  const cutoff = now.getTime() - windowDays * 86_400_000;
  const previousCutoff = cutoff - windowDays * 86_400_000;
  const ids = [...new Set([...(providerIds ?? []), ...runs.map((run) => run.providerId)])].sort();
  return ids.map((providerId) => {
    const dated = runs.filter((run) => run.providerId === providerId && run.completedAt && Number.isFinite(Date.parse(run.completedAt)));
    const current = buildProviderTelemetry(dated.filter((run) => Date.parse(run.completedAt!) >= cutoff), [providerId])[0];
    const previous = buildProviderTelemetry(dated.filter((run) => Date.parse(run.completedAt!) >= previousCutoff && Date.parse(run.completedAt!) < cutoff), [providerId])[0];
    let direction: ProviderTelemetryTrend["direction"] = "insufficient-evidence";
    if (current.attempts > 0 && previous.attempts > 0) {
      const currentScore = (current.failureRate ?? 0) + (current.p95DurationMs ?? 0) / 100_000;
      const previousScore = (previous.failureRate ?? 0) + (previous.p95DurationMs ?? 0) / 100_000;
      direction = currentScore < previousScore ? "improving" : currentScore > previousScore ? "worsening" : "stable";
    }
    return { providerId, windowDays, current: { attempts: current.attempts, failureRate: current.failureRate, p95DurationMs: current.p95DurationMs }, previous: { attempts: previous.attempts, failureRate: previous.failureRate, p95DurationMs: previous.p95DurationMs }, direction, evidence: "orchestration-telemetry" };
  });
}
