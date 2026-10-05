import type { Request, Response, NextFunction } from "express";

export interface RateLimiterOptions {
  /** Maximum burst token capacity (limit per window) */
  max: number;
  /** Window duration in milliseconds (default: 60,000 ms = 1 minute) */
  windowMs?: number;
  /** Optional custom token refill rate per millisecond. Defaults to max / windowMs */
  refillRatePerMs?: number;
  /** Custom key extractor for identifying clients (defaults to IP or Authorization header) */
  keyGenerator?: (req: Request) => string;
  /** Error message or payload sent on HTTP 429 */
  message?: string | Record<string, unknown>;
  /** HTTP status code on limit breach (default: 429) */
  statusCode?: number;
  /** Whether to attach standard RateLimit headers (default: true) */
  headers?: boolean;
  /** Custom skip predicate */
  skip?: (req: Request) => boolean;
}

export interface BucketState {
  tokens: number;
  lastRefill: number;
}

export interface TokenBucketLimiter {
  (req: Request, res: Response, next: NextFunction): void;
  reset: () => void;
  getBucket: (key: string) => BucketState | undefined;
  consume: (key: string, count?: number) => { allowed: boolean; remaining: number; resetMs: number };
}

/**
 * Creates a token-bucket rate limiter middleware.
 * Tokens refill continuously over time up to `max` capacity.
 */
export function createTokenBucketLimiter(options: RateLimiterOptions): TokenBucketLimiter {
  const max = Math.max(1, options.max);
  const windowMs = Math.max(100, options.windowMs ?? 60_000);
  const refillRatePerMs = options.refillRatePerMs ?? max / windowMs;
  const statusCode = options.statusCode ?? 429;
  const includeHeaders = options.headers ?? true;
  const message = options.message ?? { error: "Rate limit exceeded" };

  const defaultKeyGen = (req: Request): string => {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith("Bearer ")) {
      return `auth:${auth.slice(7)}`;
    }
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string") {
      return `ip:${forwarded.split(",")[0].trim()}`;
    }
    return `ip:${req.ip || req.socket.remoteAddress || "127.0.0.1"}`;
  };

  const keyGen = options.keyGenerator ?? defaultKeyGen;
  const buckets = new Map<string, BucketState>();

  const consume = (key: string, count = 1): { allowed: boolean; remaining: number; resetMs: number } => {
    const now = Date.now();
    let state = buckets.get(key);

    if (!state) {
      state = { tokens: max, lastRefill: now };
    } else {
      // Calculate continuous refill
      const elapsed = Math.max(0, now - state.lastRefill);
      const refilledTokens = elapsed * refillRatePerMs;
      state.tokens = Math.min(max, state.tokens + refilledTokens);
      state.lastRefill = now;
    }

    if (state.tokens >= count) {
      state.tokens -= count;
      buckets.set(key, state);
      const deficit = max - state.tokens;
      const resetMs = Math.ceil(deficit / refillRatePerMs);
      return { allowed: true, remaining: Math.floor(state.tokens), resetMs };
    } else {
      buckets.set(key, state);
      const needed = count - state.tokens;
      const resetMs = Math.ceil(needed / refillRatePerMs);
      return { allowed: false, remaining: 0, resetMs };
    }
  };

  const middleware: TokenBucketLimiter = Object.assign(
    (req: Request, res: Response, next: NextFunction): void => {
      if (options.skip && options.skip(req)) {
        return next();
      }

      const key = keyGen(req);
      const result = consume(key, 1);

      if (includeHeaders) {
        res.setHeader("RateLimit-Limit", String(max));
        res.setHeader("RateLimit-Remaining", String(result.remaining));
        res.setHeader("RateLimit-Reset", String(Math.ceil(result.resetMs / 1000)));
      }

      if (!result.allowed) {
        if (includeHeaders) {
          res.setHeader("Retry-After", String(Math.max(1, Math.ceil(result.resetMs / 1000))));
        }
        res.status(statusCode).json(typeof message === "string" ? { error: message } : message);
        return;
      }

      next();
    },
    {
      reset: () => buckets.clear(),
      getBucket: (key: string) => buckets.get(key),
      consume,
    }
  );

  return middleware;
}

/** Pre-configured Token-Bucket Limiter for Admin Endpoints (60 req/min) */
export const adminTokenBucketLimiter = createTokenBucketLimiter({
  max: 60,
  windowMs: 60_000,
  // Unauthenticated callers control bearer/forwarded headers. The local API
  // has no trusted proxy; use its actual peer so rotating headers cannot mint
  // unlimited admin buckets or evade the shared request budget.
  keyGenerator: (req) => `peer:${req.socket.remoteAddress ?? "unknown"}`,
  message: { error: "Rate limit exceeded" },
});

/** Pre-configured Token-Bucket Limiter for LLM Debate Generation (10 req/min) */
export const llmDebateTokenBucketLimiter = createTokenBucketLimiter({
  max: 10,
  windowMs: 60_000,
  message: { error: "LLM debate quota exceeded. Maximum 10 requests per minute." },
});

/** Pre-configured Token-Bucket Limiter for Ingestion Invocations (30 req/min) */
export const ingestionTokenBucketLimiter = createTokenBucketLimiter({
  max: 30,
  windowMs: 60_000,
  message: { error: "Data ingestion rate limit exceeded. Maximum 30 requests per minute." },
});
