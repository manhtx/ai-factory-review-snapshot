import { Indicator } from "../types.js";
import { DataSourceConfig } from "../../config/dataSources.js";

export const OECD_MONTHLY_SCOPES = [
  { country: "DE" as const, label: "Germany", region: "Europe", centralBank: "European Central Bank" },
  { country: "JP" as const, label: "Japan", region: "East Asia", centralBank: "Bank of Japan" },
  { country: "GB" as const, label: "United Kingdom", region: "Europe", centralBank: "Bank of England" },
  { country: "KR" as const, label: "South Korea", region: "East Asia", centralBank: "Bank of Korea" },
  { country: "FR" as const, label: "France", region: "Europe", centralBank: "European Central Bank" },
];

export const OECD_MONTHLY_SERIES_DEFS = [
  {
    prefix: "cpi",
    name: "Consumer Price Index",
    shortName: "CPI",
    category: "inflation" as const,
    unit: "Index",
    transformation: "pc1" as const,
    decimalPlaces: 1,
    description: "Harmonized / Total Consumer Price Index (YoY % / Index level) published via OECD/FRED.",
    fredSeriesByCountry: {
      DE: "DEUCPIALLMINMEI",
      JP: "JPNCPIALLMINMEI",
      GB: "GBRCPIALLMINMEI",
      KR: "KORCPIALLMINMEI",
      FR: "FRACPIALLMINMEI",
    },
  },
  {
    prefix: "harmonized-unemployment",
    name: "Harmonized Unemployment Rate",
    shortName: "Unemployment",
    category: "labor" as const,
    unit: "%",
    transformation: "lin" as const,
    decimalPlaces: 2,
    description: "Standardized harmonized unemployment rate (% of labor force, monthly) published via OECD/FRED.",
    fredSeriesByCountry: {
      DE: "LRHUTTTTDEM156S",
      JP: "LRHUTTTTJPM156S",
      GB: "LRHUTTTTGBM156S",
      KR: "LRHUTTTTKRM156S",
      FR: "LRHUTTTTFRM156S",
    },
  },
  {
    prefix: "industrial-production",
    name: "Industrial Production Index",
    shortName: "Industrial Prod",
    category: "liquidity" as const,
    unit: "Index",
    transformation: "lin" as const,
    decimalPlaces: 1,
    description: "Total industrial production volume index (2015=100, monthly) published via OECD/FRED.",
    fredSeriesByCountry: {
      DE: "DEUPROINDMISMEI",
      JP: "JPNPROINDMISMEI",
      GB: "GBRPROINDMISMEI",
      KR: "KORPROINDMISMEI",
      FR: "FRAPROINDMISMEI",
    },
  },
  {
    prefix: "policy-rate",
    name: "3-Month Interbank / Reference Rate",
    shortName: "3M Policy Rate",
    category: "monetary" as const,
    unit: "%",
    transformation: "lin" as const,
    decimalPlaces: 2,
    description: "3-Month interbank reference rate reflecting monetary stance (% per annum, monthly) published via OECD/FRED.",
    fredSeriesByCountry: {
      DE: "IR3TIB01DEM156N",
      JP: "IR3TIB01JPM156N",
      GB: "IR3TIB01GBM156N",
      KR: "IR3TIB01KRM156N",
      FR: "IR3TIB01FRM156N",
    },
  },
];

export const OECD_MONTHLY_EXPANSION_INDICATORS: Indicator[] = OECD_MONTHLY_SCOPES.flatMap((scope) =>
  OECD_MONTHLY_SERIES_DEFS.map((seriesDef) => {
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
        notes: `High-frequency Tier 1 OECD monthly series (${scope.country}). Ingest and validate before treating as evidence.`,
      },
    };
  })
);

export const OECD_MONTHLY_EXPANSION_SOURCES: Record<string, DataSourceConfig> = Object.fromEntries(
  OECD_MONTHLY_SCOPES.flatMap((scope) =>
    OECD_MONTHLY_SERIES_DEFS.map((seriesDef) => {
      const seriesId = seriesDef.fredSeriesByCountry[scope.country];
      const indicatorId = `${seriesDef.prefix}-${scope.country.toLowerCase()}`;
      const config: DataSourceConfig = {
        type: "fred",
        seriesId,
        fredTransformation: seriesDef.transformation === "pc1" ? "pc1" : "lin",
        source: "FRED",
        agency: "OECD",
        sourceUrl: `https://fred.stlouisfed.org/series/${seriesId}`,
        frequencyLabel: "Monthly",
        unit: seriesDef.unit,
        notes: `${scope.label} ${seriesDef.name} (${seriesDef.category}). ${seriesDef.description}`,
      };
      return [indicatorId, config];
    })
  )
);
