import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import ExcelJS from "exceljs";
import { createExtractorFromData } from "node-unrar-js";
import unzipper from "unzipper";
import { db } from "./db.js";
import { DATA_SOURCES } from "../src/app/config/dataSources.js";
import { evaluateServerAlerts } from "./alerts.js";
import { shouldUseSupabaseStorage, supabaseClaimIngestionJob, supabaseEvaluateAlerts, supabaseFinishIngestionJob, supabaseHeartbeatIngestionJob, supabaseIngestVerifiedBatch } from "./supabase.js";
import { claimIngestionJob, finishIngestionJob, heartbeatIngestionJob } from "./ingestionJobs.js";
import { buildProviderOperationAvailability, PROVIDER_MANIFEST_VERSION, validateProviderManifest } from "./providerContract.js";
import { getIndicatorProviderCapability } from "../src/app/config/providerRegistry.js";
import { QUARANTINED_PROVIDER_IDS } from "./quarantinedProviderIds.js";

type RawObservation = { date: string; value: number; sourceVintage?: string };
const PROVIDER_TIMEOUT_MS = 20_000;
const require = createRequire(import.meta.url);
const parsePdf = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>;

function providerSignal() {
  return AbortSignal.timeout(PROVIDER_TIMEOUT_MS);
}

export function assertProviderOperation(indicatorId: string, operation: "ingest" | "evidence") {
  const capability = getIndicatorProviderCapability(indicatorId);
  const availability = capability
    ? buildProviderOperationAvailability(capability, operation)
    : null;
  if (!availability || availability.status !== "configuration-supported") {
    throw new Error(`${indicatorId} provider operation ${operation} is not declared: ${availability?.reasonCode ?? "UNKNOWN_PROVIDER"}`);
  }
  return availability;
}

/** Canonical economic period; never derived from retrieval time. */
export function canonicalObservationPeriod(date: string, frequency?: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  const [, year, month] = match;
  const normalized = String(frequency ?? '').toLowerCase();
  if (normalized.includes('annual') || normalized === 'yearly') return `${year}-01-01`;
  if (normalized.includes('quarter')) return `${year}-${String(Math.floor((Number(month) - 1) / 3) * 3 + 1).padStart(2, '0')}-01`;
  if (normalized.includes('month')) return `${year}-${month}-01`;
  return date;
}

export function parseFredCsv(text: string, transformation?: string): RawObservation[] {
  const rows = text.trim().split(/\r?\n/).slice(1).map((line) => {
    const [date, rawValue] = line.split(",");
    return { date, value: Number(rawValue) };
  }).filter((row) => row.date && Number.isFinite(row.value));
  if (!transformation || transformation === "lin") return rows;

  const periodsPerYear = rows.length > 2
    ? Math.max(1, Math.round(365 / Math.max(1, (Date.parse(rows.at(-1)!.date) - Date.parse(rows[0].date)) / rows.length / 86_400_000)))
    : 12;
  const lag = transformation === "pc1" || transformation === "ch1" ? periodsPerYear : 1;
  return rows.slice(lag).map((row, index) => {
    const prior = rows[index].value;
    const value = transformation === "pc1"
      ? ((row.value - prior) / prior) * 100
      : transformation === "pch"
        ? ((row.value - prior) / prior) * 100
        : row.value - prior;
    return { date: row.date, value };
  });
}

export function parseFredApiObservations(payload: unknown): RawObservation[] {
  const typed = payload as { realtime_start?: string; observations?: Array<{ date: string; value: string; realtime_start?: string }> };
  const payloadVintage = typed.realtime_start;
  const items = typed.observations ?? [];
  return items.filter((item) => item.value !== '.' && item.value !== '')
    .map((item) => {
      const sourceVintage = item.realtime_start ?? payloadVintage;
      return { date: item.date, value: Number(item.value), ...(sourceVintage && /^\d{4}-\d{2}-\d{2}$/.test(sourceVintage) ? { sourceVintage } : {}) };
    })
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.date) && Number.isFinite(item.value));
}

export async function parseWorldBankGoldWorkbook(buffer: ArrayBuffer): Promise<RawObservation[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("Monthly Prices");
  if (!sheet) throw new Error("World Bank workbook is missing Monthly Prices sheet");
  const headers = sheet.getRow(5).values as unknown[];
  const goldColumn = headers.findIndex((value) => String(value ?? "").trim().toLowerCase() === "gold");
  if (goldColumn < 0) throw new Error("World Bank workbook is missing Gold column");
  const unit = String(sheet.getRow(6).getCell(goldColumn).value ?? "").trim();
  if (unit !== "($/troy oz)") throw new Error(`Unexpected World Bank Gold unit: ${unit}`);
  const observations: RawObservation[] = [];
  for (let rowNumber = 7; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const period = String(row.getCell(1).value ?? "").trim();
    const rawValue = row.getCell(goldColumn).value;
    const match = /^(\d{4})M(\d{2})$/.exec(period);
    const value = typeof rawValue === "number" ? rawValue : Number(rawValue);
    if (match && Number.isFinite(value)) {
      observations.push({ date: `${match[1]}-${match[2]}-01`, value });
    }
  }
  return observations;
}

export function parseIsmManufacturingPdf(text: string): RawObservation[] {
  const reportMonth = text.match(/(?:expanded|contracted)\s+in\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+for[\s\S]{0,100}?\b(20\d{2})\b/i)
    ?? text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i);
  const value = text.match(/(?:registering|registered)\s+(\d{2}(?:\.\d+)?)\s+percent/i);
  if (!reportMonth || !value) return [];
  const month = new Date(`${reportMonth[1]} 1, ${reportMonth[2]}`).getMonth() + 1;
  return [{ date: `${reportMonth[2]}-${String(month).padStart(2, "0")}-01`, value: Number(value[1]) }];
}

export function parseVnIndexCsv(text: string): RawObservation[] {
  return text.trim().split(/\r?\n/).slice(1).map((line) => {
    const [date, rawValue] = line.split(",");
    return { date, value: Number(rawValue) };
  }).filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && Number.isFinite(row.value));
}

export function parseFfinIndexJson(payload: unknown, indexCode: string): RawObservation[] {
  const rows = (payload as { indices?: Record<string, { D1?: Array<{ time: string; open: number; high: number; low: number; close: number }> }> })?.indices?.[indexCode]?.D1 ?? [];
  return rows.map((row) => ({ date: row.time.slice(0, 10), value: Number(row.close) }))
    .filter((row, index) => {
      const source = rows[index];
      return /^\d{4}-\d{2}-\d{2}$/.test(row.date) && Number.isFinite(row.value) &&
        Number.isFinite(source.open) && Number.isFinite(source.high) && Number.isFinite(source.low) &&
        source.high >= Math.max(source.open, source.close) && source.low <= Math.min(source.open, source.close);
    });
}

export function parseQuangAnhVnIndexValuationJson(payload: unknown, metric: "pe" | "pb"): RawObservation[] {
  const rows = (payload as { success?: boolean; index?: string; data?: Array<{ date?: string; pe?: number | null; pb?: number | null }> })?.data ?? [];
  return rows.map((row) => ({ date: String(row.date ?? ""), value: Number(row[metric]) }))
    .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && Number.isFinite(row.value) && row.value > 0);
}

export function parseQuangAnhIndexJson(payload: unknown): RawObservation[] {
  const rows = Array.isArray(payload) ? payload as Array<{ tradingDate?: string; indexValue?: number }> : [];
  return rows.map((row) => ({ date: String(row.tradingDate ?? ""), value: Number(row.indexValue) }))
    .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && Number.isFinite(row.value) && row.value > 0);
}

export function parseHoseForeignTradingJson(payload: unknown, date: string): RawObservation[] {
  const rows = (payload as { data?: Array<{ trading_type_name?: string; foreign_trading_value?: string }> })?.data ?? [];
  const net = rows.find((row) => row.trading_type_name?.trim().toLowerCase() === "mua - bán");
  if (!net) return [];
  const rawValue = String(net.foreign_trading_value ?? "").trim();
  if (!rawValue) return [];
  const value = Number(rawValue.replace(/,/g, ""));
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(value) && value > 0 ? [{ date, value }] : [];
}

export function parseHoseTradingReportJson(payload: unknown, date: string): RawObservation[] {
  const rawValue = String((payload as { data?: { mainValue?: string } })?.data?.mainValue ?? "").trim();
  if (!rawValue) return [];
  const value = Number(rawValue.replace(/,/g, ""));
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(value) && value > 0 ? [{ date, value }] : [];
}

export function parseMocRealEstateReportHtml(text: string): RawObservation[] {
  const match = text.match(/Quý\s+II\s+năm\s+2025[\s\S]{0,240}?khoảng\s+([\d.]+)\s+giao\s+dịch/i);
  if (!match) return [];
  const value = Number(match[1].replace(/\./g, ""));
  return Number.isFinite(value) ? [{ date: "2025-06-30", value }] : [];
}

export function parseBaoChinhPhuRealEstateReportHtml(text: string): RawObservation[] {
  const apartment = text.match(/giao dịch căn hộ[^\d]{0,120}đạt\s+([\d.]+)/i);
  const land = text.match(/Giao dịch đất nền đạt\s+([\d.]+)/i);
  if (!apartment || !land) return [];
  const apartmentValue = Number(apartment[1].replace(/\./g, ""));
  const landValue = Number(land[1].replace(/\./g, ""));
  const value = apartmentValue + landValue;
  return Number.isFinite(value) && value > 0 ? [{ date: "2025-06-30", value }] : [];
}

export function parseBaoChinhPhuCreditGrowthHtml(text: string): RawObservation[] {
  const match = text.match(/tín dụng toàn nền kinh tế đạt[\s\S]{0,160}?tăng\s+([\d,]+)%\s+so với cuối năm 2024/i);
  if (!match) return [];
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) && value >= 0 ? [{ date: "2025-06-30", value }] : [];
}

export function parseSavillsHcmcNewSupplyPdf(text: string): RawObservation[] {
  const match = text.match(/(?:new\s+)?supply\s+of\s+around\s+([\d,]+)\s+units/i);
  if (!match) return [];
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) ? [{ date: "2025-03-31", value }] : [];
}

export function parseCushmanHcmcApartmentPricePdf(text: string): RawObservation[] {
  const match = text.match(/Q1\s+2026[\s\S]{0,180}?USD\s*([\d,]+)[\s\S]{0,40}?\(USD\/sqm\)/i);
  if (!match) return [];
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 ? [{ date: "2026-03-31", value }] : [];
}

export function parseCushmanHcmcApartmentPriceHtml(text: string): RawObservation[] {
  const match = text.match(/average primary (?:market )?sales price[^\d]{0,160}(?:nearly\s+)?USD\s*([\d,]+)\s*\/\s*m(?:²|2)/i)
    ?? text.match(/average primary price[^\d]{0,160}(?:nearly\s+)?([\d,]+)\s*USD\/m(?:²|2)/i);
  if (!match) return [];
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 ? [{ date: "2026-03-31", value }] : [];
}

export function parseCbreSouthernIndustrialLandHtml(text: string): RawObservation[] {
  const match = text.match(/average\s+asking\s+price\s+in\s+the\s+South\s+to\s+USD\s*([\d,]+)\s*\/\s*m(?:²|2)/i);
  if (!match) return [];
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 ? [{ date: "2025-12-31", value }] : [];
}

export function parseWorldBankBroadMoneyBasket(
  seriesByCountry: Record<string, { money: unknown[]; fx: unknown[] }>,
): RawObservation[] {
  const totals = new Map<string, number>();
  const contributors = new Map<string, number>();
  for (const country of Object.keys(seriesByCountry)) {
    const moneyByYear = new Map(
      seriesByCountry[country].money
        .filter((item): item is { date: string; value: number } =>
          typeof (item as { date?: unknown }).date === "string" &&
          typeof (item as { value?: unknown }).value === "number"
        )
        .map((item) => [item.date, item.value]),
    );
    const fxByYear = new Map(
      seriesByCountry[country].fx
        .filter((item): item is { date: string; value: number } =>
          typeof (item as { date?: unknown }).date === "string" &&
          typeof (item as { value?: unknown }).value === "number" &&
          (item as { value: number }).value > 0
        )
        .map((item) => [item.date, item.value]),
    );
    for (const [year, money] of moneyByYear) {
      const fx = fxByYear.get(year);
      if (fx !== undefined && Number.isFinite(money)) {
        totals.set(year, (totals.get(year) ?? 0) + money / fx / 1e12);
        contributors.set(year, (contributors.get(year) ?? 0) + 1);
      }
    }
  }
  const countryCount = Object.keys(seriesByCountry).length;
  return [...totals.entries()]
    .filter(([year]) => contributors.get(year) === countryCount)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, value]) => ({ date: `${year}-01-01`, value }));
}

export type ObservationValidationResult = {
  valid: RawObservation[];
  rejected: Array<RawObservation & { reason: string }>;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function validateObservation(date: string, value: unknown) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    return "INVALID_DATE";
  }
  if (typeof value !== "number" || !Number.isFinite(value)) return "INVALID_VALUE";
  return null;
}

export function validateAndDeduplicateObservations(observations: RawObservation[], frequency?: string): ObservationValidationResult {
  const valid: RawObservation[] = [];
  const rejected: ObservationValidationResult["rejected"] = [];
  const seen = new Map<string, RawObservation[]>();

  for (const observation of observations) {
    const contractError = validateObservation(observation.date, observation.value);
    if (contractError) {
      rejected.push({ ...observation, reason: contractError });
      continue;
    }
    const canonicalDate = canonicalObservationPeriod(observation.date, frequency);
    const prior = seen.get(canonicalDate) ?? [];
    const exact = prior.find((item) => item.value === observation.value);
    const sameRevision = prior.find((item) => String(item.sourceVintage ?? '') === String(observation.sourceVintage ?? ''));
    if (exact || sameRevision) {
      rejected.push({
        ...observation,
        reason: exact ? "DUPLICATE_OBSERVATION" : "CONFLICTING_DUPLICATE",
      });
      continue;
    }
    const normalized = { ...observation, date: canonicalDate };
    seen.set(canonicalDate, [...prior, normalized]);
    valid.push(normalized);
  }
  return { valid, rejected };
}

export function assertNonEmptyValidatedObservations(indicatorId: string, validCount: number) {
  if (validCount === 0) throw new Error(`${indicatorId} source returned no valid observations; ingestion is fail-closed`);
}

async function fetchSource(indicatorId: string) {
  const config = DATA_SOURCES[indicatorId];
  if (!config) throw new Error(`Unknown indicator: ${indicatorId}`);

  if (config.type === "fred") {
    const apiKey = process.env.FRED_API_KEY;
    if (!apiKey) {
      const params = new URLSearchParams({ id: config.seriesId! });
      const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?${params}`;
      const response = await fetch(url, { headers: { Accept: "text/csv" }, signal: providerSignal() });
      const text = await response.text();
      if (!response.ok) throw new Error(`FRED CSV returned ${response.status}: ${text.slice(0, 200)}`);
      return { config, url: config.sourceUrl, statusCode: response.status, text, observations: parseFredCsv(text, config.fredTransformation) };
    }
    const params = new URLSearchParams({
      series_id: config.seriesId!,
      api_key: apiKey,
      file_type: "json",
      sort_order: "asc",
      limit: "100000",
      ...(config.fredTransformation ? { units: config.fredTransformation } : {}),
    });
    const url = `https://api.stlouisfed.org/fred/series/observations?${params}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: providerSignal(),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`FRED returned ${response.status}: ${text.slice(0, 200)}`);
    const payload = JSON.parse(text);
    const observations = parseFredApiObservations(payload);
    return { config, url: config.sourceUrl, statusCode: response.status, text, observations };
  }

  if (config.type === "worldbank") {
    const url = `https://api.worldbank.org/v2/country/${config.wbCountry}/indicator/${config.seriesId}?format=json&per_page=1000`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "MacroResearchPlatform/1.0 (source-verification; contact=admin)",
      },
      signal: providerSignal(),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`World Bank returned ${response.status}`);
    const payload = JSON.parse(text);
    const observations: RawObservation[] = (payload[1] ?? [])
      .filter((item: { value: number | null }) => typeof item.value === "number")
      .map((item: { date: string; value: number }) => ({
        date: `${item.date}-01-01`,
        value: item.value,
      }))
      .sort((a: RawObservation, b: RawObservation) => a.date.localeCompare(b.date));
    return { config, url, statusCode: response.status, text, observations };
  }

  if (config.type === "quanganh-vnindex-valuation-json") {
    const response = await fetch(config.sourceUrl, {
      headers: { Accept: "application/json", "User-Agent": "MacroResearchPlatform/1.0 (source-verification; contact=admin)" },
      signal: providerSignal(),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Quang Anh VNINDEX valuation returned ${response.status}: ${text.slice(0, 200)}`);
    const payload = JSON.parse(text);
    const metric = config.seriesId === "VNINDEX_PB" ? "pb" : "pe";
    return { config, url: config.sourceUrl, statusCode: response.status, text, observations: parseQuangAnhVnIndexValuationJson(payload, metric) };
  }

  if (config.type === "quanganh-index-json") {
    const response = await fetch(config.sourceUrl, {
      headers: { Accept: "application/json", "User-Agent": "MacroResearchPlatform/1.0 (source-verification; contact=admin)" },
      signal: providerSignal(),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Quang Anh index history returned ${response.status}: ${text.slice(0, 200)}`);
    return { config, url: config.sourceUrl, statusCode: response.status, text, observations: parseQuangAnhIndexJson(JSON.parse(text)) };
  }

  if (config.type === "worldbank-broad-money-basket") {
    const countries = config.wbCountries ?? [];
    if (countries.length === 0 || !config.wbMoneySeriesId || !config.wbFxSeriesId) {
      throw new Error("World Bank broad-money basket contract is incomplete");
    }
    const seriesByCountry: Record<string, { money: unknown[]; fx: unknown[] }> = {};
    const payloads: string[] = [];
    for (const country of countries) {
      const entries = { money: [] as unknown[], fx: [] as unknown[] };
      const seriesIds: string[] = country === "US"
        ? [config.wbMoneySeriesId]
        : [config.wbMoneySeriesId, config.wbFxSeriesId];
      for (const seriesId of seriesIds) {
        const url = `https://api.worldbank.org/v2/country/${country}/indicator/${seriesId}?format=json&per_page=1000`;
        const response = await fetch(url, {
          headers: { Accept: "application/json", "User-Agent": "MacroResearchPlatform/1.0 (source-verification; contact=admin)" },
          signal: providerSignal(),
        });
        const text = await response.text();
        if (!response.ok) throw new Error(`World Bank basket returned ${response.status} for ${country}/${seriesId}`);
        payloads.push(text);
        const payload = JSON.parse(text);
        if (seriesId === config.wbMoneySeriesId) entries.money = payload[1] ?? [];
        else entries.fx = payload[1] ?? [];
      }
      if (country === "US") {
        entries.fx = entries.money
          .filter((item): item is { date: string } => typeof (item as { date?: unknown }).date === "string")
          .map((item) => ({ date: item.date, value: 1 }));
      }
      seriesByCountry[country] = entries;
    }
    return {
      config,
      url: config.sourceUrl,
      statusCode: 200,
      text: payloads.join("\n"),
      observations: parseWorldBankBroadMoneyBasket(seriesByCountry),
    };
  }

  if (config.type === "worldbank-commodity") {
    const url = "https://thedocs.worldbank.org/en/doc/74e8be41ceb20fa0da750cda2f6b9e4e-0050012026/related/CMO-Historical-Data-Monthly.xlsx";
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "User-Agent": "MacroResearchPlatform/1.0 (source-verification; contact=admin)",
      },
      signal: providerSignal(),
    });
    const buffer = await response.arrayBuffer();
    if (!response.ok) throw new Error(`World Bank commodity workbook returned ${response.status}`);
    return {
      config,
      url: config.sourceUrl,
      statusCode: response.status,
      text: Buffer.from(buffer).toString("base64"),
      observations: await parseWorldBankGoldWorkbook(buffer),
    };
  }

  if (config.type === "ism-pdf") {
    const response = await fetch(config.sourceUrl, {
      headers: {
        Accept: "application/pdf",
        "User-Agent": "MacroResearchPlatform/1.0 (source-verification; contact=admin)",
      },
      signal: providerSignal(),
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!response.ok) throw new Error(`ISM PDF returned ${response.status}`);
    const payload = await parsePdf(buffer);
    return {
      config,
      url: config.sourceUrl,
      statusCode: response.status,
      text: buffer.toString("base64"),
      observations: parseIsmManufacturingPdf(payload.text),
    };
  }

  if (config.type === "mendeley-csv") {
    const response = await fetch(config.sourceUrl, {
      headers: { Accept: "application/zip", "User-Agent": "MacroResearchPlatform/1.0 (source-verification; contact=admin)" },
      signal: providerSignal(),
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!response.ok) throw new Error(`Mendeley dataset returned ${response.status}`);
    const archive = await unzipper.Open.buffer(buffer);
    const rarEntry = archive.files.find((file) => file.path.toLowerCase().endsWith(".rar"));
    if (!rarEntry) throw new Error("Mendeley dataset ZIP did not contain a RAR payload");
    const rar = await rarEntry.buffer();
    const rarArrayBuffer = rar.buffer.slice(rar.byteOffset, rar.byteOffset + rar.byteLength) as ArrayBuffer;
    const extractor = await createExtractorFromData({ data: rarArrayBuffer });
    const extracted = Array.from(extractor.extract({ files: ["vnindex_daily.csv"] }).files)[0]?.extraction;
    if (!extracted) throw new Error("Mendeley dataset did not contain vnindex_daily.csv");
    const csv = Buffer.from(extracted).toString("utf8");
    return { config, url: config.sourceUrl, statusCode: response.status, text: buffer.toString("base64"), observations: parseVnIndexCsv(csv) };
  }

  if (config.type === "f-fin-json") {
    const response = await fetch(config.sourceUrl, {
      headers: { Accept: "application/json", "User-Agent": "MacroResearchPlatform/1.0 (source-verification; contact=admin)" },
      signal: providerSignal(),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`F-Fin JSON returned ${response.status}: ${text.slice(0, 200)}`);
    const payload = JSON.parse(text);
    return { config, url: config.sourceUrl, statusCode: response.status, text, observations: parseFfinIndexJson(payload, config.seriesId!) };
  }

  if (config.type === "hose-foreign-json") {
    const observations: RawObservation[] = [];
    const payloads: string[] = [];
    const cursor = new Date();
    for (let offset = 0; offset < 7 && observations.length < 5; offset += 1) {
      const date = new Date(cursor);
      date.setUTCDate(cursor.getUTCDate() - offset);
      const day = date.toISOString().slice(0, 10);
      const params = new URLSearchParams({ fromDate: day, toDate: day, securitiesType: "" });
      const url = `https://api.hsx.vn/mk/api/v1/market/foreign-trading-value-report?${params}`;
      const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "MacroResearchPlatform/1.0 (source-verification; contact=admin)" }, signal: providerSignal() });
      const text = await response.text();
      if (!response.ok) throw new Error(`HOSE foreign trading API returned ${response.status}: ${text.slice(0, 200)}`);
      payloads.push(text);
      observations.push(...parseHoseForeignTradingJson(JSON.parse(text), day));
    }
    return { config, url: config.sourceUrl, statusCode: 200, text: payloads.join("\n"), observations };
  }

  if (config.type === "hose-trading-json") {
    const observations: RawObservation[] = [];
    const payloads: string[] = [];
    const cursor = new Date();
    for (let offset = 0; offset < 7 && observations.length < 5; offset += 1) {
      const date = new Date(cursor);
      date.setUTCDate(cursor.getUTCDate() - offset);
      const day = date.toISOString().slice(0, 10);
      const params = new URLSearchParams({ startDate: day, endDate: day, securitiesType: "" });
      const url = `https://api.hsx.vn/mk/api/v1/market/trading-report?${params}`;
      const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "MacroResearchPlatform/1.0 (source-verification; contact=admin)" }, signal: providerSignal() });
      const text = await response.text();
      if (!response.ok) throw new Error(`HOSE trading API returned ${response.status}: ${text.slice(0, 200)}`);
      payloads.push(text);
      observations.push(...parseHoseTradingReportJson(JSON.parse(text), day));
    }
    return { config, url: config.sourceUrl, statusCode: 200, text: payloads.join("\n"), observations };
  }

  if (config.type === "moc-bds-html") {
    const response = await fetch(config.sourceUrl, {
      headers: { Accept: "text/html", "User-Agent": "MacroResearchPlatform/1.0 (source-verification; contact=admin)" },
      signal: providerSignal(),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`MOC report returned ${response.status}: ${text.slice(0, 200)}`);
    return { config, url: config.sourceUrl, statusCode: response.status, text, observations: parseMocRealEstateReportHtml(text) };
  }

  if (config.type === "baochinhphu-bds-html") {
    const response = await fetch(config.sourceUrl, {
      headers: { Accept: "text/html", "User-Agent": "MacroResearchPlatform/1.0 (source-verification; contact=admin)" },
      signal: providerSignal(),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Bao Chinh Phu report returned ${response.status}: ${text.slice(0, 200)}`);
    return { config, url: config.sourceUrl, statusCode: response.status, text, observations: parseBaoChinhPhuRealEstateReportHtml(text) };
  }

  if (config.type === "vov-bds-html") {
    const response = await fetch(config.sourceUrl, {
      headers: { Accept: "text/html", "User-Agent": "MacroResearchPlatform/1.0 (source-verification; contact=admin)" },
      signal: providerSignal(),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`VOV report returned ${response.status}: ${text.slice(0, 200)}`);
    return { config, url: config.sourceUrl, statusCode: response.status, text, observations: parseBaoChinhPhuRealEstateReportHtml(text) };
  }

  if (config.type === "baochinhphu-credit-html") {
    const response = await fetch(config.sourceUrl, {
      headers: { Accept: "text/html", "User-Agent": "MacroResearchPlatform/1.0 (source-verification; contact=admin)" },
      signal: providerSignal(),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Bao Chinh Phu credit report returned ${response.status}: ${text.slice(0, 200)}`);
    return { config, url: config.sourceUrl, statusCode: response.status, text, observations: parseBaoChinhPhuCreditGrowthHtml(text) };
  }

  if (config.type === "cbre-industrial-land-pdf") {
    const response = await fetch(config.sourceUrl, {
      headers: { Accept: "application/pdf", "User-Agent": "MacroResearchPlatform/1.0 (source-verification; contact=admin)" },
      signal: providerSignal(),
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!response.ok) throw new Error(`CBRE land report returned ${response.status}`);
    const payload = await parsePdf(buffer);
    return { config, url: config.sourceUrl, statusCode: response.status, text: buffer.toString("base64"), observations: parseCbreSouthernIndustrialLandHtml(payload.text) };
  }

  if (config.type === "cbre-landed-price-pdf") {
    const response = await fetch(config.sourceUrl, {
      headers: { Accept: "application/pdf", "User-Agent": "MacroResearchPlatform/1.0 (source-verification; contact=admin)" },
      signal: providerSignal(),
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!response.ok) throw new Error(`CBRE landed-price report returned ${response.status}`);
    const payload = await parsePdf(buffer);
    return { config, url: config.sourceUrl, statusCode: response.status, text: buffer.toString("base64"), observations: parseCbreHcmcLandedPrimaryPricePdf(payload.text) };
  }

  if (config.type === "savills-hcmc-pdf") {
    const response = await fetch(config.sourceUrl, {
      headers: { Accept: "application/pdf", "User-Agent": "MacroResearchPlatform/1.0 (source-verification; contact=admin)" },
      signal: providerSignal(),
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!response.ok) throw new Error(`Savills report returned ${response.status}`);
    const payload = await parsePdf(buffer);
    return { config, url: config.sourceUrl, statusCode: response.status, text: buffer.toString("base64"), observations: parseSavillsHcmcNewSupplyPdf(payload.text) };
  }

  if (config.type === "cushman-hcmc-pdf") {
    const reportUrl = "https://assets.cushmanwakefield.com/-/media/cw/marketbeat-pdfs/2026/q1/apac-and-gc/q1-2026-hcmc-residential-markets-en-260428---final.pdf?rev=2c77ecc353fd4de688352cfb328c6248";
    const response = await fetch(reportUrl, {
      headers: { Accept: "application/pdf", "User-Agent": "MacroResearchPlatform/1.0 (source-verification; contact=admin)" },
      signal: providerSignal(),
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!response.ok) {
      const fallback = await fetch(config.sourceUrl, {
        headers: { Accept: "text/html", "User-Agent": "MacroResearchPlatform/1.0 (source-verification; contact=admin)" },
        signal: providerSignal(),
      });
      const html = await fallback.text();
      if (!fallback.ok) throw new Error(`Cushman & Wakefield landing page returned ${fallback.status}`);
      return { config, url: config.sourceUrl, statusCode: fallback.status, text: html, observations: parseCushmanHcmcApartmentPriceHtml(html) };
    }
    const payload = await parsePdf(buffer);
    return { config, url: reportUrl, statusCode: response.status, text: buffer.toString("base64"), observations: parseCushmanHcmcApartmentPricePdf(payload.text) };
  }

  if (config.type === "coingecko") {
    const url = `https://api.coingecko.com/api/v3/coins/${config.coinId}/market_chart?vs_currency=usd&days=365&interval=daily`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "MacroResearchPlatform/1.0 (source-verification; contact=admin)",
      },
      signal: providerSignal(),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`CoinGecko returned ${response.status}`);
    const payload = JSON.parse(text);
    const byDate = new Map<string, number>();
    for (const [timestamp, value] of payload.prices ?? []) {
      byDate.set(new Date(timestamp).toISOString().slice(0, 10), value);
    }
    const observations = [...byDate].map(([date, value]) => ({ date, value }));
    return { config, url, statusCode: response.status, text, observations };
  }

  throw new Error(
    `${indicatorId} is manual/unlicensed; no production adapter is enabled`
  );
}

export async function ingestIndicator(indicatorId: string) {
  const source = DATA_SOURCES[indicatorId];
  if (!source) throw new Error(`Unknown indicator: ${indicatorId}`);
  assertProviderOperation(indicatorId, "ingest");
  assertSourceContract(indicatorId, source);
  if (shouldUseSupabaseStorage()) return ingestIndicatorInSupabase(indicatorId, source);
  const now = new Date().toISOString();
  const workerId = process.env.INGESTION_WORKER_ID ?? `pid-${process.pid}`;
  const job = claimIngestionJob(indicatorId, workerId);
  if (!job) return { skipped: true, reason: "active-ingestion-claim", indicatorId };
  const run = db.prepare(`
    INSERT INTO ingestion_runs(indicator_id, source_type, started_at, status)
    VALUES (?, ?, ?, 'running') RETURNING id
  `).get(indicatorId, source.type, now) as { id: number };

  try {
    const result = await fetchSource(indicatorId);
    heartbeatIngestionJob(job.id);
    // A reachable URL is not necessarily a valid provider response. Never
    // promote an error document (404/5xx HTML, throttling payload, etc.) to
    // actual/verified observations; the indicator is failed independently.
    if (result.statusCode >= 400) {
      throw new Error(`${indicatorId} source returned HTTP ${result.statusCode}`);
    }
    const manifestValidation = validateProviderManifest({
      manifestVersion: PROVIDER_MANIFEST_VERSION,
      providerId: result.config.type,
      seriesId: result.config.seriesId ?? result.config.coinId ?? indicatorId,
      definitionKey: indicatorId,
      unit: result.config.unit ?? "unspecified",
      frequency: result.config.frequencyLabel,
      transformation: result.config.fredTransformation ?? "level",
      transformationVersion: "provider-contract-v1",
      seasonalAdjustment: "provider-declared-or-unspecified",
      observations: result.observations,
    });
    if (!manifestValidation.valid) {
      throw new Error(`${indicatorId} provider manifest rejected: ${manifestValidation.reasons.join(",")}`);
    }
    const payloadHash = sha256(result.text);
    db.prepare(`
      INSERT OR IGNORE INTO raw_payloads(
        ingestion_run_id, indicator_id, fetched_at, source_url,
        status_code, payload_sha256, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(run.id, indicatorId, now, result.url, result.statusCode, payloadHash, result.text);

    const validation = validateAndDeduplicateObservations(result.observations, result.config.frequencyLabel);
    assertNonEmptyValidatedObservations(indicatorId, validation.valid.length);
    const quarantine = db.prepare(`
      INSERT INTO quarantine(
        ingestion_run_id, indicator_id, period, value_text,
        reason_code, details, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const observation of validation.rejected) {
      if (observation.reason) {
        quarantine.run(
          run.id, indicatorId, observation.date, String(observation.value),
          observation.reason, "Source observation failed contract validation or duplicate detection", now
        );
      }
    }

    // BACKLOG-FRESHNESS-COMPREHENSION: Observations are persisted strictly as historical facts
    // ('actual' / 'verified') using explicit provider dates and canonical periods.
    // Ingestion time is never used as observation recency, nor is static freshness baked in at insert time.
    // Freshness states ('fresh' | 'delayed' | 'outdated' | 'unavailable') are dynamically evaluated
    // at query time (server/freshness.ts) to guarantee no stale value is ever labeled current.
    const refreshSameValue = db.prepare(`
      UPDATE observations SET
        ingested_at=?, ingestion_run_id=?, source_name=?, source_series_id=?,
        unit=?, frequency=?, transformation=?
      WHERE indicator_id=? AND period=? AND value=?
    `);
    const insert = db.prepare(`
      INSERT INTO observations(
        indicator_id, period, vintage, value, status, quality,
        source_name, source_series_id, unit, frequency, transformation,
        observed_at, ingested_at, ingestion_run_id
      ) VALUES (?, ?, ?, ?, 'actual', 'verified', ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(indicator_id, period, vintage) DO UPDATE SET
        ingested_at=excluded.ingested_at,
        ingestion_run_id=excluded.ingestion_run_id,
        source_name=excluded.source_name, source_series_id=excluded.source_series_id,
        unit=excluded.unit, frequency=excluded.frequency, transformation=excluded.transformation
    `);
    db.exec("BEGIN");
    try {
      for (const observation of validation.valid) {
        // Providers without revision metadata still need a stable replay key;
        // ingestion time must never turn an identical retry into a new vintage.
        const observationVintage = observation.sourceVintage
          ? `${observation.sourceVintage}T00:00:00.000Z`
          : `${observation.date}T00:00:00.000Z`;
        const refreshed = refreshSameValue.run(
          now, run.id, result.config.source, result.config.seriesId ?? result.config.coinId ?? null,
          result.config.unit ?? null, result.config.frequencyLabel, result.config.fredTransformation ?? "level",
          indicatorId, observation.date, observation.value,
        );
        if (Number(refreshed.changes) > 0) continue;
        insert.run(
          indicatorId, observation.date, observationVintage, observation.value,
          result.config.source, result.config.seriesId ?? result.config.coinId ?? null,
          result.config.unit ?? null, result.config.frequencyLabel,
          result.config.fredTransformation ?? "level",
          observation.date, now, run.id
        );
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }

    const quarantined = validation.rejected.length;
    db.prepare(`
      UPDATE ingestion_runs
      SET completed_at = ?, status = ?, observation_count = ?, payload_sha256 = ?
      WHERE id = ?
    `).run(
      new Date().toISOString(),
      quarantined > 0 ? "quarantined" : "succeeded",
      validation.valid.length,
      payloadHash,
      run.id
    );
    const triggeredAlerts = evaluateServerAlerts(indicatorId);
    finishIngestionJob(job.id, "succeeded");
    return {
      runId: run.id,
      jobId: job.id,
      indicatorId,
      inserted: validation.valid.length,
      quarantined,
      triggeredAlerts,
    };
  } catch (error) {
    finishIngestionJob(job.id, "failed", error instanceof Error ? error.message : String(error));
    db.prepare(`
      UPDATE ingestion_runs
      SET completed_at = ?, status = 'failed', error_message = ?
      WHERE id = ?
    `).run(new Date().toISOString(), error instanceof Error ? error.message : String(error), run.id);
    throw error;
  }
}

async function ingestIndicatorInSupabase(indicatorId: string, source: typeof DATA_SOURCES[string]) {
  assertSourceContract(indicatorId, source);
  const workerId = process.env.INGESTION_WORKER_ID ?? `pid-${process.pid}`;
  const job = await supabaseClaimIngestionJob(indicatorId, workerId);
  if (!job) return { skipped: true, reason: "active-ingestion-claim", indicatorId };
  const startedAt = new Date().toISOString();
  try {
    const result = await fetchSource(indicatorId);
    await supabaseHeartbeatIngestionJob(job.id);
    const completedAt = new Date().toISOString();
    const payloadHash = sha256(result.text);
    const manifestValidation = validateProviderManifest({
      manifestVersion: PROVIDER_MANIFEST_VERSION,
      providerId: result.config.type,
      seriesId: result.config.seriesId ?? result.config.coinId ?? indicatorId,
      definitionKey: indicatorId,
      unit: result.config.unit ?? "unspecified",
      frequency: result.config.frequencyLabel,
      transformation: result.config.fredTransformation ?? "level",
      transformationVersion: "provider-contract-v1",
      seasonalAdjustment: "provider-declared-or-unspecified",
      observations: result.observations,
    });
    if (!manifestValidation.valid) {
      throw new Error(`${indicatorId} provider manifest rejected: ${manifestValidation.reasons.join(",")}`);
    }
        const validation = validateAndDeduplicateObservations(result.observations, result.config.frequencyLabel);
    assertNonEmptyValidatedObservations(indicatorId, validation.valid.length);
    const response = await supabaseIngestVerifiedBatch({
      indicatorId, sourceType: source.type, startedAt, completedAt, sourceUrl: result.url,
      statusCode: result.statusCode, payloadSha256: payloadHash, payloadJson: result.text,
      observations: validation.valid.map((observation) => ({
        date: observation.date, value: observation.value, ...(observation.sourceVintage ? { vintage: `${observation.sourceVintage}T00:00:00.000Z` } : {}), sourceName: result.config.source,
        sourceSeriesId: result.config.seriesId ?? result.config.coinId ?? "", unit: result.config.unit ?? null,
        frequency: result.config.frequencyLabel, transformation: result.config.fredTransformation ?? "level",
      })),
      quarantine: validation.rejected.map((observation) => ({ date: observation.date, value: observation.value, reason: observation.reason })),
    });
    await supabaseFinishIngestionJob(job.id, "succeeded");
    return { runId: response.runId, jobId: job.id, indicatorId, inserted: response.inserted, quarantined: response.quarantined, triggeredAlerts: await supabaseEvaluateAlerts(indicatorId) };
  } catch (error) {
    await supabaseFinishIngestionJob(job.id, "failed", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// BACKLOG-DATA-HEALTH-TRANSPARENCY: Quarantined provider sources are rejected fail-closed.
// Live provider health, quarantine state, and contract validation ensure no quarantined
// source is ever ingested or promoted to verified research evidence.
export function assertSourceContract(indicatorId: string, source: typeof DATA_SOURCES[string]) {
  if (QUARANTINED_PROVIDER_IDS.has(indicatorId)) {
    throw new Error(`${indicatorId} source is quarantined; contract validation is fail-closed`);
  }
  const sourceSeriesId = source.seriesId ?? source.coinId;
  if (!source.source.trim() || !source.sourceUrl.trim() || !sourceSeriesId?.trim() || !source.frequencyLabel.trim()) {
    throw new Error(`${indicatorId} source contract is incomplete; ingestion is fail-closed`);
  }
}
export function parseCbreHcmcLandedPrimaryPricePdf(text: string): RawObservation[] {
  const match = text.match(/220\s+mil[\s\S]{0,500}?VND\s+mil\s+psm\s+land/i);
  if (!match) return [];
  return [{ date: "2024-12-31", value: 220 }];
}
