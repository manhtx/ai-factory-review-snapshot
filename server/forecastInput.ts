import { deterministicFingerprint } from "../src/app/data/deterministicFingerprint.js";

export interface ForecastRevisionInput {
  indicatorId: string;
  country: string;
  forecastValue: number;
  forecastDate: string;
  targetDate: string;
  institution: string;
  analyst?: string | null;
  methodology: string;
  confidence: number;
  version: number;
  status: "consensus" | "internal";
  sourceName: string;
  sourceUrl: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isDate(value: unknown): value is string {
  return typeof value === "string" && ISO_DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function validateForecastRevision(input: Partial<ForecastRevisionInput>): string[] {
  const issues: string[] = [];
  if (!/^[A-Za-z0-9_.-]{1,80}$/.test(String(input.indicatorId ?? ""))) issues.push("invalid-indicator-id");
  for (const field of ["country", "institution", "methodology", "sourceName"] as const) if (!String(input[field] ?? "").trim()) issues.push(`missing-${field}`);
  if (!Number.isFinite(input.forecastValue)) issues.push("invalid-forecast-value");
  if (!isDate(input.forecastDate)) issues.push("invalid-forecast-date");
  if (!isDate(input.targetDate)) issues.push("invalid-target-date");
  if (isDate(input.forecastDate) && isDate(input.targetDate) && input.forecastDate > input.targetDate) issues.push("forecast-date-after-target-date");
  if (!Number.isFinite(input.confidence) || Number(input.confidence) < 0 || Number(input.confidence) > 1) issues.push("invalid-confidence");
  if (!Number.isInteger(input.version) || Number(input.version) < 1) issues.push("invalid-version");
  if (input.status !== "consensus" && input.status !== "internal") issues.push("invalid-status");
  try { const url = new URL(String(input.sourceUrl ?? "")); if (url.protocol !== "https:") issues.push("source-url-must-use-https"); } catch { issues.push("invalid-source-url"); }
  return [...new Set(issues)];
}

export function buildForecastRevision(input: ForecastRevisionInput, id?: string, now = new Date().toISOString()) {
  const issues = validateForecastRevision(input);
  if (issues.length) throw new Error(`Invalid forecast revision: ${issues.join(", ")}`);
  const stableId = id ?? `forecast:${input.indicatorId}:${input.institution}:${input.targetDate}:v${input.version}`;
  const record = { id: stableId, ...input, analyst: input.analyst ?? null, createdAt: now, updatedAt: now };
  return { ...record, fingerprint: deterministicFingerprint({ id: stableId, ...input, analyst: input.analyst ?? null }) };
}
