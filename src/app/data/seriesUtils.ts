import {
  DataPoint,
  DataProvenanceMeta,
  DataStatus,
  Indicator,
  Momentum,
  Timeframe,
  Trend,
} from "./types";

const TIMEFRAME_MONTHS: Record<Exclude<Timeframe, "MAX">, number> = {
  "1M": 1,
  "3M": 3,
  "6M": 6,
  "1Y": 12,
  "3Y": 36,
  "5Y": 60,
  "10Y": 120,
};

export function filterSeriesByTimeframe(series: DataPoint[], timeframe: Timeframe): DataPoint[] {
  if (timeframe === "MAX" || series.length === 0) return series;
  const lastDate = new Date(series.at(-1)!.date);
  const cutoff = new Date(lastDate);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - TIMEFRAME_MONTHS[timeframe]);
  return series.filter((point) => new Date(point.date) >= cutoff);
}

export function calculateSnapshot(series: DataPoint[]) {
  const current = series.at(-1);
  const previous = series.at(-2);
  if (!current) return { value: 0, date: "", change: 0, changePct: 0 };
  if (!previous) return { value: current.value, date: current.date, change: 0, changePct: 0 };
  const change = current.value - previous.value;
  const changePct = previous.value === 0 ? 0 : (change / Math.abs(previous.value)) * 100;
  return {
    value: current.value,
    date: current.date,
    change: Math.round(change * 100) / 100,
    changePct: Math.round(changePct * 100) / 100,
  };
}

export function calculateTrend(series: DataPoint[]): { trend: Trend; momentum: Momentum } {
  if (series.length < 3) return { trend: "flat", momentum: "stable" };
  const values = series.slice(-4).map((point) => point.value);
  const latestChange = values.at(-1)! - values.at(-2)!;
  const previousChange = values.length >= 3 ? values.at(-2)! - values.at(-3)! : latestChange;
  const scale = Math.max(Math.abs(values.at(-2)!), 1);
  const flatTolerance = scale * 0.001;
  const trend: Trend =
    Math.abs(latestChange) <= flatTolerance ? "flat" : latestChange > 0 ? "up" : "down";
  const acceleration = Math.abs(latestChange) - Math.abs(previousChange);
  const momentum: Momentum =
    Math.abs(acceleration) <= flatTolerance
      ? "stable"
      : acceleration > 0
      ? "accelerating"
      : "decelerating";
  return { trend, momentum };
}

export function resolveIndicatorSeries(
  indicator: Indicator,
  series: DataPoint[],
  provenance: Partial<DataProvenanceMeta> & { status: DataStatus }
): Indicator {
  if (series.length === 0) return indicator;
  const snapshot = calculateSnapshot(series);
  const { trend, momentum } = calculateTrend(series);
  return {
    ...indicator,
    series,
    snapshot,
    trend,
    momentum,
    provenance: {
      status: provenance.status,
      quality: provenance.quality ?? (provenance.status === "actual" ? "verified" : "unverified"),
      sourceName: provenance.sourceName ?? indicator.source,
      sourceSeriesId: provenance.sourceSeriesId,
      sourceUrl: provenance.sourceUrl,
      transformation: provenance.transformation ?? indicator.provenance?.transformation ?? "custom",
      seasonalAdjustment:
        provenance.seasonalAdjustment ?? indicator.provenance?.seasonalAdjustment ?? "unknown",
      observedThrough: series.at(-1)!.date,
      ingestedAt: provenance.ingestedAt,
      notes: provenance.notes,
    },
  };
}

export function periodKey(date: string, frequency: Indicator["frequency"]): string {
  const value = new Date(date);
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth() + 1;
  if (frequency === "daily") return date;
  if (frequency === "weekly") {
    const first = new Date(Date.UTC(year, 0, 1));
    const week = Math.ceil((((value.getTime() - first.getTime()) / 86_400_000) + first.getUTCDay() + 1) / 7);
    return `${year}-W${String(week).padStart(2, "0")}`;
  }
  if (frequency === "quarterly") return `${year}-Q${Math.floor((month - 1) / 3) + 1}`;
  if (frequency === "annual") return `${year}`;
  return `${year}-${String(month).padStart(2, "0")}`;
}
