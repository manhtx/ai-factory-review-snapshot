export type RetryDecision = { retryable: boolean; reason: "timeout" | "rate-limit" | "server-error" | "network" | "contract" | "unknown"; delayMs: number };

export function classifyIngestionError(error: unknown, attempt: number, maxAttempts: number, baseDelayMs: number): RetryDecision {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  const reason: RetryDecision["reason"] = normalized.includes("timeout") || normalized.includes("timed out")
    ? "timeout"
    : normalized.includes("429") || normalized.includes("rate limit") || normalized.includes("too many requests")
      ? "rate-limit"
      : /\b5\d\d\b/.test(normalized) || normalized.includes("service unavailable")
        ? "server-error"
        : normalized.includes("fetch failed") || normalized.includes("network") || normalized.includes("econn")
          ? "network"
          : normalized.includes("contract") || normalized.includes("quarantin") || normalized.includes("manual") || normalized.includes("no valid observations")
            ? "contract"
            : "unknown";
  const retryable = reason !== "contract" && reason !== "unknown" && attempt < maxAttempts;
  return { retryable, reason, delayMs: retryable ? Math.min(baseDelayMs * (2 ** Math.max(0, attempt - 1)), 60_000) : 0 };
}

export async function runWithRetry<T>(operation: () => Promise<T>, options?: { maxAttempts?: number; baseDelayMs?: number; sleep?: (delayMs: number) => Promise<void> }) {
  const maxAttempts = Math.max(1, Math.floor(options?.maxAttempts ?? 3));
  const baseDelayMs = Math.max(0, options?.baseDelayMs ?? 1_000);
  const sleep = options?.sleep ?? ((delayMs: number) => new Promise<void>((resolve) => setTimeout(resolve, delayMs)));
  const decisions: RetryDecision[] = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return { value: await operation(), attempts: attempt, decisions };
    } catch (error) {
      const decision = classifyIngestionError(error, attempt, maxAttempts, baseDelayMs);
      decisions.push(decision);
      if (!decision.retryable) throw Object.assign(error instanceof Error ? error : new Error(String(error)), { ingestionAttempts: attempt, retryDecisions: decisions });
      await sleep(decision.delayMs);
    }
  }
  throw new Error("Retry loop exhausted without a result");
}
