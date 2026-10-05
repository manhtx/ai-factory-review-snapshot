import {
  AssetNode,
  AssetClass,
  CountryCode,
  calculateCorrelationMatrix,
  getPredefinedInstitutionalAssetUniverse,
} from "./crossAssetRiskMatrix";
import { deterministicFingerprint } from "./deterministicFingerprint";

export interface CustomShockParameters {
  name: string;
  description?: string;
  rateShockBps: number; // e.g., +150 bps
  equityShockPct: number; // e.g., -20%
  commodityShockPct: number; // e.g., +35%
  fxDevaluationPct: number; // e.g., +15%
  liquidityStressIndex: number; // bounded [0, 1]
  correlationSpikeMultiplier?: number; // e.g., 1.25
}

export interface AssetStressResult {
  assetId: string;
  assetName: string;
  assetClass: AssetClass;
  country: CountryCode;
  baseVolatility: number;
  stressedVolatility: number;
  estimatedDrawdownPct: number;
  contributionToRiskPct: number;
}

export interface CapitalAdequacyImpact {
  baselineCapitalRatioPct: number;
  stressedCapitalRatioPct: number;
  capitalDepletionBps: number;
  regulatoryMinimumPct: number;
  capitalSurplusOrDeficit: "SURPLUS" | "DEFICIT" | "WARNING";
  bufferRemainingPct: number;
}

export interface HedgeRecommendation {
  instrument: string;
  targetWeightPct: number;
  hedgeType: "direct" | "proxy" | "cross_market";
  expectedDrawdownMitigationPct: number;
  rationale: string;
}

export type ComplianceRating = "PASS" | "BORDERLINE" | "CRITICAL_ACTION_REQUIRED";

export interface DynamicStressSimulationResult {
  schema: "macro-os.dynamic-stress-simulation";
  version: 1;
  simulationId: string;
  executedAt: string;
  parameters: CustomShockParameters;
  portfolioRiskScore: number;
  portfolioVaR95Pct: number;
  portfolioVaR99Pct: number;
  portfolioExpectedShortfall99Pct: number;
  averageCorrelationPreStress: number;
  averageCorrelationPostStress: number;
  assetImpacts: AssetStressResult[];
  capitalAdequacy: CapitalAdequacyImpact;
  recommendedHedges: HedgeRecommendation[];
  lineageFingerprint: string;
  complianceRating: ComplianceRating;
  limitations: string[];
}

export const PREDEFINED_SCENARIO_TEMPLATES: Record<string, CustomShockParameters> = {
  STAGFLATION_COMPOUND_SHOCK: {
    name: "Global Stagflationary Compound Shock",
    description: "Concomitant +175 bps yield spike, +45% energy surge, and -22% equity repricing.",
    rateShockBps: 175,
    equityShockPct: -22,
    commodityShockPct: 45,
    fxDevaluationPct: 18,
    liquidityStressIndex: 0.65,
    correlationSpikeMultiplier: 1.3,
  },
  SYSTEMIC_LIQUIDITY_CRUNCH: {
    name: "Systemic Interbank Liquidity Crunch",
    description: "Acute dollar funding freeze, +250 bps short-rate volatility, and broad asset liquidation.",
    rateShockBps: 125,
    equityShockPct: -30,
    commodityShockPct: -15,
    fxDevaluationPct: 25,
    liquidityStressIndex: 0.9,
    correlationSpikeMultiplier: 1.5,
  },
  EM_DEBT_CONTAGION: {
    name: "Emerging Market FX & Sovereign Debt Contagion",
    description: "Severe capital flight from emerging markets with currency depreciations and credit spread widening.",
    rateShockBps: 100,
    equityShockPct: -18,
    commodityShockPct: 10,
    fxDevaluationPct: 35,
    liquidityStressIndex: 0.7,
    correlationSpikeMultiplier: 1.35,
  },
  DOVISH_PIVOT_REFLATION: {
    name: "Coordinated Central Bank Reflationary Easing",
    description: "-100 bps global rate cuts triggering risk-asset multiple expansion and commodity bid.",
    rateShockBps: -100,
    equityShockPct: 15,
    commodityShockPct: 20,
    fxDevaluationPct: -5,
    liquidityStressIndex: 0.15,
    correlationSpikeMultiplier: 0.9,
  },
};

export function runDynamicStressSimulation(
  params: CustomShockParameters,
  portfolioAssets?: AssetNode[],
  executedAt?: string,
): DynamicStressSimulationResult {
  const timestamp = executedAt ?? new Date().toISOString();
  const assets = portfolioAssets !== undefined
    ? portfolioAssets
    : getPredefinedInstitutionalAssetUniverse();

  if (assets.length === 0) {
    throw new Error("Cannot run stress simulation on an empty asset universe.");
  }

  const baselineMatrix = calculateCorrelationMatrix(assets);
  const avgCorrPre = baselineMatrix.averageCorrelation;
  const corrMultiplier = params.correlationSpikeMultiplier ?? 1.2;
  const avgCorrPost = Math.min(0.99, Math.max(-0.99, Math.round(avgCorrPre * corrMultiplier * 1000) / 1000));

  const liquidityFactor = Math.max(0, Math.min(1, params.liquidityStressIndex));
  const rateFactor = params.rateShockBps / 100; // in percent

  let totalAbsoluteShock = 0;
  const assetImpacts: AssetStressResult[] = [];

  for (const asset of assets) {
    let shockPct = 0;
    switch (asset.assetClass) {
      case "yields": {
        // Higher yields reduce bond prices: Duration proxy ~ 7.5 years
        shockPct = -(rateFactor * 7.5) * (1 + liquidityFactor * 0.3);
        break;
      }
      case "equities": {
        const beta = asset.country === "US" ? 1.0 : 1.35;
        shockPct = (params.equityShockPct * beta) - (rateFactor * 1.5) - (liquidityFactor * 8.0);
        break;
      }
      case "commodities": {
        const isEnergy = asset.id.includes("CRUDE") || asset.id.includes("OIL");
        const isGold = asset.id.includes("GOLD") || asset.id.includes("XAU");
        if (isGold) {
          shockPct = (params.commodityShockPct * 0.4) + (liquidityFactor > 0.6 ? 8.0 : -3.0) - (rateFactor * 2.0);
        } else if (isEnergy) {
          shockPct = params.commodityShockPct - (liquidityFactor * 5.0);
        } else {
          shockPct = (params.commodityShockPct * 0.7) - (liquidityFactor * 6.0);
        }
        break;
      }
      case "fx": {
        if (asset.country === "US") {
          // USD strengthens during flight to quality
          shockPct = (params.fxDevaluationPct * 0.5) + (liquidityFactor * 6.0);
        } else {
          // Non-US FX depreciates
          shockPct = -(params.fxDevaluationPct * 1.2) - (liquidityFactor * 7.0);
        }
        break;
      }
      case "inflation": {
        shockPct = (params.commodityShockPct * 0.15) + (rateFactor * 0.2);
        break;
      }
    }

    const roundedShockPct = Math.round(shockPct * 100) / 100;
    const volSurge = Math.round(
      asset.volatilityAnnualized * (1 + (Math.abs(roundedShockPct) / 50) + liquidityFactor * 0.5) * 1000
    ) / 1000;

    assetImpacts.push({
      assetId: asset.id,
      assetName: asset.name,
      assetClass: asset.assetClass,
      country: asset.country,
      baseVolatility: asset.volatilityAnnualized,
      stressedVolatility: volSurge,
      estimatedDrawdownPct: roundedShockPct,
      contributionToRiskPct: 0, // Calculated below
    });

    totalAbsoluteShock += Math.abs(roundedShockPct);
  }

  // Calculate percentage contribution to risk
  for (const impact of assetImpacts) {
    impact.contributionToRiskPct = totalAbsoluteShock > 0
      ? Math.round((Math.abs(impact.estimatedDrawdownPct) / totalAbsoluteShock) * 1000) / 10
      : 0;
  }

  // Average Portfolio Drawdown
  const avgDrawdown = totalAbsoluteShock / assets.length;
  const portfolioRiskScore = Math.min(100, Math.max(0, Math.round(avgDrawdown * 3.2 + liquidityFactor * 25)));

  // Parametric Value at Risk & Expected Shortfall (Normal proxy with fat-tail liquidity adjustment)
  const weightedStressedVol = assetImpacts.reduce((sum, a) => sum + a.stressedVolatility, 0) / assetImpacts.length;
  const tailMultiplier = 1 + liquidityFactor * 0.45;
  const portfolioVaR95Pct = Math.round(1.645 * weightedStressedVol * tailMultiplier * 1000) / 10;
  const portfolioVaR99Pct = Math.round(2.326 * weightedStressedVol * tailMultiplier * 1000) / 10;
  const portfolioExpectedShortfall99Pct = Math.round(2.665 * weightedStressedVol * tailMultiplier * 1000) / 10;

  // Regulatory Capital Adequacy Calculation (Basel III Proxy)
  const baselineCapitalRatioPct = 14.8;
  const capitalDepletionBps = Math.round(avgDrawdown * 22 + liquidityFactor * 150);
  const stressedCapitalRatioPct = Math.round((baselineCapitalRatioPct - (capitalDepletionBps / 100)) * 100) / 100;
  const regulatoryMinimumPct = 10.5;
  const bufferRemainingPct = Math.round((stressedCapitalRatioPct - regulatoryMinimumPct) * 100) / 100;

  let capitalSurplusOrDeficit: "SURPLUS" | "DEFICIT" | "WARNING" = "SURPLUS";
  if (bufferRemainingPct < 0) {
    capitalSurplusOrDeficit = "DEFICIT";
  } else if (bufferRemainingPct < 1.5) {
    capitalSurplusOrDeficit = "WARNING";
  }

  // Compliance Rating
  let complianceRating: ComplianceRating = "PASS";
  if (capitalSurplusOrDeficit === "DEFICIT" || portfolioRiskScore > 75) {
    complianceRating = "CRITICAL_ACTION_REQUIRED";
  } else if (capitalSurplusOrDeficit === "WARNING" || portfolioRiskScore > 50) {
    complianceRating = "BORDERLINE";
  }

  // Generate Tailored Dynamic Hedges
  const recommendedHedges: HedgeRecommendation[] = [];
  if (params.rateShockBps > 50) {
    recommendedHedges.push({
      instrument: "Short 10Y Sovereign Bond Futures / Payer Swaptions",
      targetWeightPct: 15,
      hedgeType: "direct",
      expectedDrawdownMitigationPct: 35,
      rationale: "Offsets duration losses from sharp rate hikes and curve bear-flattening.",
    });
  }
  if (params.equityShockPct < -15) {
    recommendedHedges.push({
      instrument: "Out-of-the-Money SPX Put Options (90% Moneyness)",
      targetWeightPct: 8,
      hedgeType: "direct",
      expectedDrawdownMitigationPct: 45,
      rationale: "Provides convex downside protection against equity valuation collapse.",
    });
  }
  if (params.commodityShockPct > 20) {
    recommendedHedges.push({
      instrument: "Long Commodity Index Swaps (Brent / Agriculture)",
      targetWeightPct: 10,
      hedgeType: "proxy",
      expectedDrawdownMitigationPct: 25,
      rationale: "Monetizes cost-push inflationary pressure across broad supply chains.",
    });
  }
  if (params.fxDevaluationPct > 15 || liquidityFactor > 0.6) {
    recommendedHedges.push({
      instrument: "Long USD Spot / Short EM Currency Basket",
      targetWeightPct: 12,
      hedgeType: "cross_market",
      expectedDrawdownMitigationPct: 30,
      rationale: "Capitalizes on flight-to-safety dollar liquidity demand during systemic stress.",
    });
  }
  if (liquidityFactor > 0.75) {
    recommendedHedges.push({
      instrument: "Cash & 3-Month Sovereign T-Bills Overweight",
      targetWeightPct: 20,
      hedgeType: "direct",
      expectedDrawdownMitigationPct: 60,
      rationale: "Eliminates counterparty risk and preserves dry powder during interbank freeze.",
    });
  }

  const lineageFingerprint = deterministicFingerprint({
    params,
    assetCount: assets.length,
    portfolioRiskScore,
    portfolioVaR99Pct,
    stressedCapitalRatioPct,
    timestamp,
  });

  const limitations = [
    "Stress test simulations employ deterministic multi-factor beta sensitivities and parametric fat-tail adjustments; they do not guarantee future performance in regime transitions.",
    "Capital depletion metrics are proxies aligned with Basel III Tier 1 capital definitions and do not replace statutory supervisory models.",
    "Lineage fingerprints provide cryptographic non-repudiation of input parameters and quantitative outputs.",
  ];

  return {
    schema: "macro-os.dynamic-stress-simulation",
    version: 1,
    simulationId: `stress-sim-${lineageFingerprint.slice(0, 12)}`,
    executedAt: timestamp,
    parameters: params,
    portfolioRiskScore,
    portfolioVaR95Pct,
    portfolioVaR99Pct,
    portfolioExpectedShortfall99Pct,
    averageCorrelationPreStress: avgCorrPre,
    averageCorrelationPostStress: avgCorrPost,
    assetImpacts,
    capitalAdequacy: {
      baselineCapitalRatioPct,
      stressedCapitalRatioPct,
      capitalDepletionBps,
      regulatoryMinimumPct,
      capitalSurplusOrDeficit,
      bufferRemainingPct,
    },
    recommendedHedges,
    lineageFingerprint,
    complianceRating,
    limitations,
  };
}

export function exportStressDossierToCSV(result: DynamicStressSimulationResult): string {
  const rows: string[] = [
    "Asset ID,Asset Name,Asset Class,Country,Base Volatility,Stressed Volatility,Estimated Drawdown %,Risk Contribution %",
  ];

  for (const a of result.assetImpacts) {
    rows.push(
      `"${a.assetId}","${a.assetName}","${a.assetClass}","${a.country}",${a.baseVolatility.toFixed(4)},${a.stressedVolatility.toFixed(4)},${a.estimatedDrawdownPct.toFixed(2)}%,${a.contributionToRiskPct.toFixed(1)}%`
    );
  }

  return rows.join("\n");
}

export function exportStressDossierToMarkdown(result: DynamicStressSimulationResult): string {
  const hedgeLines = result.recommendedHedges.map(
    (h) => `| ${h.instrument} | ${h.targetWeightPct}% | ${h.hedgeType} | +${h.expectedDrawdownMitigationPct}% | ${h.rationale} |`
  );

  const assetRows = result.assetImpacts.map(
    (a) => `| ${a.assetName} (${a.assetId}) | ${a.assetClass.toUpperCase()} | ${a.country} | ${(a.baseVolatility * 100).toFixed(1)}% | ${(a.stressedVolatility * 100).toFixed(1)}% | **${a.estimatedDrawdownPct > 0 ? "+" : ""}${a.estimatedDrawdownPct.toFixed(2)}%** | ${a.contributionToRiskPct.toFixed(1)}% |`
  );

  return [
    `# Institutional Stress Test Dossier — ${result.parameters.name}`,
    "",
    `**Simulation ID:** \`${result.simulationId}\` | **Executed At:** \`${result.executedAt}\``,
    `**Deterministic Lineage Fingerprint:** \`${result.lineageFingerprint}\``,
    `**Compliance Rating:** **${result.complianceRating}** | **Portfolio Risk Score:** **${result.portfolioRiskScore}/100**`,
    "",
    "## 1. Executive Summary & Value-at-Risk",
    `- **Parametric VaR (95% Confidence):** ${result.portfolioVaR95Pct.toFixed(1)}%`,
    `- **Parametric VaR (99% Confidence):** ${result.portfolioVaR99Pct.toFixed(1)}%`,
    `- **Expected Shortfall / CVaR (99% Confidence):** ${result.portfolioExpectedShortfall99Pct.toFixed(1)}%`,
    `- **Cross-Asset Correlation Shift:** ${result.averageCorrelationPreStress.toFixed(3)} (Base) → **${result.averageCorrelationPostStress.toFixed(3)}** (Stressed)`,
    "",
    "## 2. Regulatory Capital Adequacy Impact (Basel III Proxy)",
    `- **Baseline Capital Ratio:** ${result.capitalAdequacy.baselineCapitalRatioPct.toFixed(2)}%`,
    `- **Stressed Capital Ratio:** **${result.capitalAdequacy.stressedCapitalRatioPct.toFixed(2)}%**`,
    `- **Capital Depletion:** -${result.capitalAdequacy.capitalDepletionBps} bps`,
    `- **Regulatory Minimum Requirement:** ${result.capitalAdequacy.regulatoryMinimumPct.toFixed(2)}%`,
    `- **Buffer Remaining:** ${result.capitalAdequacy.bufferRemainingPct > 0 ? "+" : ""}${result.capitalAdequacy.bufferRemainingPct.toFixed(2)}% (${result.capitalAdequacy.capitalSurplusOrDeficit})`,
    "",
    "## 3. Asset-by-Asset Sensitivity Breakdown",
    "| Asset Name | Class | Country | Base Vol | Stressed Vol | Est. Drawdown | Risk Contrib |",
    "| :--- | :--- | :--- | :--- | :--- | :--- | :--- |",
    ...assetRows,
    "",
    "## 4. Prescribed Dynamic Hedging Program",
    "| Hedge Instrument | Target Weight | Strategy Type | Mitigation | Rationale |",
    "| :--- | :--- | :--- | :--- | :--- |",
    ...hedgeLines,
    "",
    "## 5. Audit & Compliance Lineage",
    `- **Shock Parameters:** Rate: ${result.parameters.rateShockBps} bps | Equity: ${result.parameters.equityShockPct}% | Commodity: ${result.parameters.commodityShockPct}% | FX Deval: ${result.parameters.fxDevaluationPct}% | Liquidity Stress: ${(result.parameters.liquidityStressIndex * 100).toFixed(0)}%`,
    `- **Verification Stamp:** \`${result.lineageFingerprint}\``,
    "",
    "## 6. Disclaimers & Model Boundaries",
    ...result.limitations.map((l) => `- ${l}`),
  ].join("\n");
}
