import { deterministicFingerprint } from "./deterministicFingerprint";

export type MarkovRegimeKey =
  | "expansion"
  | "stagflation"
  | "policy_divergence"
  | "liquidity_stress";

export interface MarkovRegimeDef {
  key: MarkovRegimeKey;
  name: string;
  category: "growth" | "inflation" | "monetary" | "systemic";
  description: string;
  favorableAssets: string[];
  vulnerableAssets: string[];
  benchmarkWeightAllocation: Record<PortfolioAssetClassKey, number>;
}

export type PortfolioAssetClassKey =
  | "equities"
  | "sovereign_bonds"
  | "commodities"
  | "inflation_linked"
  | "cash_liquidity";

export interface PortfolioAssetClassDef {
  key: PortfolioAssetClassKey;
  name: string;
  benchmarkNeutralWeightPct: number;
  expectedAnnualReturnPct: number;
  annualizedVolPct: number;
}

export const PORTFOLIO_ASSET_CLASSES: Record<PortfolioAssetClassKey, PortfolioAssetClassDef> = {
  equities: {
    key: "equities",
    name: "Global Equities (Developed & Emerging)",
    benchmarkNeutralWeightPct: 40.0,
    expectedAnnualReturnPct: 8.5,
    annualizedVolPct: 16.0,
  },
  sovereign_bonds: {
    key: "sovereign_bonds",
    name: "Sovereign Duration & Benchmark Treasuries",
    benchmarkNeutralWeightPct: 25.0,
    expectedAnnualReturnPct: 4.2,
    annualizedVolPct: 8.5,
  },
  commodities: {
    key: "commodities",
    name: "Commodities, Metals & Energy",
    benchmarkNeutralWeightPct: 15.0,
    expectedAnnualReturnPct: 6.5,
    annualizedVolPct: 22.0,
  },
  inflation_linked: {
    key: "inflation_linked",
    name: "Inflation-Linked Bonds (TIPS)",
    benchmarkNeutralWeightPct: 10.0,
    expectedAnnualReturnPct: 4.8,
    annualizedVolPct: 7.0,
  },
  cash_liquidity: {
    key: "cash_liquidity",
    name: "Cash & Short-Term Interbank Liquidity",
    benchmarkNeutralWeightPct: 10.0,
    expectedAnnualReturnPct: 3.5,
    annualizedVolPct: 1.2,
  },
};

export const MARKOV_REGIMES: Record<MarkovRegimeKey, MarkovRegimeDef> = {
  expansion: {
    key: "expansion",
    name: "Risk-On Expansion / Soft Landing",
    category: "growth",
    description: "Broad macro expansion with moderate inflation and supportive corporate earnings.",
    favorableAssets: ["Global Equities", "High Yield Credit", "Emerging Market Equities"],
    vulnerableAssets: ["Cash / T-Bills", "Defensive Sovereign Duration"],
    benchmarkWeightAllocation: {
      equities: 50.0,
      sovereign_bonds: 20.0,
      commodities: 15.0,
      inflation_linked: 5.0,
      cash_liquidity: 10.0,
    },
  },
  stagflation: {
    key: "stagflation",
    name: "Stagflationary Supply Shock",
    category: "inflation",
    description: "Supply-chain driven cost pressures coupled with decelerating economic output.",
    favorableAssets: ["Energy & Commodities", "TIPS / Real Assets", "Cash"],
    vulnerableAssets: ["Long Duration Bonds", "High Growth / Multiple Equities"],
    benchmarkWeightAllocation: {
      equities: 15.0,
      sovereign_bonds: 10.0,
      commodities: 35.0,
      inflation_linked: 25.0,
      cash_liquidity: 15.0,
    },
  },
  policy_divergence: {
    key: "policy_divergence",
    name: "Policy Divergence & Rate Squeeze",
    category: "monetary",
    description: "Divergent central bank paths driving FX volatility and term premium repricing.",
    favorableAssets: ["USD Cash & Carry", "Short-Duration Fixed Income", "Precious Metals"],
    vulnerableAssets: ["EM Currencies", "Sovereign Long Duration"],
    benchmarkWeightAllocation: {
      equities: 25.0,
      sovereign_bonds: 25.0,
      commodities: 15.0,
      inflation_linked: 15.0,
      cash_liquidity: 20.0,
    },
  },
  liquidity_stress: {
    key: "liquidity_stress",
    name: "Systemic Liquidity Stress & Flight-to-Safety",
    category: "systemic",
    description: "Interbank funding stress, spike in cross-asset correlation, and collateral shortage.",
    favorableAssets: ["Ultra-Short Sovereign T-Bills", "Gold Spot", "USD Cash"],
    vulnerableAssets: ["Equities", "High Beta Credit", "Emerging Market Assets"],
    benchmarkWeightAllocation: {
      equities: 5.0,
      sovereign_bonds: 30.0,
      commodities: 10.0,
      inflation_linked: 15.0,
      cash_liquidity: 40.0,
    },
  },
};

export interface MacroRegimeInputs {
  currentRegime?: MarkovRegimeKey;
  yieldCurveSlopeBps?: number;
  inflationYoy?: number;
  creditSpreadBps?: number;
  equityMomentumPct?: number;
  fxVolatilityIndex?: number;
}

export interface HorizonTransitionForecast {
  horizonMonths: number;
  horizonLabel: string;
  probabilities: Record<MarkovRegimeKey, number>;
  mostLikelyRegime: MarkovRegimeKey;
  regimeEntropy: number;
}

export interface AssetAllocationTrade {
  assetClass: PortfolioAssetClassKey;
  assetName: string;
  currentWeightPct: number;
  targetWeightPct: number;
  tradeDeltaPct: number;
  action: "overweight" | "underweight" | "neutral";
  riskContributionPct: number;
}

export interface RegimeMarkovSnapshot {
  schema: "macro-os.regime-markov-snapshot";
  version: 1;
  snapshotId: string;
  executedAt: string;
  currentRegime: MarkovRegimeKey;
  transitionMatrix: {
    fromRegime: MarkovRegimeKey;
    toProbabilities: Record<MarkovRegimeKey, number>;
  }[];
  horizonForecasts: HorizonTransitionForecast[];
  stationaryDistribution: Record<MarkovRegimeKey, number>;
  portfolioRebalancing: {
    recommendedWeights: Record<PortfolioAssetClassKey, number>;
    trades: AssetAllocationTrade[];
    expectedAnnualizedReturnPct: number;
    expectedAnnualizedVolPct: number;
    expectedSharpeRatio: number;
    turnoverPct: number;
    topHedgingPrescriptions: string[];
  };
  lineageFingerprint: string;
  auditTrail: string[];
}

export function multiplySquareMatrices(A: number[][], B: number[][]): number[][] {
  const n = A.length;
  const C: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += A[i][k] * B[k][j];
      }
      C[i][j] = sum;
    }
  }
  return C;
}

export function matrixPower(A: number[][], p: number): number[][] {
  if (p <= 1) return A.map((r) => [...r]);
  let result = A.map((r) => [...r]);
  for (let step = 1; step < p; step++) {
    result = multiplySquareMatrices(result, A);
  }
  return result;
}

const REGIME_KEYS: MarkovRegimeKey[] = [
  "expansion",
  "stagflation",
  "policy_divergence",
  "liquidity_stress",
];

export function buildCalibratedTransitionMatrix(inputs: MacroRegimeInputs): number[][] {
  const slope = inputs.yieldCurveSlopeBps ?? 45;
  const inflation = inputs.inflationYoy ?? 3.2;
  const creditSpread = inputs.creditSpreadBps ?? 320;
  const eqMomentum = inputs.equityMomentumPct ?? 4.5;
  const fxVol = inputs.fxVolatilityIndex ?? 12.0;

  const baseMatrix: number[][] = [
    [0.82, 0.08, 0.07, 0.03],
    [0.06, 0.80, 0.10, 0.04],
    [0.10, 0.08, 0.76, 0.06],
    [0.15, 0.05, 0.10, 0.70],
  ];

  const matrix = baseMatrix.map((row) => [...row]);

  if (slope < 0 || inflation > 4.5) {
    matrix[0][1] += 0.08;
    matrix[0][2] += 0.06;
    matrix[0][0] -= 0.14;

    matrix[2][1] += 0.05;
    matrix[2][2] -= 0.05;
  }

  if (creditSpread > 450 || fxVol > 18.0) {
    matrix[0][3] += 0.07;
    matrix[0][0] -= 0.07;

    matrix[1][3] += 0.08;
    matrix[1][1] -= 0.08;

    matrix[2][3] += 0.10;
    matrix[2][2] -= 0.10;
  }

  if (eqMomentum > 10.0 && inflation < 3.0 && slope > 50) {
    matrix[0][0] += 0.05;
    matrix[0][1] -= 0.03;
    matrix[0][3] -= 0.02;

    matrix[2][0] += 0.08;
    matrix[2][2] -= 0.08;
  }

  for (let i = 0; i < 4; i++) {
    const rowSum = matrix[i].reduce((sum, v) => sum + Math.max(0.01, v), 0);
    for (let j = 0; j < 4; j++) {
      matrix[i][j] = Math.round((Math.max(0.01, matrix[i][j]) / rowSum) * 1000) / 1000;
    }
  }

  return matrix;
}

export function predictRegimeTransitionsAndRebalance(
  inputs: MacroRegimeInputs = {},
  currentPortfolioWeights?: Record<PortfolioAssetClassKey, number>,
  executedAt?: string
): RegimeMarkovSnapshot {
  const timestamp = executedAt ?? new Date().toISOString();
  const currentRegime = inputs.currentRegime ?? "expansion";
  const currentRegimeIdx = REGIME_KEYS.indexOf(currentRegime);

  const transitionMatrix = buildCalibratedTransitionMatrix(inputs);

  const horizons = [
    { months: 1, label: "1-Month Ahead (Tactical Horizon)" },
    { months: 3, label: "3-Month Ahead (Quarterly Outlook)" },
    { months: 6, label: "6-Month Ahead (Semi-Annual Cycle)" },
    { months: 12, label: "12-Month Ahead (Annual Regime Horizon)" },
  ];

  const horizonForecasts: HorizonTransitionForecast[] = horizons.map((h) => {
    const P_h = matrixPower(transitionMatrix, h.months);
    const row = P_h[currentRegimeIdx] || [0.25, 0.25, 0.25, 0.25];

    const sum = row.reduce((acc, v) => acc + v, 0);
    const probs: Record<MarkovRegimeKey, number> = {
      expansion: Math.round((row[0] / sum) * 1000) / 1000,
      stagflation: Math.round((row[1] / sum) * 1000) / 1000,
      policy_divergence: Math.round((row[2] / sum) * 1000) / 1000,
      liquidity_stress: Math.round((row[3] / sum) * 1000) / 1000,
    };

    let maxKey: MarkovRegimeKey = "expansion";
    let maxVal = -1;
    let entropy = 0;

    for (const key of REGIME_KEYS) {
      const p = probs[key];
      if (p > maxVal) {
        maxVal = p;
        maxKey = key;
      }
      if (p > 0) {
        entropy -= p * Math.log2(p);
      }
    }

    return {
      horizonMonths: h.months,
      horizonLabel: h.label,
      probabilities: probs,
      mostLikelyRegime: maxKey,
      regimeEntropy: Math.round(entropy * 1000) / 1000,
    };
  });

  const P_long = matrixPower(transitionMatrix, 100);
  const longRow = P_long[0];
  const longSum = longRow.reduce((s, v) => s + v, 0);
  const stationaryDistribution: Record<MarkovRegimeKey, number> = {
    expansion: Math.round((longRow[0] / longSum) * 1000) / 1000,
    stagflation: Math.round((longRow[1] / longSum) * 1000) / 1000,
    policy_divergence: Math.round((longRow[2] / longSum) * 1000) / 1000,
    liquidity_stress: Math.round((longRow[3] / longSum) * 1000) / 1000,
  };

  const forecastProbs = horizonForecasts[1].probabilities;
  const assetClassKeys: PortfolioAssetClassKey[] = [
    "equities",
    "sovereign_bonds",
    "commodities",
    "inflation_linked",
    "cash_liquidity",
  ];

  const recommendedWeights: Record<PortfolioAssetClassKey, number> = {
    equities: 0,
    sovereign_bonds: 0,
    commodities: 0,
    inflation_linked: 0,
    cash_liquidity: 0,
  };

  for (const assetKey of assetClassKeys) {
    let blended = 0;
    for (const regKey of REGIME_KEYS) {
      const regWeight = MARKOV_REGIMES[regKey].benchmarkWeightAllocation[assetKey];
      blended += forecastProbs[regKey] * regWeight;
    }
    recommendedWeights[assetKey] = Math.round(blended * 10) / 10;
  }

  const totalWeight = Object.values(recommendedWeights).reduce((a, b) => a + b, 0);
  if (totalWeight !== 100.0) {
    recommendedWeights.cash_liquidity =
      Math.round((recommendedWeights.cash_liquidity + (100.0 - totalWeight)) * 10) / 10;
  }

  const defaultCurrentWeights: Record<PortfolioAssetClassKey, number> = {
    equities: 40.0,
    sovereign_bonds: 25.0,
    commodities: 15.0,
    inflation_linked: 10.0,
    cash_liquidity: 10.0,
  };
  const currentWeights = currentPortfolioWeights ?? defaultCurrentWeights;

  let totalTurnover = 0;
  const trades: AssetAllocationTrade[] = assetClassKeys.map((assetKey) => {
    const cur = currentWeights[assetKey] ?? 0;
    const tgt = recommendedWeights[assetKey];
    const delta = Math.round((tgt - cur) * 10) / 10;
    totalTurnover += Math.abs(delta);

    const assetDef = PORTFOLIO_ASSET_CLASSES[assetKey];
    const riskContrib =
      Math.round(((tgt * assetDef.annualizedVolPct) / 100) * 10) / 10;

    let action: "overweight" | "underweight" | "neutral" = "neutral";
    if (delta > 1.0) action = "overweight";
    else if (delta < -1.0) action = "underweight";

    return {
      assetClass: assetKey,
      assetName: assetDef.name,
      currentWeightPct: cur,
      targetWeightPct: tgt,
      tradeDeltaPct: delta,
      action,
      riskContributionPct: riskContrib,
    };
  });

  const turnoverPct = Math.round((totalTurnover / 2.0) * 10) / 10;

  let expReturn = 0;
  let expVol = 0;
  for (const assetKey of assetClassKeys) {
    const w = recommendedWeights[assetKey] / 100.0;
    const def = PORTFOLIO_ASSET_CLASSES[assetKey];
    expReturn += w * def.expectedAnnualReturnPct;
    expVol += w * w * (def.annualizedVolPct * def.annualizedVolPct);
  }
  const annualizedVol = Math.sqrt(expVol) * 1.15;
  const riskFreeRate = 3.5;
  const expectedSharpe =
    annualizedVol > 0 ? Math.round(((expReturn - riskFreeRate) / annualizedVol) * 100) / 100 : 0;

  const topHedgingPrescriptions: string[] = [];
  if (forecastProbs.stagflation > 0.2) {
    topHedgingPrescriptions.push(
      "Overweight Energy Swaps & Broad Commodity Index to hedge cost-push margin compression."
    );
  }
  if (forecastProbs.liquidity_stress > 0.15) {
    topHedgingPrescriptions.push(
      "Increase allocation to Ultra-Short T-Bills and Gold Spot to protect against credit spread widening."
    );
  }
  if (forecastProbs.policy_divergence > 0.2) {
    topHedgingPrescriptions.push(
      "Short EM Sovereign Credit spreads and hold Long USD currency hedges."
    );
  }
  if (topHedgingPrescriptions.length === 0) {
    topHedgingPrescriptions.push(
      "Maintain growth equity core allocation with systematic rebalancing band filters."
    );
  }

  const lineageFingerprint = deterministicFingerprint({
    currentRegime,
    forecastProbs,
    recommendedWeights,
    turnoverPct,
    expectedSharpe,
    timestamp,
  });

  const auditTrail = [
    `Calibrated 4x4 Markov transition matrix with macro signals (Slope: ${inputs.yieldCurveSlopeBps ?? 45}bps, Inflation: ${inputs.inflationYoy ?? 3.2}%).`,
    `Computed discrete matrix power projections across 1, 3, 6, and 12-month horizons.`,
    `Derived steady-state stationary distribution and entropy convergence metrics.`,
    `Synthesized risk-budgeted multi-asset rebalancing allocation with ${turnoverPct}% turnover.`,
    `Generated deterministic cryptographic verification hash (${lineageFingerprint.slice(0, 16)}).`,
  ];

  return {
    schema: "macro-os.regime-markov-snapshot",
    version: 1,
    snapshotId: `markov-snap-${lineageFingerprint.slice(0, 12)}`,
    executedAt: timestamp,
    currentRegime,
    transitionMatrix: REGIME_KEYS.map((fromKey, i) => ({
      fromRegime: fromKey,
      toProbabilities: {
        expansion: transitionMatrix[i][0],
        stagflation: transitionMatrix[i][1],
        policy_divergence: transitionMatrix[i][2],
        liquidity_stress: transitionMatrix[i][3],
      },
    })),
    horizonForecasts,
    stationaryDistribution,
    portfolioRebalancing: {
      recommendedWeights,
      trades,
      expectedAnnualizedReturnPct: Math.round(expReturn * 10) / 10,
      expectedAnnualizedVolPct: Math.round(annualizedVol * 10) / 10,
      expectedSharpeRatio: expectedSharpe,
      turnoverPct,
      topHedgingPrescriptions,
    },
    lineageFingerprint,
    auditTrail,
  };
}

export function exportRegimeMarkovSnapshotToCSV(snapshot: RegimeMarkovSnapshot): string {
  const rows: string[] = [
    "Asset Class,Asset Name,Current Weight %,Target Weight %,Trade Delta %,Action,Risk Contribution %",
  ];

  for (const t of snapshot.portfolioRebalancing.trades) {
    rows.push(
      `"${t.assetClass}","${t.assetName}",${t.currentWeightPct.toFixed(1)},${t.targetWeightPct.toFixed(1)},${t.tradeDeltaPct.toFixed(1)},"${t.action}",${t.riskContributionPct.toFixed(1)}`
    );
  }

  return rows.join("\n");
}

export function exportRegimeMarkovSnapshotToMarkdown(
  snapshot: RegimeMarkovSnapshot
): string {
  const matrixRows = snapshot.transitionMatrix.map(
    (m) =>
      `| **${MARKOV_REGIMES[m.fromRegime].name}** | \`${(m.toProbabilities.expansion * 100).toFixed(1)}%\` | \`${(m.toProbabilities.stagflation * 100).toFixed(1)}%\` | \`${(m.toProbabilities.policy_divergence * 100).toFixed(1)}%\` | \`${(m.toProbabilities.liquidity_stress * 100).toFixed(1)}%\` |`
  );

  const forecastRows = snapshot.horizonForecasts.map(
    (f) =>
      `| **${f.horizonLabel}** | **${MARKOV_REGIMES[f.mostLikelyRegime].name}** | \`${(f.probabilities.expansion * 100).toFixed(1)}%\` | \`${(f.probabilities.stagflation * 100).toFixed(1)}%\` | \`${(f.probabilities.policy_divergence * 100).toFixed(1)}%\` | \`${(f.probabilities.liquidity_stress * 100).toFixed(1)}%\` | ${f.regimeEntropy} |`
  );

  const tradeRows = snapshot.portfolioRebalancing.trades.map(
    (t) =>
      `| ${t.assetName} | \`${t.currentWeightPct.toFixed(1)}%\` | **\`${t.targetWeightPct.toFixed(1)}%\`** | \`${t.tradeDeltaPct > 0 ? "+" : ""}${t.tradeDeltaPct.toFixed(1)}%\` | **${t.action.toUpperCase()}** | \`${t.riskContributionPct.toFixed(1)}%\` |`
  );

  return [
    `# Institutional Dynamic Regime Transition Markov Predictor & Rebalancing Dossier`,
    "",
    `**Snapshot ID:** \`${snapshot.snapshotId}\` | **Executed At:** \`${snapshot.executedAt}\``,
    `**Current Regime:** **${MARKOV_REGIMES[snapshot.currentRegime].name}**`,
    `**Cryptographic Verification Stamp:** \`${snapshot.lineageFingerprint}\``,
    `**Expected Portfolio Return:** \`${snapshot.portfolioRebalancing.expectedAnnualizedReturnPct}%\` | **Expected Volatility:** \`${snapshot.portfolioRebalancing.expectedAnnualizedVolPct}%\` | **Sharpe Ratio:** \`${snapshot.portfolioRebalancing.expectedSharpeRatio}\``,
    "",
    "## 1. Calibrated 1-Month Markov Transition Probability Matrix",
    "| Current State \\ Next State | Expansion | Stagflation | Policy Divergence | Liquidity Stress |",
    "| :--- | :--- | :--- | :--- | :--- |",
    ...matrixRows,
    "",
    "## 2. Multi-Horizon Forward Regime Projections",
    "| Forecast Horizon | Most Likely Regime | Expansion % | Stagflation % | Policy Div % | Liquidity Stress % | Entropy |",
    "| :--- | :--- | :--- | :--- | :--- | :--- | :--- |",
    ...forecastRows,
    "",
    "## 3. Multi-Asset Portfolio Rebalancing & Risk-Budgeting",
    "| Asset Class | Current Weight | Target Allocation | Rebalance Delta | Action | Risk Contrib |",
    "| :--- | :--- | :--- | :--- | :--- | :--- |",
    ...tradeRows,
    "",
    "## 4. Key Hedging Prescriptions",
    ...snapshot.portfolioRebalancing.topHedgingPrescriptions.map((h) => `- ${h}`),
    "",
    "## 5. Verification & Audit Trail",
    ...snapshot.auditTrail.map((a) => `- ${a}`),
  ].join("\n");
}
