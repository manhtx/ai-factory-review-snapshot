export type Category =
  | "inflation"
  | "labor"
  | "monetary"
  | "bonds"
  | "liquidity"
  | "currency"
  | "vietnam"
  | "stocks"
  | "realestate"
  | "alternative";

export type Country = "US" | "VN" | "CN" | "JP" | "DE" | "GB" | "KR" | "IN" | "EA" | "FR" | "BR" | "ID" | "MX" | "GLOBAL";
export type Frequency = "daily" | "weekly" | "monthly" | "quarterly" | "annual";
export type Trend = "up" | "down" | "flat";
export type Momentum = "accelerating" | "decelerating" | "stable";
export type Timeframe = "1M" | "3M" | "6M" | "1Y" | "3Y" | "5Y" | "10Y" | "MAX";
export type DataStatus = "actual" | "estimated" | "forecast" | "scenario" | "simulated";
export type DataQuality = "verified" | "provisional" | "unverified";
export type EvidenceFreshness = "fresh" | "delayed" | "outdated" | "unavailable";

export interface DataPoint {
  date: string;
  value: number;
  status?: DataStatus;
  observedAt?: string;
  releasedAt?: string;
  ingestedAt?: string;
  vintage?: string;
}

export interface DataProvenanceMeta {
  status: DataStatus;
  quality: DataQuality;
  sourceName: string;
  sourceSeriesId?: string;
  sourceUrl?: string;
  transformation: "level" | "yoy" | "mom" | "change" | "index" | "custom";
  seasonalAdjustment: "seasonally-adjusted" | "not-seasonally-adjusted" | "mixed" | "unknown";
  observedThrough: string;
  freshness?: EvidenceFreshness;
  ingestedAt?: string;
  notes?: string;
}

export interface Relationship {
  indicatorId: string;
  type: "leads" | "lags" | "coincident";
  lagMonths: number;
  description: string;
}

export interface HistoricalEvent {
  date: string;
  label: string;
  note: string;
}

export interface Threshold {
  warn: number;
  critical: number;
  direction: "above" | "below";
}

export interface Snapshot {
  value: number;
  date: string;
  change: number;
  changePct: number;
}

export interface Indicator {
  id: string;
  name: string;
  shortName: string;
  description: string;
  category: Category;
  country: Country;
  frequency: Frequency;
  source: string;
  unit: string;
  decimalPlaces: number;
  snapshot: Snapshot;
  trend: Trend;
  momentum: Momentum;
  threshold?: Threshold;
  relationships: Relationship[];
  historicalEvents: HistoricalEvent[];
  series: DataPoint[];
  provenance?: DataProvenanceMeta;
}

export interface NormalizedIndicator extends Indicator {
  provenance: DataProvenanceMeta;
}

export interface DataQualityIssue {
  code: string;
  severity: "error" | "warning";
  indicatorId?: string;
  message: string;
}

export interface DataQualityReport {
  checkedAt: string;
  indicatorCount: number;
  errorCount: number;
  warningCount: number;
  issues: DataQualityIssue[];
}

export interface HistoricalCycle {
  id: string;
  name: string;
  period: { start: string; end: string };
  context: string;
  policy: string;
  impact: string;
  lesson: string;
  whatIDo: string;
  keyIndicators: string[];
  severity: "mild" | "moderate" | "severe";
  region: "US" | "VN" | "GLOBAL";
  kind: "historical" | "scenario";
  evidenceStatus?: "verified" | "unverified" | "illustrative";
}

export interface Alert {
  id: string;
  indicatorId: string;
  condition: "above" | "below" | "crossover";
  threshold: number;
  active: boolean;
  triggered: boolean;
  triggeredAt?: string;
  createdAt: string;
  note?: string;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  inflation: "Inflation",
  labor: "Labor Market",
  monetary: "Monetary Policy",
  bonds: "Bond Market",
  liquidity: "Liquidity",
  currency: "Currency",
  vietnam: "Vietnam Economy",
  stocks: "Stock Market",
  realestate: "Real Estate",
  alternative: "Alternative Assets",
};

export const CATEGORY_COLORS: Record<Category, string> = {
  inflation: "#ef4444",
  labor: "#f97316",
  monetary: "#3b82f6",
  bonds: "#8b5cf6",
  liquidity: "#06b6d4",
  currency: "#84cc16",
  vietnam: "#f59e0b",
  stocks: "#10b981",
  realestate: "#ec4899",
  alternative: "#a78bfa",
};

export const TIMEFRAME_MONTHS: Record<Timeframe, number> = {
  "1M": 1,
  "3M": 3,
  "6M": 6,
  "1Y": 12,
  "3Y": 36,
  "5Y": 60,
  "10Y": 120,
  "MAX": 999,
};
