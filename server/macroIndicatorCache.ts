/**
 * macroIndicatorCache.ts — TTL-based Cache Layer for Macro Data
 *
 * Adapted from TradingAgents data caching pattern.
 * Provides frequency-aware TTL: monthly data caches for 24h, daily for 1h.
 *
 * Key features:
 *   - Frequency-aware TTL (monthly → 24h, weekly → 6h, daily → 1h)
 *   - Stale-with-warning return: never silently drop old data
 *   - Audit log for every cache hit/miss (for provenance)
 *   - LRU-style eviction when max entries exceeded
 *
 * PRODUCT_GOAL.md: "Everything is Traceable" — cache hits are logged.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type CacheVendor = "fred" | "openbb" | "local";

export type CachedMacroDataPoint = {
  date: string;
  value: number;
  status: "actual" | "estimated" | "forecast";
  vintage?: string;
};

export interface CacheEntry {
  data: CachedMacroDataPoint[];
  fetchedAt: string;
}

interface InternalEntry {
  entry: CacheEntry;
  storedAt: number;
  ttlMs: number;
  vendor: CacheVendor;
  hitCount: number;
}

export interface CacheHit {
  data: CacheEntry["data"];
  fetchedAt: string;
  isStale: boolean;
  staleness?: string;
}

// ─── TTL Config ───────────────────────────────────────────────────────────────

/** TTL per vendor data type (in milliseconds) */
const VENDOR_TTL: Record<CacheVendor, number> = {
  fred: 24 * 60 * 60 * 1000,      // 24h — FRED data is released monthly/weekly
  openbb: 6 * 60 * 60 * 1000,     // 6h  — OpenBB aggregation may update intraday
  local: 60 * 60 * 1000,          // 1h  — Local/daily data
};

/** Extended TTL for stale-but-usable data (before complete eviction) */
const STALE_GRACE_MULTIPLIER = 3;

/** Max entries before LRU eviction */
const MAX_ENTRIES = 500;

// ─── Cache Store ──────────────────────────────────────────────────────────────

class MacroIndicatorCache {
  private store = new Map<string, InternalEntry>();
  private accessOrder: string[] = [];

  get(key: string, vendor: CacheVendor): CacheHit | null {
    const entry = this.store.get(key);
    if (!entry) {
      this.auditLog("miss", key, vendor);
      return null;
    }

    const ageMs = Date.now() - entry.storedAt;
    const isStale = ageMs > entry.ttlMs;
    const isExpired = ageMs > entry.ttlMs * STALE_GRACE_MULTIPLIER;

    if (isExpired) {
      this.store.delete(key);
      this.auditLog("expired", key, vendor);
      return null;
    }

    // Update access order for LRU
    entry.hitCount++;
    this.updateAccessOrder(key);
    this.auditLog(isStale ? "stale-hit" : "hit", key, vendor);

    return {
      data: entry.entry.data,
      fetchedAt: entry.entry.fetchedAt,
      isStale,
      staleness: isStale
        ? `${Math.round(ageMs / 60_000)}m since last fetch (TTL: ${Math.round(entry.ttlMs / 60_000)}m)`
        : undefined,
    };
  }

  set(key: string, entry: CacheEntry, vendor: CacheVendor): void {
    // LRU eviction if at capacity
    if (this.store.size >= MAX_ENTRIES && !this.store.has(key)) {
      const oldest = this.accessOrder.shift();
      if (oldest) this.store.delete(oldest);
    }

    this.store.set(key, {
      entry,
      storedAt: Date.now(),
      ttlMs: VENDOR_TTL[vendor],
      vendor,
      hitCount: 0,
    });
    this.updateAccessOrder(key);
    this.auditLog("set", key, vendor);
  }

  /** Invalidate all entries for a given vendor */
  invalidateVendor(vendor: CacheVendor): number {
    let count = 0;
    for (const [key, entry] of this.store.entries()) {
      if (entry.vendor === vendor) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  /** Get cache statistics for monitoring */
  stats(): {
    totalEntries: number;
    staleEntries: number;
    byVendor: Record<CacheVendor, number>;
  } {
    const now = Date.now();
    let staleEntries = 0;
    const byVendor: Record<CacheVendor, number> = { fred: 0, openbb: 0, local: 0 };

    for (const entry of this.store.values()) {
      if (now - entry.storedAt > entry.ttlMs) staleEntries++;
      byVendor[entry.vendor] = (byVendor[entry.vendor] ?? 0) + 1;
    }

    return { totalEntries: this.store.size, staleEntries, byVendor };
  }

  private updateAccessOrder(key: string): void {
    const idx = this.accessOrder.indexOf(key);
    if (idx !== -1) this.accessOrder.splice(idx, 1);
    this.accessOrder.push(key);
  }

  private auditLog(
    event: "hit" | "miss" | "stale-hit" | "expired" | "set",
    key: string,
    vendor: CacheVendor,
  ): void {
    if (process.env.NODE_ENV === "test") return;
    console.log(
      JSON.stringify({
        type: "macro_cache",
        event,
        key: key.slice(0, 60),
        vendor,
        size: this.store.size,
      }),
    );
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

/**
 * Singleton cache instance shared across all server routes.
 * Import this wherever macro data is fetched.
 *
 * @example
 * import { macroIndicatorCache } from "./macroIndicatorCache.js";
 * const cached = macroIndicatorCache.get("CPIAUCSL:365:2024-06-01", "fred");
 */
export const macroIndicatorCache = new MacroIndicatorCache();
