import { describe, expect, it } from "vitest";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import {
  CompoundingIntelligenceEngine,
  type CompanyEpochMetrics,
} from "./compoundingIntelligence";

describe("CompoundingIntelligenceEngine (L4 Compounding Intelligence)", () => {
  const baselineEpoch: CompanyEpochMetrics = {
    epoch_id: "EPOCH_1_TO_18_BASELINE",
    epoch_name: "Cycles 1–18 Sandbox Simulator",
    cycle_range: "1–18",
    cycles_count: 18,
    objectives_attempted: 18,
    objectives_delivered_to_main: 0,
    first_pass_delivery_rate_pct: 0,
    average_rework_cycles_per_delivered_item: 18,
    rediscovery_of_known_failures_count: 5,
    scheduler_livelocks_count: 3,
    average_tokens_consumed_per_cycle: 21000,
    tokens_per_verified_main_commit: "INFINITY",
    lines_of_code_surviving_in_main: 0,
  };

  const compoundedEpoch: CompanyEpochMetrics = {
    epoch_id: "EPOCH_19_TO_21_ADAPTED",
    epoch_name: "Cycles 19–21 Autonomous Delivery",
    cycle_range: "19–21",
    cycles_count: 3,
    objectives_attempted: 3,
    objectives_delivered_to_main: 3,
    first_pass_delivery_rate_pct: 100,
    average_rework_cycles_per_delivered_item: 1.0,
    rediscovery_of_known_failures_count: 0,
    scheduler_livelocks_count: 0,
    average_tokens_consumed_per_cycle: 21000,
    tokens_per_verified_main_commit: 21000,
    lines_of_code_surviving_in_main: 461,
  };

  it("does not overclaim empirical acceleration from sandbox/simulator epochs", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "ai-compounding-test-"));
    const engine = new CompoundingIntelligenceEngine(tmpDir);

    const result = engine.evaluateEpochs(baselineEpoch, compoundedEpoch);

    expect(result.is_compounding_empirically_proven).toBe(false);
    expect(result.evidence_quality).toBe("CLAIM_ONLY");
    expect(result.delivery_acceleration_factor).toBeGreaterThanOrEqual(100);
    expect(result.waste_reduction_pct).toBeGreaterThan(90);
    expect(result.compounded_epoch.first_pass_delivery_rate_pct).toBe(100);
    expect(result.baseline_epoch.first_pass_delivery_rate_pct).toBe(0);
    expect(result.auditable_evidence.length).toBeGreaterThanOrEqual(3);

    await engine.persistResult(result);
    const loaded = await engine.loadLatestResult();
    expect(loaded).not.toBeNull();
    expect(loaded?.is_compounding_empirically_proven).toBe(false);
  });
});
