import { Indicator } from "../types.js";
import { DataSourceConfig } from "../../config/dataSources.js";

export const EMERGING_MARKETS_SCOPES = [
  { country: "VN" as const, label: "Vietnam", region: "Southeast Asia", centralBank: "State Bank of Vietnam", currency: "VND" },
  { country: "BR" as const, label: "Brazil", region: "Latin America", centralBank: "Central Bank of Brazil", currency: "BRL" },
  { country: "IN" as const, label: "India", region: "South Asia", centralBank: "Reserve Bank of India", currency: "INR" },
  { country: "ID" as const, label: "Indonesia", region: "Southeast Asia", centralBank: "Bank Indonesia", currency: "IDR" },
  { country: "MX" as const, label: "Mexico", region: "Latin America", centralBank: "Bank of Mexico", currency: "MXN" },
];

export const EMERGING_MARKETS_SERIES_DEFS = [
  {
    prefix: "em-cpi",
    name: "Consumer Price Index",
    shortName: "CPI",
    category: "inflation" as const,
    unit: "Index",
    transformation: "pc1" as const,
    decimalPlaces: 1,
    description: "Harmonized / Total Consumer Price Index (YoY % / Index level) published via OECD/FRED/IMF.",
    fredSeriesByCountry: {
      VN: "VNMCPICORMINMEI",
      BR: "BRACPIALLMINMEI",
      IN: "INDCPIALLMINMEI",
      ID: "IDNCPIALLMINMEI",
      MX: "MEXCPIALLMINMEI",
    },
  },
  {
    prefix: "em-policy-rate",
    name: "Central Bank Policy / Discount Rate",
    shortName: "Policy Rate",
    category: "monetary" as const,
    unit: "%",
    transformation: "lin" as const,
    decimalPlaces: 2,
    description: "Benchmark central bank policy or official discount rate (% per annum, monthly) published via FRED/IMF.",
    fredSeriesByCountry: {
      VN: "INTDSRVNM193N",
      BR: "INTDSRBRM193N",
      IN: "INTDSRINM193N",
      ID: "INTDSRIDM193N",
      MX: "INTDSRMXM193N",
    },
  },
  {
    prefix: "em-industrial-production",
    name: "Industrial Production Index",
    shortName: "Industrial Prod",
    category: "liquidity" as const,
    unit: "Index",
    transformation: "lin" as const,
    decimalPlaces: 1,
    description: "Total industrial production volume index (2015=100 / monthly) published via OECD/FRED.",
    fredSeriesByCountry: {
      VN: "VNMPROINDMISMEI",
      BR: "BRAPROINDMISMEI",
      IN: "INDPROINDMISMEI",
      ID: "IDNPROINDMISMEI",
      MX: "MEXPRINTO02IXOBSAM",
    },
  },
  {
    prefix: "em-interbank-rate",
    name: "3-Month Interbank / Reference Rate",
    shortName: "3M Interbank",
    category: "monetary" as const,
    unit: "%",
    transformation: "lin" as const,
    decimalPlaces: 2,
    description: "3-Month interbank reference rate reflecting monetary stance (% per annum, monthly) published via OECD/FRED/IMF.",
    fredSeriesByCountry: {
      VN: "IR3TIB01VNM156N",
      BR: "IRSTCI01BRM156N",
      IN: "INDIR3TIB01STM",
      ID: "IR3TIB01IDM156N",
      MX: "IR3TIB01MXM156N",
    },
  },
];

export const EMERGING_MARKETS_EXPANSION_INDICATORS: Indicator[] = EMERGING_MARKETS_SCOPES.flatMap((scope) =>
  EMERGING_MARKETS_SERIES_DEFS.map((seriesDef) => {
    const seriesId = seriesDef.fredSeriesByCountry[scope.country];
    return {
      id: `${seriesDef.prefix}-${scope.country.toLowerCase()}`,
      name: `${scope.label} ${seriesDef.name}`,
      shortName: `${scope.country} ${seriesDef.shortName}`,
      description: seriesDef.description,
      category: seriesDef.category,
      country: scope.country,
      frequency: "monthly" as const,
      source: "FRED",
      unit: seriesDef.unit,
      decimalPlaces: seriesDef.decimalPlaces,
      snapshot: { value: 0, date: "", change: 0, changePct: 0 },
      trend: "flat" as const,
      momentum: "stable" as const,
      relationships: [],
      historicalEvents: [],
      series: [],
      provenance: {
        status: "simulated" as const,
        quality: "unverified" as const,
        sourceName: "FRED",
        sourceSeriesId: seriesId,
        sourceUrl: `https://fred.stlouisfed.org/series/${seriesId}`,
        transformation: seriesDef.transformation === "pc1" ? ("yoy" as const) : ("level" as const),
        seasonalAdjustment: "seasonally-adjusted" as const,
        observedThrough: "",
        notes: `High-frequency Emerging Market monthly series (${scope.country}). Ingest and validate before treating as evidence.`,
      },
    };
  })
);

export const EMERGING_MARKETS_EXPANSION_SOURCES: Record<string, DataSourceConfig> = Object.fromEntries(
  EMERGING_MARKETS_SCOPES.flatMap((scope) =>
    EMERGING_MARKETS_SERIES_DEFS.map((seriesDef) => {
      const seriesId = seriesDef.fredSeriesByCountry[scope.country];
      const indicatorId = `${seriesDef.prefix}-${scope.country.toLowerCase()}`;
      const config: DataSourceConfig = {
        type: "fred",
        seriesId,
        fredTransformation: seriesDef.transformation === "pc1" ? "pc1" : "lin",
        source: "FRED",
        agency: "OECD/IMF/Central Bank",
        sourceUrl: `https://fred.stlouisfed.org/series/${seriesId}`,
        frequencyLabel: "Monthly",
        unit: seriesDef.unit,
        notes: `${scope.label} ${seriesDef.name} (${seriesDef.category}). ${seriesDef.description}`,
      };
      return [indicatorId, config];
    })
  )
);
