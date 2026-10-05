/**
 * Dynamic Wavelet Transform & Frequency-Domain Macro Comovement Engine
 *
 * Strict Compliance:
 * - Macro OS Product Goal & Scope Guardrails: Macroeconomic research & data intelligence.
 * - Product Truth & Evidence: Separates empirical observed facts (aligned sample,
 *   wavelet energy decomposition, band-specific Pearson correlations, empirical p-values)
 *  */

import type { TimeSeriesPoint } from "./crossCountryLeadLag.js";



export interface WaveletScaleBand {
  scaleLevel: number;
  label: string;
  periodMonthsRange: string;
  cycleClassification: "high_frequency_noise" | "short_run_fluctuation" | "business_cycle" | "intermediate_cycle" | "long_run_trend";
  seriesAEnergyPct: number;
  seriesBEnergyPct: number;
  bandCorrelation: number;
  pValue: number;
  tStat: number;
  isStatisticallySignificant: boolean;
  leadLagOffsetMonths: number; // Positive = Series A leads Series B at this frequency band
  comovementStrength: "strong_positive" | "moderate_positive" | "neutral" | "moderate_negative" | "strong_negative";
}

export interface WaveletFactVsInferenceEvidence {
  factualObservations: {
    alignedObservationCount: number;
    dateRange: { start: string; end: string };
    rawContemporaneousCorrelation: number;
    highestComovementBand: string;
    peakBandCorrelation: number;
    seriesATotalVariance: number;
    seriesBTotalVariance: number;
    sourceACitation: string;
    sourceBCitation: string;
  };
  analyticalInferences: {
    dominantComovementHorizon: string;
    frequencyDecouplingDetected: boolean;
    frequencyDecouplingSummary: string;
    transmissionHypothesis: string;
    econometricLimitations: string[];
  };
}

export interface WaveletComovementReport {
  seriesAId: string;
  seriesAName: string;
  seriesBId: string;
  seriesBName: string;
  scaleBands: WaveletScaleBand[];
  evidence: WaveletFactVsInferenceEvidence;
  hasSufficientData: boolean;
  warningMessage?: string;
}

export interface CanonicalWaveletPreset {
  id: string;
  name: string;
  seriesAId: string;
  seriesBId: string;
  description: string;
  expectedComovementHorizon: string;
}

export const CANONICAL_WAVELET_PRESETS: CanonicalWaveletPreset[] = [
  {
    id: "preset-fed-funds-cpi",
    name: "Fed Funds Rate vs US CPI Inflation",
    seriesAId: "fed-funds-rate",
    seriesBId: "cpi-us",
    description: "Evaluates the Taylor-rule and Phillips transmission curve: noise at 1-3M, strong positive comovement at 2-5Y business cycle frequency.",
    expectedComovementHorizon: "Medium-run business cycle (24-60 months)",
  },
  {
    id: "preset-us10y-vn-interbank",
    name: "US 10Y Yield vs VN Interbank Rate",
    seriesAId: "us-10y-yield",
    seriesBId: "vn-interbank-rate",
    description: "Evaluates international monetary transmission from global benchmark rates to domestic liquidity across frequency horizons.",
    expectedComovementHorizon: "Intermediate to long-run cycle (16-64 months)",
  },
  {
    id: "preset-us10y-de10y",
    name: "US 10Y Treasury vs German 10Y Bund",
    seriesAId: "us-10y-yield",
    seriesBId: "de-10y-bund",
    description: "Transatlantic sovereign bond comovement across short-term term premia shocks vs secular global growth trends.",
    expectedComovementHorizon: "Classical business cycle and secular trend (>32 months)",
  },
  {
    id: "preset-gdp-m2",
    name: "Real GDP Growth vs Money Supply (M2)",
    seriesAId: "us-gdp",
    seriesBId: "us-m2",
    description: "Monetarist quantity theory comovement: weak high-frequency correlation, strong medium-run cyclical comovement.",
    expectedComovementHorizon: "Long-run structural trend (>48 months)",
  },
];

/**
 * Aligns two time series strictly by calendar date (YYYY-MM).
 */
export function alignTimeSeriesPairs(
  seriesA: TimeSeriesPoint[],
  seriesB: TimeSeriesPoint[]
): { alignedA: number[]; alignedB: number[]; dates: string[] } {
  if (!seriesA?.length || !seriesB?.length) {
    return { alignedA: [], alignedB: [], dates: [] };
  }

  const mapB = new Map<string, number>();
  for (const pt of seriesB) {
    if (pt.date && typeof pt.value === "number" && !isNaN(pt.value)) {
      const ym = pt.date.slice(0, 7);
      mapB.set(ym, pt.value);
    }
  }

  const dates: string[] = [];
  const alignedA: number[] = [];
  const alignedB: number[] = [];

  for (const pt of seriesA) {
    if (pt.date && typeof pt.value === "number" && !isNaN(pt.value)) {
      const ym = pt.date.slice(0, 7);
      const valB = mapB.get(ym);
      if (valB !== undefined) {
        dates.push(ym);
        alignedA.push(pt.value);
        alignedB.push(valB);
      }
    }
  }

  return { alignedA, alignedB, dates };
}

/**
 * Computes standard sample variance.
 */
export function calculateVariance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const sumSq = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0);
  return sumSq / (values.length - 1);
}

/**
 * Computes Pearson correlation coefficient between two numeric arrays.
 */
export function calculatePearsonCorrelation(x: number[], y: number[]): number {
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

  let numer = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numer += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denom = Math.sqrt(denomX * denomY);
  if (denom === 0) return 0;
  const r = numer / denom;
  return Math.max(-1, Math.min(1, r));
}

/**
 * Computes Student's t-statistic and approximate two-tailed p-value for correlation r.
 */
export function calculateCorrelationSignificance(r: number, n: number): { tStat: number; pValue: number } {
  if (n <= 2 || Math.abs(r) >= 1) {
    return { tStat: 0, pValue: Math.abs(r) >= 1 ? 0 : 1 };
  }
  const tStat = r * Math.sqrt((n - 2) / (1 - r * r));
  const absT = Math.abs(tStat);
  const pValue = 2 * Math.exp(-0.5 * absT * absT) / (1 + Math.exp(-0.07056 * Math.pow(absT, 3)));
  return {
    tStat: Math.round(tStat * 1000) / 1000,
    pValue: Math.min(1, Math.max(0, Math.round(pValue * 10000) / 10000)),
  };
}

/**
 * Maximal Overlap Discrete Wavelet Transform (MODWT) decomposition using Haar wavelet.
 * Decomposes series into 4 detail scales (D1, D2, D3, D4) and 1 approximation smooth (A4).
 */
export function modwtHaarDecomposition(values: number[]): { details: number[][]; smooth: number[] } {
  const n = values.length;
  if (n === 0) {
    return { details: [[], [], [], []], smooth: [] };
  }

  const numScales = 4;
  const details: number[][] = [];
  let currentSmooth = [...values];

  for (let s = 1; s <= numScales; s++) {
    const scaleDetail: number[] = new Array(n).fill(0);
    const nextSmooth: number[] = new Array(n).fill(0);
    const step = Math.pow(2, s - 1);

    for (let t = 0; t < n; t++) {
      const pastIdx = t - step;
      const prevVal = pastIdx >= 0 ? currentSmooth[pastIdx] : currentSmooth[0];
      const currVal = currentSmooth[t];

      // Haar high-pass filter: (x_t - x_{t-2^{s-1}}) / sqrt(2)
      scaleDetail[t] = (currVal - prevVal) / Math.SQRT2;
      // Haar low-pass filter: (x_t + x_{t-2^{s-1}}) / sqrt(2)
      nextSmooth[t] = (currVal + prevVal) / Math.SQRT2;
    }

    details.push(scaleDetail);
    currentSmooth = nextSmooth;
  }

  return { details, smooth: currentSmooth };
}

/**
 * Computes cross-correlation of wavelet detail series across lags to estimate lead/lag offset.
 */
function computeWaveletLeadLagOffset(detailA: number[], detailB: number[], maxLag = 6): number {
  let peakCorr = -1;
  let optimalLag = 0;
  const n = detailA.length;

  for (let lag = -maxLag; lag <= maxLag; lag++) {
    const sliceA: number[] = [];
    const sliceB: number[] = [];

    for (let t = 0; t < n; t++) {
      const targetB = t + lag;
      if (targetB >= 0 && targetB < n) {
        sliceA.push(detailA[t]);
        sliceB.push(detailB[targetB]);
      }
    }

    if (sliceA.length >= 10) {
      const r = Math.abs(calculatePearsonCorrelation(sliceA, sliceB));
      if (r > peakCorr) {
        peakCorr = r;
        optimalLag = lag;
      }
    }
  }

  return optimalLag;
}

/**
 * Categorizes correlation strength.
 */
function classifyComovement(r: number): WaveletScaleBand["comovementStrength"] {
  if (r >= 0.6) return "strong_positive";
  if (r >= 0.25) return "moderate_positive";
  if (r <= -0.6) return "strong_negative";
  if (r <= -0.25) return "moderate_negative";
  return "neutral";
}

/**
 * Performs complete Dynamic Wavelet Transform & Frequency-Domain Macro Comovement Analysis.
 */
export function analyzeMacroWaveletComovement(
  seriesAInput: { id: string; name: string; series: TimeSeriesPoint[] },
  seriesBInput: { id: string; name: string; series: TimeSeriesPoint[] },
  options: {
    sourceACitation?: string;
    sourceBCitation?: string;
  } = {}
): WaveletComovementReport {
  const { alignedA, alignedB, dates } = alignTimeSeriesPairs(
    seriesAInput.series,
    seriesBInput.series
  );

  const n = alignedA.length;
  if (n < 16) {
    return {
      seriesAId: seriesAInput.id,
      seriesAName: seriesAInput.name,
      seriesBId: seriesBInput.id,
      seriesBName: seriesBInput.name,
      scaleBands: [],
      hasSufficientData: false,
      warningMessage: `Insufficient aligned monthly observations (${n} points). Minimum 16 aligned monthly observations required for dyadic wavelet decomposition.`,
      evidence: {
        factualObservations: {
          alignedObservationCount: n,
          dateRange: { start: dates[0] || "N/A", end: dates[dates.length - 1] || "N/A" },
          rawContemporaneousCorrelation: 0,
          highestComovementBand: "None",
          peakBandCorrelation: 0,
          seriesATotalVariance: 0,
          seriesBTotalVariance: 0,
          sourceACitation: options.sourceACitation || seriesAInput.id,
          sourceBCitation: options.sourceBCitation || seriesBInput.id,
        },
        analyticalInferences: {
          dominantComovementHorizon: "Inconclusive due to short sample",
          frequencyDecouplingDetected: false,
          frequencyDecouplingSummary: "Data sample too short to verify multi-scale frequency comovement.",
          transmissionHypothesis: "Pending data hydration.",
          econometricLimitations: ["Sample size below minimum dyadic threshold."],
        },
      },
    };
  }

  // Raw contemporaneous correlation
  const rawCorr = calculatePearsonCorrelation(alignedA, alignedB);
  const varA = calculateVariance(alignedA);
  const varB = calculateVariance(alignedB);

  // MODWT Decomposition
  const decompA = modwtHaarDecomposition(alignedA);
  const decompB = modwtHaarDecomposition(alignedB);

  // Compute energy for series A and B
  const energyA: number[] = decompA.details.map((d) => d.reduce((sum, v) => sum + v * v, 0));
  const smoothEnergyA = decompA.smooth.reduce((sum, v) => sum + v * v, 0);
  const totalEnergyA = energyA.reduce((s, e) => s + e, 0) + smoothEnergyA || 1;

  const energyB: number[] = decompB.details.map((d) => d.reduce((sum, v) => sum + v * v, 0));
  const smoothEnergyB = decompB.smooth.reduce((sum, v) => sum + v * v, 0);
  const totalEnergyB = energyB.reduce((s, e) => s + e, 0) + smoothEnergyB || 1;

  const bandConfigs: Array<{
    scaleLevel: number;
    label: string;
    periodMonthsRange: string;
    cycleClassification: WaveletScaleBand["cycleClassification"];
  }> = [
    { scaleLevel: 1, label: "Scale D1 (High-Freq Noise)", periodMonthsRange: "2–4 Months", cycleClassification: "high_frequency_noise" },
    { scaleLevel: 2, label: "Scale D2 (Short Fluctuations)", periodMonthsRange: "4–8 Months", cycleClassification: "short_run_fluctuation" },
    { scaleLevel: 3, label: "Scale D3 (Short Business Cycle)", periodMonthsRange: "8–16 Months", cycleClassification: "business_cycle" },
    { scaleLevel: 4, label: "Scale D4 (Intermediate Cycle)", periodMonthsRange: "16–32 Months", cycleClassification: "intermediate_cycle" },
    { scaleLevel: 5, label: "Scale A4 (Long-Run Secular Trend)", periodMonthsRange: ">32 Months", cycleClassification: "long_run_trend" },
  ];

  const scaleBands: WaveletScaleBand[] = [];

  // Detail bands D1..D4
  for (let i = 0; i < 4; i++) {
    const dA = decompA.details[i];
    const dB = decompB.details[i];
    const r = calculatePearsonCorrelation(dA, dB);
    const { tStat, pValue } = calculateCorrelationSignificance(r, n);
    const lagOffset = computeWaveletLeadLagOffset(dA, dB, 6);

    scaleBands.push({
      scaleLevel: bandConfigs[i].scaleLevel,
      label: bandConfigs[i].label,
      periodMonthsRange: bandConfigs[i].periodMonthsRange,
      cycleClassification: bandConfigs[i].cycleClassification,
      seriesAEnergyPct: Math.round((energyA[i] / totalEnergyA) * 1000) / 10,
      seriesBEnergyPct: Math.round((energyB[i] / totalEnergyB) * 1000) / 10,
      bandCorrelation: Math.round(r * 1000) / 1000,
      pValue,
      tStat,
      isStatisticallySignificant: pValue < 0.05,
      leadLagOffsetMonths: lagOffset,
      comovementStrength: classifyComovement(r),
    });
  }

  // Smooth approximation A4
  const rSmooth = calculatePearsonCorrelation(decompA.smooth, decompB.smooth);
  const { tStat: tSmooth, pValue: pSmooth } = calculateCorrelationSignificance(rSmooth, n);
  const lagOffsetSmooth = computeWaveletLeadLagOffset(decompA.smooth, decompB.smooth, 6);

  scaleBands.push({
    scaleLevel: bandConfigs[4].scaleLevel,
    label: bandConfigs[4].label,
    periodMonthsRange: bandConfigs[4].periodMonthsRange,
    cycleClassification: bandConfigs[4].cycleClassification,
    seriesAEnergyPct: Math.round((smoothEnergyA / totalEnergyA) * 1000) / 10,
    seriesBEnergyPct: Math.round((smoothEnergyB / totalEnergyB) * 1000) / 10,
    bandCorrelation: Math.round(rSmooth * 1000) / 1000,
    pValue: pSmooth,
    tStat: tSmooth,
    isStatisticallySignificant: pSmooth < 0.05,
    leadLagOffsetMonths: lagOffsetSmooth,
    comovementStrength: classifyComovement(rSmooth),
  });

  // Identify peak comovement band
  let highestBand = scaleBands[0];
  for (const b of scaleBands) {
    if (Math.abs(b.bandCorrelation) > Math.abs(highestBand.bandCorrelation)) {
      highestBand = b;
    }
  }

  // Frequency decoupling detection:
  const noiseCorr = Math.abs(scaleBands[0].bandCorrelation);
  const cycleCorr = Math.max(Math.abs(scaleBands[3].bandCorrelation), Math.abs(scaleBands[4].bandCorrelation));
  const frequencyDecouplingDetected = noiseCorr < 0.3 && cycleCorr >= 0.45;

  let decouplingSummary = "No frequency decoupling detected; comovement is relatively uniform across frequencies.";
  if (frequencyDecouplingDetected) {
    decouplingSummary = `Frequency decoupling verified: Low correlation (|r| = ${noiseCorr.toFixed(2)}) at high-frequency noise scale (2–4M), but strong comovement (|r| = ${cycleCorr.toFixed(2)}) at macroeconomic cycle and secular scales (>16M).`;
  }

  // Analytical inference hypothesis
  const dominantHorizon = `${highestBand.label} (${highestBand.periodMonthsRange})`;
  let transmissionHypothesis = `Peak macroeconomic comovement is concentrated at ${highestBand.label} with r = ${highestBand.bandCorrelation.toFixed(3)}.`;
  if (highestBand.scaleLevel <= 2) {
    transmissionHypothesis += " Short-term market sentiment or headline surprises dominate relationship.";
  } else if (highestBand.scaleLevel <= 4) {
    transmissionHypothesis += " Medium-run business cycle transmission channel is dominant; monetary and business cyclical alignment drives co-movement.";
  } else {
    transmissionHypothesis += " Structural secular trends and long-run macroeconomic equilibrium drive the relationship.";
  }

  return {
    seriesAId: seriesAInput.id,
    seriesAName: seriesAInput.name,
    seriesBId: seriesBInput.id,
    seriesBName: seriesBInput.name,
    scaleBands,
    hasSufficientData: true,
    evidence: {
      factualObservations: {
        alignedObservationCount: n,
        dateRange: { start: dates[0], end: dates[dates.length - 1] },
        rawContemporaneousCorrelation: Math.round(rawCorr * 1000) / 1000,
        highestComovementBand: highestBand.label,
        peakBandCorrelation: highestBand.bandCorrelation,
        seriesATotalVariance: Math.round(varA * 1000) / 1000,
        seriesBTotalVariance: Math.round(varB * 1000) / 1000,
        sourceACitation: options.sourceACitation || seriesAInput.id,
        sourceBCitation: options.sourceBCitation || seriesBInput.id,
      },
      analyticalInferences: {
        dominantComovementHorizon: dominantHorizon,
        frequencyDecouplingDetected,
        frequencyDecouplingSummary: decouplingSummary,
        transmissionHypothesis,
        econometricLimitations: [
          "Haar wavelet filters exhibit sharp time localization but step-like frequency leakage.",
          "Boundary condition padding assumes continuous extension at the earliest sample periods.",
          "Frequency-band correlation does not guarantee causal structural transmission; common exogenous shocks may drive co-movement.",
        ],
      },
    },
  };
}
