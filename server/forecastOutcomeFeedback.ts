import { listForecasts, latestObservations, recordResearchMemory } from "./db.js";
import { evaluateForecastBatch, type EvaluationForecast, type EvaluationObservation } from "./batchForecastEvaluation.js";
import { shouldUseSupabaseStorage, supabaseLatestObservations, supabaseListForecasts, supabaseRecordResearchMemory } from "./supabase.js";

export type ForecastOutcomeFeedbackResult = {
  indicatorId: string;
  evaluatedCount: number;
  pendingCount: number;
  pending: Array<{ predictionId: string; targetDate: string; reason: string }>;
  evidence: "exact-target-date-actual-verified";
};

function toForecast(row: Record<string, unknown>): EvaluationForecast {
  return {
    id: String(row.id), indicatorId: String(row.indicatorId), institution: String(row.institution),
    version: Number(row.version), targetDate: String(row.targetDate), forecastDate: String(row.forecastDate),
    forecastValue: Number(row.forecastValue), sourceName: String(row.sourceName), sourceUrl: String(row.sourceUrl),
  };
}

export async function runForecastOutcomeFeedback(indicatorId: string, limit = 100): Promise<ForecastOutcomeFeedbackResult> {
  const forecasts = ((shouldUseSupabaseStorage() ? await supabaseListForecasts() : listForecasts()) as Array<Record<string, unknown>>)
    .filter((row) => String(row.indicatorId) === indicatorId)
    .slice(0, Math.min(100, Math.max(1, limit)))
    .map(toForecast);
  const observations = (shouldUseSupabaseStorage()
    ? await supabaseLatestObservations(indicatorId, 10_000)
    : latestObservations(indicatorId, 10_000)) as unknown as EvaluationObservation[];
  const result = evaluateForecastBatch(forecasts, { [indicatorId]: observations });
  if (shouldUseSupabaseStorage()) {
    await Promise.all(result.evaluated.map((record) => supabaseRecordResearchMemory(record)));
  } else {
    result.evaluated.forEach((record) => recordResearchMemory(record));
  }
  return {
    indicatorId, evaluatedCount: result.evaluated.length, pendingCount: result.pending.length,
    pending: result.pending.map(({ predictionId, targetDate, reason }) => ({ predictionId, targetDate, reason })),
    evidence: "exact-target-date-actual-verified",
  };
}
