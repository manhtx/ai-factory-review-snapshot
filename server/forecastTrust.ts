export function hasCompleteForecastEvidence(record: { methodology?: unknown; confidence?: unknown; sourceUrl?: unknown }): boolean {
  return Boolean(record.methodology && record.confidence !== undefined && record.sourceUrl);
}

export type ForecastEvaluationStatus = "available" | "pending" | "unverified_data_unavailable";

export interface ForecastAccuracyMetrics {
  mae: number | null;
  rmse: number | null;
  count: number;
  pendingCount: number;
  status: "computed" | "pending" | "insufficient_data";
}

/**
 * Retrospective accuracy evaluation strictly against verified historical releases.
 * Mean Absolute Error (MAE): (1/n) * sum(|F_i - A_i|)
 * Root Mean Squared Error (RMSE): sqrt((1/n) * sum((F_i - A_i)^2))
 */
export function calculateForecastAccuracyMetrics(
  records: Array<{
    forecastValue: number;
    actualValue?: number | null;
    accuracyState?: string;
  }>
): ForecastAccuracyMetrics {
  if (!records || records.length === 0) {
    return {
      mae: null,
      rmse: null,
      count: 0,
      pendingCount: 0,
      status: "insufficient_data",
    };
  }

  const validEvaluated = records.filter(
    (r) =>
      r.accuracyState === "available" &&
      r.actualValue !== null &&
      r.actualValue !== undefined &&
      Number.isFinite(r.actualValue) &&
      Number.isFinite(r.forecastValue)
  );

  const pendingCount = records.length - validEvaluated.length;

  if (validEvaluated.length === 0) {
    return {
      mae: null,
      rmse: null,
      count: 0,
      pendingCount,
      status: "pending",
    };
  }

  const absErrors = validEvaluated.map((r) =>
    Math.abs(r.forecastValue - (r.actualValue as number))
  );
  const sqErrors = validEvaluated.map((r) =>
    Math.pow(r.forecastValue - (r.actualValue as number), 2)
  );

  const sumAbs = absErrors.reduce((acc, val) => acc + val, 0);
  const sumSq = sqErrors.reduce((acc, val) => acc + val, 0);

  const n = validEvaluated.length;
  const mae = Math.round((sumAbs / n) * 10000) / 10000;
  const rmse = Math.round(Math.sqrt(sumSq / n) * 10000) / 10000;

  return {
    mae,
    rmse,
    count: n,
    pendingCount,
    status: "computed",
  };
}
