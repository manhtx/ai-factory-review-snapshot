export type FreshnessStatus = "fresh" | "delayed" | "outdated" | "unavailable";

export const MAX_AGE_DAYS: Record<string, number> = {
  daily: 3,
  weekly: 10,
  monthly: 45,
  quarterly: 120,
  semiannual: 210,
  yearly: 730,
  annual: 730,
};

export interface SeriesReleaseSchedule {
  frequency: "daily" | "weekly" | "monthly" | "quarterly" | "semiannual" | "annual";
  publicationLagDays: number;
  expectedIntervalDays: number;
  providerGracePeriodDays: number;
}

// Per-Series Release Calendar Metadata (Finding F-012 / P2-03, BACKLOG-044, BACKLOG-INDICATOR-FRESHNESS-COVERAGE)
export const SERIES_RELEASE_CALENDAR: Record<string, Partial<SeriesReleaseSchedule>> = {
  // US Inflation / Prices
  "cpi-us": { frequency: "monthly", publicationLagDays: 14, expectedIntervalDays: 30, providerGracePeriodDays: 15 },
  "core-cpi-us": { frequency: "monthly", publicationLagDays: 14, expectedIntervalDays: 30, providerGracePeriodDays: 15 },
  "ppi-us": { frequency: "monthly", publicationLagDays: 14, expectedIntervalDays: 30, providerGracePeriodDays: 15 },
  "pce-us": { frequency: "monthly", publicationLagDays: 28, expectedIntervalDays: 30, providerGracePeriodDays: 15 },
  "core-pce-us": { frequency: "monthly", publicationLagDays: 28, expectedIntervalDays: 30, providerGracePeriodDays: 15 },

  // US Labor
  "unemployment-us": { frequency: "monthly", publicationLagDays: 7, expectedIntervalDays: 30, providerGracePeriodDays: 15 },
  "nfp-us": { frequency: "monthly", publicationLagDays: 7, expectedIntervalDays: 30, providerGracePeriodDays: 15 },
  "jolts-us": { frequency: "monthly", publicationLagDays: 35, expectedIntervalDays: 30, providerGracePeriodDays: 15 },
  "wage-growth-us": { frequency: "monthly", publicationLagDays: 7, expectedIntervalDays: 30, providerGracePeriodDays: 15 },
  "initial-claims-us": { frequency: "weekly", publicationLagDays: 5, expectedIntervalDays: 7, providerGracePeriodDays: 3 },

  // US Activity / Output
  "pmi-us": { frequency: "monthly", publicationLagDays: 2, expectedIntervalDays: 30, providerGracePeriodDays: 5 },
  "gdp-us": { frequency: "quarterly", publicationLagDays: 30, expectedIntervalDays: 90, providerGracePeriodDays: 30 },

  // US Rates & Yields
  "fed-funds-rate": { frequency: "daily", publicationLagDays: 1, expectedIntervalDays: 1, providerGracePeriodDays: 2 },
  "fed-funds-rate:monthly": { frequency: "monthly", publicationLagDays: 2, expectedIntervalDays: 30, providerGracePeriodDays: 5 },
  "sofr-us": { frequency: "daily", publicationLagDays: 1, expectedIntervalDays: 1, providerGracePeriodDays: 2 },
  "reverse-repo-us": { frequency: "daily", publicationLagDays: 1, expectedIntervalDays: 1, providerGracePeriodDays: 2 },
  "us2y-yield": { frequency: "daily", publicationLagDays: 1, expectedIntervalDays: 1, providerGracePeriodDays: 2 },
  "us10y-yield": { frequency: "daily", publicationLagDays: 1, expectedIntervalDays: 1, providerGracePeriodDays: 2 },
  "us30y-yield": { frequency: "daily", publicationLagDays: 1, expectedIntervalDays: 1, providerGracePeriodDays: 2 },
  "yield-curve": { frequency: "daily", publicationLagDays: 1, expectedIntervalDays: 1, providerGracePeriodDays: 2 },
  "credit-spread-us": { frequency: "daily", publicationLagDays: 1, expectedIntervalDays: 1, providerGracePeriodDays: 2 },

  // US Monetary
  "fed-balance-sheet": { frequency: "weekly", publicationLagDays: 2, expectedIntervalDays: 7, providerGracePeriodDays: 3 },
  "m1-us": { frequency: "monthly", publicationLagDays: 28, expectedIntervalDays: 30, providerGracePeriodDays: 15 },
  "m2-us": { frequency: "monthly", publicationLagDays: 28, expectedIntervalDays: 30, providerGracePeriodDays: 15 },
  "global-m2": { frequency: "annual", publicationLagDays: 270, expectedIntervalDays: 365, providerGracePeriodDays: 95 },

  // FX & Currencies
  "dxy": { frequency: "daily", publicationLagDays: 1, expectedIntervalDays: 1, providerGracePeriodDays: 2 },
  "usd-vnd": { frequency: "annual", publicationLagDays: 180, expectedIntervalDays: 365, providerGracePeriodDays: 90 },
  "usd-vnd:daily": { frequency: "daily", publicationLagDays: 1, expectedIntervalDays: 1, providerGracePeriodDays: 2 },
  "usd-cny": { frequency: "daily", publicationLagDays: 1, expectedIntervalDays: 1, providerGracePeriodDays: 2 },
  "eur-usd": { frequency: "daily", publicationLagDays: 1, expectedIntervalDays: 1, providerGracePeriodDays: 2 },

  // Vietnam Economy / Rates
  "credit-growth-vn": { frequency: "monthly", publicationLagDays: 25, expectedIntervalDays: 30, providerGracePeriodDays: 15 },
  "credit-growth-vn:semiannual": { frequency: "semiannual", publicationLagDays: 30, expectedIntervalDays: 180, providerGracePeriodDays: 30 },
  // BACKLOG-044: Vietnam deposit rate — confirmed stale (latest 2023-01-01 in production screenshots)
  "deposit-rate-vn": { frequency: "monthly", publicationLagDays: 10, expectedIntervalDays: 30, providerGracePeriodDays: 15 },
  "deposit-rate-vn:annual": { frequency: "annual", publicationLagDays: 270, expectedIntervalDays: 365, providerGracePeriodDays: 95 },
  "lending-rate-vn": { frequency: "annual", publicationLagDays: 270, expectedIntervalDays: 365, providerGracePeriodDays: 95 },
  "lending-rate-vn:monthly": { frequency: "monthly", publicationLagDays: 15, expectedIntervalDays: 30, providerGracePeriodDays: 15 },
  "cpi-vn": { frequency: "monthly", publicationLagDays: 15, expectedIntervalDays: 30, providerGracePeriodDays: 15 },
  "cpi-vn:annual": { frequency: "annual", publicationLagDays: 180, expectedIntervalDays: 365, providerGracePeriodDays: 90 },
  "gdp-vn": { frequency: "quarterly", publicationLagDays: 45, expectedIntervalDays: 90, providerGracePeriodDays: 30 },
  "gdp-vn:annual": { frequency: "annual", publicationLagDays: 180, expectedIntervalDays: 365, providerGracePeriodDays: 90 },
  "policy-rate-vn": { frequency: "monthly", publicationLagDays: 5, expectedIntervalDays: 30, providerGracePeriodDays: 15 },

  // Vietnam Stock Market
  "vnindex": { frequency: "daily", publicationLagDays: 1, expectedIntervalDays: 1, providerGracePeriodDays: 2 },
  "vn30": { frequency: "daily", publicationLagDays: 1, expectedIntervalDays: 1, providerGracePeriodDays: 2 },
  "vnindex-pe": { frequency: "daily", publicationLagDays: 1, expectedIntervalDays: 1, providerGracePeriodDays: 2 },
  "vnindex-pb": { frequency: "daily", publicationLagDays: 1, expectedIntervalDays: 1, providerGracePeriodDays: 2 },
  "market-liquidity-vn": { frequency: "daily", publicationLagDays: 1, expectedIntervalDays: 1, providerGracePeriodDays: 2 },
  "foreign-flow-vn": { frequency: "daily", publicationLagDays: 1, expectedIntervalDays: 1, providerGracePeriodDays: 2 },

  // Vietnam Real Estate
  "apartment-price-vn": { frequency: "quarterly", publicationLagDays: 30, expectedIntervalDays: 90, providerGracePeriodDays: 30 },
  "apartment-price-vn:monthly": { frequency: "monthly", publicationLagDays: 30, expectedIntervalDays: 30, providerGracePeriodDays: 15 },
  "land-price-vn": { frequency: "quarterly", publicationLagDays: 45, expectedIntervalDays: 90, providerGracePeriodDays: 30 },
  "transaction-volume-vn": { frequency: "quarterly", publicationLagDays: 45, expectedIntervalDays: 90, providerGracePeriodDays: 30 },
  "new-supply-vn": { frequency: "quarterly", publicationLagDays: 45, expectedIntervalDays: 90, providerGracePeriodDays: 30 },

  // Commodities & Digital Assets
  // BACKLOG-044 / BACKLOG-INDICATOR-FRESHNESS-COVERAGE: Gold — World Bank monthly benchmark
  "gold": { frequency: "monthly", publicationLagDays: 30, expectedIntervalDays: 30, providerGracePeriodDays: 20 },
  "gold-wb-monthly": { frequency: "monthly", publicationLagDays: 30, expectedIntervalDays: 30, providerGracePeriodDays: 20 },
  "bitcoin": { frequency: "daily", publicationLagDays: 1, expectedIntervalDays: 1, providerGracePeriodDays: 2 },
  "ethereum": { frequency: "daily", publicationLagDays: 1, expectedIntervalDays: 1, providerGracePeriodDays: 2 },

  // International Policy Rates & GDP
  "policy-rate-jp": { frequency: "monthly", publicationLagDays: 5, expectedIntervalDays: 30, providerGracePeriodDays: 15 },
  "policy-rate-de": { frequency: "monthly", publicationLagDays: 5, expectedIntervalDays: 45, providerGracePeriodDays: 15 },
  "gdp-de": { frequency: "quarterly", publicationLagDays: 30, expectedIntervalDays: 90, providerGracePeriodDays: 30 },
  "gdp-jp": { frequency: "quarterly", publicationLagDays: 45, expectedIntervalDays: 90, providerGracePeriodDays: 30 },
};

export function getSeriesSchedule(
  indicatorId?: string | null,
  frequencyLabel?: string | null
): Partial<SeriesReleaseSchedule> | null {
  if (!indicatorId) return null;
  const raw = (frequencyLabel ?? "").trim().toLowerCase().match(/^(daily|weekly|monthly|quarterly|semiannual|annual|yearly)/)?.[1];
  const supplied = raw === "yearly" ? "annual" : raw;

  if (supplied && SERIES_RELEASE_CALENDAR[`${indicatorId}:${supplied}`]) {
    return SERIES_RELEASE_CALENDAR[`${indicatorId}:${supplied}`];
  }
  if (SERIES_RELEASE_CALENDAR[indicatorId]) {
    const entry = SERIES_RELEASE_CALENDAR[indicatorId];
    if (!supplied || entry.frequency === supplied) {
      return entry;
    }
  }
  if (indicatorId === "gold" && SERIES_RELEASE_CALENDAR["gold-wb-monthly"]) {
    return SERIES_RELEASE_CALENDAR["gold-wb-monthly"];
  }
  return SERIES_RELEASE_CALENDAR[indicatorId] ?? null;
}

function hasValidIndicatorSchedule(indicatorId?: string | null, frequencyLabel?: string | null): boolean {
  if (!indicatorId) return true;
  const schedule = getSeriesSchedule(indicatorId, frequencyLabel);
  const raw = (frequencyLabel ?? "").trim().toLowerCase().match(/^(daily|weekly|monthly|quarterly|semiannual|annual|yearly)/)?.[1];
  const supplied = raw === "yearly" ? "annual" : raw;
  return Boolean(schedule && supplied && schedule.frequency === supplied);
}

export function freshnessSlo(frequencyLabel: string | null | undefined, _indicatorId?: string | null) {
  const normalized = (frequencyLabel ?? "").toLowerCase();
  const frequency = normalized.includes("annual")
    ? "annual"
    : Object.keys(MAX_AGE_DAYS).find((key) => normalized.includes(key));
  const schedule = _indicatorId ? getSeriesSchedule(_indicatorId, frequencyLabel) : null;
  const freshWithinDays = schedule
    ? (schedule.expectedIntervalDays ?? 0) + (schedule.publicationLagDays ?? 0) + (schedule.providerGracePeriodDays ?? 0)
    : frequency ? MAX_AGE_DAYS[frequency] : 45;

  return {
    frequency: frequency ?? "default",
    freshWithinDays,
    delayedUntilDays: freshWithinDays * 2,
  };
}

/**
 * Calendar-Aware Freshness Calculator (Finding F-012 / P2-03)
 * Calculates whether an observation is fresh based on expected publication cadence & lag.
 */
export function freshnessStatus(
  observedThrough: string | null | undefined,
  frequencyLabel: string | null | undefined,
  now = new Date(),
  indicatorId?: string | null
): FreshnessStatus {
  if (!observedThrough) return "unavailable";
  const observed = Date.parse(observedThrough);
  if (Number.isNaN(observed)) return "unavailable";
  if (observed > now.getTime()) return "unavailable";
  // An indicator-specific classification must never silently fall back to a
  // generic cadence when its provider metadata is missing or unsupported.
  // Generic callers without an indicator retain the documented default SLO.
  if (indicatorId && !/^(daily|weekly|monthly|quarterly|semiannual|annual|yearly)(?:\s|$)/i.test((frequencyLabel ?? '').trim())) return "unavailable";
  const schedule = indicatorId ? getSeriesSchedule(indicatorId, frequencyLabel) : null;
  const suppliedFrequencyRaw = (frequencyLabel ?? '').trim().toLowerCase().match(/^(daily|weekly|monthly|quarterly|semiannual|annual|yearly)/)?.[1];
  const suppliedFrequency = suppliedFrequencyRaw === 'yearly' ? 'annual' : suppliedFrequencyRaw;
  if (indicatorId && (!schedule || schedule.frequency !== suppliedFrequency)) return "unavailable";

  const { freshWithinDays: expectedDays, delayedUntilDays } = freshnessSlo(frequencyLabel, indicatorId);
  const ageDays = Math.max(0, (now.getTime() - observed) / 86_400_000);

  if (ageDays <= expectedDays) return "fresh";
  if (ageDays <= delayedUntilDays) return "delayed";
  return "outdated";
}

// ---------------------------------------------------------------------------
// BACKLOG-044: Next Expected Release and Observation Age utilities
// These implement the "latest-available contract" — every displayed observation
// must expose its age and the next expected release date. This is required by
// PRODUCT_GOAL.md §Non-negotiable guardrails: "Never label stale data
// latest/current or actual without an age qualifier."
// ---------------------------------------------------------------------------

/**
 * Computes the ISO date string (YYYY-MM-DD) on which the next release
 * for a given series is expected, based on the latest observation date and
 * the series release calendar.
 *
 * Returns null if the observation date or schedule is not parseable.
 *
 * Formula: latestObservation + expectedIntervalDays + publicationLagDays
 * (providerGracePeriodDays is intentionally excluded — that is the tolerance
 *  window, not a predicted release date.)
 */
export function computeNextExpectedRelease(
  latestObservationDate: string | null | undefined,
  indicatorId?: string | null,
  frequencyLabel?: string | null
): string | null {
  if (!latestObservationDate) return null;
  const observed = Date.parse(latestObservationDate);
  if (Number.isNaN(observed)) return null;
  if (!hasValidIndicatorSchedule(indicatorId, frequencyLabel)) return null;

  const schedule = indicatorId ? getSeriesSchedule(indicatorId, frequencyLabel) : null;
  let intervalDays: number;
  let lagDays: number;

  if (schedule) {
    intervalDays = schedule.expectedIntervalDays ?? 0;
    lagDays = schedule.publicationLagDays ?? 0;
  } else {
    // Fall back to frequency label
    const normalized = (frequencyLabel ?? "").toLowerCase();
    const frequency = normalized.includes("annual")
      ? "annual"
      : Object.keys(MAX_AGE_DAYS).find((key) => normalized.includes(key));
    intervalDays = frequency ? MAX_AGE_DAYS[frequency] : 45;
    lagDays = 0;
  }

  const nextReleaseMs = observed + (intervalDays + lagDays) * 86_400_000;
  return new Date(nextReleaseMs).toISOString().slice(0, 10);
}

/**
 * Returns a human-readable age label for the observation date,
 * relative to `now`.
 *
 * Examples: "today", "1 day ago", "3 months ago", "2 years ago"
 *
 * This is used to implement the PRODUCT_GOAL.md requirement that any
 * "latest" or "current" label must carry an age qualifier.
 */
export function observationAgeLabel(
  observationDate: string | null | undefined,
  now = new Date()
): string {
  if (!observationDate) return "unknown date";
  const observed = Date.parse(observationDate);
  if (Number.isNaN(observed)) return "unknown date";

  const ageDays = Math.max(0, (now.getTime() - observed) / 86_400_000);

  if (ageDays < 1) return "today";
  if (ageDays < 2) return "1 day ago";
  if (ageDays < 30) return `${Math.round(ageDays)} days ago`;
  const ageMonths = ageDays / 30.44;
  if (ageMonths < 2) return "1 month ago";
  if (ageMonths < 12) return `${Math.round(ageMonths)} months ago`;
  const ageYears = ageDays / 365.25;
  if (ageYears < 2) return "1 year ago";
  return `${Math.round(ageYears)} years ago`;
}

/**
 * Returns true if a missed release is detected: i.e., the current date is
 * past the expected next release + grace period and no newer observation exists.
 *
 * This maps to the BACKLOG-044 acceptance criterion:
 * "Alert on missed release SLA and isolate stale indicators from healthy ones."
 */
export function isMissedRelease(
  latestObservationDate: string | null | undefined,
  indicatorId?: string | null,
  frequencyLabel?: string | null,
  now = new Date()
): boolean {
  if (!latestObservationDate) return false;
  const observed = Date.parse(latestObservationDate);
  if (Number.isNaN(observed)) return false;
  if (!hasValidIndicatorSchedule(indicatorId, frequencyLabel)) return false;

  const schedule = indicatorId ? getSeriesSchedule(indicatorId, frequencyLabel) : null;
  let intervalDays: number;
  let lagDays: number;
  let graceDays: number;

  if (schedule) {
    intervalDays = schedule.expectedIntervalDays ?? 0;
    lagDays = schedule.publicationLagDays ?? 0;
    graceDays = schedule.providerGracePeriodDays ?? 0;
  } else {
    const normalized = (frequencyLabel ?? "").toLowerCase();
    const frequency = normalized.includes("annual")
      ? "annual"
      : Object.keys(MAX_AGE_DAYS).find((key) => normalized.includes(key));
    intervalDays = frequency ? MAX_AGE_DAYS[frequency] : 45;
    lagDays = 0;
    graceDays = 0;
  }

  // Missed release window: observation + interval + lag + grace < now
  const expectedCutoffMs = observed + (intervalDays + lagDays + graceDays) * 86_400_000;
  return now.getTime() > expectedCutoffMs;
}

/**
 * Builds a complete freshness display record for a single indicator,
 * combining all of the above utilities into one UI-ready payload.
 *
 * This record must be included on every indicator card/chart that shows a number,
 * per the PRODUCT_GOAL.md "Everything is Traceable" design principle.
 *
 * IMPORTANT: The `currentLabel` field deliberately avoids the strings "latest"
 * or "current" for non-fresh series, instead using "stale" or "unavailable"
 * with an age qualifier to comply with the non-negotiable guardrail.
 */
export interface FreshnessDisplayRecord {
  status: FreshnessStatus;
  /** ISO-8601 date of the most recent observation */
  latestObservationDate: string | null;
  /** Human-readable age string: e.g., "3 months ago" */
  ageLabel: string;
  /** Expected date of the next release (ISO-8601 date), or null if unknown */
  nextExpectedRelease: string | null;
  /** True if the provider has missed its expected release SLA */
  isMissedRelease: boolean;
  /**
   * Safe display label for UI — never "current" or "latest" for non-fresh data.
   * fresh     → "Latest available (today)" or "Latest available (N days ago)"
   * delayed   → "Delayed — latest available N days ago"
   * outdated  → "Stale — last observed N ago"
   * unavailable → "Unavailable"
   */
  currentLabel: string;
}

export function buildFreshnessDisplayRecord(
  latestObservationDate: string | null | undefined,
  frequencyLabel: string | null | undefined,
  indicatorId?: string | null,
  now = new Date()
): FreshnessDisplayRecord {
  const status = freshnessStatus(latestObservationDate, frequencyLabel, now, indicatorId);
  const ageLabel = observationAgeLabel(latestObservationDate, now);
  const nextExpectedReleaseDate = computeNextExpectedRelease(latestObservationDate, indicatorId, frequencyLabel);
  const missedRelease = isMissedRelease(latestObservationDate, indicatorId, frequencyLabel, now);
  const observationDateStr = latestObservationDate ?? null;

  let currentLabel: string;
  switch (status) {
    case "fresh":
      currentLabel = `Latest available (${ageLabel})`;
      break;
    case "delayed":
      currentLabel = `Delayed — latest available ${ageLabel}`;
      break;
    case "outdated":
      currentLabel = `Stale — last observed ${ageLabel}`;
      break;
    case "unavailable":
      currentLabel = "Unavailable";
      break;
  }

  return {
    status,
    latestObservationDate: observationDateStr,
    ageLabel,
    nextExpectedRelease: nextExpectedReleaseDate,
    isMissedRelease: missedRelease,
    currentLabel,
  };
}
