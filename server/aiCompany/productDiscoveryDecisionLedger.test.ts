import { describe, expect, it } from "vitest";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { ProductDiscoveryDecisionLedger, type ProductDiscoveryDecision } from "./productDiscoveryDecisionLedger";

describe("ProductDiscoveryDecisionLedger", () => {
  it("records discovery decisions and evaluates decision diversity fail-closed", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "ai-discovery-decisions-"));
    const ledger = new ProductDiscoveryDecisionLedger(tmpDir);

    const decisions: ProductDiscoveryDecision[] = [
      {
        decision_id: "DEC-INFLATION-RATE-SPREAD",
        opportunity_id: "OPP-INFLATION-RATE-REGIME-SPREAD",
        golden_journey_id: "JOURNEY_INFLATION_RATES",
        domain: "REGIME_MODELS",
        title: "Inflation Expectations & Real Yield Spread Analyzer",
        decision_type: "PROTOTYPE",
        deep_research: {
          hypothesis: "Breakeven inflation rates combined with Fed Funds indicate regime changes.",
          data_sources_examined: ["FRED:T10YIE", "FRED:FEDFUNDS"],
          provider_limitations_found: ["TIPS liquidity premia during stress episodes"],
          contradictions_identified: ["Liquidity distortions falsely signal disinflation during market panics"],
          assumptions_rejected: ["Breakeven rate equals pure inflation expectations"],
          remaining_unknowns: ["Magnitude of TIPS illiquidity discount in rapid rate-hiking regimes"],
        },
        decision_rationale: "Prototype a liquidity-adjusted breakeven model before production promotion.",
        recorded_at: new Date().toISOString(),
        actor: "pm-agent",
      },
      {
        decision_id: "DEC-COMPOSITE-LIQUIDITY",
        opportunity_id: "OPP-COMPOSITE-LIQUIDITY-INDEX",
        golden_journey_id: "JOURNEY_LIQUIDITY_FX",
        domain: "REGIME_MODELS",
        title: "Composite Cross-Currency Liquidity Stress Indicator",
        decision_type: "RESEARCH",
        deep_research: {
          hypothesis: "SOFR, RRP, and DXY combine into a predictive EM FX liquidity stress index.",
          data_sources_examined: ["FRED:SOFR", "FRED:RRPONTSYD", "FRED:DTWEXBGS"],
          provider_limitations_found: ["RRP facility drain timing variations"],
          contradictions_identified: ["Central bank FX intervention buffers mask linear transmission"],
          assumptions_rejected: ["Linear comovement between SOFR spikes and spot EM FX depreciation"],
          remaining_unknowns: ["Central bank reaction function timing in Vietnam and China"],
        },
        decision_rationale: "Conduct academic research on capital control reaction functions first.",
        recorded_at: new Date().toISOString(),
        actor: "pm-agent",
      },
      {
        decision_id: "DEC-CREDIT-PROPERTY-STRESS",
        opportunity_id: "OPP-VN-CREDIT-PROPERTY-STRESS",
        golden_journey_id: "JOURNEY_CREDIT_REAL_ESTATE",
        domain: "GOLDEN_JOURNEYS",
        title: "Credit Growth & Property Price Decoupling Monitor",
        decision_type: "BUILD",
        deep_research: {
          hypothesis: "Decoupling between bank credit and property transaction volume signals leverage stress.",
          data_sources_examined: ["SBV:credit-growth-vn", "GSO:apartment-price-vn"],
          provider_limitations_found: ["Quarterly reporting frequency of transaction volumes"],
          contradictions_identified: ["Nominal property price resilience during volume freezes"],
          assumptions_rejected: ["Property prices fall concurrently with volume declines"],
          remaining_unknowns: ["Secondary market informal developer lending volumes"],
        },
        decision_rationale: "Build the decoupling indicator since core series freshness is now contractually verified.",
        recorded_at: new Date().toISOString(),
        actor: "pm-agent",
      },
      {
        decision_id: "DEC-PREDICTIVE-TRADING-SIGNALS",
        opportunity_id: "OPP-SYNTHETIC-PREDICTIVE-TRADING-SIGNALS",
        golden_journey_id: "JOURNEY_INFLATION_RATES",
        domain: "TRADING_SIGNALS",
        title: "Automated Algorithmic Buy/Sell Trading Signals",
        decision_type: "KILL",
        deep_research: {
          hypothesis: "AI-generated trading signals increase user engagement.",
          data_sources_examined: ["Synthetic Momentum Indicators"],
          provider_limitations_found: ["Severe overfitting to past regimes"],
          contradictions_identified: ["Directly violates Product Goal fact/inference separation and non-advice policy"],
          assumptions_rejected: ["Black-box signals create long-term institutional value"],
          remaining_unknowns: [],
        },
        decision_rationale: "KILL permanently: violates core Product Goal and creates regulatory non-compliance.",
        recorded_at: new Date().toISOString(),
        actor: "pm-agent",
      },
    ];

    for (const d of decisions) {
      await ledger.record(d);
    }

    const loaded = await ledger.list();
    expect(loaded).toHaveLength(4);

    const diversity = ledger.evaluateDecisionDiversity(loaded);
    expect(diversity.has_diversity).toBe(true);
    expect(diversity.unique_decision_types.length).toBeGreaterThanOrEqual(3);
    expect(diversity.has_kill_or_simplify).toBe(true);
    expect(diversity.journey_coverage).toEqual(
      expect.arrayContaining([
        "JOURNEY_INFLATION_RATES",
        "JOURNEY_LIQUIDITY_FX",
        "JOURNEY_CREDIT_REAL_ESTATE",
      ])
    );
  });
});
