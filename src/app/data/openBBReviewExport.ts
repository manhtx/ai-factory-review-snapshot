import { OpenBBReviewArtifactRecord, ResearchLineageRecord, ResearchRunRecord } from "../services/platformApi";
import { deterministicFingerprint } from "./deterministicFingerprint.js";

export interface OpenBBReviewPackage {
  schema: "macro-os.openbb-review-package";
  version: 1;
  exportedAt: string;
  fingerprint: string;
  boundary: "bounded-persisted-staging-review";
  run: ResearchRunRecord;
  reviewArtifact: OpenBBReviewArtifactRecord;
  lineage: ResearchLineageRecord;
  limitations: string[];
}

export function createOpenBBReviewPackage(run: ResearchRunRecord, reviewArtifact: OpenBBReviewArtifactRecord, lineage: ResearchLineageRecord, exportedAt = new Date().toISOString()): OpenBBReviewPackage {
  return {
    schema: "macro-os.openbb-review-package",
    version: 1,
    exportedAt,
    fingerprint: deterministicFingerprint({ run, reviewArtifact, lineage }),
    boundary: "bounded-persisted-staging-review",
    run: { ...run, indicatorIds: [...run.indicatorIds], sourceVintages: run.sourceVintages.map((item) => ({ ...item })), dateRange: { ...run.dateRange }, transformations: [...run.transformations], evidence: run.evidence.map((item) => ({ ...item, periods: [...item.periods] })), limitations: [...run.limitations] },
    reviewArtifact: { ...reviewArtifact, comparison: { ...reviewArtifact.comparison, sidecar: { ...reviewArtifact.comparison.sidecar, runtime: reviewArtifact.comparison.sidecar.runtime ? { ...reviewArtifact.comparison.sidecar.runtime } : null }, overlap: { ...reviewArtifact.comparison.overlap }, revisions: { ...reviewArtifact.comparison.revisions }, comparisonAudit: { ...reviewArtifact.comparison.comparisonAudit, semantics: { ...reviewArtifact.comparison.comparisonAudit.semantics }, revisions: { ...reviewArtifact.comparison.comparisonAudit.revisions }, freshness: { ...reviewArtifact.comparison.comparisonAudit.freshness }, rights: { ...reviewArtifact.comparison.comparisonAudit.rights }, operationalCost: { ...reviewArtifact.comparison.comparisonAudit.operationalCost } }, reviewability: { ...reviewArtifact.comparison.reviewability, reasons: [...reviewArtifact.comparison.reviewability.reasons] }, reviewDecision: { ...reviewArtifact.comparison.reviewDecision, reasonCodes: [...reviewArtifact.comparison.reviewDecision.reasonCodes], nextActions: [...reviewArtifact.comparison.reviewDecision.nextActions] }, discrepancySummary: { ...reviewArtifact.comparison.discrepancySummary } }, limitations: [...reviewArtifact.limitations] },
    lineage: { ...lineage, nodes: lineage.nodes.map((node) => ({ ...node })), edges: lineage.edges.map((edge) => ({ ...edge })), limitations: [...lineage.limitations] },
    limitations: ["This package contains bounded persisted review metadata, evidence links and lineage; it excludes credentials and raw provider payloads.", "Re-check freshness, rights and source availability before using this package for new research.", ...new Set([...reviewArtifact.limitations, ...lineage.limitations])],
  };
}
