import { deterministicFingerprint } from "./deterministicFingerprint.js";

export type SovereignCountryCode =
  | "US"
  | "DE"
  | "JP"
  | "GB"
  | "FR"
  | "IT"
  | "CN"
  | "KR"
  | "VN"
  | "BR";

export interface SovereignNodeProfile {
  countryCode: SovereignCountryCode;
  countryName: string;
  region: "Americas" | "Europe" | "Asia-Pacific";
  totalBankingAssetsUsdBn: number;
  coreTier1CapitalRatioPct: number;
  sovereignDebtToGdpPct: number;
  baselineCdsSpreadBps: number;
  domesticBankSovereignHoldingPct: number; // Sovereign debt held by domestic banks (% of Tier 1 capital)
  interbankLeverageRatio: number;
  fireSaleSensitivity: number; // Price elasticity under forced asset sales
}

export const SOVEREIGN_BANKING_PROFILES: Record<SovereignCountryCode, SovereignNodeProfile> = {
  US: {
    countryCode: "US",
    countryName: "United States",
    region: "Americas",
    totalBankingAssetsUsdBn: 23800,
    coreTier1CapitalRatioPct: 13.8,
    sovereignDebtToGdpPct: 122.5,
    baselineCdsSpreadBps: 18,
    domesticBankSovereignHoldingPct: 65,
    interbankLeverageRatio: 12.5,
    fireSaleSensitivity: 0.15,
  },
  DE: {
    countryCode: "DE",
    countryName: "Germany",
    region: "Europe",
    totalBankingAssetsUsdBn: 10400,
    coreTier1CapitalRatioPct: 15.6,
    sovereignDebtToGdpPct: 66.1,
    baselineCdsSpreadBps: 12,
    domesticBankSovereignHoldingPct: 55,
    interbankLeverageRatio: 14.0,
    fireSaleSensitivity: 0.18,
  },
  JP: {
    countryCode: "JP",
    countryName: "Japan",
    region: "Asia-Pacific",
    totalBankingAssetsUsdBn: 12900,
    coreTier1CapitalRatioPct: 14.2,
    sovereignDebtToGdpPct: 254.0,
    baselineCdsSpreadBps: 22,
    domesticBankSovereignHoldingPct: 140,
    interbankLeverageRatio: 16.5,
    fireSaleSensitivity: 0.22,
  },
  GB: {
    countryCode: "GB",
    countryName: "United Kingdom",
    region: "Europe",
    totalBankingAssetsUsdBn: 11200,
    coreTier1CapitalRatioPct: 15.1,
    sovereignDebtToGdpPct: 98.4,
    baselineCdsSpreadBps: 26,
    domesticBankSovereignHoldingPct: 70,
    interbankLeverageRatio: 15.0,
    fireSaleSensitivity: 0.20,
  },
  FR: {
    countryCode: "FR",
    countryName: "France",
    region: "Europe",
    totalBankingAssetsUsdBn: 11800,
    coreTier1CapitalRatioPct: 14.9,
    sovereignDebtToGdpPct: 110.8,
    baselineCdsSpreadBps: 34,
    domesticBankSovereignHoldingPct: 88,
    interbankLeverageRatio: 15.8,
    fireSaleSensitivity: 0.24,
  },
  IT: {
    countryCode: "IT",
    countryName: "Italy",
    region: "Europe",
    totalBankingAssetsUsdBn: 4100,
    coreTier1CapitalRatioPct: 14.0,
    sovereignDebtToGdpPct: 137.3,
    baselineCdsSpreadBps: 115,
    domesticBankSovereignHoldingPct: 165,
    interbankLeverageRatio: 14.5,
    fireSaleSensitivity: 0.35,
  },
  CN: {
    countryCode: "CN",
    countryName: "China",
    region: "Asia-Pacific",
    totalBankingAssetsUsdBn: 52000,
    coreTier1CapitalRatioPct: 12.8,
    sovereignDebtToGdpPct: 83.6,
    baselineCdsSpreadBps: 58,
    domesticBankSovereignHoldingPct: 110,
    interbankLeverageRatio: 17.2,
    fireSaleSensitivity: 0.28,
  },
  KR: {
    countryCode: "KR",
    countryName: "South Korea",
    region: "Asia-Pacific",
    totalBankingAssetsUsdBn: 3400,
    coreTier1CapitalRatioPct: 15.4,
    sovereignDebtToGdpPct: 51.3,
    baselineCdsSpreadBps: 38,
    domesticBankSovereignHoldingPct: 60,
    interbankLeverageRatio: 13.0,
    fireSaleSensitivity: 0.21,
  },
  VN: {
    countryCode: "VN",
    countryName: "Vietnam",
    region: "Asia-Pacific",
    totalBankingAssetsUsdBn: 950,
    coreTier1CapitalRatioPct: 11.9,
    sovereignDebtToGdpPct: 37.1,
    baselineCdsSpreadBps: 125,
    domesticBankSovereignHoldingPct: 95,
    interbankLeverageRatio: 12.0,
    fireSaleSensitivity: 0.40,
  },
  BR: {
    countryCode: "BR",
    countryName: "Brazil",
    region: "Americas",
    totalBankingAssetsUsdBn: 2100,
    coreTier1CapitalRatioPct: 14.5,
    sovereignDebtToGdpPct: 74.4,
    baselineCdsSpreadBps: 145,
    domesticBankSovereignHoldingPct: 120,
    interbankLeverageRatio: 11.5,
    fireSaleSensitivity: 0.38,
  },
};

// Bilateral cross-border banking claims matrix (Lender -> Borrower as % of Lender's Core Capital)
export const DEFAULT_BILATERAL_EXPOSURE_WEIGHTS: Record<SovereignCountryCode, Partial<Record<SovereignCountryCode, number>>> = {
  US: { GB: 0.12, DE: 0.08, FR: 0.07, JP: 0.06, CN: 0.04, IT: 0.02, KR: 0.02, BR: 0.015, VN: 0.005 },
  DE: { FR: 0.18, US: 0.15, IT: 0.11, GB: 0.10, JP: 0.04, CN: 0.03, KR: 0.015, BR: 0.01, VN: 0.004 },
  JP: { US: 0.28, DE: 0.08, GB: 0.07, FR: 0.06, CN: 0.05, KR: 0.04, IT: 0.02, VN: 0.015, BR: 0.01 },
  GB: { US: 0.22, DE: 0.12, FR: 0.10, CN: 0.06, JP: 0.05, IT: 0.03, KR: 0.02, BR: 0.01, VN: 0.005 },
  FR: { IT: 0.22, DE: 0.16, US: 0.14, GB: 0.09, JP: 0.04, CN: 0.03, BR: 0.015, KR: 0.01, VN: 0.005 },
  IT: { FR: 0.14, DE: 0.12, US: 0.09, GB: 0.05, JP: 0.02, CN: 0.01 },
  CN: { US: 0.15, JP: 0.08, KR: 0.07, DE: 0.06, GB: 0.05, FR: 0.04, VN: 0.03, BR: 0.02, IT: 0.01 },
  KR: { CN: 0.18, US: 0.16, JP: 0.10, VN: 0.06, DE: 0.04, GB: 0.03, FR: 0.02, BR: 0.01, IT: 0.01 },
  VN: { CN: 0.20, US: 0.14, JP: 0.12, KR: 0.10, DE: 0.03, GB: 0.02, FR: 0.02, IT: 0.01, BR: 0.005 },
  BR: { US: 0.25, CN: 0.12, DE: 0.06, GB: 0.05, FR: 0.04, JP: 0.03, IT: 0.02, KR: 0.01, VN: 0.005 },
};

export type EarlyWarningLevel =
  | "NORMAL"
  | "WATCH"
  | "ELEVATED"
  | "CRITICAL_SYSTEMIC";

export interface ContagionShockParameter {
  epicenterCountry: SovereignCountryCode;
  initialSovereignCdsShockBps?: number;
  initialBankCapitalLossPct?: number;
  interbankLiquidityFreeze?: boolean;
}

export interface NodeContagionImpact {
  countryCode: SovereignCountryCode;
  countryName: string;
  region: string;
  initialCapitalPct: number;
  depletedCapitalPct: number;
  capitalLossPct: number;
  capitalLossUsdBn: number;
  stressedCdsSpreadBps: number;
  cdsSpreadWiderBps: number;
  sovereignDoomLoopLossPct: number;
  interbankSpilloverLossPct: number;
  fireSaleDiscountLossPct: number;
  outwardSystemicImpactScore: number; // 0-100 DebtRank influence
  vulnerabilityIndexScore: number; // 0-100 susceptibility
  isInsolvent: boolean;
  status: "ROBUST" | "IMPACTED" | "DISTRESSED" | "CRITICAL_DEFAULT";
}

export interface CascadeRoundTelemetry {
  round: number;
  roundName: string;
  marginalCapitalLossPct: number;
  marginalLossUsdBn: number;
  newlyDistressedNodes: SovereignCountryCode[];
  newlyInsolventNodes: SovereignCountryCode[];
  systemicDistressIndex: number;
}

export interface ContagionPrescription {
  priority: "IMMEDIATE" | "HIGH" | "TACTICAL";
  domain: "LIQUIDITY_BUFFER" | "SOVEREIGN_HEDGE" | "COLLATERAL_REDUCTION" | "FX_SWAP_ACCESS";
  targetHubs: SovereignCountryCode[];
  recommendation: string;
  rationale: string;
}

export interface LiquidityCascadeSimulationSnapshot {
  snapshotId: string;
  schemaVersion: "1.0.0";
  simulatedAt: string;
  shockParameters: ContagionShockParameter[];
  overallSystemicDistressIndex: number; // 0-100
  totalSystemicCapitalLossUsdBn: number;
  totalSystemicCapitalLossPct: number;
  cascadeRoundsCompleted: number;
  earlyWarningLevel: EarlyWarningLevel;
  mostVulnerableHubs: SovereignCountryCode[];
  greatestContagionVectors: SovereignCountryCode[];
  nodeImpacts: NodeContagionImpact[];
  cascadeRounds: CascadeRoundTelemetry[];
  prescriptions: ContagionPrescription[];
  fingerprint: string;
}

export function simulateLiquidityCascadeContagion(
  shocks: ContagionShockParameter[] = [{ epicenterCountry: "IT", initialSovereignCdsShockBps: 250 }],
  simulatedAt?: string
): LiquidityCascadeSimulationSnapshot {
  const timestamp = simulatedAt || new Date().toISOString();
  const countryCodes = Object.keys(SOVEREIGN_BANKING_PROFILES) as SovereignCountryCode[];

  // State trackers per node
  const capitalBufferPct: Record<SovereignCountryCode, number> = {} as never;
  const initialCapitals: Record<SovereignCountryCode, number> = {} as never;
  const cdsSpreads: Record<SovereignCountryCode, number> = {} as never;
  const interbankLosses: Record<SovereignCountryCode, number> = {} as never;
  const doomLoopLosses: Record<SovereignCountryCode, number> = {} as never;
  const fireSaleLosses: Record<SovereignCountryCode, number> = {} as never;
  const isInsolvent: Record<SovereignCountryCode, boolean> = {} as never;

  countryCodes.forEach((code) => {
    const p = SOVEREIGN_BANKING_PROFILES[code];
    capitalBufferPct[code] = p.coreTier1CapitalRatioPct;
    initialCapitals[code] = p.coreTier1CapitalRatioPct;
    cdsSpreads[code] = p.baselineCdsSpreadBps;
    interbankLosses[code] = 0;
    doomLoopLosses[code] = 0;
    fireSaleLosses[code] = 0;
    isInsolvent[code] = false;
  });

  const cascadeRounds: CascadeRoundTelemetry[] = [];

  // Round 0 / 1: Initial Epicenter Shock Injection
  let currentRoundLossUsd = 0;
  const r1Distressed: SovereignCountryCode[] = [];
  const r1Insolvent: SovereignCountryCode[] = [];

  shocks.forEach((shock) => {
    const node = shock.epicenterCountry;
    if (!SOVEREIGN_BANKING_PROFILES[node]) return;

    const profile = SOVEREIGN_BANKING_PROFILES[node];
    const cdsShock = shock.initialSovereignCdsShockBps || 200;
    const directCapShock = shock.initialBankCapitalLossPct || 0;

    cdsSpreads[node] += cdsShock;
    const doomLoss = (cdsShock / 100) * (profile.domesticBankSovereignHoldingPct / 100) * 0.8;
    doomLoopLosses[node] += doomLoss;

    let directLoss = directCapShock + doomLoss;
    if (shock.interbankLiquidityFreeze) {
      directLoss += profile.interbankLeverageRatio * 0.15;
    }

    capitalBufferPct[node] = Math.max(0, capitalBufferPct[node] - directLoss);
    const usdLoss = (directLoss / 100) * (profile.totalBankingAssetsUsdBn * 0.1);
    currentRoundLossUsd += usdLoss;

    if (capitalBufferPct[node] < 8.0) r1Distressed.push(node);
    if (capitalBufferPct[node] <= 0) {
      isInsolvent[node] = true;
      r1Insolvent.push(node);
    }
  });

  cascadeRounds.push({
    round: 1,
    roundName: "Epicenter Sovereign Spread Blowout & Direct Balance Sheet Shock",
    marginalCapitalLossPct: Number((currentRoundLossUsd / 130000 * 100).toFixed(2)),
    marginalLossUsdBn: Number(currentRoundLossUsd.toFixed(1)),
    newlyDistressedNodes: [...new Set(r1Distressed)],
    newlyInsolventNodes: [...new Set(r1Insolvent)],
    systemicDistressIndex: Math.min(100, Number((currentRoundLossUsd / 250).toFixed(1))),
  });

  // Round 2: Bilateral Interbank Spillover Propagation
  let r2LossUsd = 0;
  const r2Distressed: SovereignCountryCode[] = [];
  const r2Insolvent: SovereignCountryCode[] = [];

  countryCodes.forEach((lender) => {
    const lenderProfile = SOVEREIGN_BANKING_PROFILES[lender];
    const exposures = DEFAULT_BILATERAL_EXPOSURE_WEIGHTS[lender] || {};

    let spilloverLossPct = 0;
    Object.entries(exposures).forEach(([borrowerCode, weight]) => {
      const borrower = borrowerCode as SovereignCountryCode;
      if (!borrower || !weight) return;

      const borrowerDistressRatio = Math.min(
        1.0,
        Math.max(0, (initialCapitals[borrower] - capitalBufferPct[borrower]) / initialCapitals[borrower])
      );

      if (borrowerDistressRatio > 0.1) {
        const loss = weight * borrowerDistressRatio * (lenderProfile.interbankLeverageRatio * 0.4);
        spilloverLossPct += loss;
      }
    });

    if (spilloverLossPct > 0) {
      interbankLosses[lender] += spilloverLossPct;
      capitalBufferPct[lender] = Math.max(0, capitalBufferPct[lender] - spilloverLossPct);
      const lossUsd = (spilloverLossPct / 100) * (lenderProfile.totalBankingAssetsUsdBn * 0.08);
      r2LossUsd += lossUsd;

      if (capitalBufferPct[lender] < 8.0 && !r1Distressed.includes(lender)) {
        r2Distressed.push(lender);
      }
      if (capitalBufferPct[lender] <= 0 && !isInsolvent[lender]) {
        isInsolvent[lender] = true;
        r2Insolvent.push(lender);
      }
    }
  });

  cascadeRounds.push({
    round: 2,
    roundName: "Cross-Border Interbank Counterparty Transmission",
    marginalCapitalLossPct: Number((r2LossUsd / 130000 * 100).toFixed(2)),
    marginalLossUsdBn: Number(r2LossUsd.toFixed(1)),
    newlyDistressedNodes: [...new Set(r2Distressed)],
    newlyInsolventNodes: [...new Set(r2Insolvent)],
    systemicDistressIndex: Math.min(100, Number(((currentRoundLossUsd + r2LossUsd) / 250).toFixed(1))),
  });

  // Round 3: Fire-Sale Asset Liquidation & Sovereign-Bank Doom Loop Amplifier
  let r3LossUsd = 0;
  const r3Distressed: SovereignCountryCode[] = [];
  const r3Insolvent: SovereignCountryCode[] = [];

  countryCodes.forEach((code) => {
    const profile = SOVEREIGN_BANKING_PROFILES[code];
    const totalPriorLoss = interbankLosses[code] + doomLoopLosses[code];

    if (totalPriorLoss > 1.5) {
      // Fire-sale liquidation discount
      const fireSaleLoss = totalPriorLoss * profile.fireSaleSensitivity * 0.75;
      fireSaleLosses[code] += fireSaleLoss;

      // Doom-loop feedback widening sovereign CDS
      const additionalCdsWidening = Math.round(fireSaleLoss * 25);
      cdsSpreads[code] += additionalCdsWidening;

      const secondaryDoomLoss = (additionalCdsWidening / 100) * (profile.domesticBankSovereignHoldingPct / 100) * 0.4;
      doomLoopLosses[code] += secondaryDoomLoss;

      const marginalRoundLoss = fireSaleLoss + secondaryDoomLoss;
      capitalBufferPct[code] = Math.max(0, capitalBufferPct[code] - marginalRoundLoss);

      const lossUsd = (marginalRoundLoss / 100) * (profile.totalBankingAssetsUsdBn * 0.08);
      r3LossUsd += lossUsd;

      if (capitalBufferPct[code] < 8.0 && !r1Distressed.includes(code) && !r2Distressed.includes(code)) {
        r3Distressed.push(code);
      }
      if (capitalBufferPct[code] <= 0 && !isInsolvent[code]) {
        isInsolvent[code] = true;
        r3Insolvent.push(code);
      }
    }
  });

  cascadeRounds.push({
    round: 3,
    roundName: "Fire-Sale Asset Depreciation & Bank-Sovereign Feedback Loop",
    marginalCapitalLossPct: Number((r3LossUsd / 130000 * 100).toFixed(2)),
    marginalLossUsdBn: Number(r3LossUsd.toFixed(1)),
    newlyDistressedNodes: [...new Set(r3Distressed)],
    newlyInsolventNodes: [...new Set(r3Insolvent)],
    systemicDistressIndex: Math.min(100, Number(((currentRoundLossUsd + r2LossUsd + r3LossUsd) / 250).toFixed(1))),
  });

  // Calculate Node-level impacts and systemic rankings
  let totalCapitalLossUsdBn = 0;
  let baselineTotalCapitalUsdBn = 0;

  const nodeImpacts: NodeContagionImpact[] = countryCodes.map((code) => {
    const profile = SOVEREIGN_BANKING_PROFILES[code];
    const initialCap = initialCapitals[code];
    const remainingCap = capitalBufferPct[code];
    const totalLossPct = Math.max(0, initialCap - remainingCap);
    const bankCapitalUsdBn = (profile.totalBankingAssetsUsdBn * (initialCap / 100));
    const lossUsdBn = (totalLossPct / initialCap) * bankCapitalUsdBn;

    totalCapitalLossUsdBn += lossUsdBn;
    baselineTotalCapitalUsdBn += bankCapitalUsdBn;

    const cdsSpreadWider = cdsSpreads[code] - profile.baselineCdsSpreadBps;

    // Outward systemic impact (DebtRank outward score: 0-100)
    const outwardExposureSum = Object.values(DEFAULT_BILATERAL_EXPOSURE_WEIGHTS[code] || {}).reduce((a, b) => a + (b || 0), 0);
    const outwardScore = Math.min(100, Number((profile.totalBankingAssetsUsdBn / 1000 * outwardExposureSum * 1.5).toFixed(1)));

    // Vulnerability score (0-100)
    const vulnScore = Math.min(
      100,
      Number(
        ((totalLossPct / initialCap * 50) +
          (profile.sovereignDebtToGdpPct / 250 * 25) +
          (profile.domesticBankSovereignHoldingPct / 150 * 25)).toFixed(1)
      )
    );

    let status: NodeContagionImpact["status"] = "ROBUST";
    if (remainingCap <= 0) status = "CRITICAL_DEFAULT";
    else if (remainingCap < 7.0) status = "DISTRESSED";
    else if (totalLossPct > 1.0) status = "IMPACTED";

    return {
      countryCode: code,
      countryName: profile.countryName,
      region: profile.region,
      initialCapitalPct: initialCap,
      depletedCapitalPct: Number(remainingCap.toFixed(2)),
      capitalLossPct: Number(totalLossPct.toFixed(2)),
      capitalLossUsdBn: Number(lossUsdBn.toFixed(1)),
      stressedCdsSpreadBps: cdsSpreads[code],
      cdsSpreadWiderBps: cdsSpreadWider,
      sovereignDoomLoopLossPct: Number(doomLoopLosses[code].toFixed(2)),
      interbankSpilloverLossPct: Number(interbankLosses[code].toFixed(2)),
      fireSaleDiscountLossPct: Number(fireSaleLosses[code].toFixed(2)),
      outwardSystemicImpactScore: outwardScore,
      vulnerabilityIndexScore: vulnScore,
      isInsolvent: isInsolvent[code],
      status,
    };
  });

  const totalSystemicLossPct = baselineTotalCapitalUsdBn > 0
    ? Number((totalCapitalLossUsdBn / baselineTotalCapitalUsdBn * 100).toFixed(2))
    : 0;

  const systemicDistressIndex = Math.min(
    100,
    Number((totalSystemicLossPct * 3.2 + (cascadeRounds[2]?.newlyDistressedNodes.length || 0) * 8).toFixed(1))
  );

  let earlyWarningLevel: EarlyWarningLevel = "NORMAL";
  if (systemicDistressIndex >= 60 || totalSystemicLossPct >= 15) earlyWarningLevel = "CRITICAL_SYSTEMIC";
  else if (systemicDistressIndex >= 35 || totalSystemicLossPct >= 8) earlyWarningLevel = "ELEVATED";
  else if (systemicDistressIndex >= 15 || totalSystemicLossPct >= 3) earlyWarningLevel = "WATCH";

  // Rank vulnerable hubs & greatest contagion vectors
  const sortedByVuln = [...nodeImpacts].sort((a, b) => b.vulnerabilityIndexScore - a.vulnerabilityIndexScore);
  const mostVulnerableHubs = sortedByVuln.slice(0, 3).map((n) => n.countryCode);

  const sortedByOutward = [...nodeImpacts].sort((a, b) => b.outwardSystemicImpactScore - a.outwardSystemicImpactScore);
  const greatestContagionVectors = sortedByOutward.slice(0, 3).map((n) => n.countryCode);

  // Generate automated hedging & risk prescriptions
  const prescriptions: ContagionPrescription[] = [];

  if (mostVulnerableHubs.includes("IT") || mostVulnerableHubs.includes("FR")) {
    prescriptions.push({
      priority: "IMMEDIATE",
      domain: "SOVEREIGN_HEDGE",
      targetHubs: ["IT", "FR"],
      recommendation: "Purchase OAT-Bund and BTP-Bund credit default spread wideners or short European bank subordinated debt.",
      rationale: "Sovereign-bank doom loop sensitivity exceeds 85% of Core Tier 1 capital under spread blowout.",
    });
  }

  if (systemicDistressIndex >= 30) {
    prescriptions.push({
      priority: "HIGH",
      domain: "LIQUIDITY_BUFFER",
      targetHubs: ["US", "DE", "GB"],
      recommendation: "Increase high-quality liquid asset (HQLA) central bank deposit allocations by 250-400 bps.",
      rationale: "Cross-border interbank transmission velocity threatens short-term repo hair-cuts.",
    });
  }

  if (mostVulnerableHubs.some((c) => ["VN", "BR", "KR"].includes(c))) {
    prescriptions.push({
      priority: "TACTICAL",
      domain: "FX_SWAP_ACCESS",
      targetHubs: ["VN", "BR", "KR"],
      recommendation: "Hedge emerging market USD cross-currency basis swap tightness and rollover exposures.",
      rationale: "Secondary liquidity drain triggers cross-border dollar funding squeeze in peripheral hubs.",
    });
  }

  const rawPayload = {
    simulatedAt: timestamp,
    shocks,
    systemicDistressIndex,
    totalCapitalLossUsdBn: Number(totalCapitalLossUsdBn.toFixed(1)),
    totalSystemicLossPct,
    earlyWarningLevel,
    nodeImpacts,
  };

  const fingerprint = deterministicFingerprint(rawPayload);
  const snapshotId = `contagion-${fingerprint.replace("fnv1a32-", "")}`;

  return {
    snapshotId,
    schemaVersion: "1.0.0",
    simulatedAt: timestamp,
    shockParameters: shocks,
    overallSystemicDistressIndex: systemicDistressIndex,
    totalSystemicCapitalLossUsdBn: Number(totalCapitalLossUsdBn.toFixed(1)),
    totalSystemicCapitalLossPct: totalSystemicLossPct,
    cascadeRoundsCompleted: cascadeRounds.length,
    earlyWarningLevel,
    mostVulnerableHubs,
    greatestContagionVectors,
    nodeImpacts,
    cascadeRounds,
    prescriptions,
    fingerprint,
  };
}

export function exportContagionSnapshotToCSV(snapshot: LiquidityCascadeSimulationSnapshot): string {
  const headers = [
    "CountryCode",
    "CountryName",
    "Region",
    "InitialCapitalPct",
    "DepletedCapitalPct",
    "CapitalLossPct",
    "CapitalLossUsdBn",
    "StressedCdsSpreadBps",
    "CdsSpreadWiderBps",
    "DoomLoopLossPct",
    "InterbankLossPct",
    "FireSaleLossPct",
    "OutwardImpactScore",
    "VulnerabilityScore",
    "Status",
  ];

  const rows = snapshot.nodeImpacts.map((n) => [
    n.countryCode,
    `"${n.countryName}"`,
    n.region,
    n.initialCapitalPct.toFixed(2),
    n.depletedCapitalPct.toFixed(2),
    n.capitalLossPct.toFixed(2),
    n.capitalLossUsdBn.toFixed(1),
    n.stressedCdsSpreadBps,
    n.cdsSpreadWiderBps,
    n.sovereignDoomLoopLossPct.toFixed(2),
    n.interbankSpilloverLossPct.toFixed(2),
    n.fireSaleDiscountLossPct.toFixed(2),
    n.outwardSystemicImpactScore.toFixed(1),
    n.vulnerabilityIndexScore.toFixed(1),
    n.status,
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export function exportContagionSnapshotToMarkdown(snapshot: LiquidityCascadeSimulationSnapshot): string {
  const shockSummary = snapshot.shockParameters
    .map(
      (s) =>
        `- **Epicenter Hub:** \`${s.epicenterCountry}\` | **Sovereign CDS Shock:** \`+${s.initialSovereignCdsShockBps || 0} bps\` | **Capital Loss:** \`${s.initialBankCapitalLossPct || 0}%\``
    )
    .join("\n");

  const tableRows = snapshot.nodeImpacts
    .map(
      (n) =>
        `| **${n.countryCode}** (${n.countryName}) | ${n.region} | \`${n.initialCapitalPct}%\` | \`${n.depletedCapitalPct}%\` | \`${n.capitalLossPct}%\` | \`$${n.capitalLossUsdBn}B\` | \`${n.stressedCdsSpreadBps} bps\` (+\`${n.cdsSpreadWiderBps}\`) | \`${n.vulnerabilityIndexScore}\` | \`${n.status}\` |`
    )
    .join("\n");

  const prescriptionsList = snapshot.prescriptions
    .map(
      (p) =>
        `### [${p.priority}] ${p.domain} — Hubs: ${p.targetHubs.map((h) => `\`${h}\``).join(", ")}\n` +
        `- **Recommendation:** ${p.recommendation}\n` +
        `- **Rationale:** ${p.rationale}\n`
    )
    .join("\n");

  const roundsList = snapshot.cascadeRounds
    .map(
      (r) =>
        `#### Round ${r.round}: ${r.roundName}\n` +
        `- **Marginal Systemic Loss:** \`$${r.marginalLossUsdBn}B\` (\`${r.marginalCapitalLossPct}%\` systemic tier 1 capital)\n` +
        `- **Newly Distressed Hubs:** ${r.newlyDistressedNodes.length > 0 ? r.newlyDistressedNodes.map((h) => `\`${h}\``).join(", ") : "None"}\n` +
        `- **Newly Insolvent Hubs:** ${r.newlyInsolventNodes.length > 0 ? r.newlyInsolventNodes.map((h) => `\`${h}\``).join(", ") : "None"}\n`
    )
    .join("\n");

  return `# Liquidity Cascade Early Warning & Sovereign Contagion Audit Dossier

**Snapshot ID:** \`${snapshot.snapshotId}\`
**Lineage Fingerprint:** \`${snapshot.fingerprint}\`
**Simulated At:** \`${snapshot.simulatedAt}\`
**Early Warning Signal Level:** \`${snapshot.earlyWarningLevel}\`
**Overall Systemic Distress Index:** \`${snapshot.overallSystemicDistressIndex} / 100\`
**Total Systemic Capital Loss:** \`$${snapshot.totalSystemicCapitalLossUsdBn}B\` (\`${snapshot.totalSystemicCapitalLossPct}%\`)

---

## 1. Initial Shock Injections
${shockSummary}

---

## 2. Multi-Round Contagion Propagation
${roundsList}

---

## 3. Sovereign & Interbank Hub Stress Matrix
| Hub | Region | Initial CET1 | Depleted CET1 | Capital Loss | Loss ($Bn) | Stressed CDS | Vulnerability | Status |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
${tableRows}

---

## 4. Prescriptive Action Plan & Hedging Overlay
${prescriptionsList}
`;
}
