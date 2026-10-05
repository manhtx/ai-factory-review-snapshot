import { Router } from "express";
import { DATA_SOURCES } from "../../src/app/config/dataSources.js";
import {
  PROVIDER_REGISTRY,
} from "../../src/app/config/providerRegistry.js";
import {
  buildProviderOperationAvailability,
  buildProviderContractAudit,
  buildProviderRightsAudit,
  buildProviderRightsReviewPackage,
  PROVIDER_MANIFEST_VERSION,
  type ProviderOperation,
} from "../providerContract.js";
import { buildSourceMappingReport, SOURCE_MAPPINGS } from "../sourceMapping.js";
import { buildProviderRedundancyReport } from "../providerRedundancy.js";
import { buildFallbackReadiness } from "../fallbackReadiness.js";

export const providerRouter = Router();

const PROVIDER_OPERATIONS: readonly ProviderOperation[] = [
  "catalog",
  "historical",
  "realtime",
  "revisions",
  "ingest",
  "evidence",
] as const;

providerRouter.get("/api/providers", (_request, response) => {
  response.json({
    manifestVersion: PROVIDER_MANIFEST_VERSION,
    providers: PROVIDER_REGISTRY,
    generatedAt: new Date().toISOString(),
    evidence: "configuration",
    note: "Capability metadata is configuration-derived; it does not prove live health, rights approval or realtime availability.",
  });
});

providerRouter.get("/api/providers/:providerId/operations/:operation", (request, response) => {
  const operation = request.params.operation as ProviderOperation;
  if (!PROVIDER_OPERATIONS.includes(operation)) {
    return response.status(400).json({
      error: "Unknown provider operation",
      operation,
      supportedOperations: PROVIDER_OPERATIONS,
    });
  }
  const provider = PROVIDER_REGISTRY.find((item) => item.providerId === request.params.providerId);
  if (!provider) {
    return response.status(404).json({
      error: "Provider not found",
      providerId: request.params.providerId,
    });
  }
  return response.json(buildProviderOperationAvailability(provider, operation));
});

providerRouter.get("/api/mcp/tools/check_provider_operation", (request, response) => {
  const operation = String(request.query.operation ?? "") as ProviderOperation;
  if (!PROVIDER_OPERATIONS.includes(operation)) {
    return response.status(400).json({
      error: "Unknown provider operation",
      operation,
      supportedOperations: PROVIDER_OPERATIONS,
    });
  }
  const provider = PROVIDER_REGISTRY.find((item) => item.providerId === String(request.query.providerId ?? ""));
  if (!provider) {
    return response.status(404).json({
      error: "Provider not found",
      providerId: String(request.query.providerId ?? ""),
    });
  }
  return response.json(buildProviderOperationAvailability(provider, operation));
});

providerRouter.get("/api/provider-contract", (_request, response) => {
  response.json({
    evidence: "configuration",
    audit: buildProviderContractAudit(DATA_SOURCES),
    limitations: [
      "This audit checks catalog completeness only; it does not prove provider reachability, rights or observation quality.",
    ],
  });
});

providerRouter.get("/api/provider-rights", (_request, response) => {
  response.json({
    evidence: "configuration",
    audit: buildProviderRightsAudit(PROVIDER_REGISTRY),
    limitations: [
      "Rights status is a review classification, not a legal determination or redistribution license.",
    ],
  });
});

providerRouter.get("/api/provider-rights/review-package", (_request, response) => {
  response.json(buildProviderRightsReviewPackage(PROVIDER_REGISTRY));
});

providerRouter.get("/api/mcp/tools/get_provider_rights_review_package", (_request, response) => {
  response.json(buildProviderRightsReviewPackage(PROVIDER_REGISTRY));
});

providerRouter.get("/api/provider-rights/:providerId", (request, response) => {
  const provider = buildProviderRightsAudit(PROVIDER_REGISTRY).records.find(
    (record) => record.providerId === request.params.providerId,
  );
  if (!provider) {
    return response.status(404).json({
      error: "Unknown provider",
      providerId: request.params.providerId,
    });
  }
  response.json({
    evidence: "configuration",
    provider,
    limitations: [
      "Rights status is a review classification, not a legal determination or redistribution license.",
      "Source URLs and adapter metadata do not prove contractual permission to redistribute data.",
    ],
  });
});

providerRouter.get("/api/source-mappings", (request, response) => {
  const requestedIndicator =
    typeof request.query.indicatorId === "string"
      ? request.query.indicatorId
      : undefined;
  const indicatorIds = requestedIndicator
    ? [requestedIndicator]
    : Object.keys(DATA_SOURCES);
  response.json({
    mappings: indicatorIds.map((indicatorId) =>
      buildSourceMappingReport(indicatorId),
    ),
    declaredMappingCount: SOURCE_MAPPINGS.length,
    evidence: "configuration",
    note: "No mapping is treated as no fallback. Source URLs or provider names alone do not establish independent redundancy.",
  });
});

providerRouter.get("/api/provider-redundancy", (request, response) => {
  const requestedIndicator =
    typeof request.query.indicatorId === "string"
      ? request.query.indicatorId
      : undefined;
  if (requestedIndicator && !DATA_SOURCES[requestedIndicator]) {
    return response
      .status(404)
      .json({ error: "Unknown indicator", indicatorId: requestedIndicator });
  }
  const report = buildProviderRedundancyReport(
    requestedIndicator ? [requestedIndicator] : undefined,
  );
  response.json(report);
});

providerRouter.get("/api/provider-fallback-readiness", (request, response) => {
  const requestedIndicator =
    typeof request.query.indicatorId === "string"
      ? request.query.indicatorId
      : undefined;
  if (requestedIndicator && !DATA_SOURCES[requestedIndicator]) {
    return response
      .status(404)
      .json({ error: "Unknown indicator", indicatorId: requestedIndicator });
  }
  const redundancy = buildProviderRedundancyReport(
    requestedIndicator ? [requestedIndicator] : undefined,
  );
  response.json(buildFallbackReadiness(redundancy.records));
});
