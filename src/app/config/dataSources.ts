import { MVP_EXPANSION_SOURCES } from "../data/indicators/mvpExpansion.js";
import { OECD_MONTHLY_EXPANSION_SOURCES } from "../data/indicators/oecdMonthlyExpansion.js";
import { EMERGING_MARKETS_EXPANSION_SOURCES } from "../data/indicators/emergingMarketsExpansion.js";
export { MVP_EXPANSION_SOURCES, OECD_MONTHLY_EXPANSION_SOURCES, EMERGING_MARKETS_EXPANSION_SOURCES };

/**
 * Real data source configuration for every indicator.
 * FRED series IDs: https://fred.stlouisfed.org
 * World Bank indicators: https://data.worldbank.org
 * CoinGecko API: https://www.coingecko.com/api
 */

export type DataSourceType = "fred" | "worldbank" | "worldbank-commodity" | "worldbank-broad-money-basket" | "ism-pdf" | "mendeley-csv" | "f-fin-json" | "hose-foreign-json" | "hose-trading-json" | "moc-bds-html" | "baochinhphu-bds-html" | "vov-bds-html" | "baochinhphu-credit-html" | "savills-hcmc-pdf" | "cushman-hcmc-pdf" | "cbre-industrial-land-pdf" | "cbre-landed-price-pdf" | "quanganh-vnindex-valuation-json" | "quanganh-index-json" | "coingecko" | "er-api" | "manual";

export interface DataSourceConfig {
  type: DataSourceType;
  /** Primary series identifier */
  seriesId?: string;
  /**
   * FRED units transformation parameter.
   * lin = level, pc1 = YoY %, pch = MoM %, chg = absolute change
   * https://fred.stlouisfed.org/docs/api/fred/series_observations.html#units
   */
  fredTransformation?: "lin" | "pc1" | "pch" | "chg" | "ch1";
  /** Human-readable source name */
  source: string;
  /** Original publishing agency */
  agency: string;
  /** Direct URL to the series page */
  sourceUrl: string;
  /** World Bank country code if applicable */
  wbCountry?: string;
  /** World Bank country basket for derived multi-country contracts. */
  wbCountries?: string[];
  /** World Bank broad-money and FX indicators for a derived basket. */
  wbMoneySeriesId?: string;
  wbFxSeriesId?: string;
  /** CoinGecko coin ID if applicable */
  coinId?: string;
  /** Frequency description */
  frequencyLabel: string;
  /** Unit stored with each observation when the provider contract defines one. */
  unit?: string;
  /** Notes on data definition */
  notes?: string;
}

export const DATA_SOURCES: Record<string, DataSourceConfig> = {
  // ── INFLATION ─────────────────────────────────────────────────────────────
  "cpi-us": {
    type: "fred",
    seriesId: "CPIAUCSL",
    fredTransformation: "pc1",
    source: "FRED",
    agency: "U.S. Bureau of Labor Statistics",
    sourceUrl: "https://fred.stlouisfed.org/series/CPIAUCSL",
    frequencyLabel: "Monthly",
    notes: "CPI for All Urban Consumers: All Items (YoY % change). Seasonally adjusted.",
  },
  "core-cpi-us": {
    type: "fred",
    seriesId: "CPILFESL",
    fredTransformation: "pc1",
    source: "FRED",
    agency: "U.S. Bureau of Labor Statistics",
    sourceUrl: "https://fred.stlouisfed.org/series/CPILFESL",
    frequencyLabel: "Monthly",
    notes: "CPI ex Food & Energy (YoY % change). Seasonally adjusted.",
  },
  "ppi-us": {
    type: "fred",
    seriesId: "PPIACO",
    fredTransformation: "pc1",
    source: "FRED",
    agency: "U.S. Bureau of Labor Statistics",
    sourceUrl: "https://fred.stlouisfed.org/series/PPIACO",
    frequencyLabel: "Monthly",
    notes: "Producer Price Index: All Commodities (YoY % change). Not seasonally adjusted.",
  },
  "pce-us": {
    type: "fred",
    seriesId: "PCEPI",
    fredTransformation: "pc1",
    source: "FRED",
    agency: "U.S. Bureau of Economic Analysis",
    sourceUrl: "https://fred.stlouisfed.org/series/PCEPI",
    frequencyLabel: "Monthly",
    notes: "Personal Consumption Expenditures Price Index (YoY % change).",
  },
  "core-pce-us": {
    type: "fred",
    seriesId: "PCEPILFE",
    fredTransformation: "pc1",
    source: "FRED",
    agency: "U.S. Bureau of Economic Analysis",
    sourceUrl: "https://fred.stlouisfed.org/series/PCEPILFE",
    frequencyLabel: "Monthly",
    notes: "PCE ex Food & Energy (YoY % change). Fed's preferred inflation gauge. Target: 2%.",
  },

  // ── LABOR ──────────────────────────────────────────────────────────────────
  "unemployment-us": {
    type: "fred",
    seriesId: "UNRATE",
    source: "FRED",
    agency: "U.S. Bureau of Labor Statistics",
    sourceUrl: "https://fred.stlouisfed.org/series/UNRATE",
    frequencyLabel: "Monthly",
    notes: "Civilian Unemployment Rate (%). Seasonally adjusted.",
  },
  "nfp-us": {
    type: "fred",
    seriesId: "PAYEMS",
    fredTransformation: "chg",
    source: "FRED",
    agency: "U.S. Bureau of Labor Statistics",
    sourceUrl: "https://fred.stlouisfed.org/series/PAYEMS",
    frequencyLabel: "Monthly",
    notes: "All Employees, Total Nonfarm — Monthly change in thousands of jobs. Seasonally adjusted.",
  },
  "jolts-us": {
    type: "fred",
    seriesId: "JTSJOL",
    source: "FRED",
    agency: "U.S. Bureau of Labor Statistics",
    sourceUrl: "https://fred.stlouisfed.org/series/JTSJOL",
    frequencyLabel: "Monthly",
    notes: "Job Openings: Total Nonfarm (thousands, seasonally adjusted).",
  },
  "wage-growth-us": {
    type: "fred",
    seriesId: "CES0500000003",
    fredTransformation: "pc1",
    source: "FRED",
    agency: "U.S. Bureau of Labor Statistics",
    sourceUrl: "https://fred.stlouisfed.org/series/CES0500000003",
    frequencyLabel: "Monthly",
    notes: "Average Hourly Earnings: Total Private (YoY % change). Seasonally adjusted.",
  },
  "initial-claims-us": {
    type: "fred",
    seriesId: "ICSA",
    source: "FRED",
    agency: "U.S. Department of Labor",
    sourceUrl: "https://fred.stlouisfed.org/series/ICSA",
    frequencyLabel: "Weekly",
    notes: "Initial Claims for Unemployment Insurance (seasonally adjusted). Released Thursdays.",
  },
  "pmi-us": {
    type: "ism-pdf",
    seriesId: "ISM_MANUFACTURING_PMI",
    source: "Institute for Supply Management",
    agency: "Institute for Supply Management",
    sourceUrl: "https://www.ismworld.org/globalassets/pub/research-and-surveys/rob/pmi/hotdm202606pmi.pdf",
    frequencyLabel: "Monthly",
    notes: "Official ISM Manufacturing PMI extracted from the publisher's monthly report PDF. >50 = expansion, <50 = contraction. No FRED proxy is used.",
  },

  // ── MONETARY POLICY ────────────────────────────────────────────────────────
  "fed-funds-rate": {
    type: "fred",
    seriesId: "FEDFUNDS",
    source: "FRED",
    agency: "Federal Reserve",
    sourceUrl: "https://fred.stlouisfed.org/series/FEDFUNDS",
    frequencyLabel: "Monthly",
    notes: "Effective Federal Funds Rate (%). Monthly average.",
  },
  "fed-balance-sheet": {
    type: "fred",
    seriesId: "WALCL",
    source: "FRED",
    agency: "Federal Reserve",
    sourceUrl: "https://fred.stlouisfed.org/series/WALCL",
    frequencyLabel: "Weekly",
    notes: "Assets: Total Assets: Total Assets (Less Eliminations from Consolidation): Wednesday Level (millions USD).",
  },
  "sofr-us": {
    type: "fred",
    seriesId: "SOFR",
    source: "FRED",
    agency: "Federal Reserve Bank of New York",
    sourceUrl: "https://fred.stlouisfed.org/series/SOFR",
    frequencyLabel: "Daily",
    notes: "Secured Overnight Financing Rate (%). Replaced LIBOR as benchmark rate.",
  },
  "reverse-repo-us": {
    type: "fred",
    seriesId: "RRPONTSYD",
    source: "FRED",
    agency: "Federal Reserve Bank of New York",
    sourceUrl: "https://fred.stlouisfed.org/series/RRPONTSYD",
    frequencyLabel: "Daily",
    notes: "Overnight Reverse Repurchase Agreements (billions USD). Measures excess bank liquidity.",
  },

  // ── BOND MARKET ────────────────────────────────────────────────────────────
  "us2y-yield": {
    type: "fred",
    seriesId: "DGS2",
    source: "FRED",
    agency: "U.S. Department of the Treasury",
    sourceUrl: "https://fred.stlouisfed.org/series/DGS2",
    frequencyLabel: "Daily",
    notes: "Market Yield on U.S. Treasury Securities at 2-Year Constant Maturity (%). Not seasonally adjusted.",
  },
  "us10y-yield": {
    type: "fred",
    seriesId: "DGS10",
    source: "FRED",
    agency: "U.S. Department of the Treasury",
    sourceUrl: "https://fred.stlouisfed.org/series/DGS10",
    frequencyLabel: "Daily",
    notes: "Market Yield on U.S. Treasury Securities at 10-Year Constant Maturity (%). Not seasonally adjusted.",
  },
  "us30y-yield": {
    type: "fred",
    seriesId: "DGS30",
    source: "FRED",
    agency: "U.S. Department of the Treasury",
    sourceUrl: "https://fred.stlouisfed.org/series/DGS30",
    frequencyLabel: "Daily",
    notes: "Market Yield on U.S. Treasury Securities at 30-Year Constant Maturity (%).",
  },
  "yield-curve": {
    type: "fred",
    seriesId: "T10Y2Y",
    source: "FRED",
    agency: "U.S. Department of the Treasury",
    sourceUrl: "https://fred.stlouisfed.org/series/T10Y2Y",
    frequencyLabel: "Daily",
    notes: "10-Year Treasury Constant Maturity Minus 2-Year (%). Negative = yield curve inversion.",
  },
  "credit-spread-us": {
    type: "fred",
    seriesId: "BAMLH0A0HYM2",
    source: "FRED",
    agency: "ICE BofA / FRED",
    sourceUrl: "https://fred.stlouisfed.org/series/BAMLH0A0HYM2",
    frequencyLabel: "Daily",
    notes: "ICE BofA US High Yield Index Option-Adjusted Spread (%). Proxy for credit risk in economy.",
  },

  // ── LIQUIDITY ──────────────────────────────────────────────────────────────
  "m1-us": {
    type: "fred",
    seriesId: "M1SL",
    source: "FRED",
    agency: "Federal Reserve",
    sourceUrl: "https://fred.stlouisfed.org/series/M1SL",
    frequencyLabel: "Monthly",
    notes: "M1 Money Stock (billions USD, seasonally adjusted). Currency + demand deposits + other liquid deposits.",
  },
  "m2-us": {
    type: "fred",
    seriesId: "M2SL",
    source: "FRED",
    agency: "Federal Reserve",
    sourceUrl: "https://fred.stlouisfed.org/series/M2SL",
    frequencyLabel: "Monthly",
    notes: "M2 Money Stock (billions USD, seasonally adjusted). M1 + small-denomination time deposits + retail MMMFs.",
  },
  "global-m2": {
    type: "worldbank-broad-money-basket",
    seriesId: "WB_BROAD_MONEY_BASKET_US_CN_JP_GB",
    source: "World Bank broad-money basket",
    agency: "World Bank / International Financial Statistics",
    sourceUrl: "https://data.worldbank.org/indicator/FM.LBL.BMNY.CN",
    frequencyLabel: "Annual",
    unit: "USD trillion",
    wbCountries: ["US", "CN", "JP", "GB"],
    wbMoneySeriesId: "FM.LBL.BMNY.CN",
    wbFxSeriesId: "PA.NUS.FCRF",
    notes: "Derived annual basket: sum of each country's World Bank broad money (FM.LBL.BMNY.CN) converted from local currency to USD using World Bank official exchange rate (PA.NUS.FCRF), divided by 1e12. Covers US, China, Japan and UK only; it is not a canonical global M2 or monthly series.",
  },

  // ── CURRENCY ───────────────────────────────────────────────────────────────
  "dxy": {
    type: "fred",
    seriesId: "DTWEXBGS",
    source: "FRED — Broad Dollar Index Proxy",
    agency: "Federal Reserve",
    sourceUrl: "https://fred.stlouisfed.org/series/DTWEXBGS",
    frequencyLabel: "Daily",
    notes: "Nominal Broad U.S. Dollar Index. This is a proxy, not the ICE U.S. Dollar Index (DXY); basket, weights and level differ.",
  },
  "usd-vnd": {
    type: "worldbank",
    seriesId: "PA.NUS.FCRF",
    source: "World Bank",
    agency: "World Bank / International Financial Statistics",
    sourceUrl: "https://data.worldbank.org/indicator/PA.NUS.FCRF?locations=VN",
    wbCountry: "VN",
    frequencyLabel: "Annual",
    notes: "Official annual exchange rate (VND per USD) from World Bank indicator PA.NUS.FCRF. This is not a daily spot rate; no daily value is represented until a verified daily provider is connected.",
  },
  "usd-cny": {
    type: "fred",
    seriesId: "DEXCHUS",
    source: "FRED",
    agency: "Federal Reserve / PBOC",
    sourceUrl: "https://fred.stlouisfed.org/series/DEXCHUS",
    frequencyLabel: "Daily",
    notes: "Chinese Yuan Renminbi to U.S. Dollar Spot Exchange Rate (CNY per 1 USD).",
  },
  "eur-usd": {
    type: "fred",
    seriesId: "DEXUSEU",
    source: "FRED",
    agency: "Federal Reserve / ECB",
    sourceUrl: "https://fred.stlouisfed.org/series/DEXUSEU",
    frequencyLabel: "Daily",
    notes: "U.S. Dollars to Euro Spot Exchange Rate (USD per 1 EUR). Not seasonally adjusted.",
  },

  // ── VIETNAM ECONOMY ────────────────────────────────────────────────────────
  "credit-growth-vn": {
    type: "baochinhphu-credit-html",
    seriesId: "SBV_CREDIT_GROWTH_H1",
    source: "Báo Điện tử Chính phủ / SBV",
    agency: "Government News / State Bank of Vietnam",
    sourceUrl: "https://baochinhphu.vn/tin-dung-tang-cao-nhat-trong-nhieu-nam-tap-trung-vao-dong-luc-tang-truong-10225070812453353.htm",
    frequencyLabel: "Semiannual",
    notes: "Credit growth of the whole Vietnamese banking system, 9.9% at 2025-06-30 versus end-2024, republished by Government News from the SBV six-month press briefing. This is not a monthly series.",
  },
  "deposit-rate-vn": {
    type: "worldbank",
    seriesId: "FR.INR.DPST",
    source: "World Bank DataBank / IMF IFS",
    agency: "World Bank / International Monetary Fund",
    sourceUrl: "https://data.worldbank.org/indicator/FR.INR.DPST?locations=VN",
    wbCountry: "VN",
    frequencyLabel: "Annual",
    notes: "Annual deposit interest rate (%) for Viet Nam from World Bank indicator FR.INR.DPST, sourced from IMF International Financial Statistics. This is not a monthly 12-month commercial-bank rate.",
  },
  "lending-rate-vn": {
    type: "worldbank",
    seriesId: "FR.INR.LEND",
    source: "World Bank DataBank / IMF IFS",
    agency: "World Bank / International Monetary Fund",
    sourceUrl: "https://data.worldbank.org/indicator/FR.INR.LEND?locations=VN",
    wbCountry: "VN",
    frequencyLabel: "Annual",
    notes: "Annual lending interest rate (%) for Viet Nam from World Bank indicator FR.INR.LEND, sourced from IMF International Financial Statistics. This is not a monthly average commercial-bank lending rate.",
  },
  "cpi-vn": {
    type: "worldbank",
    seriesId: "FP.CPI.TOTL.ZG",
    source: "World Bank",
    agency: "World Bank / GSO Vietnam",
    sourceUrl: "https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG?locations=VN",
    wbCountry: "VN",
    frequencyLabel: "Annual",
    notes: "CPI inflation (annual %) from World Bank indicator FP.CPI.TOTL.ZG. No monthly GSO observations are represented by this contract.",
  },
  "gdp-vn": {
    type: "worldbank",
    seriesId: "NY.GDP.MKTP.KD.ZG",
    source: "World Bank",
    agency: "World Bank / GSO Vietnam",
    sourceUrl: "https://data.worldbank.org/indicator/NY.GDP.MKTP.KD.ZG?locations=VN",
    wbCountry: "VN",
    frequencyLabel: "Annual",
    notes: "GDP growth (annual %) from World Bank indicator NY.GDP.MKTP.KD.ZG. No quarterly GSO observations are represented by this contract.",
  },

  // ── STOCK MARKET ───────────────────────────────────────────────────────────
  "vnindex": {
    type: "mendeley-csv",
    seriesId: "VNINDEX",
    source: "Mendeley Data / Vietstock-provided dataset",
    agency: "Mendeley Data (Elsevier)",
    sourceUrl: "https://data.mendeley.com/public-api/zip/8584zp8rtr/download/1",
    frequencyLabel: "Daily",
    notes: "Historical daily VN-Index closes, 2014-01-02 through 2024-12-31, from DOI 10.17632/8584zp8rtr.1. Raw data were provided by Vietstock; this contract is historical and not a realtime feed.",
  },
  "vn30": {
    type: "quanganh-index-json",
    seriesId: "VN30",
    source: "Quang Anh Market Data (VCI/CafeF/BTMC/Yahoo Finance)",
    agency: "Quang Anh",
    sourceUrl: "https://stock.quanganh.org/api/market/index-history?index=VN30&days=2000",
    frequencyLabel: "Daily",
    notes: "Daily VN30 index history from the provider's public index-history endpoint. The provider documents VCI, CafeF, BTMC and Yahoo Finance as source families; this is not an HOSE official feed and remains subject to source-rights review.",
  },
  "vnindex-pe": {
    type: "quanganh-vnindex-valuation-json",
    seriesId: "VNINDEX_PE",
    source: "Quang Anh Market Data (SQLite+Vietcap)",
    agency: "Quang Anh",
    sourceUrl: "https://stock.quanganh.org/api/market/pe-chart?metric=both&time_frame=ALL",
    frequencyLabel: "Daily",
    notes: "Daily VNINDEX P/E series exposed by the provider's public valuation endpoint. Provider identifies the payload source as SQLite+Vietcap; values are accepted only with a date and finite PE/PB payload.",
  },
  "vnindex-pb": {
    type: "quanganh-vnindex-valuation-json",
    seriesId: "VNINDEX_PB",
    source: "Quang Anh Market Data (SQLite+Vietcap)",
    agency: "Quang Anh",
    sourceUrl: "https://stock.quanganh.org/api/market/pe-chart?metric=both&time_frame=ALL",
    frequencyLabel: "Daily",
    notes: "Daily VNINDEX P/B series exposed by the provider's public valuation endpoint. Provider identifies the payload source as SQLite+Vietcap; values are accepted only with a date and finite PE/PB payload.",
  },
  "market-liquidity-vn": {
    type: "hose-trading-json",
    seriesId: "HOSE_TRADING_VALUE",
    source: "Sở Giao dịch Chứng khoán TP.HCM (HOSE)",
    agency: "Ho Chi Minh Stock Exchange",
    sourceUrl: "https://www.hsx.vn/vi/du-lieu-giao-dich/quy-mo-giao-dich",
    frequencyLabel: "Daily",
    unit: "million VND",
    notes: "Daily regular-order matched trading value on HOSE (million VND), from the official HOSE market-data trading-report endpoint.",
  },
  "foreign-flow-vn": {
    type: "hose-foreign-json",
    seriesId: "HOSE_FOREIGN_NET",
    source: "Sở Giao dịch Chứng khoán TP.HCM (HOSE)",
    agency: "Ho Chi Minh Stock Exchange",
    sourceUrl: "https://www.hsx.vn/vi/du-lieu-giao-dich/giao-dich-ndtnn",
    frequencyLabel: "Daily",
    unit: "million VND",
    notes: "Foreign investors net buy/sell value on HOSE (million VND), from the official HOSE market-data endpoint. The adapter queries each date separately and stores only dated net rows.",
  },

  // ── REAL ESTATE ────────────────────────────────────────────────────────────
  "apartment-price-vn": {
    type: "cushman-hcmc-pdf",
    seriesId: "CW_HCMC_APT_AVG_PRIMARY_PRICE",
    source: "Cushman & Wakefield Research Vietnam",
    agency: "Cushman & Wakefield",
    sourceUrl: "https://www.cushmanwakefield.com/en/vietnam/insights/ho-chi-minh-city-marketbeat/residential-marketbeat",
    frequencyLabel: "Quarterly",
    unit: "USD/sqm",
    notes: "HCMC average primary apartment selling price for Q1/2026 in USD/sqm, calculated on GFA and excluding VAT, maintenance fees, and discounts. The public MarketBeat landing page links the underlying Cushman & Wakefield Q1/2026 report PDF.",
  },
  "land-price-vn": {
    type: "cbre-landed-price-pdf",
    seriesId: "CBRE_HCMC_LANDED_PRIMARY_PRICE_Q4_2024",
    source: "CBRE Research (Vietcap mirror)",
    agency: "CBRE Research",
    sourceUrl: "https://www.vietcap.com.vn/api/cms-api/uploads/froala/files/Real%20Estate%20Panel%20Next%20Phase%20of%20the%20Cycle.pdf",
    frequencyLabel: "Quarterly",
    unit: "Tr VND/m²",
    notes: "CBRE Research landed-property average primary selling price in HCMC for Q4/2024: VND 220 million/sqm land, before VAT, maintenance fee and discounts. The PDF is hosted by Vietcap as a directly fetchable mirror and identifies CBRE Research as the source; forecasts are not ingested.",
  },
  "transaction-volume-vn": {
    type: "vov-bds-html",
    seriesId: "MOC_BDS_TRANSACTIONS",
    source: "Đài Tiếng nói Việt Nam (VOV) / Bộ Xây dựng",
    agency: "Voice of Vietnam / Vietnam Ministry of Construction",
    sourceUrl: "https://vov.gov.vn/bat-dong-san-quy-ii2025-nguon-cung-but-toc-nong-nhe-cuoc-dua-chat-luong-nong-dtnew-1104998?keyDevice=true",
    frequencyLabel: "Quarterly",
    unit: "transactions",
    notes: "Successful nationwide real-estate transactions in Q2/2025, reconstructed as 34,461 apartment/private-house transactions plus 122,560 land transactions from VOV's republication of the Ministry of Construction report. Historical observation, not a realtime feed; the article's comparison percentage is not used.",
  },
  "new-supply-vn": {
    type: "savills-hcmc-pdf",
    seriesId: "CBRE_HCMC_NEW_SUPPLY",
    source: "CBRE Vietnam / Savills Vietnam",
    agency: "CBRE Research",
    sourceUrl: "https://www.savills.com.vn/pdf-folder/hcmc-mrq12025-en.pdf",
    frequencyLabel: "Quarterly",
    unit: "units",
    notes: "New HCMC apartment units launched for sale. This contract is a historical Q1/2025 Savills report observation, not a realtime feed.",
  },

  // ── ALTERNATIVE ASSETS ────────────────────────────────────────────────────
  "gold": {
    type: "worldbank-commodity",
    seriesId: "GOLD",
    source: "World Bank Pink Sheet",
    agency: "World Bank Prospects Group",
    sourceUrl: "https://thedocs.worldbank.org/en/doc/74e8be41ceb20fa0da750cda2f6b9e4e-0050012026/related/CMO-Historical-Data-Monthly.xlsx",
    frequencyLabel: "Monthly",
    unit: "USD per troy ounce",
    notes: "Gold monthly average in nominal USD/troy oz from the World Bank Commodities Price Data (Pink Sheet). This is not the LBMA daily benchmark.",
  },
  "bitcoin": {
    type: "fred",
    seriesId: "CBBTCUSD",
    source: "FRED",
    agency: "Coinbase / Federal Reserve",
    sourceUrl: "https://fred.stlouisfed.org/series/CBBTCUSD",
    frequencyLabel: "Daily",
    notes: "Coinbase Bitcoin USD price. FRED started tracking from 2014. For real-time: CoinGecko API (bitcoin).",
  },
  "ethereum": {
    type: "coingecko",
    seriesId: "ethereum",
    coinId: "ethereum",
    source: "CoinGecko",
    agency: "CoinGecko",
    sourceUrl: "https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=usd&days=1",
    frequencyLabel: "Daily",
    notes: "Ethereum/USD price from the public CoinGecko market-chart API. The human-facing CoinGecko page may be protected; this is the machine-readable verification endpoint.",
  },
};

Object.assign(DATA_SOURCES, MVP_EXPANSION_SOURCES, OECD_MONTHLY_EXPANSION_SOURCES, EMERGING_MARKETS_EXPANSION_SOURCES);

/** All indicator IDs that have FRED series (can be auto-fetched with API key) */
export const FRED_FETCHABLE_IDS = Object.entries(DATA_SOURCES)
  .filter(([, ds]) => ds.type === "fred")
  .map(([id]) => id);

/** Indicators using World Bank API (free, no key needed) */
export const WORLDBANK_FETCHABLE_IDS = Object.entries(DATA_SOURCES)
  .filter(([, ds]) => ds.type === "worldbank")
  .map(([id]) => id);

/** Indicators using CoinGecko API (free, no key needed) */
export const COINGECKO_FETCHABLE_IDS = Object.entries(DATA_SOURCES)
  .filter(([, ds]) => ds.type === "coingecko")
  .map(([id]) => id);
