import { deterministicFingerprint } from "../src/app/data/deterministicFingerprint.js";

export type QualitativeRightsStatus = "public-source" | "review-required" | "manual-review";
export type QualitativeDataState = "context-only" | "unavailable";

export interface DiffQuoteInput {
  quote: string;
  sourceText: string;
  quoteType?: "addition" | "deletion" | "modification" | "reference";
  context?: string;
}

export interface DiffQuoteValidationResult {
  valid: boolean;
  issues: string[];
  groundedQuotes: string[];
  unverifiedQuotes: string[];
}

export interface QualitativeEvidenceInput {
  providerId: string;
  publisher: string;
  url: string;
  headline: string;
  summary?: string | null;
  publishedAt: string;
  retrievedAt: string;
  topic?: string | null;
  rightsStatus: QualitativeRightsStatus;
  diffQuotes?: DiffQuoteInput[];
}

export interface QualitativeEvidenceItem {
  id: string;
  providerId: string;
  publisher: string;
  url: string;
  headline: string;
  excerpt: string;
  publishedAt: string;
  retrievedAt: string;
  topic: string | null;
  sentiment: number;
  rightsStatus: "public-source";
  dataState: "context-only";
  eligible: true;
  limitation: string;
  diffQuoteValidation?: DiffQuoteValidationResult;
}

export interface QualitativeNormalizationResult {
  item: QualitativeEvidenceItem | null;
  issues: string[];
}

export interface QualitativeSourceSummary {
  providerId: string;
  inputCount: number;
  eligibleCount: number;
  excludedCount: number;
  state: "available" | "empty" | "excluded";
  limitation: string;
}

const MAX_EXCERPT_LENGTH = 500;
const POSITIVE = ["improve", "growth", "strong", "easing", "decline in risk", "recovery", "expansion", "lower inflation"];
const NEGATIVE = ["crisis", "recession", "weak", "stress", "surge", "collapse", "contraction", "higher inflation"];

function parseDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function validateDiffQuotes(input: DiffQuoteInput | DiffQuoteInput[]): DiffQuoteValidationResult {
  const items = Array.isArray(input) ? input : [input];
  if (items.length === 0) {
    return { valid: true, issues: [], groundedQuotes: [], unverifiedQuotes: [] };
  }

  const issues: string[] = [];
  const groundedQuotes: string[] = [];
  const unverifiedQuotes: string[] = [];

  for (const item of items) {
    const rawQuote = item.quote;
    const rawSource = item.sourceText;

    if (typeof rawQuote !== "string" || !rawQuote.trim()) {
      issues.push("missing-quote");
      unverifiedQuotes.push(rawQuote || "");
      continue;
    }

    if (typeof rawSource !== "string" || !rawSource.trim()) {
      issues.push("empty-source-text");
      unverifiedQuotes.push(rawQuote);
      continue;
    }

    const normQuote = normalizeWhitespace(rawQuote);
    const normSource = normalizeWhitespace(rawSource);

    if (normSource.includes(normQuote)) {
      groundedQuotes.push(rawQuote);
    } else {
      issues.push("quote-not-found-in-source");
      unverifiedQuotes.push(rawQuote);
    }
  }

  const uniqueIssues = [...new Set(issues)];
  const valid = unverifiedQuotes.length === 0 && uniqueIssues.length === 0;

  return {
    valid,
    issues: uniqueIssues,
    groundedQuotes,
    unverifiedQuotes,
  };
}

export function scoreQualitativeSentiment(headline: string, summary = "") {
  const text = `${headline} ${summary}`.toLowerCase();
  const positive = POSITIVE.filter((term) => text.includes(term)).length;
  const negative = NEGATIVE.filter((term) => text.includes(term)).length;
  return Math.max(-1, Math.min(1, (positive - negative) / Math.max(1, positive + negative)));
}

export function scoreGroundedDiffQuotes(diffQuotes: DiffQuoteInput | DiffQuoteInput[]): {
  sentiment: number;
  validation: DiffQuoteValidationResult;
} {
  const validation = validateDiffQuotes(diffQuotes);
  if (!validation.valid || validation.groundedQuotes.length === 0) {
    return {
      sentiment: 0,
      validation,
    };
  }
  const combined = validation.groundedQuotes.join(" ");
  return {
    sentiment: scoreQualitativeSentiment(combined, ""),
    validation,
  };
}

export function normalizeQualitativeEvidence(input: QualitativeEvidenceInput, cutoff: string): QualitativeNormalizationResult {
  const issues: string[] = [];
  if (!input.providerId?.trim()) issues.push("missing-provider-id");
  if (!input.publisher?.trim()) issues.push("missing-publisher");
  if (!input.headline?.trim()) issues.push("missing-headline");
  let url: URL | null = null;
  try { url = new URL(input.url); } catch { issues.push("invalid-url"); }
  if (url && url.protocol !== "https:") issues.push("url-must-use-https");
  if (!["public-source", "review-required", "manual-review"].includes(input.rightsStatus)) issues.push("invalid-rights-status");
  const published = parseDate(input.publishedAt);
  const retrieved = parseDate(input.retrievedAt);
  const cutoffDate = parseDate(cutoff);
  if (!published) issues.push("invalid-published-at");
  if (!retrieved) issues.push("invalid-retrieved-at");
  if (!cutoffDate) issues.push("invalid-cutoff");
  if (published && retrieved && retrieved < published) issues.push("retrieved-before-published");
  if (published && cutoffDate && published > cutoffDate) issues.push("published-after-cutoff");
  if (input.rightsStatus !== "public-source") issues.push("rights-review-required");

  let diffQuoteValidation: DiffQuoteValidationResult | undefined;
  if (input.diffQuotes && input.diffQuotes.length > 0) {
    const diffResult = validateDiffQuotes(input.diffQuotes);
    if (!diffResult.valid) {
      issues.push(...diffResult.issues);
    } else {
      diffQuoteValidation = diffResult;
    }
  }

  if (issues.length) return { item: null, issues: [...new Set(issues)] };
  const excerpt = `${input.summary ?? ""}`.trim().slice(0, MAX_EXCERPT_LENGTH);
  const base = {
    providerId: input.providerId.trim(),
    publisher: input.publisher.trim(),
    url: url!.toString(),
    headline: input.headline.trim(),
    excerpt,
    publishedAt: published!.toISOString(),
    retrievedAt: retrieved!.toISOString(),
    topic: input.topic?.trim() || null,
    sentiment: scoreQualitativeSentiment(input.headline, excerpt),
    rightsStatus: "public-source" as const,
    dataState: "context-only" as const,
    ...(diffQuoteValidation ? { diffQuoteValidation } : {}),
  };
  return {
    item: {
      ...base,
      id: deterministicFingerprint(base),
      eligible: true,
      limitation: "Qualitative context is descriptive and source-bounded; statement quotes must be grounded against official publication text; it is not an actual observation, forecast, causal claim or trading signal.",
    },
    issues: [],
  };
}

export function buildQualitativeContext(inputs: QualitativeEvidenceInput[], cutoff: string, declaredProviderIds: string[] = []) {
  const normalized = inputs.map((input) => normalizeQualitativeEvidence(input, cutoff));
  const items = normalized.flatMap((result) => result.item ? [result.item] : []).sort((a, b) => a.publishedAt.localeCompare(b.publishedAt) || a.id.localeCompare(b.id));
  const excluded = normalized.filter((result) => !result.item).flatMap((result) => result.issues);
  const sourceIds = [...new Set([...inputs.map((input) => input.providerId.trim()), ...declaredProviderIds.map((providerId) => providerId.trim())].filter(Boolean))].sort();
  const sourceSummaries = sourceIds.map((providerId): QualitativeSourceSummary => {
    const indexes = inputs.flatMap((input, index) => input.providerId.trim() === providerId ? [index] : []);
    const eligibleCount = indexes.filter((index) => Boolean(normalized[index]?.item)).length;
    const excludedCount = indexes.length - eligibleCount;
    return {
      providerId,
      inputCount: indexes.length,
      eligibleCount,
      excludedCount,
      state: eligibleCount ? "available" : excludedCount ? "excluded" : "empty",
      limitation: eligibleCount ? "At least one source item passed the rights and publication-cutoff contract." : excludedCount ? "All supplied items were excluded by the qualitative evidence contract." : "The source was supplied without records.",
    };
  });
  const content = { cutoff, items, excludedCount: normalized.length - items.length, sourceSummaries };
  return {
    ...content,
    evidence: items.length ? "context-only" as const : "none" as const,
    fingerprint: deterministicFingerprint(content),
    limitations: [
      "Publication time controls eligibility; retrieval time is retained for audit.",
      "Qualitative sentiment is descriptive context and must not be treated as quantitative macro data.",
      "Statement quotes must be grounded against official publication text.",
      ...(excluded.length ? [`${excluded.length} qualitative item validation issue(s) excluded from context.`] : []),
    ],
  };
}
