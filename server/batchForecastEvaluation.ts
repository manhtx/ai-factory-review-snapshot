import { deterministicFingerprint } from "../src/app/data/deterministicFingerprint.js";
import { buildResearchMemoryRecord, type ResearchMemoryRecord } from "./researchMemory.js";

export interface EvaluationForecast {
  id: string;
  indicatorId: string;
  institution: string;
  version: number;
  targetDate: string;
  forecastDate: string;
  forecastValue: number;
  sourceName: string;
  sourceUrl: string;
}

export interface EvaluationObservation {
  date: string;
  value: number;
  status: string;
  quality: string;
}

export interface BatchEvaluationResult {
  evaluated: ResearchMemoryRecord[];
  pending: Array<{ predictionId: string; indicatorId: string; targetDate: string; reason: string }>;
}

export function evaluateForecastBatch(forecasts: EvaluationForecast[], observationsByIndicator: Record<string, EvaluationObservation[]>): BatchEvaluationResult {
  const evaluated: ResearchMemoryRecord[] = [];
  const pending: BatchEvaluationResult["pending"] = [];
  for (const forecast of forecasts) {
    const rows = [...(observationsByIndicator[forecast.indicatorId] ?? [])].sort((a, b) => a.date.localeCompare(b.date));
    const actual = rows.find((row) => row.date === forecast.targetDate && row.status === "actual" && row.quality === "verified" && Number.isFinite(row.value));
    const baseline = [...rows].filter((row) => row.date <= forecast.forecastDate && row.status === "actual" && row.quality === "verified" && Number.isFinite(row.value)).at(-1);
    if (!actual) {
      pending.push({ predictionId: forecast.id, indicatorId: forecast.indicatorId, targetDate: forecast.targetDate, reason: "exact target-date actual/verified observation unavailable" });
      continue;
    }
    if (!baseline) {
      pending.push({ predictionId: forecast.id, indicatorId: forecast.indicatorId, targetDate: forecast.targetDate, reason: "verified baseline at or before forecast date unavailable" });
      continue;
    }
    const record = buildResearchMemoryRecord({
      predictionId: forecast.id,
      indicatorId: forecast.indicatorId,
      institution: forecast.institution,
      version: forecast.version,
      targetDate: forecast.targetDate,
      predictionValue: forecast.forecastValue,
      snapshotValue: baseline.value,
      actualValue: actual.value,
      actualDate: actual.date,
      actualStatus: "actual-verified-source-backed",
      predictionSource: forecast.sourceName,
      predictionFingerprint: deterministicFingerprint({ forecast }),
    });
    if (record) evaluated.push(record);
  }
  return { evaluated, pending };
}
