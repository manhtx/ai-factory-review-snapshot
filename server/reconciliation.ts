export type ReconciliationStatus = "eligible" | "ineligible" | "insufficient-overlap" | "mismatch";

export interface ReconciliationObservation {
  date: string;
  value: number;
}

export interface ReconciliationSeries {
  providerId: string;
  seriesId: string;
  definitionKey: string;
  unit: string;
  frequency: string;
  transformation: string;
  seasonalAdjustment: string;
  observations: ReconciliationObservation[];
}

export interface ReconciliationResult {
  status: ReconciliationStatus;
  reasons: string[];
  comparedPeriods: number;
  missingPeriods: { primary: number; secondary: number };
  maxAbsoluteDifference: number | null;
  maxRelativeDifferencePct: number | null;
  primary: Pick<ReconciliationSeries, "providerId" | "seriesId">;
  secondary: Pick<ReconciliationSeries, "providerId" | "seriesId">;
  suitableForFallback: boolean;
}

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

function compareSemanticField(
  field: string,
  primary: string,
  secondary: string,
  reasons: string[],
) {
  if (normalized(primary) !== normalized(secondary)) {
    reasons.push(`SEMANTIC_MISMATCH:${field}`);
  }
}

export function reconcileSeries(
  primary: ReconciliationSeries,
  secondary: ReconciliationSeries,
  options: { minimumOverlap?: number; maximumRelativeDifferencePct?: number } = {},
): ReconciliationResult {
  const minimumOverlap = options.minimumOverlap ?? 3;
  const maximumRelativeDifferencePct = options.maximumRelativeDifferencePct ?? 1;
  const reasons: string[] = [];

  compareSemanticField("definitionKey", primary.definitionKey, secondary.definitionKey, reasons);
  compareSemanticField("unit", primary.unit, secondary.unit, reasons);
  compareSemanticField("frequency", primary.frequency, secondary.frequency, reasons);
  compareSemanticField("transformation", primary.transformation, secondary.transformation, reasons);
  compareSemanticField("seasonalAdjustment", primary.seasonalAdjustment, secondary.seasonalAdjustment, reasons);

  const primaryByDate = new Map(primary.observations.map((observation) => [observation.date, observation.value]));
  const secondaryByDate = new Map(secondary.observations.map((observation) => [observation.date, observation.value]));
  const sharedDates = [...primaryByDate.keys()].filter((date) => secondaryByDate.has(date)).sort();
  const missingPeriods = {
    primary: [...secondaryByDate.keys()].filter((date) => !primaryByDate.has(date)).length,
    secondary: [...primaryByDate.keys()].filter((date) => !secondaryByDate.has(date)).length,
  };
  const differences = sharedDates.map((date) => {
    const primaryValue = primaryByDate.get(date)!;
    const secondaryValue = secondaryByDate.get(date)!;
    const absolute = Math.abs(primaryValue - secondaryValue);
    const relative = primaryValue === 0 ? (absolute === 0 ? 0 : Infinity) : (absolute / Math.abs(primaryValue)) * 100;
    return { absolute, relative };
  });
  const maxAbsoluteDifference = differences.length ? Math.max(...differences.map((item) => item.absolute)) : null;
  const maxRelativeDifferencePct = differences.length ? Math.max(...differences.map((item) => item.relative)) : null;

  if (reasons.length > 0) {
    return {
      status: "mismatch",
      reasons,
      comparedPeriods: sharedDates.length,
      missingPeriods,
      maxAbsoluteDifference,
      maxRelativeDifferencePct,
      primary: { providerId: primary.providerId, seriesId: primary.seriesId },
      secondary: { providerId: secondary.providerId, seriesId: secondary.seriesId },
      suitableForFallback: false,
    };
  }
  if (sharedDates.length < minimumOverlap) {
    return {
      status: "insufficient-overlap",
      reasons: [`INSUFFICIENT_OVERLAP:${sharedDates.length}<${minimumOverlap}`],
      comparedPeriods: sharedDates.length,
      missingPeriods,
      maxAbsoluteDifference,
      maxRelativeDifferencePct,
      primary: { providerId: primary.providerId, seriesId: primary.seriesId },
      secondary: { providerId: secondary.providerId, seriesId: secondary.seriesId },
      suitableForFallback: false,
    };
  }
  if (maxRelativeDifferencePct !== null && maxRelativeDifferencePct > maximumRelativeDifferencePct) {
    return {
      status: "ineligible",
      reasons: [`VALUE_DIFFERENCE_EXCEEDS_THRESHOLD:${maxRelativeDifferencePct.toFixed(4)}>${maximumRelativeDifferencePct}`],
      comparedPeriods: sharedDates.length,
      missingPeriods,
      maxAbsoluteDifference,
      maxRelativeDifferencePct,
      primary: { providerId: primary.providerId, seriesId: primary.seriesId },
      secondary: { providerId: secondary.providerId, seriesId: secondary.seriesId },
      suitableForFallback: false,
    };
  }
  return {
    status: "eligible",
    reasons: [],
    comparedPeriods: sharedDates.length,
    missingPeriods,
    maxAbsoluteDifference,
    maxRelativeDifferencePct,
    primary: { providerId: primary.providerId, seriesId: primary.seriesId },
    secondary: { providerId: secondary.providerId, seriesId: secondary.seriesId },
    suitableForFallback: true,
  };
}
