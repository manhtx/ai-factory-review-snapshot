/**
 * Cross-Country Macro Lead-Lag Relationship & Dynamic Rolling Correlation Engine
 *
 * Strict Compliance:
 * - Macro OS Product Goal & Scope Guardrails: Macroeconomic research & data intelligence.
 * - Product Truth & Evidence: Distinguishes empirical observed facts (aligned sample,
 *   cross-correlation coefficients, rolling window metrics) from analytical inferences
 *   (directional lead/lag hypotheses, regime stability, transmission channel interpretations).
 */

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

export interface CrossCorrelationLagPoint {
  lag: number; // Positive = Series A leads Series B by `lag` periods; Negative = Series B leads Series A
  correlation: number;
  sampleSize: number;
  pValue: number;
  isOptimal: boolean;
}

export interface RollingCorrelationPoint {
  date: string;
  correlation: number;
  sampleSize: number;
  regime: "strong_positive" | "moderate_positive" | "uncorrelated" | "moderate_negative" | "strong_negative";
}

export type LeadLagDirection = "A_LEADS_B" | "B_LEADS_A" | "CONTEMPORANEOUS" | "INCONCLUSIVE";

export interface FactVsInferenceEvidence {
  factualObservations: {
    alignedObservationCount: number;
    dateRange: { start: string; end: string };
    contemporaneousCorrelation: number;
    peakCorrelation: number;
    optimalLagMonths: number;
    rollingCorrelationStats: {
      mean: number;
      min: number;
      max: number;
      stdDev: number;
    };
    sourceACitation: string;
    sourceBCitation: string;
  };
  analyticalInferences: {
    directionalHypothesis: string;
    transmissionChannel: string;
    regimeStabilityAssessment: "stable_coupling" | "regime_dependent" | "decoupled" | "inconclusive";
    econometricLimitations: string[];
  };
}

export interface LeadLagAnalysisReport {
  seriesAId: string;
  seriesAName: string;
  seriesBId: string;
  seriesBName: string;
  maxLagTested: number;
  rollingWindowSize: number;
  contemporaneousCorrelation: number;
  optimalLag: number;
  peakCorrelation: number;
  direction: LeadLagDirection;
  statisticalConfidence: "high" | "moderate" | "low" | "none";
  crossCorrelationCurve: CrossCorrelationLagPoint[];
  rollingCorrelationTimeline: RollingCorrelationPoint[];
  evidence: FactVsInferenceEvidence;
  analyzedAt: string;
}

export interface LeadLagOptions {
  maxLag?: number; // Maximum lag/lead offset to test in periods/months (default: 12)
  rollingWindow?: number; // Window size for rolling correlation (default: 12)
  sourceACitation?: string;
  sourceBCitation?: string;
  transmissionNarrative?: string;
}

/**
 * Aligns two time series on matching dates (inner join on date string).
 * Assumes chronological ordering.
 */
export function alignSeriesByDate(
  seriesA: TimeSeriesPoint[],
  seriesB: TimeSeriesPoint[]
): Array<{ date: string; a: number; b: number }> {
  if (!seriesA || !seriesB || seriesA.length === 0 || seriesB.length === 0) {
    return [];
  }

  const mapB = new Map<string, number>();
  for (const pt of seriesB) {
    if (Number.isFinite(pt.value)) {
      mapB.set(pt.date, pt.value);
    }
  }

  const aligned: Array<{ date: string; a: number; b: number }> = [];
  for (const pt of seriesA) {
    if (Number.isFinite(pt.value) && mapB.has(pt.date)) {
      aligned.push({
        date: pt.date,
        a: pt.value,
        b: mapB.get(pt.date)!,
      });
    }
  }

  aligned.sort((x, y) => x.date.localeCompare(y.date));
  return aligned;
}

/**
 * Computes standard Pearson correlation between two number vectors.
 */
export function computePearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;

  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let numerator = 0;
  let varX = 0;
  let varY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }

  const denominator = Math.sqrt(varX * varY);
  if (denominator === 0 || !Number.isFinite(denominator)) return 0;

  const r = numerator / denominator;
  return Math.max(-1, Math.min(1, r));
}

/**
 * Computes conservative two-tailed p-value for correlation r with sample size n.
 */
export function computeCorrelationPValue(r: number, n: number): number {
  if (!Number.isFinite(r) || n < 4 || Math.abs(r) >= 1) {
    return Math.abs(r) >= 1 ? 0.0001 : 1.0;
  }
  const t = Math.abs(r) * Math.sqrt((n - 2) / Math.max(1e-9, 1 - r * r));
  // Conservative approximation of Student's t distribution tail
  const p = Math.exp(-0.717 * t - 0.416 * t * t);
  return Math.min(1, Math.max(0, p));
}

/**
 * Calculates Cross-Correlation Function (CCF) across lags [-maxLag, +maxLag].
 * Lag k > 0 means Series A at time t is compared with Series B at time t + k (Series A leads Series B).
 * Lag k < 0 means Series A at time t is compared with Series B at time t - |k| (Series B leads Series A).
 */
export function computeCrossCorrelationCurve(
  aligned: Array<{ date: string; a: number; b: number }>,
  maxLag = 12
): CrossCorrelationLagPoint[] {
  const n = aligned.length;
  if (n < 5) return [];

  const results: CrossCorrelationLagPoint[] = [];
  const effectiveMaxLag = Math.min(maxLag, Math.floor(n / 3));

  let maxAbsR = -1;
  let bestLagIndex = -1;

  for (let lag = -effectiveMaxLag; lag <= effectiveMaxLag; lag++) {
    let vecA: number[];
    let vecB: number[];

    if (lag > 0) {
      // A leads B: A[0 ... n - 1 - lag] vs B[lag ... n - 1]
      vecA = aligned.slice(0, n - lag).map((p) => p.a);
      vecB = aligned.slice(lag, n).map((p) => p.b);
    } else if (lag < 0) {
      // B leads A: A[-lag ... n - 1] vs B[0 ... n - 1 + lag]
      const absLag = Math.abs(lag);
      vecA = aligned.slice(absLag, n).map((p) => p.a);
      vecB = aligned.slice(0, n - absLag).map((p) => p.b);
    } else {
      vecA = aligned.map((p) => p.a);
      vecB = aligned.map((p) => p.b);
    }

    const count = vecA.length;
    const r = computePearsonCorrelation(vecA, vecB);
    const pValue = computeCorrelationPValue(r, count);

    results.push({
      lag,
      correlation: Number(r.toFixed(4)),
      sampleSize: count,
      pValue: Number(pValue.toFixed(4)),
      isOptimal: false,
    });

    if (Math.abs(r) > maxAbsR) {
      maxAbsR = Math.abs(r);
      bestLagIndex = results.length - 1;
    }
  }

  if (bestLagIndex >= 0 && results[bestLagIndex]) {
    results[bestLagIndex].isOptimal = true;
  }

  return results;
}

/**
 * Computes rolling correlation across a sliding window of size W.
 */
export function computeRollingCorrelationTimeline(
  aligned: Array<{ date: string; a: number; b: number }>,
  windowSize = 12
): RollingCorrelationPoint[] {
  const n = aligned.length;
  if (n < windowSize || windowSize < 4) return [];

  const timeline: RollingCorrelationPoint[] = [];

  for (let i = windowSize - 1; i < n; i++) {
    const windowSlice = aligned.slice(i - windowSize + 1, i + 1);
    const xs = windowSlice.map((p) => p.a);
    const ys = windowSlice.map((p) => p.b);
    const r = computePearsonCorrelation(xs, ys);

    let regime: RollingCorrelationPoint["regime"] = "uncorrelated";
    if (r >= 0.6) regime = "strong_positive";
    else if (r >= 0.25) regime = "moderate_positive";
    else if (r <= -0.6) regime = "strong_negative";
    else if (r <= -0.25) regime = "moderate_negative";

    timeline.push({
      date: aligned[i].date,
      correlation: Number(r.toFixed(4)),
      sampleSize: windowSize,
      regime,
    });
  }

  return timeline;
}

/**
 * Comprehensive cross-country lead-lag analysis engine.
 */
export function analyzeCrossCountryLeadLag(
  seriesA: { id: string; name: string; series: TimeSeriesPoint[] },
  seriesB: { id: string; name: string; series: TimeSeriesPoint[] },
  options: LeadLagOptions = {}
): LeadLagAnalysisReport {
  const maxLag = options.maxLag ?? 12;
  const rollingWindow = options.rollingWindow ?? 12;

  const aligned = alignSeriesByDate(seriesA.series, seriesB.series);
  const now = new Date().toISOString();

  // Edge case: insufficient overlap
  if (aligned.length < 6) {
    return {
      seriesAId: seriesA.id,
      seriesAName: seriesA.name,
      seriesBId: seriesB.id,
      seriesBName: seriesB.name,
      maxLagTested: maxLag,
      rollingWindowSize: rollingWindow,
      contemporaneousCorrelation: 0,
      optimalLag: 0,
      peakCorrelation: 0,
      direction: "INCONCLUSIVE",
      statisticalConfidence: "none",
      crossCorrelationCurve: [],
      rollingCorrelationTimeline: [],
      evidence: {
        factualObservations: {
          alignedObservationCount: aligned.length,
          dateRange: {
            start: aligned[0]?.date ?? "N/A",
            end: aligned[aligned.length - 1]?.date ?? "N/A",
          },
          contemporaneousCorrelation: 0,
          peakCorrelation: 0,
          optimalLagMonths: 0,
          rollingCorrelationStats: { mean: 0, min: 0, max: 0, stdDev: 0 },
          sourceACitation: options.sourceACitation ?? "Official Provider / Central Bank",
          sourceBCitation: options.sourceBCitation ?? "Official Provider / Central Bank",
        },
        analyticalInferences: {
          directionalHypothesis: "Insufficient overlapping historical data points (< 6 observations) to establish lead-lag relationship.",
          transmissionChannel: "Transmission relationship unobservable due to lack of historical series overlap.",
          regimeStabilityAssessment: "inconclusive",
          econometricLimitations: [
            "Sample size is too small for statistical cross-correlation inference.",
            "Requires at least 12 synchronized monthly periods for robust lead-lag identification.",
          ],
        },
      },
      analyzedAt: now,
    };
  }

  const contemporaneous = computePearsonCorrelation(
    aligned.map((p) => p.a),
    aligned.map((p) => p.b)
  );

  const curve = computeCrossCorrelationCurve(aligned, maxLag);
  const rolling = computeRollingCorrelationTimeline(aligned, rollingWindow);

  const optimalPoint = curve.find((p) => p.isOptimal) ?? {
    lag: 0,
    correlation: contemporaneous,
    sampleSize: aligned.length,
    pValue: computeCorrelationPValue(contemporaneous, aligned.length),
    isOptimal: true,
  };

  const optimalLag = optimalPoint.lag;
  const peakR = optimalPoint.correlation;

  // Determine Direction
  const direction: LeadLagDirection = Math.abs(peakR) < 0.25 ? "INCONCLUSIVE" : optimalLag > 0 ? "A_LEADS_B" : optimalLag < 0 ? "B_LEADS_A" : "CONTEMPORANEOUS";

  // Statistical Confidence
  let statisticalConfidence: LeadLagAnalysisReport["statisticalConfidence"] = "low";
  if (aligned.length >= 24 && Math.abs(peakR) >= 0.6 && optimalPoint.pValue < 0.01) {
    statisticalConfidence = "high";
  } else if (aligned.length >= 12 && Math.abs(peakR) >= 0.4 && optimalPoint.pValue < 0.05) {
    statisticalConfidence = "moderate";
  } else if (Math.abs(peakR) < 0.25) {
    statisticalConfidence = "none";
  }

  // Rolling stats
  const rollingCorrs = rolling.map((r) => r.correlation);
  let rollingMean = 0;
  let rollingMin = 0;
  let rollingMax = 0;
  let rollingStdDev = 0;

  if (rollingCorrs.length > 0) {
    rollingMean = rollingCorrs.reduce((a, b) => a + b, 0) / rollingCorrs.length;
    rollingMin = Math.min(...rollingCorrs);
    rollingMax = Math.max(...rollingCorrs);
    const variance =
      rollingCorrs.reduce((sum, v) => sum + Math.pow(v - rollingMean, 2), 0) /
      rollingCorrs.length;
    rollingStdDev = Math.sqrt(variance);
  }

  // Regime stability assessment
  let regimeStabilityAssessment: FactVsInferenceEvidence["analyticalInferences"]["regimeStabilityAssessment"] = "inconclusive";
  if (rollingStdDev < 0.25 && Math.abs(rollingMean) >= 0.5) {
    regimeStabilityAssessment = "stable_coupling";
  } else if (rollingStdDev >= 0.35 || (rollingMin < 0 && rollingMax > 0.4)) {
    regimeStabilityAssessment = "regime_dependent";
  } else if (Math.abs(rollingMean) < 0.25) {
    regimeStabilityAssessment = "decoupled";
  }

  // Directional hypothesis narrative
  const directionalHypothesis = direction === "A_LEADS_B"
    ? `Empirical evidence indicates that ${seriesA.name} leads ${seriesB.name} by approximately ${optimalLag} period(s) (Peak r = ${peakR.toFixed(2)}, p = ${optimalPoint.pValue}).`
    : direction === "B_LEADS_A"
      ? `Empirical evidence indicates that ${seriesB.name} leads ${seriesA.name} by approximately ${Math.abs(optimalLag)} period(s) (Peak r = ${peakR.toFixed(2)}, p = ${optimalPoint.pValue}).`
      : direction === "CONTEMPORANEOUS"
        ? `${seriesA.name} and ${seriesB.name} exhibit contemporaneous co-movement (Peak r = ${peakR.toFixed(2)} at Lag 0). No significant transmission lead/lag observed.`
        : `No statistically meaningful lead-lag or co-movement detected between ${seriesA.name} and ${seriesB.name} (|r| < 0.25).`;

  const transmissionChannel =
    options.transmissionNarrative ??
    (direction === "A_LEADS_B"
      ? `Cross-border policy & market transmission: Changes in ${seriesA.name} transmit to domestic conditions in ${seriesB.name} through capital flows, yield differentials, and terms-of-trade adjustments over ${optimalLag} month(s).`
      : direction === "B_LEADS_A"
      ? `Changes in ${seriesB.name} precede movements in ${seriesA.name} by ${Math.abs(optimalLag)} month(s), suggesting leading indicator dynamics or anticipatory market repricing.`
      : `Synchronized market reaction or shared global macro common factor driving both series concurrently.`);

  return {
    seriesAId: seriesA.id,
    seriesAName: seriesA.name,
    seriesBId: seriesB.id,
    seriesBName: seriesB.name,
    maxLagTested: maxLag,
    rollingWindowSize: rollingWindow,
    contemporaneousCorrelation: Number(contemporaneous.toFixed(4)),
    optimalLag,
    peakCorrelation: Number(peakR.toFixed(4)),
    direction,
    statisticalConfidence,
    crossCorrelationCurve: curve,
    rollingCorrelationTimeline: rolling,
    evidence: {
      factualObservations: {
        alignedObservationCount: aligned.length,
        dateRange: {
          start: aligned[0].date,
          end: aligned[aligned.length - 1].date,
        },
        contemporaneousCorrelation: Number(contemporaneous.toFixed(4)),
        peakCorrelation: Number(peakR.toFixed(4)),
        optimalLagMonths: optimalLag,
        rollingCorrelationStats: {
          mean: Number(rollingMean.toFixed(4)),
          min: Number(rollingMin.toFixed(4)),
          max: Number(rollingMax.toFixed(4)),
          stdDev: Number(rollingStdDev.toFixed(4)),
        },
        sourceACitation: options.sourceACitation ?? "Official Provider / Central Bank",
        sourceBCitation: options.sourceBCitation ?? "Official Provider / Central Bank",
      },
      analyticalInferences: {
        directionalHypothesis,
        transmissionChannel,
        regimeStabilityAssessment,
        econometricLimitations: [
          "Cross-correlation does not establish strict causality; omitted third-variable macro shocks (e.g. global liquidity, commodity cycles) may drive both series.",
          "Non-stationarity or structural policy breaks can induce spurious correlation; analysis should be paired with economic fundamentals.",
          "Lead-lag relationships can vary dynamically across different macroeconomic regimes (e.g. tightening vs easing phases).",
        ],
      },
    },
    analyzedAt: now,
  };
}

/**
 * Curated Canonical Cross-Country Comparison Presets for Macro Research
 */
export const CANONICAL_LEAD_LAG_PRESETS = [
  {
    id: "us-10y-vs-vn-interbank",
    title: "US 10Y Treasury Yield vs VN Interbank Rate",
    seriesAId: "us10y-yield",
    seriesBId: "vn-interbank-rate",
    expectedLead: "US Leads VN by 1–3 months",
    channel: "Global dollar yield transmission to domestic money market liquidity and FX intervention pressure.",
  },
  {
    id: "fed-funds-vs-sbv-refinancing",
    title: "Fed Funds Policy Rate vs SBV Refinancing Rate",
    seriesAId: "fed-funds-rate",
    seriesBId: "sbv-refinancing-rate",
    expectedLead: "Fed Leads SBV by 2–4 months",
    channel: "Monetary policy divergence and capital flow management cycle.",
  },
  {
    id: "us-cpi-vs-vn-cpi",
    title: "US Consumer Price Index vs Vietnam CPI",
    seriesAId: "cpi-us",
    seriesBId: "cpi-vn",
    expectedLead: "US Leads VN by 3–6 months",
    channel: "Imported inflation transmission via global trade and dollar-denominated commodity prices.",
  },
  {
    id: "us10y-vs-de10y",
    title: "US 10Y Treasury Yield vs Germany 10Y Bund Yield",
    seriesAId: "us10y-yield",
    seriesBId: "de10y-yield",
    expectedLead: "Contemporaneous with US Lead on turning points",
    channel: "Transatlantic sovereign bond yield transmission and global term premium co-movement.",
  },
];
