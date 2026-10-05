export interface ModelObservation {
  date: string;
  value: number;
  status: string;
  quality: string;
  freshness?: string;
}

export interface InternalModelReport {
  modelId: "naive-persistence-v1";
  methodology: string;
  status: "ready" | "unavailable";
  eligibleObservationCount: number;
  currentEvidence: boolean;
  freshness: string;
  asOfPeriod: string | null;
  targetPeriod: string | null;
  forecastValue: number | null;
  backtest: { sampleSize: number; mae: number | null; mape: number | null };
  limitation: string;
}

const MINIMUM_OBSERVATIONS = 8;

function nextPeriod(period: string, frequency: string | undefined) {
  const date = new Date(`${period}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  const normalized = frequency?.toLowerCase() ?? "monthly";
  if (normalized.includes("quarter")) date.setUTCMonth(date.getUTCMonth() + 3);
  else if (normalized.includes("annual") || normalized.includes("year")) date.setUTCFullYear(date.getUTCFullYear() + 1);
  else if (normalized.includes("week")) date.setUTCDate(date.getUTCDate() + 7);
  else if (normalized.includes("day")) date.setUTCDate(date.getUTCDate() + 1);
  else date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}

export function evaluateNaivePersistence(
  observations: ModelObservation[],
  frequency?: string,
  options: { operationSupported?: boolean } = {},
): InternalModelReport {
  const eligible = observations
    .filter((row) => row.status === "actual" && row.quality === "verified" && Number.isFinite(row.value))
    .sort((left, right) => left.date.localeCompare(right.date));
  const backtestErrors = eligible.slice(MINIMUM_OBSERVATIONS - 1).map((actual, index) => {
    const prediction = eligible[index + MINIMUM_OBSERVATIONS - 2].value;
    return { absolute: Math.abs(actual.value - prediction), percentage: actual.value === 0 ? null : Math.abs((actual.value - prediction) / actual.value) * 100 };
  });
  const mae = backtestErrors.length
    ? backtestErrors.reduce((sum, row) => sum + row.absolute, 0) / backtestErrors.length
    : null;
  const percentageErrors = backtestErrors.filter((row): row is { absolute: number; percentage: number } => row.percentage !== null);
  const mape = percentageErrors.length
    ? percentageErrors.reduce((sum, row) => sum + row.percentage, 0) / percentageErrors.length
    : null;
  const last = eligible.at(-1);
  const freshness = last?.freshness ?? "fresh";
  const operationSupported = options.operationSupported !== false;
  const currentEvidence = freshness === "fresh" && operationSupported;
  const ready = eligible.length >= MINIMUM_OBSERVATIONS && Boolean(last) && currentEvidence;
  return {
    modelId: "naive-persistence-v1",
    methodology: "Last eligible actual/verified observation carried forward one release period.",
    status: ready ? "ready" : "unavailable",
    eligibleObservationCount: eligible.length,
    currentEvidence,
    freshness,
    asOfPeriod: last?.date ?? null,
    targetPeriod: ready && last ? nextPeriod(last.date, frequency) : null,
    forecastValue: ready ? last!.value : null,
    backtest: { sampleSize: backtestErrors.length, mae, mape },
    limitation: ready
      ? "Baseline benchmark only; release revisions, transformations and regime changes can make persistence inaccurate."
      : !operationSupported
      ? "The provider does not declare the governed evidence operation; historical backtest rows remain inspectable, but no current internal estimate is produced."
      : !currentEvidence
      ? `The latest eligible observation is ${freshness}; historical backtest rows remain inspectable, but no current internal estimate is produced.`
      : `At least ${MINIMUM_OBSERVATIONS} actual and verified observations are required; no internal estimate is produced.`,
  };
}
