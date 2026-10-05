import type { CountryCoverageRecord } from "./countryCoverage.js";
import { deterministicFingerprint } from "../src/app/data/deterministicFingerprint.js";

export type MvpReadinessReport = {
  evidence: "catalog-and-snapshot";
  target: {
    countryCount: number;
    indicatorRange: { min: number; max: number };
  };
  observed: {
    countryCount: number;
    registeredIndicatorCount: number;
    historicalHydratedCount: number;
    currentEligibleCount: number;
  };
  countryStates: {
    hydrated: number;
    registeredOnly: number;
    uncovered: number;
  };
  dimensions: {
    scope: ReadinessDimension;
    historicalEvidence: ReadinessDimension;
    currentEvidence: ReadinessDimension;
  };
  priorityGaps: Array<{
    country: string;
    indicatorId: string;
    priority: "core" | "supporting" | "discovery";
    priorityScore: number;
    priorityReason: string;
  }>;
  state: "partial" | "on-track" | "unavailable";
  nextActions: string[];
  limitations: string[];
};

export type ReadinessDimension = {
  status: "pass" | "attention" | "unavailable";
  observed: number;
  target: number;
  detail: string;
};

export type MvpReadinessArtifact = {
  schema: "macro-os.mvp-readiness";
  version: 1;
  exportedAt: string;
  fingerprint: string;
  boundary: "bounded-catalog-and-snapshot-planning-artifact";
  report: MvpReadinessReport;
  countries: CountryCoverageRecord[];
  limitations: string[];
};

export function mvpReadinessFingerprint(
  countries: CountryCoverageRecord[],
  report: MvpReadinessReport,
): string {
  return deterministicFingerprint({ countries, report });
}

export function buildMvpReadinessArtifact(
  countries: CountryCoverageRecord[],
  report: MvpReadinessReport,
  exportedAt = new Date().toISOString(),
): MvpReadinessArtifact {
  const fingerprint = mvpReadinessFingerprint(countries, report);
  return {
    schema: "macro-os.mvp-readiness",
    version: 1,
    exportedAt,
    fingerprint,
    boundary: "bounded-catalog-and-snapshot-planning-artifact",
    report: {
      ...report,
      target: {
        ...report.target,
        indicatorRange: { ...report.target.indicatorRange },
      },
      observed: { ...report.observed },
      countryStates: { ...report.countryStates },
      dimensions: {
        scope: { ...report.dimensions.scope },
        historicalEvidence: { ...report.dimensions.historicalEvidence },
        currentEvidence: { ...report.dimensions.currentEvidence },
      },
      priorityGaps: report.priorityGaps.map((gap) => ({ ...gap })),
      nextActions: [...report.nextActions],
      limitations: [...report.limitations],
    },
    countries: countries.map((country) => ({
      ...country,
      registeredIndicatorIds: [...country.registeredIndicatorIds],
      hydratedIndicatorIds: [...country.hydratedIndicatorIds],
      currentHydratedIndicatorIds: [...country.currentHydratedIndicatorIds],
      missingIndicatorIds: [...country.missingIndicatorIds],
      missingIndicatorPlan: country.missingIndicatorPlan.map((gap) => ({
        ...gap,
      })),
    })),
    limitations: [
      "This is a catalog-and-snapshot readiness projection, not proof of production readiness.",
      "Credentials and raw provider payloads are excluded.",
      ...new Set(report.limitations),
    ],
  };
}

export function buildMvpReadinessReport(
  countries: CountryCoverageRecord[],
  target = { countryCount: 9, indicatorMin: 80, indicatorMax: 120 },
): MvpReadinessReport {
  const registeredIndicatorCount = countries.reduce(
    (sum, country) => sum + country.registeredCount,
    0,
  );
  const historicalHydratedCount = countries.reduce(
    (sum, country) => sum + country.hydratedCount,
    0,
  );
  const currentEligibleCount = countries.reduce(
    (sum, country) => sum + country.currentHydratedCount,
    0,
  );
  const countryStates = countries.reduce(
    (result, country) => {
      if (country.state === "hydrated") result.hydrated += 1;
      else if (country.state === "registered-only") result.registeredOnly += 1;
      else result.uncovered += 1;
      return result;
    },
    { hydrated: 0, registeredOnly: 0, uncovered: 0 },
  );
  const nextActions: string[] = [];
  const priorityGaps = countries
    .flatMap((country) =>
      country.missingIndicatorPlan.map((gap) => ({
        country: country.country,
        ...gap,
      })),
    )
    .sort(
      (a, b) =>
        b.priorityScore - a.priorityScore ||
        a.country.localeCompare(b.country) ||
        a.indicatorId.localeCompare(b.indicatorId),
    )
    .slice(0, 12);
  if (countries.length < target.countryCount)
    nextActions.push(
      `Register coverage contracts for ${target.countryCount - countries.length} remaining MVP country scope(s).`,
    );
  if (registeredIndicatorCount < target.indicatorMin)
    nextActions.push(
      `Expand the registered catalog by at least ${target.indicatorMin - registeredIndicatorCount} indicator(s) to reach the MVP lower bound.`,
    );
  if (countryStates.registeredOnly + countryStates.uncovered > 0)
    nextActions.push(
      "Hydrate and validate source-backed observations for countries without historical evidence.",
    );
  if (currentEligibleCount < historicalHydratedCount)
    nextActions.push(
      "Resolve freshness or current-eligibility gaps; historical hydration is not current evidence.",
    );
  const scopePass =
    countries.length >= target.countryCount &&
    registeredIndicatorCount >= target.indicatorMin;
  const historicalEvidencePass =
    registeredIndicatorCount > 0 &&
    historicalHydratedCount === registeredIndicatorCount &&
    countryStates.registeredOnly === 0 &&
    countryStates.uncovered === 0;
  const currentEvidencePass =
    registeredIndicatorCount > 0 &&
    currentEligibleCount === registeredIndicatorCount;
  const dimensions: MvpReadinessReport["dimensions"] = {
    scope: {
      status: countries.length === 0 ? "unavailable" : scopePass ? "pass" : "attention",
      observed: registeredIndicatorCount,
      target: target.indicatorMin,
      detail: `${countries.length}/${target.countryCount} country scopes and ${registeredIndicatorCount}/${target.indicatorMin} minimum registered indicators.`,
    },
    historicalEvidence: {
      status: countries.length === 0 ? "unavailable" : historicalEvidencePass ? "pass" : "attention",
      observed: historicalHydratedCount,
      target: registeredIndicatorCount,
      detail: `${historicalHydratedCount}/${registeredIndicatorCount} registered country-scoped indicators have actual, verified, source-backed historical evidence.`,
    },
    currentEvidence: {
      status: countries.length === 0 ? "unavailable" : currentEvidencePass ? "pass" : "attention",
      observed: currentEligibleCount,
      target: registeredIndicatorCount,
      detail: `${currentEligibleCount}/${registeredIndicatorCount} registered country-scoped indicators also pass the cadence-aware freshness gate.`,
    },
  };
  return {
    evidence: "catalog-and-snapshot",
    target: {
      countryCount: target.countryCount,
      indicatorRange: { min: target.indicatorMin, max: target.indicatorMax },
    },
    observed: {
      countryCount: countries.length,
      registeredIndicatorCount,
      historicalHydratedCount,
      currentEligibleCount,
    },
    countryStates,
    dimensions,
    priorityGaps,
    state:
      countries.length === 0
        ? "unavailable"
        : scopePass && historicalEvidencePass && currentEvidencePass
          ? "on-track"
          : "partial",
    nextActions: nextActions.length
      ? nextActions
      : [
          "Continue monitoring freshness, rights and independent redundancy before claiming MVP readiness.",
        ],
    limitations: [
      "This is a catalog-and-snapshot readiness projection, not proof of full MVP delivery.",
      "Counts can include multiple country-specific indicators and do not establish rights, semantic validity, independent redundancy or provider continuity.",
      "Current-eligible counts require actual, verified, source-backed and fresh observations; historical hydration is not current evidence.",
      "Production runtime, durability, rights and redundancy are separate gates and are not evaluated by this readiness state.",
    ],
  };
}
