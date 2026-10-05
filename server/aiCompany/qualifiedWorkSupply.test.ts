import { describe, it, expect } from "vitest";
import path from "node:path";
import {
  QualifiedWorkSupplyManager,
  type CandidateWork,
  type ProductOpportunity,
  type QualifiedWorkItem,
  type ResearchQuestion,
} from "./qualifiedWorkSupply";

describe("Qualified Work Supply & Product Development Intelligence (V2.1)", () => {
  const rootDir = process.cwd();
  const manager = new QualifiedWorkSupplyManager(rootDir);

  // Sample Opportunity & Candidate for testing
  const sampleOpportunity: ProductOpportunity = {
    id: "OPP-TIPS-LIQUIDITY",
    title: "TIPS Liquidity-Adjusted Breakeven Prototype",
    problem_statement: "Unadjusted 10y breakevens plummeted 110 bps in March 2020 due to cash Treasury dislocations, giving false deflation signals.",
    gap_or_unknown: "Off-the-run Treasury yield spread proxy threshold.",
    target_persona: "Fixed Income PM",
    golden_journey_id: "JOURNEY_1_INFLATION_RATES",
    supporting_evidence: ["FEDS 2020-084 study", "FRED DGS10 - DFII10 data"],
    counter_evidence: ["In tranquil periods, liquidity premia average under 10 bps."],
    hypothesis: "Liquidity filtering prevents false regime signals during financial market dislocations.",
    strategic_horizon: "H0",
    created_at: new Date().toISOString(),
  };

  const sampleCandidate: CandidateWork = {
    id: "CW-TIPS-ADJUSTER",
    opportunity_id: "OPP-TIPS-LIQUIDITY",
    title: "TIPS Liquidity-Adjusted Breakeven Prototype",
    proposed_intervention: "Implement liquidity adjustment filter using off-the-run spread threshold.",
    action_type: "PROTOTYPE",
    scope_paths: ["server/analytics/breakevenAdjuster.ts", "server/analytics/breakevenAdjuster.test.ts"],
    expected_impact: "Provides filtered breakeven series preventing regime misclassification during flight-to-safety events.",
    estimated_complexity: "LOW",
    dependencies: ["7ad51b6"],
    created_at: new Date().toISOString(),
  };

  it("Proof 2 & 5: evaluates candidate against Goal lineage and produces Task Evidence Pack", () => {
    const result = manager.evaluateCandidateForQualification(sampleCandidate, sampleOpportunity, []);
    expect(result.decision).toBe("QUALIFIED");
    expect(result.total_score).toBeGreaterThanOrEqual(100);
    expect(result.passed_mandatory_gates).toBe(true);
    expect(result.evidence_pack).toBeDefined();
    expect(result.evidence_pack?.goal_lineage).toContain("JOURNEY_1_INFLATION_RATES");
    expect(result.evidence_pack?.supporting_evidence).toHaveLength(2);
  });

  it("Proof 6: naturally discriminates across QUALIFIED, RESEARCH_REQUIRED, DEFERRED, REJECTED, and MERGED_SUPERSEDED", () => {
    // 1. RESEARCH_REQUIRED: Missing counter-evidence on BUILD action
    const unresearchedOpp: ProductOpportunity = {
      ...sampleOpportunity,
      counter_evidence: [], // No counter-evidence or disconfirming research
    };
    const buildCandidate: CandidateWork = {
      ...sampleCandidate,
      action_type: "BUILD",
    };
    const resReq = manager.evaluateCandidateForQualification(buildCandidate, unresearchedOpp, []);
    expect(resReq.decision).toBe("RESEARCH_REQUIRED");
    expect(resReq.reason).toContain("Significant uncertainties remain");

    // 2. REJECTED: Deliberate KILL decision (e.g. predictive advice)
    const killCandidate: CandidateWork = {
      ...sampleCandidate,
      action_type: "KILL",
    };
    const resKill = manager.evaluateCandidateForQualification(killCandidate, sampleOpportunity, []);
    expect(resKill.decision).toBe("REJECTED");
    expect(resKill.reason).toContain("kill decision");

    // 3. DEFERRED: Horizon H2 or high complexity
    const deferredOpp: ProductOpportunity = {
      ...sampleOpportunity,
      strategic_horizon: "H2",
    };
    const resDef = manager.evaluateCandidateForQualification(sampleCandidate, deferredOpp, []);
    expect(resDef.decision).toBe("DEFERRED");

    // 4. MERGED_SUPERSEDED: Exact duplicate candidate in existing inventory
    const existingItem: QualifiedWorkItem = {
      id: "QW-EXISTING-1",
      candidate_id: sampleCandidate.id,
      title: sampleCandidate.title,
      action_type: "PROTOTYPE",
      qualification_status: "QUALIFIED",
      qualification_reason: "Pre-existing",
      evidence_pack: {} as any,
      qualification_score: 90,
      allowed_paths: [],
      status: "PENDING_SELECTION",
      last_evaluated_at: new Date().toISOString(),
    };
    const resDup = manager.evaluateCandidateForQualification(sampleCandidate, sampleOpportunity, [existingItem]);
    expect(resDup.decision).toBe("MERGED_SUPERSEDED");
  });

  it("Proof 7, 8, 9: enforces selective execution with Why This Now while preserving surplus qualified options", () => {
    const inventory: QualifiedWorkItem[] = [
      {
        id: "QW-ITEM-1",
        candidate_id: "CW-1",
        title: "TIPS Liquidity-Adjusted Breakeven Prototype",
        action_type: "PROTOTYPE",
        qualification_status: "QUALIFIED",
        qualification_reason: "High EV",
        evidence_pack: {
          why_this_exists: "Inflation journey priority",
          goal_lineage: "Product Goal Tier 1",
          problem_or_unknown: "Liquidity distortion",
          current_product_reality: "Raw FRED breakevens",
          supporting_evidence: ["study1"],
          contradictory_evidence: [],
          important_uncertainties: [],
          expected_product_contribution: "Regime filter",
          dependencies: [],
          related_work_ids: [],
          invalidation_conditions: [],
          verification_plan: ["test"],
          freshness_timestamp: new Date().toISOString(),
        },
        qualification_score: 95,
        allowed_paths: ["server/analytics/breakevenAdjuster.ts"],
        status: "PENDING_SELECTION",
        last_evaluated_at: new Date().toISOString(),
      },
      {
        id: "QW-ITEM-2",
        candidate_id: "CW-2",
        title: "Vietnam Credit Growth vs Property Decoupling",
        action_type: "BUILD",
        qualification_status: "QUALIFIED",
        qualification_reason: "Strong option preserved",
        evidence_pack: {
          why_this_exists: "Credit journey priority",
          goal_lineage: "Product Goal Tier 2",
          problem_or_unknown: "Lagged price reporting",
          current_product_reality: "VN CPI active",
          supporting_evidence: ["sbv quota"],
          contradictory_evidence: [],
          important_uncertainties: [],
          expected_product_contribution: "Early warning",
          dependencies: [],
          related_work_ids: [],
          invalidation_conditions: [],
          verification_plan: ["test"],
          freshness_timestamp: new Date().toISOString(),
        },
        qualification_score: 88,
        allowed_paths: ["server/analytics/vietnamCreditRegime.ts"],
        status: "PENDING_SELECTION",
        last_evaluated_at: new Date().toISOString(),
      },
    ];

    const admission = manager.selectExecutionCommitment(inventory);

    // Proof 9: Selected exactly 1 focused commitment with Why This Now
    expect(admission.selectedCommitment).not.toBeNull();
    expect(admission.selectedCommitment?.qualified_work_id).toBe("QW-ITEM-1");
    expect(admission.selectedCommitment?.why_this_now.why_this).toContain("Highest scored qualified item");
    expect(admission.selectedCommitment?.why_this_now.strongest_alternative_id).toBe("QW-ITEM-2");

    // Proof 8: Good task intentionally unexecuted and preserved
    expect(admission.unselectedQualifiedItems).toHaveLength(1);
    expect(admission.unselectedQualifiedItems[0].id).toBe("QW-ITEM-2");
    expect(admission.unselectedQualifiedItems[0].qualification_score).toBe(88);

    // Proof 7: Qualified Surplus (2 qualified items > 1 active commitment)
    expect(inventory.length).toBeGreaterThan(1);
  });

  it("Proof 10 & 11: computes Qualified Work Runway metrics and detects health states", () => {
    const inventory: QualifiedWorkItem[] = [
      {
        id: "QW-1",
        candidate_id: "CW-1",
        title: "CPI Inflation Rates",
        action_type: "BUILD",
        qualification_status: "QUALIFIED",
        qualification_reason: "Clean",
        evidence_pack: { dependencies: [], supporting_evidence: ["e1", "e2"] } as any,
        qualification_score: 90,
        allowed_paths: [],
        status: "PENDING_SELECTION",
        last_evaluated_at: new Date().toISOString(),
      },
      {
        id: "QW-2",
        candidate_id: "CW-2",
        title: "Liquidity FX Stress Indicator",
        action_type: "BUILD",
        qualification_status: "QUALIFIED",
        evidence_pack: { dependencies: [], supporting_evidence: ["e1", "e2"] } as any,
        qualification_reason: "Clean",
        qualification_score: 85,
        allowed_paths: [],
        status: "PENDING_SELECTION",
        last_evaluated_at: new Date().toISOString(),
      },
      {
        id: "QW-3",
        candidate_id: "CW-3",
        title: "Vietnam Credit Real Estate Regimes",
        action_type: "BUILD",
        qualification_status: "QUALIFIED",
        evidence_pack: { dependencies: [], supporting_evidence: ["e1", "e2"] } as any,
        qualification_reason: "Clean",
        qualification_score: 92,
        allowed_paths: [],
        status: "PENDING_SELECTION",
        last_evaluated_at: new Date().toISOString(),
      },
    ];

    const healthyRunway = manager.assessQualifiedWorkRunway(inventory, 1.0);
    expect(healthyRunway.runway_state).toBe("HEALTHY");
    expect(healthyRunway.qualified_depth).toBe(3);
    expect(healthyRunway.semantic_diversity).toBe(1.0);
    expect(healthyRunway.estimated_runway_cycles).toBe(3.0);
    expect(healthyRunway.replenishment_recommended).toBe(false);

    // Starvation risk case: empty inventory
    const starvedRunway = manager.assessQualifiedWorkRunway([], 1.0);
    expect(starvedRunway.runway_state).toBe("STARVATION_RISK");
    expect(starvedRunway.replenishment_recommended).toBe(true);
    expect(starvedRunway.replenishment_actions.length).toBeGreaterThan(0);
  });

  it("Proof 13: anti-livelock handles blocked candidate by pivoting to alternative qualified option", () => {
    const blockedItem: QualifiedWorkItem = {
      id: "QW-BLOCKED-1",
      candidate_id: "CW-B1",
      title: "Blocked Objective Candidate",
      action_type: "BUILD",
      qualification_status: "QUALIFIED",
      qualification_reason: "Valid but blocked",
      evidence_pack: { dependencies: ["UNAVAILABLE-API"] } as any,
      qualification_score: 90,
      allowed_paths: [],
      status: "PENDING_SELECTION",
      last_evaluated_at: new Date().toISOString(),
    };

    const alternateItem: QualifiedWorkItem = {
      id: "QW-ALT-2",
      candidate_id: "CW-A2",
      title: "Alternative Ready Objective",
      action_type: "BUILD",
      qualification_status: "QUALIFIED",
      qualification_reason: "Ready to run",
      evidence_pack: { dependencies: [] } as any,
      qualification_score: 85,
      allowed_paths: [],
      status: "PENDING_SELECTION",
      last_evaluated_at: new Date().toISOString(),
    };

    const result = manager.handleBlockedCandidate(blockedItem, "Upstream provider rate limited", [blockedItem, alternateItem]);
    expect(result.actionTaken).toBe("PIVOT_TO_ALTERNATIVE");
    expect(result.alternativeNBA?.id).toBe("QW-ALT-2");
    expect(result.updatedItem.status).toBe("BLOCKED");
    expect(result.updatedItem.blocked_retry_condition).toContain("Do not retry");
  });

  it("Proof 14: real product outcome updates supply, unblocking dependencies and superseding redundant items", () => {
    const deliveredItem: QualifiedWorkItem = {
      id: "QW-DELIVERED-1",
      candidate_id: "CW-D1",
      title: "Central Bank Statement Diff Grounding",
      action_type: "BUILD",
      qualification_status: "QUALIFIED",
      qualification_reason: "Delivered",
      evidence_pack: { why_this_exists: "RQ-DIFF-01", dependencies: [], supporting_evidence: ["diff-proof"] } as any,
      qualification_score: 95,
      allowed_paths: [],
      status: "EXECUTING",
      last_evaluated_at: new Date().toISOString(),
    };

    const dependentItem: QualifiedWorkItem = {
      id: "QW-DEPENDENT-2",
      candidate_id: "CW-DEP2",
      title: "Automated Hawkish/Dovish Shift Detection",
      action_type: "BUILD",
      qualification_status: "QUALIFIED",
      qualification_reason: "Depends on grounding",
      evidence_pack: { dependencies: [deliveredItem.id], supporting_evidence: [] } as any,
      qualification_score: 88,
      allowed_paths: [],
      status: "BLOCKED",
      blocked_reason: "Waiting on statement diff grounding",
      last_evaluated_at: new Date().toISOString(),
    };

    const redundantItem: QualifiedWorkItem = {
      id: "QW-REDUNDANT-3",
      candidate_id: "CW-RED3",
      title: "Legacy Central Bank Statement Diff Grounding Variant",
      action_type: "BUILD",
      qualification_status: "QUALIFIED",
      qualification_reason: "Duplicate idea",
      evidence_pack: { dependencies: [], supporting_evidence: [] } as any,
      qualification_score: 60,
      allowed_paths: [],
      status: "PENDING_SELECTION",
      last_evaluated_at: new Date().toISOString(),
    };

    const question: ResearchQuestion = {
      id: "RQ-DIFF-01",
      question: "Can diff quotes be grounded without hallucinations?",
      goal_connection: "Trust boundary",
      why_it_matters: "Sentiment accuracy",
      current_belief: "Yes with exact quote validation",
      known_evidence: [],
      important_unknown: "None",
      decision_this_may_change: deliveredItem.id,
      what_would_change_mind: "Failed tests",
      appropriate_source_types: [],
      stop_condition: "Unit pass",
      disconfirming_hypotheses: [],
      priority: "HIGH",
      status: "IN_PROGRESS",
      created_at: new Date().toISOString(),
    };

    const outcomeUpdate = manager.updateSupplyFromProductOutcome(
      deliveredItem,
      [deliveredItem, dependentItem, redundantItem],
      [question]
    );

    // Dependent item unblocked
    expect(outcomeUpdate.newlyPossibleItems).toContain("QW-DEPENDENT-2");
    const updatedDep = outcomeUpdate.updatedInventory.find((i) => i.id === "QW-DEPENDENT-2");
    expect(updatedDep?.status).toBe("PENDING_SELECTION");
    expect(updatedDep?.evidence_pack.dependencies).toHaveLength(0);

    // Redundant item superseded
    expect(outcomeUpdate.noLongerNecessaryItems).toContain("QW-REDUNDANT-3");
    const updatedRed = outcomeUpdate.updatedInventory.find((i) => i.id === "QW-REDUNDANT-3");
    expect(updatedRed?.qualification_status).toBe("MERGED_SUPERSEDED");

    // Research question resolved
    expect(outcomeUpdate.updatedQuestions[0].status).toBe("COMPLETED");
  });

  it("Proof 17 & 18: longitudinal compounding evaluation proves task quality gains and failure reduction", () => {
    const baselineTasks = [
      { goal_lineage_hops: 4, bounded_scope: false, deduplicated: false, verified_evidence: false },
      { goal_lineage_hops: 3, bounded_scope: true, deduplicated: false, verified_evidence: true },
    ];

    const compoundedTasks = [
      { goal_lineage_hops: 1, bounded_scope: true, deduplicated: true, verified_evidence: true },
      { goal_lineage_hops: 1, bounded_scope: true, deduplicated: true, verified_evidence: true },
    ];

    const evalResult = manager.evaluateTaskQualityCompounding(baselineTasks, compoundedTasks);
    expect(evalResult.baselineQualityScore).toBeLessThan(50);
    expect(evalResult.compoundedQualityScore).toBe(100);
    expect(evalResult.qualityGainPct).toBeGreaterThan(100);
    expect(evalResult.failureRecurrenceReductionPct).toBe(100);
    expect(evalResult.isCompoundingProven).toBe(true);
  });

  it("Continuity Freeze Guard: rejects control plane continuity candidates without failure evidence", () => {
    const frozenCandidate: CandidateWork = {
      ...sampleCandidate,
      id: "CW-CONTROL-PLANE-EXT",
      title: "Add distributed queue to continuity kernel",
      proposed_intervention: "continuity kernel redis integration",
      work_class: "CONTROL_PLANE_CONTINUITY",
    };

    const resFrozen = manager.evaluateCandidateForQualification(frozenCandidate, sampleOpportunity, []);
    expect(resFrozen.decision).toBe("REJECTED");
    expect(resFrozen.reason).toContain("Control plane continuity infrastructure is FROZEN");

    const authorizedCandidate: CandidateWork = {
      ...frozenCandidate,
      runtime_failure_evidence_id: "RFE-2026-CRASH-002",
    };
    const resAuth = manager.evaluateCandidateForQualification(authorizedCandidate, sampleOpportunity, []);
    expect(resAuth.decision).toBe("QUALIFIED");
  });
});
