/**
 * macroDebate.ts — Macro Research Multi-Agent Debate Engine
 *
 * Adapted from TradingAgents multi-agent architecture (TauricResearch/TradingAgents):
 *   - Bull Researcher: builds evidence-based case FOR a prediction
 *   - Bear Researcher: builds evidence-based case AGAINST a prediction
 *   - Risk Analyst: identifies tail risks and warning flags
 *   - Macro Verdict Engine: synthesizes debate into structured research opinion
 *
 * Key differences from TradingAgents:
 *   - No LLM calls (Phase 1 is deterministic rule-based)
 *   - No trading execution — output is Research Opinion only
 *   - Uses Macro OS indicator types instead of stock data
 *   - All evidence must be source-backed (follows PRODUCT_GOAL.md guardrails)
 *
 * PRODUCT_GOAL.md alignment:
 *   - Objective 4: Analyze relationships and lead/lag effects between indicators
 *   - Objective 6: Detect early warning signals with inspectable evidence
 *   - Design: "Everything is Explainable"
 */

import { Indicator, DataPoint } from "./types";
import { isCurrentSourceBackedIndicator } from "./dataContract";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DebatePrediction {
  /** The predicted value for the next release period */
  value: number;
  /** Human-readable horizon, e.g. "next quarter", "next month" */
  horizon: string;
  /** Which entity or methodology produced this prediction */
  source: string;
  /** Direction this prediction implies vs current value */
  impliedDirection: "higher" | "lower" | "flat";
}

export interface EvidenceBullet {
  indicatorId: string;
  shortName: string;
  value: number;
  unit: string;
  asOf: string;
  trend: "up" | "down" | "flat";
  /** How this bullet supports the analyst's case */
  argument: string;
  sourceName: string;
  sourceUrl: string | null;
  seriesId: string | null;
}

export interface AnalystOutput {
  role: "bull" | "bear" | "risk";
  thesis: string;
  bullets: EvidenceBullet[];
  strength: "strong" | "moderate" | "weak" | "insufficient";
  limitation: string;
}

export interface RiskFlag {
  type: "threshold" | "trend_reversal" | "leading_indicator" | "relationship";
  severity: "high" | "medium" | "low";
  indicator: string;
  description: string;
  evidenceDate: string;
}

export type VerdictSignal =
  | "prediction_supported"
  | "prediction_contested"
  | "prediction_uncertain"
  | "insufficient_evidence";

export interface MacroVerdict {
  signal: VerdictSignal;
  label: string;
  summary: string;
  bullStrength: number; // 0–100
  bearStrength: number; // 0–100
  riskCount: number;
  limitation: string;
  boundary: "bounded-research-opinion";
}

export interface DebateSession {
  id: string;
  indicatorId: string;
  indicatorName: string;
  prediction: DebatePrediction;
  currentSnapshot: { value: number; date: string; unit: string };
  bullCase: AnalystOutput;
  bearCase: AnalystOutput;
  riskAnalysis: AnalystOutput;
  riskFlags: RiskFlag[];
  verdict: MacroVerdict;
  debateRounds: number;
  eligibleIndicatorIds: string[];
  runAt: string;
  fingerprint: string;
}

// ─── Evidence Scoring ─────────────────────────────────────────────────────────

/**
 * Score an analyst role's evidence strength based on number and quality of bullets.
 * Mirrors TradingAgents judge decision logic but deterministic.
 */
function scoreStrength(bullets: EvidenceBullet[]): AnalystOutput["strength"] {
  if (bullets.length === 0) return "insufficient";
  if (bullets.length >= 4) return "strong";
  if (bullets.length >= 2) return "moderate";
  return "weak";
}

// ─── Trend Analysis Helpers ───────────────────────────────────────────────────

function recentTrendDirection(series: DataPoint[], windowSize = 3): "up" | "down" | "flat" {
  const recent = [...series].sort((a, b) => a.date.localeCompare(b.date)).slice(-windowSize);
  if (recent.length < 2) return "flat";
  const first = recent[0].value;
  const last = recent[recent.length - 1].value;
  if (last > first * 1.005) return "up";
  if (last < first * 0.995) return "down";
  return "flat";
}

function computeRecentChangePercent(series: DataPoint[], windowSize = 3): number {
  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const recent = sorted.slice(-windowSize);
  if (recent.length < 2) return 0;
  const first = recent[0].value;
  const last = recent[recent.length - 1].value;
  if (first === 0) return 0;
  return ((last - first) / Math.abs(first)) * 100;
}

// ─── Risk Flag Detection ──────────────────────────────────────────────────────

function detectRiskFlags(
  indicator: Indicator,
  relatedIndicators: Map<string, Indicator>,
  prediction: DebatePrediction,
): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const snapshot = indicator.snapshot;
  const series = indicator.series;

  // 1. Threshold breach risk
  if (indicator.threshold) {
    const { warn, critical, direction } = indicator.threshold;
    const breachesWarn =
      direction === "above" ? snapshot.value > warn : snapshot.value < warn;
    const breachesCritical =
      direction === "above" ? snapshot.value > critical : snapshot.value < critical;
    if (breachesCritical) {
      flags.push({
        type: "threshold",
        severity: "high",
        indicator: indicator.shortName,
        description: `Giá trị hiện tại ${snapshot.value} ${indicator.unit} đã vượt ngưỡng nghiêm trọng (${critical}). Rủi ro cao nếu dự đoán tiếp tục theo hướng này.`,
        evidenceDate: snapshot.date,
      });
    } else if (breachesWarn) {
      flags.push({
        type: "threshold",
        severity: "medium",
        indicator: indicator.shortName,
        description: `Giá trị hiện tại ${snapshot.value} ${indicator.unit} đang tiệm cận ngưỡng cảnh báo (${warn}).`,
        evidenceDate: snapshot.date,
      });
    }
  }

  // 2. Trend reversal risk
  const trend3m = recentTrendDirection(series, 3);
  const trend6m = recentTrendDirection(series, 6);
  if (trend3m !== trend6m && trend6m !== "flat") {
    flags.push({
      type: "trend_reversal",
      severity: "medium",
      indicator: indicator.shortName,
      description: `Xu hướng 3 tháng gần đây (${trend3m}) diverges với xu hướng 6 tháng (${trend6m}) — tín hiệu đảo chiều tiềm năng.`,
      evidenceDate: snapshot.date,
    });
  }

  // 3. Leading indicator signals from relationships
  for (const rel of indicator.relationships) {
    if (rel.type !== "leads") continue;
    const related = relatedIndicators.get(rel.indicatorId);
    if (!related || !isCurrentSourceBackedIndicator(related)) continue;
    const relTrend = recentTrendDirection(related.series, 3);
    // If a leading indicator is moving opposite to the prediction direction
    const predictingUp = prediction.impliedDirection === "higher";
    if ((predictingUp && relTrend === "down") || (!predictingUp && relTrend === "up")) {
      flags.push({
        type: "leading_indicator",
        severity: "medium",
        indicator: related.shortName,
        description: `${related.shortName} (leading indicator, lag ${rel.lagMonths}M) đang ${relTrend === "down" ? "giảm" : "tăng"} — mâu thuẫn với hướng dự đoán. ${rel.description}`,
        evidenceDate: related.snapshot.date,
      });
    }
  }

  // 4. Prediction divergence from current trend
  const currentTrend = recentTrendDirection(series, 3);
  if (
    (prediction.impliedDirection === "higher" && currentTrend === "down") ||
    (prediction.impliedDirection === "lower" && currentTrend === "up")
  ) {
    flags.push({
      type: "relationship",
      severity: "low",
      indicator: indicator.shortName,
      description: `Dự đoán (${prediction.impliedDirection}) diverges với xu hướng hiện tại (${currentTrend}). Cần bằng chứng bổ sung để hỗ trợ sự đảo chiều.`,
      evidenceDate: snapshot.date,
    });
  }

  return flags;
}

// ─── Bull Analyst ─────────────────────────────────────────────────────────────

/**
 * Bull Researcher: Builds evidence-based case FOR the prediction being correct.
 * Adapted from TradingAgents bull_researcher.py — "advocate for the bullish thesis".
 * For macro predictions: "bull" means the prediction is accurate / trend supports it.
 */
function runBullAnalyst(
  indicator: Indicator,
  prediction: DebatePrediction,
  relatedIndicators: Map<string, Indicator>,
): AnalystOutput {
  const bullets: EvidenceBullet[] = [];
  const eligible = isCurrentSourceBackedIndicator(indicator);

  if (eligible) {
    const trend = recentTrendDirection(indicator.series, 3);
    const changePct = computeRecentChangePercent(indicator.series, 3);
    const direction = prediction.impliedDirection;

    // Bullet 1: Primary indicator trend supports prediction
    if (
      (direction === "higher" && trend === "up") ||
      (direction === "lower" && trend === "down") ||
      (direction === "flat" && trend === "flat")
    ) {
      bullets.push({
        indicatorId: indicator.id,
        shortName: indicator.shortName,
        value: indicator.snapshot.value,
        unit: indicator.unit,
        asOf: indicator.snapshot.date,
        trend,
        argument: `Xu hướng ${indicator.shortName} 3 tháng gần đây (${trend === "up" ? "tăng" : trend === "down" ? "giảm" : "ổn định"} ${Math.abs(changePct).toFixed(1)}%) nhất quán với hướng dự đoán ${direction}.`,
        sourceName: indicator.provenance?.sourceName ?? indicator.source,
        sourceUrl: indicator.provenance?.sourceUrl ?? null,
        seriesId: indicator.provenance?.sourceSeriesId ?? null,
      });
    }

    // Bullet 2: Momentum supports continuation
    if (
      (indicator.momentum === "accelerating" && direction === "higher") ||
      (indicator.momentum === "decelerating" && direction === "lower")
    ) {
      bullets.push({
        indicatorId: indicator.id,
        shortName: indicator.shortName,
        value: indicator.snapshot.value,
        unit: indicator.unit,
        asOf: indicator.snapshot.date,
        trend,
        argument: `Momentum ${indicator.momentum === "accelerating" ? "đang tăng tốc" : "đang chậm lại"} — hỗ trợ hướng dự đoán.`,
        sourceName: indicator.provenance?.sourceName ?? indicator.source,
        sourceUrl: indicator.provenance?.sourceUrl ?? null,
        seriesId: indicator.provenance?.sourceSeriesId ?? null,
      });
    }
  }

  // Bullet 3-N: Supporting indicators from relationships
  for (const rel of indicator.relationships) {
    if (bullets.length >= 4) break;
    const related = relatedIndicators.get(rel.indicatorId);
    if (!related || !isCurrentSourceBackedIndicator(related)) continue;
    const relTrend = recentTrendDirection(related.series, 3);
    const direction = prediction.impliedDirection;

    // Leading indicator supports prediction
    if (
      rel.type === "leads" &&
      ((direction === "higher" && relTrend === "up") ||
        (direction === "lower" && relTrend === "down"))
    ) {
      bullets.push({
        indicatorId: related.id,
        shortName: related.shortName,
        value: related.snapshot.value,
        unit: related.unit,
        asOf: related.snapshot.date,
        trend: relTrend,
        argument: `${related.shortName} (leading indicator, lag ${rel.lagMonths}M) đang ${relTrend === "up" ? "tăng" : "giảm"} — phù hợp với dự đoán. ${rel.description}`,
        sourceName: related.provenance?.sourceName ?? related.source,
        sourceUrl: related.provenance?.sourceUrl ?? null,
        seriesId: related.provenance?.sourceSeriesId ?? null,
      });
    }

    // Coincident indicator corroborates
    if (
      rel.type === "coincident" &&
      ((direction === "higher" && relTrend === "up") ||
        (direction === "lower" && relTrend === "down"))
    ) {
      bullets.push({
        indicatorId: related.id,
        shortName: related.shortName,
        value: related.snapshot.value,
        unit: related.unit,
        asOf: related.snapshot.date,
        trend: relTrend,
        argument: `${related.shortName} (coincident indicator) xác nhận hướng di chuyển tương tự. ${rel.description}`,
        sourceName: related.provenance?.sourceName ?? related.source,
        sourceUrl: related.provenance?.sourceUrl ?? null,
        seriesId: related.provenance?.sourceSeriesId ?? null,
      });
    }
  }

  const strength = scoreStrength(bullets);
  const bullThesis =
    bullets.length === 0
      ? `Không đủ bằng chứng để xây dựng luận điểm bullish cho dự đoán ${prediction.value} ${indicator.unit}. Cần observation đạt actual + verified + có URL nguồn.`
      : `Luận điểm bullish: Dự đoán ${prediction.value} ${indicator.unit} (${prediction.horizon}) được hỗ trợ bởi ${bullets.length} bằng chứng từ indicator catalog. ${prediction.source}.`;

  return {
    role: "bull",
    thesis: bullThesis,
    bullets,
    strength,
    limitation:
      "Luận điểm này chỉ phản ánh hướng biến động từ observation đã xác minh; không bao gồm yếu tố địa chính trị, chính sách đột xuất hoặc shock ngoại sinh.",
  };
}

// ─── Bear Analyst ─────────────────────────────────────────────────────────────

/**
 * Bear Researcher: Builds evidence-based case AGAINST the prediction.
 * Adapted from TradingAgents bear_researcher.py — "advocate for the bearish thesis".
 * For macro predictions: "bear" means prediction may be wrong / risks diverge.
 */
function runBearAnalyst(
  indicator: Indicator,
  prediction: DebatePrediction,
  relatedIndicators: Map<string, Indicator>,
): AnalystOutput {
  const bullets: EvidenceBullet[] = [];
  const eligible = isCurrentSourceBackedIndicator(indicator);

  if (eligible) {
    const trend = recentTrendDirection(indicator.series, 3);
    const changePct = computeRecentChangePercent(indicator.series, 3);
    const direction = prediction.impliedDirection;

    // Bullet 1: Current trend contradicts prediction
    if (
      (direction === "higher" && trend === "down") ||
      (direction === "lower" && trend === "up")
    ) {
      bullets.push({
        indicatorId: indicator.id,
        shortName: indicator.shortName,
        value: indicator.snapshot.value,
        unit: indicator.unit,
        asOf: indicator.snapshot.date,
        trend,
        argument: `Xu hướng ${indicator.shortName} 3 tháng gần đây (${trend === "down" ? "giảm" : "tăng"} ${Math.abs(changePct).toFixed(1)}%) đi ngược chiều dự đoán (${direction}). Đảo chiều cần bằng chứng mạnh hơn.`,
        sourceName: indicator.provenance?.sourceName ?? indicator.source,
        sourceUrl: indicator.provenance?.sourceUrl ?? null,
        seriesId: indicator.provenance?.sourceSeriesId ?? null,
      });
    }

    // Bullet 2: Momentum contradicts
    if (
      (indicator.momentum === "decelerating" && direction === "higher") ||
      (indicator.momentum === "accelerating" && direction === "lower")
    ) {
      bullets.push({
        indicatorId: indicator.id,
        shortName: indicator.shortName,
        value: indicator.snapshot.value,
        unit: indicator.unit,
        asOf: indicator.snapshot.date,
        trend,
        argument: `Momentum ${indicator.momentum === "decelerating" ? "đang suy yếu" : "đang tăng tốc"} — mâu thuẫn với hướng dự đoán.`,
        sourceName: indicator.provenance?.sourceName ?? indicator.source,
        sourceUrl: indicator.provenance?.sourceUrl ?? null,
        seriesId: indicator.provenance?.sourceSeriesId ?? null,
      });
    }

    // Bullet 3: Gap between prediction and current value
    const currentValue = indicator.snapshot.value;
    const predictionValue = prediction.value;
    const gapPct = Math.abs((predictionValue - currentValue) / Math.abs(currentValue)) * 100;
    if (gapPct > 15) {
      bullets.push({
        indicatorId: indicator.id,
        shortName: indicator.shortName,
        value: currentValue,
        unit: indicator.unit,
        asOf: indicator.snapshot.date,
        trend,
        argument: `Khoảng cách lớn giữa giá trị hiện tại (${currentValue} ${indicator.unit}) và dự đoán (${predictionValue} ${indicator.unit}) — chênh lệch ${gapPct.toFixed(1)}%. Cần lý giải rõ catalyst.`,
        sourceName: indicator.provenance?.sourceName ?? indicator.source,
        sourceUrl: indicator.provenance?.sourceUrl ?? null,
        seriesId: indicator.provenance?.sourceSeriesId ?? null,
      });
    }
  }

  // Counter-evidence from relationships
  for (const rel of indicator.relationships) {
    if (bullets.length >= 4) break;
    const related = relatedIndicators.get(rel.indicatorId);
    if (!related || !isCurrentSourceBackedIndicator(related)) continue;
    const relTrend = recentTrendDirection(related.series, 3);
    const direction = prediction.impliedDirection;

    // Leading indicator contradicts prediction
    if (
      rel.type === "leads" &&
      ((direction === "higher" && relTrend === "down") ||
        (direction === "lower" && relTrend === "up"))
    ) {
      bullets.push({
        indicatorId: related.id,
        shortName: related.shortName,
        value: related.snapshot.value,
        unit: related.unit,
        asOf: related.snapshot.date,
        trend: relTrend,
        argument: `${related.shortName} (leading indicator, lag ${rel.lagMonths}M) đang ${relTrend === "down" ? "giảm" : "tăng"} — mâu thuẫn với dự đoán. ${rel.description}`,
        sourceName: related.provenance?.sourceName ?? related.source,
        sourceUrl: related.provenance?.sourceUrl ?? null,
        seriesId: related.provenance?.sourceSeriesId ?? null,
      });
    }
  }

  const strength = scoreStrength(bullets);
  const bearThesis =
    bullets.length === 0
      ? `Không đủ bằng chứng để phản biện dự đoán. Thiếu observation ngược chiều đủ điều kiện.`
      : `Luận điểm bearish: ${bullets.length} bằng chứng cho thấy dự đoán ${prediction.value} ${indicator.unit} có thể không đạt được trong horizon ${prediction.horizon}.`;

  return {
    role: "bear",
    thesis: bearThesis,
    bullets,
    strength,
    limitation:
      "Phản biện này dựa trên observation historical; không tính đến thông tin chính sách chưa công bố hoặc điều chỉnh phương pháp thống kê.",
  };
}

// ─── Risk Analyst ─────────────────────────────────────────────────────────────

/**
 * Risk Analyst: Identifies tail risks, warning signals, and research limitations.
 * Adapted from TradingAgents risk management team logic.
 */
function runRiskAnalyst(
  indicator: Indicator,
  prediction: DebatePrediction,
  relatedIndicators: Map<string, Indicator>,
  riskFlags: RiskFlag[],
): AnalystOutput {
  const bullets: EvidenceBullet[] = [];

  // Convert risk flags to evidence bullets
  for (const flag of riskFlags) {
    if (bullets.length >= 5) break;
    const related = relatedIndicators.get(flag.indicator) ?? indicator;
    bullets.push({
      indicatorId: related.id,
      shortName: flag.indicator,
      value: related.snapshot.value,
      unit: related.unit,
      asOf: flag.evidenceDate,
      trend: related.trend,
      argument: `[${flag.severity.toUpperCase()} RISK — ${flag.type}] ${flag.description}`,
      sourceName: related.provenance?.sourceName ?? related.source,
      sourceUrl: related.provenance?.sourceUrl ?? null,
      seriesId: related.provenance?.sourceSeriesId ?? null,
    });
  }

  // Add data quality risk if indicator is not fully source-backed
  if (!isCurrentSourceBackedIndicator(indicator)) {
    bullets.push({
      indicatorId: indicator.id,
      shortName: indicator.shortName,
      value: indicator.snapshot.value,
      unit: indicator.unit,
      asOf: indicator.snapshot.date,
      trend: indicator.trend,
      argument: `Chỉ báo chính chưa đạt actual + verified + freshness hiện tại — debate dựa trên dữ liệu có thể không cập nhật.`,
      sourceName: indicator.provenance?.sourceName ?? indicator.source,
      sourceUrl: indicator.provenance?.sourceUrl ?? null,
      seriesId: indicator.provenance?.sourceSeriesId ?? null,
    });
  }

  const strength = scoreStrength(bullets);

  return {
    role: "risk",
    thesis:
      riskFlags.length === 0
        ? `Không phát hiện risk flag đặc biệt từ threshold, trend reversal, hoặc leading indicators. Vẫn áp dụng giới hạn chung của mô hình.`
        : `Phát hiện ${riskFlags.length} risk flag (${riskFlags.filter((f) => f.severity === "high").length} high, ${riskFlags.filter((f) => f.severity === "medium").length} medium). Cần xem xét kỹ trước khi ra kết luận nghiên cứu.`,
    bullets,
    strength,
    limitation:
      "Phân tích rủi ro chỉ dựa trên quantitative signals từ catalog; rủi ro tail và black swan không có trong dữ liệu lịch sử sẽ không được phát hiện.",
  };
}

// ─── Verdict Engine ───────────────────────────────────────────────────────────

/**
 * Macro Verdict Engine: Synthesizes Bull/Bear/Risk debate into research opinion.
 * Adapted from TradingAgents Research Manager and Portfolio Manager logic.
 * Output is NEVER a trading recommendation — it is a Research Opinion.
 */
function computeVerdict(
  bullCase: AnalystOutput,
  bearCase: AnalystOutput,
  riskAnalysis: AnalystOutput,
  riskFlags: RiskFlag[],
): MacroVerdict {
  const strengthScore = (s: AnalystOutput["strength"]) => {
    if (s === "strong") return 100;
    if (s === "moderate") return 60;
    if (s === "weak") return 30;
    return 0; // insufficient
  };

  const bullScore = strengthScore(bullCase.strength);
  const bearScore = strengthScore(bearCase.strength);
  const highRiskCount = riskFlags.filter((f) => f.severity === "high").length;

  let signal: VerdictSignal;
  let label: string;
  let summary: string;

  if (bullScore === 0 && bearScore === 0) {
    signal = "insufficient_evidence";
    label = "Không đủ bằng chứng";
    summary =
      "Không có observation đủ điều kiện để tranh luận. Chờ dữ liệu có nguồn actual + verified.";
  } else if (highRiskCount >= 2 || (highRiskCount >= 1 && bearScore > bullScore)) {
    signal = "prediction_contested";
    label = "Dự đoán bị phản biện";
    summary = `Luận điểm phản biện (${bearCase.strength}) kết hợp ${highRiskCount} high-risk flag outweigh bằng chứng hỗ trợ (${bullCase.strength}).`;
  } else if (bullScore >= 60 && bearScore <= 30) {
    signal = "prediction_supported";
    label = "Dự đoán được hỗ trợ";
    summary = `Bằng chứng hỗ trợ (${bullCase.strength}) vượt trội phản biện (${bearCase.strength}). ${riskFlags.length} risk flag cần theo dõi.`;
  } else if (bullScore >= bearScore) {
    signal = "prediction_uncertain";
    label = "Kết quả chưa chắc chắn";
    summary = `Bằng chứng hai chiều tương đối cân bằng (bull: ${bullCase.strength}, bear: ${bearCase.strength}). Cần thêm dữ liệu hoặc phân tích sâu hơn.`;
  } else {
    signal = "prediction_contested";
    label = "Dự đoán bị phản biện";
    summary = `Bằng chứng phản biện (${bearCase.strength}) nhiều hơn hỗ trợ (${bullCase.strength}).`;
  }

  return {
    signal,
    label,
    summary,
    bullStrength: bullScore,
    bearStrength: bearScore,
    riskCount: riskFlags.length,
    limitation:
      "Đây là Research Opinion tự động từ observation catalog — không phải dự báo kinh tế, không phải khuyến nghị đầu tư. Tham khảo analyst chuyên sâu trước khi ra quyết định.",
    boundary: "bounded-research-opinion",
  };
}

// ─── Fingerprint ──────────────────────────────────────────────────────────────

function debateFingerprint(
  indicatorId: string,
  prediction: DebatePrediction,
  runAt: string,
): string {
  const input = `${indicatorId}|${prediction.value}|${prediction.horizon}|${prediction.source}|${runAt.slice(0, 16)}`;
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

// ─── Main API ─────────────────────────────────────────────────────────────────

/**
 * Run a full multi-agent macro debate for an indicator prediction.
 *
 * @param indicator - The primary indicator being debated
 * @param prediction - The prediction to evaluate (value, horizon, source)
 * @param allIndicators - All available indicators (for relationship lookups)
 * @returns A DebateSession with Bull/Bear/Risk analysis and a final verdict
 *
 * @example
 * const session = runMacroDebate(cpiIndicator, {
 *   value: 3.2,
 *   horizon: "next month",
 *   source: "IMF Consensus",
 *   impliedDirection: "lower",
 * }, allIndicators);
 */
export function runMacroDebate(
  indicator: Indicator,
  prediction: DebatePrediction,
  allIndicators: Indicator[],
): DebateSession {
  const runAt = new Date().toISOString();
  const id = `debate-${indicator.id}-${debateFingerprint(indicator.id, prediction, runAt)}`;

  // Build related indicator map
  const relatedIds = new Set(indicator.relationships.map((r) => r.indicatorId));
  const relatedIndicators = new Map<string, Indicator>(
    allIndicators
      .filter((i) => relatedIds.has(i.id))
      .map((i) => [i.id, i]),
  );

  const eligibleIndicatorIds = [indicator.id, ...relatedIndicators.keys()].filter(
    (id) => {
      const ind = id === indicator.id ? indicator : relatedIndicators.get(id);
      return ind ? isCurrentSourceBackedIndicator(ind) : false;
    },
  );

  // Run all three analysts (mirrors TradingAgents agent pipeline)
  const riskFlags = detectRiskFlags(indicator, relatedIndicators, prediction);
  const bullCase = runBullAnalyst(indicator, prediction, relatedIndicators);
  const bearCase = runBearAnalyst(indicator, prediction, relatedIndicators);
  const riskAnalysis = runRiskAnalyst(indicator, prediction, relatedIndicators, riskFlags);

  // Verdict Engine (mirrors TradingAgents Research Manager)
  const verdict = computeVerdict(bullCase, bearCase, riskAnalysis, riskFlags);

  return {
    id,
    indicatorId: indicator.id,
    indicatorName: indicator.name,
    prediction,
    currentSnapshot: {
      value: indicator.snapshot.value,
      date: indicator.snapshot.date,
      unit: indicator.unit,
    },
    bullCase,
    bearCase,
    riskAnalysis,
    riskFlags,
    verdict,
    debateRounds: 1, // Phase 1 is single-pass; Phase 2 will add multi-round LLM debate
    eligibleIndicatorIds,
    runAt,
    fingerprint: debateFingerprint(indicator.id, prediction, runAt),
  };
}

/**
 * Infer a prediction from the latest consensus forecast for an indicator.
 * Bridges between ForecastCenter forecasts and the debate engine.
 */
export function inferPredictionFromForecast(
  forecastValue: number,
  currentValue: number,
  horizon: string,
  source: string,
): DebatePrediction {
  let impliedDirection: DebatePrediction["impliedDirection"];
  const diff = forecastValue - currentValue;
  const diffPct = Math.abs(diff / Math.abs(currentValue || 1)) * 100;
  if (diffPct < 0.5) {
    impliedDirection = "flat";
  } else if (diff > 0) {
    impliedDirection = "higher";
  } else {
    impliedDirection = "lower";
  }
  return { value: forecastValue, horizon, source, impliedDirection };
}

/**
 * Check if a debate session has sufficient evidence to be meaningful.
 */
export function hasDebateEvidence(session: DebateSession): boolean {
  return (
    session.bullCase.strength !== "insufficient" ||
    session.bearCase.strength !== "insufficient"
  );
}
