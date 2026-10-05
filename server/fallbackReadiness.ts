import type { ProviderRedundancyRecord } from "./providerRedundancy.js";

export type FallbackEvidence = {
  providerId: string;
  rightsStatus: string;
  runtimeStatus: string;
  freshness: string;
};

export type FallbackReadinessRecord = {
  indicatorId: string;
  state: "no-mapping" | "reconciliation-pending" | "blocked" | "reviewable" | "insufficient-evidence";
  primary: FallbackEvidence | null;
  fallback: FallbackEvidence | null;
  reasonCodes: string[];
  nextActions: string[];
  ownerApproval: "not-recorded" | "approved" | "rejected";
};

export function buildFallbackReadiness(
  redundancy: ProviderRedundancyRecord[],
  evidenceByIndicator: Record<string, FallbackEvidence> = {},
  ownerApprovalByIndicator: Record<string, "approved" | "rejected"> = {},
) {
  const records: FallbackReadinessRecord[] = redundancy.map((record) => {
    if (record.state === "no-mapping") return {
      indicatorId: record.indicatorId, state: "no-mapping", primary: null, fallback: null,
      reasonCodes: ["NO_INDEPENDENT_MAPPING"], nextActions: ["Declare and rights-review an independent secondary source before fallback review."], ownerApproval: "not-recorded",
    };
    if (record.state === "mapped-unreconciled") return {
      indicatorId: record.indicatorId, state: "reconciliation-pending", primary: null, fallback: null,
      reasonCodes: ["MAPPING_NOT_RECONCILED"], nextActions: ["Run bounded semantic reconciliation for both series."], ownerApproval: "not-recorded",
    };
    if (record.state === "reconciled-blocked") return {
      indicatorId: record.indicatorId, state: "blocked", primary: null, fallback: null,
      reasonCodes: ["RECONCILIATION_NOT_SUITABLE"], nextActions: ["Resolve semantic/overlap discrepancies before operational review."], ownerApproval: "not-recorded",
    };
    const mapping = record.mapping!;
    const primary = evidenceByIndicator[mapping.primaryIndicatorId] ?? null;
    const fallback = evidenceByIndicator[mapping.secondaryIndicatorId] ?? null;
    const reasons: string[] = [];
    if (!primary || !fallback) reasons.push("RUNTIME_EVIDENCE_MISSING");
    for (const item of [primary, fallback]) {
      if (item && item.rightsStatus !== "public-source") reasons.push("RIGHTS_REVIEW_REQUIRED");
      if (item && item.runtimeStatus !== "succeeded") reasons.push("PROVIDER_RUNTIME_NOT_HEALTHY");
      if (item && item.freshness !== "fresh") reasons.push("PROVIDER_FRESHNESS_NOT_CURRENT");
    }
    const uniqueReasons = [...new Set(reasons)];
    return {
      indicatorId: record.indicatorId,
      state: uniqueReasons.length ? "insufficient-evidence" : "reviewable",
      primary,
      fallback,
      reasonCodes: uniqueReasons.length ? uniqueReasons : ["ALL_PRECHECKS_PASSED_REVIEW_ONLY"],
      nextActions: uniqueReasons.length
        ? ["Resolve every listed evidence gate; automatic fallback remains disabled."]
        : ["Obtain owner approval and complete the production failover review; do not publish automatically."],
      ownerApproval: ownerApprovalByIndicator[record.indicatorId] ?? "not-recorded",
    };
  });
  return {
    records,
    counts: {
      "no-mapping": records.filter((record) => record.state === "no-mapping").length,
      "reconciliation-pending": records.filter((record) => record.state === "reconciliation-pending").length,
      blocked: records.filter((record) => record.state === "blocked").length,
      reviewable: records.filter((record) => record.state === "reviewable").length,
      "insufficient-evidence": records.filter((record) => record.state === "insufficient-evidence").length,
    },
    automaticFallback: false as const,
    evidence: "redundancy-rights-runtime-freshness" as const,
    limitations: ["Reviewable means prechecks pass only; it does not authorize automatic fallback or observation promotion.", "Missing runtime evidence is reported explicitly and never treated as healthy."],
  };
}
