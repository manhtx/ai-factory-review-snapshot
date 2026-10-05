import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

export type InstitutionalOutlookInput = {
  indicatorId?: string;
  country?: string;
  institution?: string;
  analyst?: string | null;
  publicationDate?: string;
  targetDate?: string;
  midpoint?: number | null;
  rangeLow?: number | null;
  rangeHigh?: number | null;
  direction?: "stronger" | "weaker" | "range-bound" | "mixed";
  thesis?: string;
  methodology?: string;
  sourceName?: string;
  sourceUrl?: string;
  version?: number;
};

export function validateInstitutionalOutlook(input: InstitutionalOutlookInput) {
  const issues: string[] = [];
  for (const [key, value] of Object.entries({
    indicatorId: input.indicatorId,
    country: input.country,
    institution: input.institution,
    publicationDate: input.publicationDate,
    targetDate: input.targetDate,
    thesis: input.thesis,
    methodology: input.methodology,
    sourceName: input.sourceName,
    sourceUrl: input.sourceUrl,
  })) {
    if (typeof value !== "string" || !value.trim()) issues.push(`MISSING_${key.toUpperCase()}`);
  }
  if (input.midpoint == null && !input.direction) issues.push("MISSING_MIDPOINT_OR_DIRECTION");
  for (const [key, value] of [["midpoint", input.midpoint], ["rangeLow", input.rangeLow], ["rangeHigh", input.rangeHigh]] as const) {
    if (value != null && (typeof value !== "number" || !Number.isFinite(value))) issues.push(`INVALID_${key.toUpperCase()}`);
  }
  if (input.rangeLow != null && input.rangeHigh != null && input.rangeLow > input.rangeHigh) issues.push("INVALID_RANGE");
  if (input.midpoint != null && input.rangeLow != null && input.midpoint < input.rangeLow) issues.push("MIDPOINT_OUTSIDE_RANGE");
  if (input.midpoint != null && input.rangeHigh != null && input.midpoint > input.rangeHigh) issues.push("MIDPOINT_OUTSIDE_RANGE");
  if (input.publicationDate && Number.isNaN(Date.parse(input.publicationDate))) issues.push("INVALID_PUBLICATION_DATE");
  if (input.targetDate && Number.isNaN(Date.parse(input.targetDate))) issues.push("INVALID_TARGET_DATE");
  if (input.publicationDate && input.targetDate && Date.parse(input.targetDate) <= Date.parse(input.publicationDate)) issues.push("INVALID_HORIZON");
  if (input.sourceUrl) {
    try { if (!/^https?:$/.test(new URL(input.sourceUrl).protocol)) issues.push("INVALID_SOURCE_URL"); } catch { issues.push("INVALID_SOURCE_URL"); }
  }
  if (input.direction && !["stronger", "weaker", "range-bound", "mixed"].includes(input.direction)) issues.push("INVALID_DIRECTION");
  return issues;
}

export function persistInstitutionalOutlook(database: DatabaseSync, input: InstitutionalOutlookInput) {
  const issues = validateInstitutionalOutlook(input);
  if (issues.length) throw new Error(`Institutional outlook rejected: ${issues.join(", ")}`);
  const now = new Date().toISOString();
  const id = randomUUID();
  database.prepare(`
    INSERT INTO institutional_outlooks (
      id, indicator_id, country, institution, analyst, publication_date, target_date,
      midpoint, range_low, range_high, direction, thesis, methodology, source_name,
      source_url, version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, input.indicatorId!, input.country!, input.institution!, input.analyst ?? null,
    input.publicationDate!, input.targetDate!, input.midpoint ?? null, input.rangeLow ?? null,
    input.rangeHigh ?? null, input.direction ?? null, input.thesis!, input.methodology!,
    input.sourceName!, input.sourceUrl!, input.version ?? 1, now, now);
  return id;
}
