export type FallbackReviewDecision = "approved" | "rejected";
export type FallbackReviewInput = {
  indicatorId: string;
  primaryIndicatorId: string;
  fallbackIndicatorId: string;
  decision: FallbackReviewDecision;
  reviewer: string;
  rationale: string;
  evidence: Array<{ kind: string; reference: string }>;
};

export function validateFallbackReviewInput(input: unknown): string[] {
  const value = input as Partial<FallbackReviewInput> | null;
  if (!value || typeof value !== "object") return ["review must be an object"];
  const issues: string[] = [];
  for (const field of ["indicatorId", "primaryIndicatorId", "fallbackIndicatorId", "reviewer", "rationale"] as const) {
    if (typeof value[field] !== "string" || !value[field]?.trim()) issues.push(`${field} is required`);
  }
  if (!["approved", "rejected"].includes(String(value.decision))) issues.push("decision must be approved or rejected");
  if (!Array.isArray(value.evidence) || value.evidence.some((item) => !item || typeof item.kind !== "string" || typeof item.reference !== "string")) issues.push("evidence must be an array of kind/reference objects");
  return issues;
}

export function buildFallbackReviewRun(input: FallbackReviewInput) {
  return {
    id: randomUUID(),
    title: `Provider fallback review: ${input.indicatorId}`,
    question: `Should ${input.fallbackIndicatorId} be retained as a reviewed fallback candidate for ${input.indicatorId}?`,
    indicatorIds: [input.indicatorId, input.primaryIndicatorId, input.fallbackIndicatorId],
    sourceVintages: [],
    dateRange: { start: null, end: null },
    transformations: [],
    calculation: { method: "provider-fallback-review", version: "1" },
    output: { schema: "macro-os.provider-fallback-review", version: 1, ...input, automaticFallback: false },
    evidence: input.evidence.map((item) => ({ indicatorId: input.indicatorId, sourceUrl: item.reference, periods: [] })),
    limitations: ["This is a persisted human review record; it does not switch providers, copy observations or authorize automatic fallback.", "Review remains bounded by the evidence references supplied by the reviewer."],
  };
}
import { randomUUID } from "node:crypto";
