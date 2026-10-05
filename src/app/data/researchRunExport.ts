import { ResearchRunRecord } from "../services/platformApi.js";
import { deterministicFingerprint } from "./deterministicFingerprint.js";

export interface ResearchRunExportArtifact {
  schema: "macro-os.research-run";
  version: 1;
  exportedAt: string;
  fingerprint: string;
  run: ResearchRunRecord;
  boundary: "persisted-research-artifact";
  limitations: string[];
}

export function createResearchRunExportArtifact(run: ResearchRunRecord, exportedAt = new Date().toISOString()): ResearchRunExportArtifact {
  const boundedRun = { ...run, indicatorIds: [...run.indicatorIds], sourceVintages: run.sourceVintages.map((vintage) => ({ ...vintage })), transformations: [...run.transformations], evidence: run.evidence.map((item) => ({ ...item })), limitations: [...run.limitations] };
  const limitations = [
    "This export contains persisted run metadata, evidence links, calculations and limitations; it does not include provider credentials or raw provider payloads.",
    "Re-run freshness, rights and source availability must be checked before using the artifact for new research.",
  ];
  const boundary = "persisted-research-artifact" as const;
  return {
    schema: "macro-os.research-run",
    version: 1,
    exportedAt,
    fingerprint: deterministicFingerprint({ run: boundedRun, boundary, limitations }),
    run: boundedRun,
    boundary,
    limitations,
  };
}
