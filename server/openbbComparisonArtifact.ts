type ComparisonResult = ReturnType<typeof import("./openbbSidecar.js").buildOpenBBSidecarComparison>;

export interface OpenBBComparisonReviewArtifact {
  schema: "macro-os.openbb-comparison-review";
  version: 1;
  exportedAt: string;
  boundary: "staging-only-review-artifact";
  comparison: {
    indicatorId: string;
    sidecar: ComparisonResult["sidecar"];
    macroOs: ComparisonResult["macroOs"];
    overlap: ComparisonResult["overlap"];
    aligned: ComparisonResult["aligned"];
    missingFromSidecar: string[];
    missingFromMacroOs: string[];
    revisions: ComparisonResult["revisions"];
    comparisonAudit: ComparisonResult["comparisonAudit"];
    reviewability: ComparisonResult["reviewability"];
    reviewDecision: ComparisonResult["reviewDecision"];
    discrepancySummary: ComparisonResult["discrepancySummary"];
  };
  limitations: string[];
}

/**
 * Creates a safe, bounded review artifact from an already validated sidecar
 * comparison. It deliberately copies only review fields; credentials and raw
 * provider payloads cannot enter the artifact through this projection.
 */
export function buildOpenBBComparisonReviewArtifact(comparison: ComparisonResult, exportedAt = new Date().toISOString()): OpenBBComparisonReviewArtifact {
  return {
    schema: "macro-os.openbb-comparison-review",
    version: 1,
    exportedAt,
    boundary: "staging-only-review-artifact",
    comparison: {
      indicatorId: comparison.indicatorId,
      sidecar: { ...comparison.sidecar, runtime: comparison.sidecar.runtime ? { ...comparison.sidecar.runtime } : null },
      macroOs: { ...comparison.macroOs },
      overlap: { ...comparison.overlap },
      aligned: comparison.aligned.map((row) => ({ ...row })),
      missingFromSidecar: [...comparison.missingFromSidecar],
      missingFromMacroOs: [...comparison.missingFromMacroOs],
      revisions: { revisedPeriodCount: comparison.revisions.revisedPeriodCount, revisedPeriods: comparison.revisions.revisedPeriods.map((period) => ({ period: period.period, revisions: period.revisions.map((revision) => ({ ...revision })) })) },
      comparisonAudit: { ...comparison.comparisonAudit, semantics: { ...comparison.comparisonAudit.semantics }, revisions: { ...comparison.comparisonAudit.revisions }, freshness: { ...comparison.comparisonAudit.freshness }, rights: { ...comparison.comparisonAudit.rights }, operationalCost: { ...comparison.comparisonAudit.operationalCost }, limitations: [...comparison.comparisonAudit.limitations] },
      reviewability: { ...comparison.reviewability, reasons: [...comparison.reviewability.reasons] },
      reviewDecision: { ...comparison.reviewDecision, reasonCodes: [...comparison.reviewDecision.reasonCodes], nextActions: [...comparison.reviewDecision.nextActions] },
      discrepancySummary: { ...comparison.discrepancySummary },
    },
    limitations: [
      ...comparison.limitations,
      "This artifact is a bounded staging review snapshot; persistence of the artifact does not promote sidecar observations.",
      "Credentials and raw provider payloads are excluded; re-check source availability, rights and freshness before reuse.",
    ],
  };
}
