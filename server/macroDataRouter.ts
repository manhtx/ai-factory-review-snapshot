/**
 * macroDataRouter.ts — Abstract Macro Data Routing Layer
 *
 * Adapted from TradingAgents `route_to_vendor()` pattern in:
 *   tradingagents/dataflows/interface.py
 *
 * Provides a unified interface for fetching macro indicator data from:
 *   1. FRED (Federal Reserve Economic Data) — primary for US indicators
 *   2. OpenBB — multi-source aggregator
 *   3. Local cache — TTL-based fallback with staleness warnings
 *
 * Usage pattern (mirrors TradingAgents @tool decorator):
 *   const data = await routeToVendor({ indicator: "cpi", lookbackDays: 365 });
 *
 * Key differences from TradingAgents:
 *   - TypeScript (not Python)
 *   - Returns structured MacroDataResult (not raw string)
 *   - Enforces provenance requirements from PRODUCT_GOAL.md
 *   - Never returns mock/estimated data as actual
 */

import { macroIndicatorCache } from "./macroIndicatorCache.js";
import { validateProviderQuery } from "./providerContract.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MacroDataQuery {
  /** Friendly alias (e.g. 'cpi', 'fed_rate') or raw FRED series ID (e.g. 'CPIAUCSL') */
  indicator: string;
  /** Trailing window in days. Default: 365 */
  lookbackDays?: number;
  /** End date in YYYY-MM-DD. Default: today */
  asOf?: string;
}

export interface MacroDataPoint {
  date: string;
  value: number;
  status: "actual" | "estimated" | "forecast";
  vintage?: string;
}

export interface MacroDataResult {
  indicatorAlias: string;
  resolvedSeriesId: string;
  vendor: "fred" | "openbb" | "cache" | "unavailable";
  sourceName: string;
  sourceUrl: string | null;
  transformation: string;
  seasonalAdjustment: string;
  data: MacroDataPoint[];
  fetchedAt: string;
  /** If true, data came from cache (potentially stale) */
  fromCache: boolean;
  /** Stale-with-warning flag */
  isStale: boolean;
  staleness?: string;
  limitation: string;
}

// ─── FRED Series Aliases ──────────────────────────────────────────────────────
// Mirrors TradingAgents macro_data_tools.py alias mapping

const FRED_ALIAS_MAP: Record<string, { seriesId: string; name: string; transformation: string; seasonalAdjustment: string }> = {
  // US Inflation
  cpi: {
    seriesId: "CPIAUCSL",
    name: "Consumer Price Index (Urban)",
    transformation: "yoy",
    seasonalAdjustment: "seasonally-adjusted",
  },
  core_pce: {
    seriesId: "PCEPILFE",
    name: "Core PCE Price Index",
    transformation: "yoy",
    seasonalAdjustment: "seasonally-adjusted",
  },
  core_cpi: {
    seriesId: "CPILFESL",
    name: "Core CPI (ex Food & Energy)",
    transformation: "yoy",
    seasonalAdjustment: "seasonally-adjusted",
  },
  pce: {
    seriesId: "PCEPI",
    name: "PCE Price Index",
    transformation: "yoy",
    seasonalAdjustment: "seasonally-adjusted",
  },

  // US Labor Market
  unemployment: {
    seriesId: "UNRATE",
    name: "Unemployment Rate",
    transformation: "level",
    seasonalAdjustment: "seasonally-adjusted",
  },
  initial_claims: {
    seriesId: "ICSA",
    name: "Initial Jobless Claims",
    transformation: "level",
    seasonalAdjustment: "seasonally-adjusted",
  },
  nonfarm_payrolls: {
    seriesId: "PAYEMS",
    name: "Total Nonfarm Payrolls",
    transformation: "change",
    seasonalAdjustment: "seasonally-adjusted",
  },

  // US Monetary Policy
  fed_funds_rate: {
    seriesId: "FEDFUNDS",
    name: "Federal Funds Effective Rate",
    transformation: "level",
    seasonalAdjustment: "not-seasonally-adjusted",
  },
  fed_funds_target: {
    seriesId: "DFEDTARU",
    name: "Federal Funds Target Rate (Upper Bound)",
    transformation: "level",
    seasonalAdjustment: "not-seasonally-adjusted",
  },

  // US Bond Market
  "10y_treasury": {
    seriesId: "DGS10",
    name: "10-Year Treasury Constant Maturity Rate",
    transformation: "level",
    seasonalAdjustment: "not-seasonally-adjusted",
  },
  "2y_treasury": {
    seriesId: "DGS2",
    name: "2-Year Treasury Constant Maturity Rate",
    transformation: "level",
    seasonalAdjustment: "not-seasonally-adjusted",
  },
  yield_curve: {
    seriesId: "T10Y2Y",
    name: "10-Year/2-Year Treasury Yield Spread",
    transformation: "level",
    seasonalAdjustment: "not-seasonally-adjusted",
  },
  tips_10y: {
    seriesId: "DFII10",
    name: "10-Year TIPS Rate",
    transformation: "level",
    seasonalAdjustment: "not-seasonally-adjusted",
  },

  // US GDP
  real_gdp: {
    seriesId: "GDPC1",
    name: "Real Gross Domestic Product",
    transformation: "yoy",
    seasonalAdjustment: "seasonally-adjusted-annual-rate",
  },
  gdp_growth: {
    seriesId: "A191RL1Q225SBEA",
    name: "Real GDP Growth Rate (Quarterly)",
    transformation: "level",
    seasonalAdjustment: "seasonally-adjusted-annual-rate",
  },

  // US Risk Indicators
  vix: {
    seriesId: "VIXCLS",
    name: "CBOE Volatility Index (VIX)",
    transformation: "level",
    seasonalAdjustment: "not-seasonally-adjusted",
  },
  credit_spread: {
    seriesId: "BAMLH0A0HYM2",
    name: "ICE BofA US High Yield OAS",
    transformation: "level",
    seasonalAdjustment: "not-seasonally-adjusted",
  },
  ted_spread: {
    seriesId: "TEDRATE",
    name: "TED Spread",
    transformation: "level",
    seasonalAdjustment: "not-seasonally-adjusted",
  },

  // US Currency
  dxy: {
    seriesId: "DTWEXBGS",
    name: "Trade Weighted US Dollar Index (Broad)",
    transformation: "level",
    seasonalAdjustment: "not-seasonally-adjusted",
  },

  // Vietnam (direct series IDs — no FRED equivalent, fallback to OpenBB)
  vn_cpi: { seriesId: "VN_CPI", name: "Vietnam CPI", transformation: "yoy", seasonalAdjustment: "unknown" },
  vn_gdp: { seriesId: "VN_GDP", name: "Vietnam GDP Growth", transformation: "yoy", seasonalAdjustment: "unknown" },
};

// ─── Resolve alias ────────────────────────────────────────────────────────────

function resolveAlias(indicator: string): {
  seriesId: string;
  name: string;
  transformation: string;
  seasonalAdjustment: string;
  vendor: "fred" | "openbb";
} {
  const lower = indicator.toLowerCase().replace(/ /g, "_");
  const mapped = FRED_ALIAS_MAP[lower];
  if (mapped) {
    return { ...mapped, vendor: mapped.seriesId.startsWith("VN_") ? "openbb" : "fred" };
  }
  // Treat as raw FRED series ID
  return {
    seriesId: indicator.toUpperCase(),
    name: indicator,
    transformation: "level",
    seasonalAdjustment: "unknown",
    vendor: "fred",
  };
}

// ─── FRED Fetch ───────────────────────────────────────────────────────────────

async function fetchFromFred(
  seriesId: string,
  lookbackDays: number,
  asOf: string,
): Promise<MacroDataPoint[]> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    throw new Error("FRED_API_KEY not configured");
  }

  const endDate = asOf;
  const asOfDate = new Date(`${asOf}T00:00:00Z`);
  asOfDate.setUTCDate(asOfDate.getUTCDate() - lookbackDays);
  const startDate = asOfDate
    .toISOString()
    .slice(0, 10);

  const url = new URL("https://api.stlouisfed.org/fred/series/observations");
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("observation_start", startDate);
  url.searchParams.set("observation_end", endDate);
  url.searchParams.set("sort_order", "asc");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("fred-timeout"), 15_000);

  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`FRED API ${response.status}: ${seriesId}`);
    }
    const json = await response.json() as {
      observations: Array<{ date: string; value: string }>;
    };
    return json.observations
      .filter((obs) => obs.value !== "." && obs.value !== "")
      .map((obs) => ({
        date: obs.date,
        value: Number(obs.value),
        status: "actual" as const,
      }));
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchFromFredPublicCsv(
  seriesId: string,
  lookbackDays: number,
  asOf: string,
): Promise<MacroDataPoint[]> {
  const asOfDate = new Date(`${asOf}T00:00:00Z`);
  asOfDate.setUTCDate(asOfDate.getUTCDate() - lookbackDays);
  const url = new URL("https://fred.stlouisfed.org/graph/fredgraph.csv");
  url.searchParams.set("id", seriesId);
  url.searchParams.set("cosd", asOfDate.toISOString().slice(0, 10));
  url.searchParams.set("coed", asOf);

  const response = await fetch(url.toString(), {
    headers: { Accept: "text/csv" },
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`FRED CSV ${response.status}: ${seriesId}`);

  return text.trim().split(/\r?\n/).slice(1).map((line) => {
    const [date, rawValue] = line.split(",");
    return { date, value: Number(rawValue), status: "actual" as const };
  }).filter((point) => point.date && Number.isFinite(point.value));
}

// ─── Main Router ──────────────────────────────────────────────────────────────

/**
 * Route a macro data query to the appropriate vendor.
 * Implements the `route_to_vendor()` pattern from TradingAgents.
 *
 * Priority order:
 *   1. Cache hit (if fresh)
 *   2. FRED API (for US indicators)
 *   3. Stale cache (with staleness warning)
 *   4. Unavailable (with full limitation explanation)
 *
 * @example
 * const result = await routeToVendor({ indicator: "cpi", lookbackDays: 365 });
 */
export async function routeToVendor(query: MacroDataQuery): Promise<MacroDataResult> {
  const { indicator, lookbackDays = 365, asOf = new Date().toISOString().slice(0, 10) } = query;
  const queryIssues = validateProviderQuery({ indicator, lookbackDays, asOf });
  if (queryIssues.length) throw new Error(`Invalid macro data query: ${queryIssues.join(", ")}`);
  const resolved = resolveAlias(indicator);
  const fetchedAt = new Date().toISOString();

  const cacheKey = `${resolved.seriesId}:${lookbackDays}:${asOf}`;
  const sourceUrl =
    resolved.vendor === "fred"
      ? `https://fred.stlouisfed.org/series/${resolved.seriesId}`
      : null;

  // 1. Check cache
  const cached = macroIndicatorCache.get(cacheKey, resolved.vendor === "fred" ? "fred" : "openbb");
  if (cached && !cached.isStale) {
    return {
      indicatorAlias: indicator,
      resolvedSeriesId: resolved.seriesId,
      vendor: "cache",
      sourceName: resolved.name,
      sourceUrl,
      transformation: resolved.transformation,
      seasonalAdjustment: resolved.seasonalAdjustment,
      data: cached.data,
      fetchedAt,
      fromCache: true,
      isStale: false,
      limitation: `Data from cache (TTL-fresh). Original vendor: ${resolved.vendor}.`,
    };
  }

  // 2. Try FRED. Prefer the keyed API, then use the official public CSV
  // contract for public series so a missing optional key does not disable
  // real-data research. Both paths remain fail-closed on provider errors.
  if (resolved.vendor === "fred") {
    try {
      const data = process.env.FRED_API_KEY
        ? await fetchFromFred(resolved.seriesId, lookbackDays, asOf)
        : await fetchFromFredPublicCsv(resolved.seriesId, lookbackDays, asOf);
      // Store in cache
      macroIndicatorCache.set(cacheKey, { data, fetchedAt }, resolved.vendor);
      return {
        indicatorAlias: indicator,
        resolvedSeriesId: resolved.seriesId,
        vendor: "fred",
        sourceName: resolved.name,
        sourceUrl,
        transformation: resolved.transformation,
        seasonalAdjustment: resolved.seasonalAdjustment,
        data,
        fetchedAt,
        fromCache: false,
        isStale: false,
        limitation:
          `Data from FRED ${process.env.FRED_API_KEY ? "JSON API" : "public CSV"}. Status: actual. Quality: verified by source. ` +
          "This is a research data point, not a trading signal.",
      };
    } catch (error) {
      console.warn(
        JSON.stringify({
          type: "fred_fetch_error",
          seriesId: resolved.seriesId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  // 3. Return stale cache with warning
  if (cached && cached.isStale) {
    return {
      indicatorAlias: indicator,
      resolvedSeriesId: resolved.seriesId,
      vendor: "cache",
      sourceName: resolved.name,
      sourceUrl,
      transformation: resolved.transformation,
      seasonalAdjustment: resolved.seasonalAdjustment,
      data: cached.data,
      fetchedAt,
      fromCache: true,
      isStale: true,
      staleness: cached.staleness,
      limitation:
        `Data is STALE (${cached.staleness}). Live source unavailable. ` +
        "Do not use as current-period evidence without verification.",
    };
  }

  // 4. Unavailable
  return {
    indicatorAlias: indicator,
    resolvedSeriesId: resolved.seriesId,
    vendor: "unavailable",
    sourceName: resolved.name,
    sourceUrl,
    transformation: resolved.transformation,
    seasonalAdjustment: resolved.seasonalAdjustment,
    data: [],
    fetchedAt,
    fromCache: false,
    isStale: false,
    limitation:
      "Vendor unavailable. FRED request failed. " +
      "No data returned — do not substitute mock values.",
  };
}

/**
 * Batch route multiple indicators (parallel fetches with individual error isolation).
 * Mirrors TradingAgents pattern of fetching multiple macro signals simultaneously.
 */
export async function routeMultipleToVendor(
  queries: MacroDataQuery[],
): Promise<MacroDataResult[]> {
  const results = await Promise.allSettled(queries.map(routeToVendor));
  return results.map((result, i) => {
    if (result.status === "fulfilled") return result.value;
    const query = queries[i];
    return {
      indicatorAlias: query.indicator,
      resolvedSeriesId: query.indicator,
      vendor: "unavailable" as const,
      sourceName: query.indicator,
      sourceUrl: null,
      transformation: "level",
      seasonalAdjustment: "unknown",
      data: [],
      fetchedAt: new Date().toISOString(),
      fromCache: false,
      isStale: false,
      limitation: `Fetch failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
    };
  });
}
