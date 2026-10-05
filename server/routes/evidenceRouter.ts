import { Router, type Request, type Response } from "express";
import { DATA_SOURCES } from "../../src/app/config/dataSources.js";
import { db, latestObservations } from "../db.js";
import {
  shouldUseSupabaseStorage,
  supabaseLatestObservations,
  supabaseListIngestionRuns,
} from "../supabase.js";
import { buildManagedStorageErrorResponse } from "../storageErrors.js";
import {
  getIndicatorProviderCapability,
  buildProviderRuntimeHealth,
  PROVIDER_REGISTRY,
} from "../../src/app/config/providerRegistry.js";
import { buildProviderOperationAvailability } from "../providerContract.js";
import {
  isSourceBackedVerifiedObservation,
  explainEvidenceAvailability,
} from "../evidence.js";
import { freshnessStatus } from "../freshness.js";
import { buildChangeReport } from "../changeReport.js";
import { buildSourceMappingReport } from "../sourceMapping.js";
import { buildComparisonReport } from "../comparison.js";

export const evidenceRouter = Router();

export const indicatorEvidenceHandler = async (
  request: Request,
  response: Response,
) => {
  const rawIndicatorId =
    request.params.indicatorId ?? request.query.indicatorId;
  const indicatorId = typeof rawIndicatorId === "string" ? rawIndicatorId : "";
  const source = DATA_SOURCES[indicatorId];
  if (!source) {
    return response
      .status(404)
      .json({ error: "Unknown indicator", indicatorId });
  }

  let observations: Awaited<ReturnType<typeof supabaseLatestObservations>>;
  let runs: Awaited<ReturnType<typeof supabaseListIngestionRuns>>;
  try {
    observations = shouldUseSupabaseStorage()
      ? await supabaseLatestObservations(indicatorId, 300)
      : latestObservations(indicatorId, 300);
    runs = shouldUseSupabaseStorage()
      ? await supabaseListIngestionRuns()
      : db
          .prepare(
            `
          SELECT indicator_id AS indicatorId, status,
                 started_at AS startedAt, completed_at AS completedAt,
                 error_message AS errorMessage
          FROM ingestion_runs ORDER BY id DESC LIMIT 500
        `,
          )
          .all();
  } catch (error) {
    return response.status(503).json(buildManagedStorageErrorResponse(error));
  }
  const provider = getIndicatorProviderCapability(indicatorId);
  const evidenceOperation = provider
    ? buildProviderOperationAvailability(provider, "evidence")
    : null;
  const evidenceOperationSupported =
    evidenceOperation?.status === "configuration-supported";
  const providerHealth =
    buildProviderRuntimeHealth(
      PROVIDER_REGISTRY,
      runs as Array<{
        indicatorId: string;
        status: string;
        startedAt?: string | null;
        completedAt?: string | null;
        errorMessage?: string | null;
      }>,
    ).find((item) => item.providerId === provider?.providerId) ?? null;
  const eligibleObservationCount = observations.filter(
    isSourceBackedVerifiedObservation,
  ).length;
  const latest = observations.at(-1) ?? null;
  const latestObservationEligible = Boolean(
    latest && isSourceBackedVerifiedObservation(latest),
  );
  const freshness = latestObservationEligible
    ? freshnessStatus(String(latest?.date ?? ""), source.frequencyLabel)
    : ("unavailable" as const);
  const currentEligibleObservationCount =
    freshness === "fresh" && evidenceOperationSupported
      ? eligibleObservationCount
      : 0;
  const availability = explainEvidenceAvailability({
    observationCount: observations.length,
    eligibleObservationCount,
    freshness,
    providerType: source.type,
    providerStatus:
      providerHealth?.indicatorStatuses[indicatorId] ?? providerHealth?.status,
  });
  const changes = buildChangeReport(
    observations as Array<{
      date: string;
      value: number;
      vintage?: string | null;
    }>,
  );

  response.json({
    indicator: {
      indicatorId,
      source: source.source,
      agency: source.agency,
      type: source.type,
      seriesId: source.seriesId ?? source.coinId ?? null,
      sourceUrl: source.sourceUrl,
      frequency: source.frequencyLabel,
      unit: source.unit ?? null,
      notes: source.notes ?? null,
    },
    observations,
    latest,
    changes,
    availability: { ...availability, freshness },
    operationAvailability: evidenceOperation,
    provider,
    providerHealth,
    sourceMapping: buildSourceMappingReport(indicatorId),
    researchEligibility: {
      eligibleObservationCount: evidenceOperationSupported
        ? eligibleObservationCount
        : 0,
      currentEligibleObservationCount,
      hasVerifiedActual:
        evidenceOperationSupported && eligibleObservationCount > 0,
      hasCurrentEvidence: currentEligibleObservationCount > 0,
      requiresSourceBackedEvidence: true,
      operation: "evidence",
      operationSupported: evidenceOperationSupported,
    },
    evidence: {
      metadata: "configuration",
      observations: observations.length > 0 ? "ingestion" : "none",
      providerHealth: providerHealth?.evidence ?? "none",
      sourceMapping: "configuration",
    },
    limitations: [
      "This bundle is evidence for research inputs, not an investment recommendation.",
      "Configuration metadata does not prove live availability, licensing or realtime access.",
      ...(evidenceOperation &&
      evidenceOperation.status !== "configuration-supported"
        ? [evidenceOperation.explanation, evidenceOperation.nextAction]
        : []),
      ...(freshness !== "fresh"
        ? [
            "Actual/verified observations remain inspectable, but current evidence is not asserted while freshness is not fresh.",
          ]
        : []),
      ...(observations.length === 0
        ? [
            "No ingested observations are currently available for this indicator.",
          ]
        : []),
    ],
  });
};

export const compareEvidenceHandler = async (
  request: Request,
  response: Response,
) => {
  const parseList = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      return value.map(String);
    }
    if (typeof value === "string") {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
  };

  const indicatorIds = Array.from(
    new Set([
      ...parseList(request.query.indicatorIds),
      ...parseList(request.body?.indicatorIds),
      ...(typeof request.query.baseIndicatorId === "string"
        ? [request.query.baseIndicatorId]
        : []),
      ...(typeof request.query.targetIndicatorId === "string"
        ? [request.query.targetIndicatorId]
        : []),
    ]),
  );

  const unknown = indicatorIds.filter((item) => !DATA_SOURCES[item]);
  if (unknown.length > 0) {
    return response.status(404).json({ error: "Unknown indicators", unknown });
  }

  if (indicatorIds.length < 2) {
    return response.status(400).json({
      error: "At least two indicators are required for evidence comparison",
    });
  }

  const transformation =
    typeof request.query.transformation === "string" &&
    ["level", "change", "pct_change"].includes(request.query.transformation)
      ? (request.query.transformation as "level" | "change" | "pct_change")
      : "level";

  const maxLag =
    typeof request.query.maxLag === "string" &&
    /^\d+$/.test(request.query.maxLag)
      ? Math.min(12, Number(request.query.maxLag))
      : 0;

  let series: Array<readonly [string, unknown[]]>;
  try {
    series = await Promise.all(
      indicatorIds.map(
        async (indicatorId) =>
          [
            indicatorId,
            shouldUseSupabaseStorage()
              ? await supabaseLatestObservations(indicatorId, 10_000)
              : latestObservations(indicatorId, 10_000),
          ] as const,
      ),
    );
  } catch (error) {
    return response.status(503).json(buildManagedStorageErrorResponse(error));
  }
  const eligibleCounts: Record<string, number> = {};
  const currentEligibleCounts: Record<string, number> = {};
  const freshnessByIndicator: Record<string, string> = {};
  const excludedCounts: Record<string, number> = {};
  const operationAvailabilityByIndicator = Object.fromEntries(
    indicatorIds.map((indicatorId) => {
      const provider = getIndicatorProviderCapability(indicatorId);
      return [
        indicatorId,
        provider
          ? buildProviderOperationAvailability(provider, "evidence")
          : buildProviderOperationAvailability(
              { providerId: "unknown", supportedOperations: [] },
              "evidence",
            ),
      ];
    }),
  );
  const eligibleSeries = Object.fromEntries(
    series.map(([indicatorId, rows]) => {
      const typedRows = rows as Array<{
        date: string;
        value: number;
        status?: string;
        quality?: string;
        sourceName?: string;
        sourceSeriesId?: string | null;
      }>;
      const operationSupported =
        operationAvailabilityByIndicator[indicatorId].status ===
        "configuration-supported";
      const eligible = operationSupported
        ? typedRows.filter(isSourceBackedVerifiedObservation)
        : [];
      eligibleCounts[indicatorId] = eligible.length;
      const latest = typedRows.at(-1);
      const freshness =
        latest && isSourceBackedVerifiedObservation(latest)
          ? freshnessStatus(
              latest.date ?? null,
              DATA_SOURCES[indicatorId].frequencyLabel,
            )
          : ("unavailable" as const);
      freshnessByIndicator[indicatorId] = freshness;
      currentEligibleCounts[indicatorId] =
        freshness === "fresh" && operationSupported ? eligible.length : 0;
      excludedCounts[indicatorId] = rows.length - eligible.length;
      return [
        indicatorId,
        eligible.map((row) => ({ date: row.date, value: row.value })),
      ];
    }),
  );
  const report = buildComparisonReport(eligibleSeries, {
    transformation,
    maxLag,
  });
  const limitations = [
    ...report.limitations,
    ...(Object.values(excludedCounts).some((count) => count > 0)
      ? [
          "Some stored rows were excluded because they were not actual, verified and source-backed.",
        ]
      : []),
  ];
  const currentEvidence = indicatorIds.every(
    (indicatorId) => currentEligibleCounts[indicatorId] > 0,
  );
  response.json({
    indicators: indicatorIds.map((indicatorId) => ({
      indicatorId,
      source: DATA_SOURCES[indicatorId].source,
      seriesId:
        DATA_SOURCES[indicatorId].seriesId ??
        DATA_SOURCES[indicatorId].coinId ??
        null,
      sourceUrl: DATA_SOURCES[indicatorId].sourceUrl,
      frequency: DATA_SOURCES[indicatorId].frequencyLabel,
      freshness: freshnessByIndicator[indicatorId],
      operationAvailability: operationAvailabilityByIndicator[indicatorId],
    })),
    report: {
      ...report,
      evidenceState: "actual-verified-source-backed",
      currentEvidenceState: currentEvidence
        ? "current-actual-verified-source-backed"
        : "historical-only-or-current-evidence-unavailable",
      eligibleCounts,
      currentEligibleCounts,
      excludedCounts,
      operationAvailability: operationAvailabilityByIndicator,
    },
    evidence: "ingestion",
    limitations: [
      ...limitations,
      ...(currentEvidence
        ? []
        : [
            "The comparison may contain historical actual/verified observations, but current evidence is not asserted until both latest series are fresh.",
          ]),
      ...(Object.values(operationAvailabilityByIndicator).every(
        (item) => item.status === "configuration-supported",
      )
        ? []
        : [
            "At least one provider does not declare the governed evidence operation; its observations were excluded from comparison.",
          ]),
    ],
  });
};

evidenceRouter.get(
  "/api/evidence/indicator/:indicatorId",
  indicatorEvidenceHandler,
);
evidenceRouter.get(
  "/api/mcp/tools/get_indicator_evidence",
  indicatorEvidenceHandler,
);
evidenceRouter.get("/api/evidence/compare", compareEvidenceHandler);
evidenceRouter.get(
  "/api/mcp/tools/get_relationship_evidence",
  compareEvidenceHandler,
);
