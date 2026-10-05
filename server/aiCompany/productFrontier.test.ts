import path from "node:path";
import { describe, expect, it } from "vitest";
import { ProductFrontierManager } from "./productFrontier";

describe("ProductFrontierManager", () => {
  const rootDir = process.cwd();
  const manager = new ProductFrontierManager(rootDir);

  it("loads the canonical product frontier and validates thesis tenets", async () => {
    const frontier = await manager.load();
    expect(frontier.version).toBe("2.0.0");
    expect(frontier.product_thesis.core_tenets.length).toBeGreaterThanOrEqual(3);
    expect(frontier.product_thesis.differentiation_vs_terminals.length).toBeGreaterThanOrEqual(2);
  });

  it("evaluates capability coverage across core macro domains", async () => {
    const frontier = await manager.load();
    const evaluation = manager.evaluateCoverage(frontier);
    expect(evaluation.overall_coverage_pct).toBeGreaterThan(70);
    expect(evaluation.mature_count).toBeGreaterThanOrEqual(3);
    expect(evaluation.golden_journey_count).toBe(3);
    expect(evaluation.total_gaps_count).toBeGreaterThanOrEqual(2);
  });

  it("verifies all 3 golden journeys have mapped personas and valid indicators", async () => {
    const frontier = await manager.load();
    expect(frontier.golden_journeys).toHaveLength(3);

    const journeyIds = frontier.golden_journeys.map((j) => j.id);
    expect(journeyIds).toContain("JOURNEY_INFLATION_RATES");
    expect(journeyIds).toContain("JOURNEY_LIQUIDITY_FX");
    expect(journeyIds).toContain("JOURNEY_CREDIT_REAL_ESTATE");

    for (const journey of frontier.golden_journeys) {
      expect(journey.persona).toBeTruthy();
      expect(journey.indicators.length).toBeGreaterThan(0);
      expect(["LEVEL_1_VERIFIED", "LEVEL_2_INTERACTIVE", "LEVEL_3_DECISION_READY"]).toContain(journey.current_maturity);
    }
  });

  it("discovers actionable opportunities from identified frontier gaps with diverse actions", async () => {
    const frontier = await manager.load();
    const opportunities = manager.discoverOpportunities(frontier);

    expect(opportunities.length).toBeGreaterThanOrEqual(4);
    const actions = new Set(opportunities.map((o) => o.recommended_action));
    expect(actions.has("BUILD") || actions.has("PROTOTYPE")).toBe(true);
    expect(actions.has("RESEARCH")).toBe(true);

    const p1Opps = opportunities.filter((o) => o.priority === "P1");
    expect(p1Opps.length).toBeGreaterThan(0);
  });
});
