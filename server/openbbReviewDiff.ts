import type { OpenBBComparisonReviewArtifact } from "./openbbComparisonArtifact.js";
import { deterministicFingerprint } from "../src/app/data/deterministicFingerprint.js";

type ReviewComparison = OpenBBComparisonReviewArtifact["comparison"];

export type OpenBBReviewDiffArtifact = {
  schema: "macro-os.openbb-review-diff";
  version: 1;
  exportedAt: string;
  fingerprint: string;
  boundary: "bounded-persisted-staging-review-diff";
  runIds: { older: string; newer: string };
  diff: ReturnType<typeof buildOpenBBReviewDiff>;
  limitations: string[];
};

export function buildOpenBBReviewDiff(
  olderInput: ReviewComparison,
  newerInput: ReviewComparison,
  olderExportedAt: string,
  newerExportedAt: string,
) {
  let older = { comparison: olderInput, exportedAt: olderExportedAt };
  let newer = { comparison: newerInput, exportedAt: newerExportedAt };
  const left = Date.parse(older.exportedAt);
  const right = Date.parse(newer.exportedAt);
  if (
    Number.isNaN(left) || Number.isNaN(right)
      ? older.exportedAt.localeCompare(newer.exportedAt) > 0
      : left > right
  )
    [older, newer] = [newer, older];
  const delta = (before: number | null, after: number | null) =>
    before == null || after == null ? null : after - before;
  return {
    olderExportedAt: older.exportedAt,
    newerExportedAt: newer.exportedAt,
    indicatorId: older.comparison.indicatorId,
    decision: {
      before: older.comparison.reviewDecision.status,
      after: newer.comparison.reviewDecision.status,
      changed:
        older.comparison.reviewDecision.status !==
        newer.comparison.reviewDecision.status,
    },
    freshness: {
      before: older.comparison.comparisonAudit.freshness.status,
      after: newer.comparison.comparisonAudit.freshness.status,
      changed:
        older.comparison.comparisonAudit.freshness.status !==
        newer.comparison.comparisonAudit.freshness.status,
    },
    overlap: {
      before: older.comparison.overlap.count,
      after: newer.comparison.overlap.count,
      delta: delta(
        older.comparison.overlap.count,
        newer.comparison.overlap.count,
      ),
    },
    revisions: {
      before: older.comparison.revisions.revisedPeriodCount,
      after: newer.comparison.revisions.revisedPeriodCount,
      delta: delta(
        older.comparison.revisions.revisedPeriodCount,
        newer.comparison.revisions.revisedPeriodCount,
      ),
    },
    discrepancyMeanAbsoluteDifference: {
      before: older.comparison.discrepancySummary.meanAbsoluteDifference,
      after: newer.comparison.discrepancySummary.meanAbsoluteDifference,
      delta: delta(
        older.comparison.discrepancySummary.meanAbsoluteDifference,
        newer.comparison.discrepancySummary.meanAbsoluteDifference,
      ),
    },
    rights: {
      before: older.comparison.comparisonAudit.rights.classification,
      after: newer.comparison.comparisonAudit.rights.classification,
      changed:
        older.comparison.comparisonAudit.rights.classification !==
        newer.comparison.comparisonAudit.rights.classification,
    },
    latencyMs: {
      before: older.comparison.comparisonAudit.operationalCost.latencyMs,
      after: newer.comparison.comparisonAudit.operationalCost.latencyMs,
      delta: delta(
        older.comparison.comparisonAudit.operationalCost.latencyMs,
        newer.comparison.comparisonAudit.operationalCost.latencyMs,
      ),
    },
    limitations: [
      "This is a descriptive diff of two bounded staging artifacts; it does not identify the correct provider or establish causality.",
      "Null deltas mean one side did not provide a comparable measurement.",
    ],
  };
}

export function buildOpenBBReviewDiffArtifact(
  olderRunId: string,
  newerRunId: string,
  diff: ReturnType<typeof buildOpenBBReviewDiff>,
  exportedAt = new Date().toISOString(),
): OpenBBReviewDiffArtifact {
  return {
    schema: "macro-os.openbb-review-diff",
    version: 1,
    exportedAt,
    fingerprint: deterministicFingerprint({ runIds: { older: olderRunId, newer: newerRunId }, diff }),
    boundary: "bounded-persisted-staging-review-diff",
    runIds: { older: olderRunId, newer: newerRunId },
    diff,
    limitations: [
      "This artifact contains bounded comparison metrics only; credentials and raw provider payloads are excluded.",
      ...diff.limitations,
    ],
  };
}
