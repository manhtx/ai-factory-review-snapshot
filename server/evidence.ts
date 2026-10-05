import type { FreshnessStatus } from "./freshness.js";

export type EvidenceAvailability = {
  status: "available" | "delayed" | "outdated" | "unavailable" | "blocked";
  reasonCode: "verified-observations" | "freshness-delay" | "freshness-outdated" | "provider-stale" | "no-ingested-observations" | "provider-failed" | "provider-quarantined" | "manual-source" | "provider-never-run";
  explanation: string;
  nextAction: string;
};

export function isSourceBackedVerifiedObservation(row: { status?: unknown; quality?: unknown; sourceName?: unknown; sourceSeriesId?: unknown }): boolean {
  return row.status === "actual" && row.quality === "verified" && typeof row.sourceName === "string" && row.sourceName.trim().length > 0 && typeof row.sourceSeriesId === "string" && row.sourceSeriesId.trim().length > 0;
}

export function explainEvidenceAvailability(input: { observationCount: number; eligibleObservationCount: number; freshness: FreshnessStatus; providerType?: string | null; providerStatus?: string | null }): EvidenceAvailability {
  if (input.providerType === "manual" && input.observationCount === 0) return { status: "blocked", reasonCode: "manual-source", explanation: "This indicator is registered as a manual or unlicensed source; no automated observations are published.", nextAction: "Connect a reviewed source adapter or provide a reviewed manual import." };
  if (input.providerStatus === "quarantined") return { status: "blocked", reasonCode: "provider-quarantined", explanation: "The latest provider run was quarantined, so its observations are not eligible for research evidence.", nextAction: "Inspect the ingestion run and resolve the validation or provenance reason before retrying." };
  if (input.providerStatus === "failed") return { status: "unavailable", reasonCode: "provider-failed", explanation: "The latest provider ingestion failed; no new evidence is being asserted from that attempt.", nextAction: "Inspect the provider error and rerun only after the source contract or dependency is healthy." };
  if (input.observationCount === 0) return { status: "unavailable", reasonCode: input.providerStatus === "never-run" ? "provider-never-run" : "no-ingested-observations", explanation: input.providerStatus === "never-run" ? "The indicator has no recorded ingestion run and therefore has no published observations." : "The indicator has no published observations in the current storage path.", nextAction: "Run a reviewed ingestion job or connect the required durable source path." };
  if (input.providerStatus === "stale") return { status: "outdated", reasonCode: "provider-stale", explanation: "Observations exist, but the latest recorded provider run is outside its freshness threshold.", nextAction: "Review the provider cadence and ingestion telemetry before treating the series as current." };
  if (input.freshness === "outdated") return { status: "outdated", reasonCode: "freshness-outdated", explanation: "Observations exist, but the latest period is outside the configured freshness tolerance.", nextAction: "Review the source release cadence and run ingestion when a newer source vintage is available." };
  if (input.freshness === "delayed") return { status: "delayed", reasonCode: "freshness-delay", explanation: "Verified observations exist, but the latest period is later than the expected release window.", nextAction: "Check provider release timing and ingestion health before treating the value as current." };
  if (input.eligibleObservationCount === 0) return { status: "blocked", reasonCode: "no-ingested-observations", explanation: "Observations exist, but none meet the actual, verified evidence gate.", nextAction: "Inspect status, quality, provenance and quarantine records before using this series in research." };
  return { status: "available", reasonCode: "verified-observations", explanation: "At least one actual, verified, source-backed observation is available for research.", nextAction: "Inspect the observation vintage and source metadata before making an inference." };
}
