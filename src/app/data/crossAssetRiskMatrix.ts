import { pearsonCorrelation } from "./analytics";

export type AssetClass = "yields" | "fx" | "equities" | "commodities" | "inflation";

export type CountryCode = "US" | "DE" | "JP" | "GB" | "VN" | "BR" | "IN" | "ID" | "MX" | "FR";

export interface AssetNode {
  id: string;
  name: string;
  assetClass: AssetClass;
  country: CountryCode;
  historicalReturns: number[];
  volatilityAnnualized: number;
}

export interface CorrelationMatrixResult {
  nodes: AssetNode[];
  correlationMatrix: number[][];
  covarianceMatrix: number[][];
  averageCorrelation: number;
  maxCorrelationPair: { nodeA: string; nodeB: string; correlation: number };
  minCorrelationPair: { nodeA: string; nodeB: string; correlation: number };
}

export type MacroRegimeType =
  | "Risk-On Expansion"
  | "Stagflationary Shock"
  | "Deflationary Contraction"
  | "Policy Divergence"
  | "Liquidity Stress";

export interface MacroRegimeCluster {
  regime: MacroRegimeType;
  confidence: number;
  rationale: string;
  primaryDrivers: string[];
  systemVolatilityIndex: number;
  diversificationBenefitRatio: number;
}

export type StressScenarioType =
  | "rate_shock_100bp"
  | "energy_spike_50pct"
  | "em_fx_devaluation_20pct"
  | "liquidity_freeze";

export interface StressTestImpact {
  scenario: StressScenarioType;
  scenarioName: string;
  projectedVolatilitySurge: number;
  estimatedDrawdownByAsset: Record<string, number>;
  portfolioRiskScore: number;
  recommendedHedges: string[];
}

export function calculateCorrelationMatrix(nodes: AssetNode[]): CorrelationMatrixResult {
  const n = nodes.length;
  if (n === 0) {
    return {
      nodes: [],
      correlationMatrix: [],
      covarianceMatrix: [],
      averageCorrelation: 0,
      maxCorrelationPair: { nodeA: "", nodeB: "", correlation: 0 },
      minCorrelationPair: { nodeA: "", nodeB: "", correlation: 0 },
    };
  }

  const correlationMatrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  const covarianceMatrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  let sumOffDiagCorr = 0;
  let offDiagCount = 0;
  let maxCorr = -Infinity;
  let maxPair = { nodeA: "", nodeB: "", correlation: 0 };
  let minCorr = Infinity;
  let minPair = { nodeA: "", nodeB: "", correlation: 0 };

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        correlationMatrix[i][j] = 1.0;
        const vol = nodes[i].volatilityAnnualized;
        covarianceMatrix[i][j] = Math.round(vol * vol * 10000) / 10000;
      } else if (i < j) {
        const corr = pearsonCorrelation(nodes[i].historicalReturns, nodes[j].historicalReturns);
        const clampedCorr = Number.isFinite(corr)
          ? Math.max(-1, Math.min(1, Math.round(corr * 1000) / 1000))
          : 0;

        correlationMatrix[i][j] = clampedCorr;
        correlationMatrix[j][i] = clampedCorr;

        const cov =
          clampedCorr * nodes[i].volatilityAnnualized * nodes[j].volatilityAnnualized;
        covarianceMatrix[i][j] = Math.round(cov * 10000) / 10000;
        covarianceMatrix[j][i] = covarianceMatrix[i][j];

        sumOffDiagCorr += clampedCorr;
        offDiagCount++;

        if (clampedCorr > maxCorr) {
          maxCorr = clampedCorr;
          maxPair = { nodeA: nodes[i].id, nodeB: nodes[j].id, correlation: clampedCorr };
        }
        if (clampedCorr < minCorr) {
          minCorr = clampedCorr;
          minPair = { nodeA: nodes[i].id, nodeB: nodes[j].id, correlation: clampedCorr };
        }
      }
    }
  }

  const averageCorrelation =
    offDiagCount > 0 ? Math.round((sumOffDiagCorr / offDiagCount) * 1000) / 1000 : 1.0;

  return {
    nodes,
    correlationMatrix,
    covarianceMatrix,
    averageCorrelation,
    maxCorrelationPair: maxPair.nodeA ? maxPair : { nodeA: nodes[0].id, nodeB: nodes[0].id, correlation: 1 },
    minCorrelationPair: minPair.nodeA ? minPair : { nodeA: nodes[0].id, nodeB: nodes[0].id, correlation: 1 },
  };
}

export function detectCrossAssetRegime(
  correlationResult: CorrelationMatrixResult,
  macroSignals: {
    averageInflationYoy?: number;
    rateDivergenceScore?: number;
    liquidityIndex?: number;
  } = {}
): MacroRegimeCluster {
  const avgCorr = correlationResult.averageCorrelation;
  const nodes = correlationResult.nodes;
  const avgVol =
    nodes.length > 0
      ? nodes.reduce((sum, n) => sum + n.volatilityAnnualized, 0) / nodes.length
      : 0;

  const inflation = macroSignals.averageInflationYoy ?? 3.2;
  const rateDivergence = macroSignals.rateDivergenceScore ?? 0.5;

  let regime: MacroRegimeType;
  let rationale: string;
  const primaryDrivers: string[] = [];

  if (avgCorr > 0.65 && avgVol > 0.2) {
    regime = "Liquidity Stress";
    rationale = "High cross-asset correlation spike and elevated volatility indicate liquidity-driven liquidation cascade.";
    primaryDrivers.push("Correlation breakdown across safe-havens", "Cross-market liquidity squeeze");
  } else if (inflation > 4.5 && avgVol > 0.15) {
    regime = "Stagflationary Shock";
    rationale = "Elevated inflation coupled with commodity outperformance and bond-equity positive correlation.";
    primaryDrivers.push("Persistent inflation prints", "Bond-equity hedging breakdown");
  } else if (rateDivergence > 0.75) {
    regime = "Policy Divergence";
    rationale = "Divergent central bank reaction functions causing foreign exchange and sovereign yield dispersion.";
    primaryDrivers.push("Fed vs ECB/BOJ policy spread", "EM FX pressure vs USD strength");
  } else if (avgCorr < 0.2 && avgVol < 0.12) {
    regime = "Risk-On Expansion";
    rationale = "Low systemic correlation provides maximum portfolio diversification in growth expansion.";
    primaryDrivers.push("Broad-based earnings growth", "Stable global interest rate environment");
  } else {
    regime = "Deflationary Contraction";
    rationale = "Decelerating growth momentum with flight to quality into long-duration sovereign bonds.";
    primaryDrivers.push("Yield curve bull steepening", "Growth equity multiples contraction");
  }

  const diversificationBenefitRatio =
    Math.max(0, Math.min(1, Math.round((1 - Math.max(0, avgCorr)) * 100) / 100));

  const systemVolatilityIndex = Math.round(avgVol * (1 + Math.max(0, avgCorr) * 0.5) * 100) / 100;

  return {
    regime,
    confidence: Math.round((0.75 + Math.min(0.2, nodes.length * 0.025)) * 100) / 100,
    rationale,
    primaryDrivers,
    systemVolatilityIndex,
    diversificationBenefitRatio,
  };
}

export function simulateStressScenarios(
  nodes: AssetNode[],
  correlationResult: CorrelationMatrixResult
): StressTestImpact[] {
  const avgCorr = correlationResult.averageCorrelation;

  const scenarios: { type: StressScenarioType; name: string; volSurge: number; hedges: string[] }[] = [
    {
      type: "rate_shock_100bp",
      name: "Global 100bps Sovereign Rate Shock",
      volSurge: 0.28,
      hedges: ["Short 10Y Duration", "Long USD/JPY", "Cash Overweight"],
    },
    {
      type: "energy_spike_50pct",
      name: "Stagflationary Crude & Gas Spike (+50%)",
      volSurge: 0.35,
      hedges: ["Long Brent/WTI Energy Swaps", "Short High-Beta Cyclicals", "Long Gold"],
    },
    {
      type: "em_fx_devaluation_20pct",
      name: "Emerging Market FX Contagion & Capital Flight",
      volSurge: 0.42,
      hedges: ["Long USD", "Short EM Sovereign Credit", "Long US Treasuries"],
    },
    {
      type: "liquidity_freeze",
      name: "Systemic Interbank Liquidity Freeze",
      volSurge: 0.55,
      hedges: ["Ultra-short T-Bills", "Long Volatility (VIX Futures)", "Gold Spot"],
    },
  ];

  return scenarios.map((scenario) => {
    const drawdown: Record<string, number> = {};
    for (const node of nodes) {
      let assetBeta = 1.0;
      switch (node.assetClass) {
        case "equities":
          assetBeta = scenario.type === "liquidity_freeze" ? 1.8 : 1.4;
          break;
        case "yields":
          assetBeta = scenario.type === "rate_shock_100bp" ? 2.2 : 0.8;
          break;
        case "commodities":
          assetBeta = scenario.type === "energy_spike_50pct" ? -1.5 : 1.1;
          break;
        case "fx":
          assetBeta = node.country === "US" ? -0.8 : 1.5;
          break;
        case "inflation":
          assetBeta = 0.5;
          break;
      }

      const estimatedShock = Math.round(
        (assetBeta * scenario.volSurge * (1 + Math.max(0, avgCorr) * 0.4)) * -100
      ) / 100;
      drawdown[node.id] = estimatedShock;
    }

    const avgDrawdown =
      nodes.length > 0
        ? Object.values(drawdown).reduce((sum, v) => sum + Math.abs(v), 0) / nodes.length
        : 0;

    const portfolioRiskScore = Math.min(100, Math.round(avgDrawdown * 150));

    return {
      scenario: scenario.type,
      scenarioName: scenario.name,
      projectedVolatilitySurge: scenario.volSurge,
      estimatedDrawdownByAsset: drawdown,
      portfolioRiskScore,
      recommendedHedges: scenario.hedges,
    };
  });
}

export function getPredefinedInstitutionalAssetUniverse(): AssetNode[] {
  return [
    {
      id: "US_10Y_YIELD",
      name: "US 10-Year Treasury Yield",
      assetClass: "yields",
      country: "US",
      historicalReturns: [0.02, -0.01, 0.03, 0.01, -0.02, 0.04, -0.03, 0.02, 0.01, -0.01, 0.03, 0.02],
      volatilityAnnualized: 0.14,
    },
    {
      id: "DE_10Y_BUND",
      name: "Germany 10-Year Bund Yield",
      assetClass: "yields",
      country: "DE",
      historicalReturns: [0.015, -0.008, 0.025, 0.008, -0.018, 0.035, -0.025, 0.018, 0.008, -0.008, 0.025, 0.015],
      volatilityAnnualized: 0.12,
    },
    {
      id: "SPX_EQUITIES",
      name: "S&P 500 Equity Index",
      assetClass: "equities",
      country: "US",
      historicalReturns: [0.03, 0.02, -0.04, 0.05, 0.01, -0.02, 0.04, 0.03, -0.01, 0.02, 0.04, 0.01],
      volatilityAnnualized: 0.16,
    },
    {
      id: "VN_VNINDEX",
      name: "Vietnam VN-Index Equities",
      assetClass: "equities",
      country: "VN",
      historicalReturns: [0.04, 0.01, -0.05, 0.06, 0.02, -0.03, 0.05, 0.02, -0.02, 0.03, 0.05, 0.0],
      volatilityAnnualized: 0.22,
    },
    {
      id: "USD_DXY",
      name: "USD Dollar Index (DXY)",
      assetClass: "fx",
      country: "US",
      historicalReturns: [-0.01, 0.015, 0.02, -0.01, 0.005, 0.025, -0.015, 0.01, 0.015, -0.005, 0.01, -0.01],
      volatilityAnnualized: 0.09,
    },
    {
      id: "BRENT_CRUDE",
      name: "Brent Crude Oil",
      assetClass: "commodities",
      country: "US",
      historicalReturns: [0.05, -0.03, 0.08, -0.02, 0.06, 0.04, -0.05, 0.07, -0.03, 0.04, 0.06, -0.02],
      volatilityAnnualized: 0.28,
    },
    {
      id: "GOLD_XAU",
      name: "Spot Gold (XAU/USD)",
      assetClass: "commodities",
      country: "US",
      historicalReturns: [0.02, 0.01, 0.03, -0.01, 0.02, 0.01, 0.04, -0.02, 0.03, 0.01, 0.02, 0.03],
      volatilityAnnualized: 0.13,
    },
  ];
}
