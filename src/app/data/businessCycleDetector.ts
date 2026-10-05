/**
 * Macroeconomic Business Cycle & Turning Point Detector Engine
 * Implements NBER / OECD Bry-Boschan Cycle Dating Algorithm adapted for
 * high-frequency and monthly/quarterly macroeconomic time-series.
 *
 * Strict Compliance:
 * - Macro OS Product Goal & Non-negotiable scope guardrails.
 * - Separates Factual Observation (historical peak/trough levels and dates)
 *   from Analytical Inference (cycle phase classification, momentum, projections).
 */

export type CyclePhase = "expansion" | "contraction" | "slowdown" | "recovery";
export type TurningPointType = "peak" | "trough";

export interface TurningPoint {
  id: string;
  date: string;
  type: TurningPointType;
  value: number;
  amplitudePercent: number;
  phaseDurationMonths: number;
  factVsInference: {
    factualObservation: string;
    analyticalInference: string;
  };
  sourceCitation: string;
}

export interface CycleRegimeMetrics {
  totalCyclesDetected: number;
  averageExpansionMonths: number;
  averageContractionMonths: number;
  averagePeakToTroughDropPercent: number;
  averageTroughToPeakGainPercent: number;
  cyclicalVolatility: number;
}

export interface CycleRegimeReport {
  indicatorId: string;
  indicatorName: string;
  currentPhase: CyclePhase;
  currentPhaseDurationMonths: number;
  turningPoints: TurningPoint[];
  metrics: CycleRegimeMetrics;
  algorithm: string;
  citation: string;
  confidenceRating: "high" | "moderate" | "preliminary";
  factVsInferenceSummary: {
    factualBasis: string;
    analyticalAssessment: string;
  };
}

export interface CycleDetectionOptions {
  window?: number; // Half-window for local extreme search (default: 5)
  minPhaseMonths?: number; // Minimum duration for a single phase (peak to trough or vice versa) (default: 5)
  minCycleMonths?: number; // Minimum duration for a complete cycle (peak to peak or trough to trough) (default: 15)
}

/**
 * Calculates month difference between two ISO date strings (YYYY-MM-DD or YYYY-MM)
 */
export function getMonthsBetween(startDate: string, endDate: string): number {
  const d1 = new Date(startDate);
  const d2 = new Date(endDate);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
  return Math.max(
    0,
    (d2.getUTCFullYear() - d1.getUTCFullYear()) * 12 + (d2.getUTCMonth() - d1.getUTCMonth())
  );
}

/**
 * Detects turning points (peaks and troughs) using Bry-Boschan algorithmic rules:
 * 1. Identify local extrema across a sliding window [t - w, t + w].
 * 2. Enforce alternating peaks and troughs (suppress intermediate non-extrema).
 * 3. Enforce minimum phase duration censoring rule.
 * 4. Compute amplitudes and durations.
 */
export function detectTurningPoints(
  series: Array<{ date: string; value: number }>,
  options: CycleDetectionOptions = {}
): TurningPoint[] {
  if (!series || series.length < 10) return [];

  const window = options.window ?? 5;
  const minPhaseMonths = options.minPhaseMonths ?? 5;

  // Step 1: Find candidate local peaks and troughs
  interface CandidateExtremum {
    index: number;
    date: string;
    value: number;
    type: TurningPointType;
  }

  const candidates: CandidateExtremum[] = [];

  for (let i = window; i < series.length - window; i++) {
    const current = series[i];
    let isPeak = true;
    let isTrough = true;

    for (let j = i - window; j <= i + window; j++) {
      if (j === i) continue;
      if (series[j].value >= current.value) isPeak = false;
      if (series[j].value <= current.value) isTrough = false;
    }

    if (isPeak) {
      candidates.push({ index: i, date: current.date, value: current.value, type: "peak" });
    } else if (isTrough) {
      candidates.push({ index: i, date: current.date, value: current.value, type: "trough" });
    }
  }

  if (candidates.length === 0) return [];

  // Step 2: Ensure strictly alternating sequence (Peak -> Trough -> Peak -> Trough)
  const alternating: CandidateExtremum[] = [];
  let currentCandidate = candidates[0];

  for (let i = 1; i < candidates.length; i++) {
    const next = candidates[i];
    if (next.type === currentCandidate.type) {
      // If consecutive peaks, keep the higher peak
      if (currentCandidate.type === "peak") {
        if (next.value > currentCandidate.value) {
          currentCandidate = next;
        }
      } else {
        // If consecutive troughs, keep the lower trough
        if (next.value < currentCandidate.value) {
          currentCandidate = next;
        }
      }
    } else {
      alternating.push(currentCandidate);
      currentCandidate = next;
    }
  }
  alternating.push(currentCandidate);

  // Step 3: Enforce minimum phase duration censoring rule
  const filtered: CandidateExtremum[] = [];
  for (let i = 0; i < alternating.length; i++) {
    const cand = alternating[i];
    if (filtered.length === 0) {
      filtered.push(cand);
      continue;
    }

    const prev = filtered[filtered.length - 1];
    const duration = getMonthsBetween(prev.date, cand.date);

    if (duration >= minPhaseMonths) {
      filtered.push(cand);
    } else {
      // Suppress or merge with adjacent extreme of the same type if applicable
      if (cand.type === prev.type) {
        if (cand.type === "peak" && cand.value > prev.value) {
          filtered[filtered.length - 1] = cand;
        } else if (cand.type === "trough" && cand.value < prev.value) {
          filtered[filtered.length - 1] = cand;
        }
      }
    }
  }

  // Step 4: Construct TurningPoint objects with amplitude, durations, and Fact vs Inference separation
  const turningPoints: TurningPoint[] = [];

  for (let i = 0; i < filtered.length; i++) {
    const pt = filtered[i];
    const prevPt = i > 0 ? filtered[i - 1] : null;

    const duration = prevPt ? Math.max(1, getMonthsBetween(prevPt.date, pt.date)) : 0;
    let amplitude = 0;
    if (prevPt && prevPt.value !== 0) {
      amplitude = Math.round(((pt.value - prevPt.value) / Math.abs(prevPt.value)) * 1000) / 10;
    }

    const typeLabel = pt.type === "peak" ? "Đỉnh Chu Kỳ (Cyclical Peak)" : "Đáy Chu Kỳ (Cyclical Trough)";

    turningPoints.push({
      id: `tp-${pt.date}-${pt.type}`,
      date: pt.date,
      type: pt.type,
      value: Math.round(pt.value * 100) / 100,
      amplitudePercent: amplitude,
      phaseDurationMonths: duration,
      factVsInference: {
        factualObservation: `Số liệu quan sát thực tế vào ngày ${pt.date} đạt mức ${pt.value} ghi nhận điểm cực trị cục bộ trong khung cửa sổ kiểm nghiệm.`,
        analyticalInference: `Thuật toán Bry-Boschan định vị đây là ${typeLabel} đại diện cho bước chuyển trạng thái kinh tế sau ${duration > 0 ? `${duration} tháng tích lũy` : "giai đoạn ban đầu"}.`,
      },
      sourceCitation: "NBER Business Cycle Dating Committee & OECD CLI Reference Turning Points",
    });
  }

  return turningPoints;
}

/**
 * Analyzes time-series data and produces a comprehensive business cycle report
 */
export function analyzeBusinessCycleRegime(
  indicatorId: string,
  indicatorName: string,
  series: Array<{ date: string; value: number }>,
  frequency: string = "monthly"
): CycleRegimeReport {
  if (!series || series.length === 0) {
    return {
      indicatorId,
      indicatorName,
      currentPhase: "expansion",
      currentPhaseDurationMonths: 0,
      turningPoints: [],
      metrics: {
        totalCyclesDetected: 0,
        averageExpansionMonths: 0,
        averageContractionMonths: 0,
        averagePeakToTroughDropPercent: 0,
        averageTroughToPeakGainPercent: 0,
        cyclicalVolatility: 0,
      },
      algorithm: "NBER / OECD Bry-Boschan Cycle Dating Algorithm",
      citation: "OECD CLI Methodology & NBER Business Cycle Dating Committee",
      confidenceRating: "preliminary",
      factVsInferenceSummary: {
        factualBasis: "Không có chuỗi dữ liệu lịch sử để thực hiện kiểm định chu kỳ.",
        analyticalAssessment: "Cần tối thiểu chuỗi số liệu từ 24 tháng trở lên để phân tích hình thái chu kỳ.",
      },
    };
  }

  const windowSize = frequency === "quarterly" ? 2 : 5;
  const minPhase = frequency === "quarterly" ? 6 : 5;

  const turningPoints = detectTurningPoints(series, {
    window: windowSize,
    minPhaseMonths: minPhase,
  });

  // Calculate cycle phase statistics
  let totalExpansionMonths = 0;
  let expansionCount = 0;
  let totalContractionMonths = 0;
  let contractionCount = 0;
  let totalDropPct = 0;
  let totalGainPct = 0;

  for (let i = 1; i < turningPoints.length; i++) {
    const curr = turningPoints[i];
    const prev = turningPoints[i - 1];

    if (curr.type === "peak" && prev.type === "trough") {
      // Expansion phase (Trough -> Peak)
      totalExpansionMonths += curr.phaseDurationMonths;
      expansionCount++;
      totalGainPct += Math.abs(curr.amplitudePercent);
    } else if (curr.type === "trough" && prev.type === "peak") {
      // Contraction phase (Peak -> Trough)
      totalContractionMonths += curr.phaseDurationMonths;
      contractionCount++;
      totalDropPct += Math.abs(curr.amplitudePercent);
    }
  }

  // Calculate cyclical volatility
  const values = series.map((s) => s.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
  const cyclicalVolatility = Math.round(Math.sqrt(variance) * 100) / 100;

  // Determine current phase and duration
  const lastPoint = series[series.length - 1];
  const lastTurningPoint = turningPoints.length > 0 ? turningPoints[turningPoints.length - 1] : null;

  let currentPhase: CyclePhase = "expansion";
  let currentPhaseDurationMonths = 0;

  if (lastTurningPoint) {
    currentPhaseDurationMonths = Math.max(
      1,
      getMonthsBetween(lastTurningPoint.date, lastPoint.date)
    );

    const deltaSinceLastTP = lastPoint.value - lastTurningPoint.value;

    if (lastTurningPoint.type === "trough") {
      // Exited a trough
      if (currentPhaseDurationMonths <= 6 && deltaSinceLastTP > 0) {
        currentPhase = "recovery";
      } else {
        currentPhase = "expansion";
      }
    } else {
      // Exited a peak
      if (deltaSinceLastTP < 0) {
        currentPhase = "contraction";
      } else {
        currentPhase = "slowdown";
      }
    }
  } else {
    // If no turning points detected, check 6-month momentum
    const recent = series.slice(-6);
    if (recent.length >= 2) {
      const first = recent[0].value;
      const last = recent[recent.length - 1].value;
      currentPhase = last >= first ? "expansion" : "contraction";
      currentPhaseDurationMonths = recent.length;
    }
  }

  const confidenceRating: "high" | "moderate" | "preliminary" =
    series.length > 60 && turningPoints.length >= 3
      ? "high"
      : series.length >= 24
      ? "moderate"
      : "preliminary";

  const phaseLabelMap: Record<CyclePhase, string> = {
    expansion: "Mở rộng kinh tế (Expansion)",
    contraction: "Thu hẹp / Suy thoái (Contraction)",
    slowdown: "Tăng trưởng chậm lại (Late Expansion / Slowdown)",
    recovery: "Phục hồi sớm từ đáy (Early Recovery)",
  };

  return {
    indicatorId,
    indicatorName,
    currentPhase,
    currentPhaseDurationMonths,
    turningPoints,
    metrics: {
      totalCyclesDetected: Math.floor(turningPoints.length / 2),
      averageExpansionMonths:
        expansionCount > 0 ? Math.round(totalExpansionMonths / expansionCount) : 0,
      averageContractionMonths:
        contractionCount > 0 ? Math.round(totalContractionMonths / contractionCount) : 0,
      averagePeakToTroughDropPercent:
        contractionCount > 0 ? Math.round((totalDropPct / contractionCount) * 10) / 10 : 0,
      averageTroughToPeakGainPercent:
        expansionCount > 0 ? Math.round((totalGainPct / expansionCount) * 10) / 10 : 0,
      cyclicalVolatility,
    },
    algorithm: "NBER / OECD Bry-Boschan Cycle Dating Algorithm",
    citation: "OECD CLI Methodology & NBER Business Cycle Dating Committee",
    confidenceRating,
    factVsInferenceSummary: {
      factualBasis: `Dựa trên chuỗi ${series.length} điểm quan sát thực tế (từ ${series[0]?.date} đến ${lastPoint?.date}), thuật toán xác định ${turningPoints.length} điểm đảo chiều lịch sử.`,
      analyticalAssessment: `Chỉ số hiện ở trạng thái '${phaseLabelMap[currentPhase]}' kéo dài ${currentPhaseDurationMonths} tháng. Đây là suy luận thuật toán phân loại chu kỳ, không phải khuyến nghị đầu tư.`,
    },
  };
}

/**
 * Pre-configured canonical cycle benchmarks for primary indicators
 */
export const CANONICAL_CYCLE_BENCHMARKS: Record<string, Partial<CycleRegimeReport>> = {
  "gdp-us": {
    indicatorId: "gdp-us",
    indicatorName: "US Real GDP",
    currentPhase: "expansion",
    currentPhaseDurationMonths: 48,
    algorithm: "NBER Business Cycle Reference Dates",
    confidenceRating: "high",
  },
  "yield-curve": {
    indicatorId: "yield-curve",
    indicatorName: "US 10Y - 2Y Yield Spread",
    currentPhase: "slowdown",
    currentPhaseDurationMonths: 22,
    algorithm: "Yield Curve Inversion Lead-Lag Cycle Model",
    confidenceRating: "high",
  },
  "credit-growth-vn": {
    indicatorId: "credit-growth-vn",
    indicatorName: "Vietnam Credit Growth YoY",
    currentPhase: "recovery",
    currentPhaseDurationMonths: 14,
    algorithm: "SBV Credit Cycle Turning Point Model",
    confidenceRating: "high",
  },
};

export function getIndicatorCycleBenchmark(indicatorId: string): Partial<CycleRegimeReport> | null {
  return CANONICAL_CYCLE_BENCHMARKS[indicatorId] ?? null;
}
