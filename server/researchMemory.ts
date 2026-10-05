/**
 * Deterministic evaluation and memory contracts for forecast/debate outcomes.
 *
 * This is intentionally independent of providers and LLMs. A prediction is
 * evaluated only when the observation for its target period is actual,
 * verified, and source-backed.
 */

export type ResearchActualStatus =
  | "actual-verified-source-backed"
  | "estimated"
  | "simulated"
  | "unavailable";

export type ResearchDirection = "higher" | "lower" | "flat";

export interface ResearchEvaluationInput {
  predictionValue: number;
  actualValue?: number | null;
  snapshotValue: number;
  targetDate: string;
  actualDate?: string | null;
  actualStatus: ResearchActualStatus;
  flatTolerance?: number;
}

export interface ResearchEvaluation {
  state: "pending" | "available";
  error: number | null;
  absolutePercentageError: number | null;
  predictedDirection: ResearchDirection;
  actualDirection: ResearchDirection | null;
  directionCorrect: boolean | null;
  limitation: string;
}

export interface ResearchMemoryInput extends ResearchEvaluationInput {
  predictionId: string;
  indicatorId: string;
  institution: string;
  version: number;
  predictionSource: string;
  predictionFingerprint: string;
  debateSessionId?: string | null;
  debateFingerprint?: string | null;
  lesson?: string | null;
}

export interface ResearchMemoryRecord {
  id: string;
  predictionId: string;
  indicatorId: string;
  institution: string;
  version: number;
  targetDate: string;
  predictionValue: number;
  actualValue: number;
  actualDate: string;
  actualStatus: "actual-verified-source-backed";
  predictionSource: string;
  predictionFingerprint: string;
  debateSessionId: string | null;
  debateFingerprint: string | null;
  error: number;
  absolutePercentageError: number | null;
  predictedDirection: ResearchDirection;
  actualDirection: ResearchDirection;
  directionCorrect: boolean;
  lesson: string | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
}

function directionFromDelta(delta: number, tolerance: number): ResearchDirection {
  if (Math.abs(delta) <= tolerance) return "flat";
  return delta > 0 ? "higher" : "lower";
}

function validateDate(value: string, name: string): void {
  if (!ISO_DATE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`${name} must be an ISO date`);
  }
}

export function evaluateResearchPrediction(input: ResearchEvaluationInput): ResearchEvaluation {
  assertFinite(input.predictionValue, "predictionValue");
  assertFinite(input.snapshotValue, "snapshotValue");
  validateDate(input.targetDate, "targetDate");
  const tolerance = input.flatTolerance ?? 0;
  assertFinite(tolerance, "flatTolerance");
  if (tolerance < 0) throw new Error("flatTolerance must not be negative");

  const predictedDirection = directionFromDelta(input.predictionValue - input.snapshotValue, tolerance);
  const actualAvailable = input.actualStatus === "actual-verified-source-backed" && input.actualValue !== null && input.actualValue !== undefined;
  if (!actualAvailable) {
    return {
      state: "pending",
      error: null,
      absolutePercentageError: null,
      predictedDirection,
      actualDirection: null,
      directionCorrect: null,
      limitation: "Chưa có actual được xác minh đúng trạng thái nguồn; không đánh giá độ chính xác.",
    };
  }

  const actualValue = input.actualValue as number;
  assertFinite(actualValue, "actualValue");
  if (!input.actualDate) throw new Error("actualDate is required for an available evaluation");
  validateDate(input.actualDate, "actualDate");
  if (input.actualDate < input.targetDate) throw new Error("actualDate must not precede targetDate");
  const error = actualValue - input.predictionValue;
  const actualDirection = directionFromDelta(actualValue - input.snapshotValue, tolerance);
  return {
    state: "available",
    error,
    absolutePercentageError: actualValue === 0 ? null : Math.abs(error / actualValue) * 100,
    predictedDirection,
    actualDirection,
    directionCorrect: predictedDirection === actualDirection,
    limitation: "Đánh giá mô tả sai số tại một kỳ mục tiêu; không chứng minh quan hệ nhân quả hay chất lượng tổng quát.",
  };
}

export function buildResearchMemoryRecord(input: ResearchMemoryInput): ResearchMemoryRecord | null {
  if (!input.predictionId || !input.indicatorId || !input.institution || !input.predictionSource || !input.predictionFingerprint) {
    throw new Error("prediction identity and provenance are required");
  }
  if (!Number.isInteger(input.version) || input.version < 1) throw new Error("version must be a positive integer");
  const evaluation = evaluateResearchPrediction(input);
  if (evaluation.state !== "available" || evaluation.actualDirection === null || input.actualValue === null || input.actualValue === undefined || !input.actualDate) return null;
  const id = [input.predictionId, input.indicatorId, input.institution, input.targetDate, input.version].join(":");
  return {
    id,
    predictionId: input.predictionId,
    indicatorId: input.indicatorId,
    institution: input.institution,
    version: input.version,
    targetDate: input.targetDate,
    predictionValue: input.predictionValue,
    actualValue: input.actualValue,
    actualDate: input.actualDate,
    actualStatus: "actual-verified-source-backed",
    predictionSource: input.predictionSource,
    predictionFingerprint: input.predictionFingerprint,
    debateSessionId: input.debateSessionId ?? null,
    debateFingerprint: input.debateFingerprint ?? null,
    error: evaluation.error as number,
    absolutePercentageError: evaluation.absolutePercentageError,
    predictedDirection: evaluation.predictedDirection,
    actualDirection: evaluation.actualDirection,
    directionCorrect: evaluation.directionCorrect as boolean,
    lesson: input.lesson ?? null,
  };
}
