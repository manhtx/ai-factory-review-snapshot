import {
  DataProvenanceMeta,
  DataQualityIssue,
  DataQualityReport,
  Frequency,
  Indicator,
  NormalizedIndicator,
} from "./types";

export interface SourceContract {
  type: "fred" | "worldbank" | "worldbank-commodity" | "worldbank-broad-money-basket" | "ism-pdf" | "mendeley-csv" | "f-fin-json" | "hose-foreign-json" | "hose-trading-json" | "moc-bds-html" | "baochinhphu-bds-html" | "vov-bds-html" | "baochinhphu-credit-html" | "savills-hcmc-pdf" | "cushman-hcmc-pdf" | "cbre-industrial-land-pdf" | "cbre-landed-price-pdf" | "quanganh-vnindex-valuation-json" | "quanganh-index-json" | "coingecko" | "er-api" | "manual";
  seriesId?: string;
  source: string;
  sourceUrl?: string;
  frequencyLabel?: string;
  fredTransformation?: "lin" | "pc1" | "pch" | "chg" | "ch1";
  notes?: string;
}

/** Only server-ingested, URL-backed observations may enter research state. */
export function isSourceBackedIndicator(indicator: Pick<Indicator, "provenance" | "series">) {
  return (
    indicator.provenance?.status === "actual" &&
    indicator.provenance.quality === "verified" &&
    Boolean(indicator.provenance.sourceUrl) &&
    Boolean(indicator.provenance.sourceSeriesId) &&
    indicator.series.length > 0 &&
    indicator.series.every((point) => point.status === "actual")
  );
}

/** Source-backed evidence that is also eligible to describe the current state. */
export function isCurrentSourceBackedIndicator(indicator: Pick<Indicator, "provenance" | "series">) {
  return indicator.provenance?.status === "actual" &&
    indicator.provenance.quality === "verified" &&
    Boolean(indicator.provenance.sourceUrl) &&
    // Missing freshness is unknown, never current. This keeps stale or
    // partially-ingested observations out of “latest” research surfaces.
    indicator.provenance.freshness === "fresh";
}

function inferTransformation(source?: SourceContract): DataProvenanceMeta["transformation"] {
  switch (source?.fredTransformation) {
    case "pc1": return "yoy";
    case "pch": return "mom";
    case "chg":
    case "ch1": return "change";
    case "lin": return "level";
    default: return "custom";
  }
}

function inferSeasonalAdjustment(source?: SourceContract): DataProvenanceMeta["seasonalAdjustment"] {
  const text = `${source?.notes ?? ""}`.toLowerCase();
  if (text.includes("not seasonally adjusted")) return "not-seasonally-adjusted";
  if (text.includes("seasonally adjusted")) return "seasonally-adjusted";
  return "unknown";
}

export function normalizeIndicator(
  indicator: Indicator,
  source?: SourceContract
): NormalizedIndicator {
  const observedThrough = indicator.series.at(-1)?.date ?? indicator.snapshot.date;
  const provenance: DataProvenanceMeta = indicator.provenance ?? {
    status: "simulated",
    quality: "unverified",
    sourceName: source?.source ?? indicator.source,
    sourceSeriesId: source?.seriesId,
    sourceUrl: source?.sourceUrl,
    transformation: inferTransformation(source),
    seasonalAdjustment: inferSeasonalAdjustment(source),
    observedThrough,
    notes: "Bundled prototype series generated from deterministic anchor points; not source observations.",
  };

  return {
    ...indicator,
    series: indicator.series.map((point) => ({
      ...point,
      status: point.status ?? provenance.status,
      observedAt: point.observedAt ?? point.date,
    })),
    provenance,
  };
}

function expectedMinimumGapDays(frequency: Frequency): number {
  return { daily: 1, weekly: 5, monthly: 20, quarterly: 70, annual: 300 }[frequency];
}

export function validateIndicators(
  indicators: NormalizedIndicator[],
  sources: Record<string, SourceContract>,
  cycleReferences: { owner: string; indicatorId: string }[] = []
): DataQualityReport {
  const issues: DataQualityIssue[] = [];
  const ids = new Set<string>();
  const add = (
    severity: DataQualityIssue["severity"],
    code: string,
    message: string,
    indicatorId?: string
  ) => issues.push({ severity, code, message, indicatorId });

  for (const indicator of indicators) {
    if (ids.has(indicator.id)) add("error", "DUPLICATE_ID", "Duplicate indicator ID.", indicator.id);
    ids.add(indicator.id);

    const sourceContract = sources[indicator.id];
    if (!sourceContract) {
      add("error", "MISSING_SOURCE_CONTRACT", "No source contract is registered.", indicator.id);
    } else {
      if (!sourceContract.source.trim()) {
        add("error", "MISSING_SOURCE_NAME", "Source contract has no provider name.", indicator.id);
      }
      if (!sourceContract.frequencyLabel?.trim()) {
        add("error", "MISSING_SOURCE_FREQUENCY", "Source contract has no frequency label.", indicator.id);
      }
      if (!sourceContract.seriesId?.trim()) {
        add("error", "MISSING_SOURCE_SERIES_ID", "Source contract has no Series ID.", indicator.id);
      }
      if (!sourceContract.sourceUrl?.trim()) {
        add("error", "MISSING_SOURCE_URL", "Source contract has no verification URL.", indicator.id);
      } else {
        try {
          const sourceUrl = new URL(sourceContract.sourceUrl);
          if (!/^https?:$/.test(sourceUrl.protocol)) {
            add("error", "INVALID_SOURCE_URL", "Source verification URL must use HTTP(S).", indicator.id);
          }
        } catch {
          add("error", "INVALID_SOURCE_URL", "Source verification URL is invalid.", indicator.id);
        }
      }
    }
    if (indicator.series.length === 0) {
      if (indicator.provenance.status !== "simulated" || indicator.provenance.quality !== "unverified") {
        add("error", "EMPTY_SERIES", "Series has no observations.", indicator.id);
      }
      continue;
    }

    for (let index = 0; index < indicator.series.length; index++) {
      const point = indicator.series[index];
      if (!Number.isFinite(point.value)) {
        add("error", "NON_FINITE_VALUE", `Invalid value at ${point.date}.`, indicator.id);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(point.date) || Number.isNaN(Date.parse(point.date))) {
        add("error", "INVALID_DATE", `Invalid observation date: ${point.date}.`, indicator.id);
      }
      if (index > 0 && point.date <= indicator.series[index - 1].date) {
        add("error", "NON_ASCENDING_SERIES", `Series is not strictly ascending at ${point.date}.`, indicator.id);
      }
    }

    const last = indicator.series.at(-1)!;
    if (indicator.snapshot.date !== last.date || indicator.snapshot.value !== last.value) {
      add("error", "SNAPSHOT_MISMATCH", "Snapshot does not match the last series observation.", indicator.id);
    }
    if (indicator.provenance.observedThrough !== last.date) {
      add("error", "PROVENANCE_DATE_MISMATCH", "observedThrough does not match the last observation.", indicator.id);
    }
    if (indicator.provenance.status === "actual" && indicator.provenance.quality === "unverified") {
      add("error", "UNVERIFIED_ACTUAL", "Actual data cannot be marked unverified.", indicator.id);
    }

    if (indicator.series.length >= 2 && indicator.provenance.status === "actual") {
      const previous = new Date(indicator.series.at(-2)!.date).getTime();
      const current = new Date(last.date).getTime();
      const gapDays = (current - previous) / 86_400_000;
      const minGap = expectedMinimumGapDays(indicator.frequency);
      if (gapDays < minGap) {
        add(
          "warning",
          "FREQUENCY_GAP_MISMATCH",
          `Last observation gap is ${gapDays.toFixed(0)} days but frequency is ${indicator.frequency}.`,
          indicator.id
        );
      }
    }

    if (indicator.threshold) {
      const { direction, warn, critical } = indicator.threshold;
      const invalidOrder = direction === "above" ? critical < warn : critical > warn;
      if (invalidOrder) {
        add("error", "THRESHOLD_ORDER", "Critical threshold is less severe than warning threshold.", indicator.id);
      }
    }

    // Layered Semantic & Plausibility Validation (Finding F-011 / P2-02)
    if (indicator.unit === "%") {
      for (const point of indicator.series) {
        if (indicator.category === "monetary" || indicator.category === "bonds") {
          if (point.value < -10 || point.value > 100) {
            add("error", "SEMANTIC_RANGE_VIOLATION", `Interest rate/yield value ${point.value}% is outside plausible economic bounds [-10%, 100%].`, indicator.id);
          }
        } else if (indicator.category === "labor") {
          if (point.value < 0 || point.value > 100) {
            add("error", "SEMANTIC_RANGE_VIOLATION", `Unemployment/labor value ${point.value}% is outside [0%, 100%].`, indicator.id);
          }
        }
      }
    } else if (indicator.unit === "B USD" || indicator.unit === "points") {
      for (const point of indicator.series) {
        if (point.value < 0) {
          add("error", "SEMANTIC_RANGE_VIOLATION", `Quantity/Index value ${point.value} cannot be negative.`, indicator.id);
        }
      }
    }

    // Continuity & Outlier Jump Check
    if (indicator.series.length >= 3 && indicator.provenance.status === "actual") {
      for (let i = 1; i < indicator.series.length; i++) {
        const prev = indicator.series[i - 1].value;
        const curr = indicator.series[i].value;
        if (prev > 0 && curr > 0 && curr / prev > 20) {
          add("warning", "OUTLIER_SPIKE_WARNING", `Extreme single-period jump (>20x) detected at ${indicator.series[i].date}: from ${prev} to ${curr}.`, indicator.id);
        }
      }
    }
  }

  for (const reference of cycleReferences) {
    if (!ids.has(reference.indicatorId)) {
      add(
        "error",
        "BROKEN_INDICATOR_REFERENCE",
        `${reference.owner} references missing indicator ${reference.indicatorId}.`
      );
    }
  }

  for (const indicator of indicators) {
    for (const relationship of indicator.relationships) {
      if (!ids.has(relationship.indicatorId)) {
        add(
          "error",
          "BROKEN_RELATIONSHIP",
          `Relationship references missing indicator ${relationship.indicatorId}.`,
          indicator.id
        );
      }
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    indicatorCount: indicators.length,
    errorCount: issues.filter((issue) => issue.severity === "error").length,
    warningCount: issues.filter((issue) => issue.severity === "warning").length,
    issues,
  };
}
