import { Indicator } from "../types";

const SCOPES = [
  { country: "CN" as const, wbCountry: "CHN", label: "China" },
  { country: "JP" as const, wbCountry: "JPN", label: "Japan" },
  { country: "DE" as const, wbCountry: "DEU", label: "Germany" },
  { country: "GB" as const, wbCountry: "GBR", label: "United Kingdom" },
  { country: "KR" as const, wbCountry: "KOR", label: "South Korea" },
  { country: "IN" as const, wbCountry: "IND", label: "India" },
  { country: "EA" as const, wbCountry: "EUU", label: "Euro Area" },
  { country: "VN" as const, wbCountry: "VNM", label: "Vietnam" },
];

const SERIES = [
  { key: "gdp-growth", name: "GDP growth", shortName: "GDP growth", wb: "NY.GDP.MKTP.KD.ZG", category: "liquidity" as const, unit: "%", description: "Annual real GDP growth from World Bank national accounts series." },
  { key: "inflation", name: "Inflation", shortName: "Inflation", wb: "FP.CPI.TOTL.ZG", category: "inflation" as const, unit: "%", description: "Annual consumer-price inflation from the World Bank indicator series." },
  { key: "unemployment", name: "Unemployment", shortName: "Unemployment", wb: "SL.UEM.TOTL.ZS", category: "labor" as const, unit: "%", description: "Unemployment rate (% of total labor force, modeled ILO estimate)." },
  { key: "population", name: "Population", shortName: "Population", wb: "SP.POP.TOTL", category: "liquidity" as const, unit: "people", description: "Total population count from the World Bank demographic series." },
  { key: "exports", name: "Exports of Goods and Services", shortName: "Exports", wb: "NE.EXP.GNFS.CD", category: "liquidity" as const, unit: "current US$", description: "Exports of goods and services in current US dollars." },
  { key: "imports", name: "Imports of Goods and Services", shortName: "Imports", wb: "NE.IMP.GNFS.CD", category: "liquidity" as const, unit: "current US$", description: "Imports of goods and services in current US dollars." },
];

export const MVP_EXPANSION_INDICATORS: Indicator[] = SCOPES.flatMap((scope) => SERIES.map((series) => ({
  id: `${series.key}-${scope.country.toLowerCase()}`,
  name: `${scope.label} ${series.name}`,
  shortName: `${scope.country} ${series.shortName}`,
  description: series.description,
  category: series.category,
  country: scope.country,
  frequency: "annual" as const,
  source: "World Bank",
  unit: series.unit,
  decimalPlaces: series.key === "population" ? 0 : 2,
  snapshot: { value: 0, date: "", change: 0, changePct: 0 },
  trend: "flat" as const,
  momentum: "stable" as const,
  relationships: [],
  historicalEvents: [],
  series: [],
  provenance: {
    status: "simulated" as const,
    quality: "unverified" as const,
    sourceName: "World Bank",
    sourceSeriesId: series.wb,
    sourceUrl: `https://data.worldbank.org/indicator/${series.wb}`,
    transformation: "level" as const,
    seasonalAdjustment: "unknown" as const,
    observedThrough: "",
    notes: "Metadata-only MVP expansion; ingest and validate before treating as evidence.",
  },
})));

export const MVP_EXPANSION_SOURCES = Object.fromEntries(SCOPES.flatMap((scope) => SERIES.map((series) => [
  `${series.key}-${scope.country.toLowerCase()}`,
  {
    type: "worldbank",
    seriesId: series.wb,
    source: "World Bank",
    agency: "World Bank",
    sourceUrl: `https://data.worldbank.org/indicator/${series.wb}`,
    wbCountry: scope.wbCountry,
    frequencyLabel: "Annual",
    unit: series.unit,
    notes: series.description,
  },
]))) as Record<string, import("../../config/dataSources").DataSourceConfig>;
