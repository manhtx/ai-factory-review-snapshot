import { describe, it, expect } from "vitest";
import {
  QualifiedWorkSupplyManager,
  type CandidateWork,
  type ProductOpportunity,
  type QualifiedWorkItem,
  type BoundedEvidenceAction,
} from "./qualifiedWorkSupply";

describe("Product Intelligence Recovery & Protocol V3 Verification", () => {
  const rootDir = process.cwd();
  const manager = new QualifiedWorkSupplyManager(rootDir);

  // ==========================================================================
  // SECTION 34: TEST MATRIX — EVIDENCE ACTION (E01–E06)
  // ==========================================================================
  describe("Evidence Action Test Matrix (E01-E06)", () => {
    it("E01 & E04: important uncertainty generates bounded action with explicit stop condition", () => {
      const action = manager.createBoundedEvidenceAction({
        action_id: "ACT-QUERY-HOLIDAY-STALES",
        action_type: "QUERY_EXISTING_DATA",
        question_or_unknown: "Are international bank holidays causing false stale flags in canonical database?",
        target_source_or_query: "observations:holiday_window",
        decision_this_changes: "Whether to qualify holiday calendar awareness or retain current fail-closed policy",
        stop_condition: "Scanned all observations across 2024-2026 for Tet and Golden Week periods",
      });

      expect(action.action_id).toBe("ACT-QUERY-HOLIDAY-STALES");
      expect(action.action_type).toBe("QUERY_EXISTING_DATA");
      expect(action.stop_condition).toContain("Scanned all observations");
      expect(action.decision_this_changes).toContain("Whether to qualify");
      expect(action.status).toBe("PENDING");

      // Verify validation requires stop condition
      expect(() =>
        manager.createBoundedEvidenceAction({
          action_id: "ACT-BAD",
          action_type: "QUERY_EXISTING_DATA",
          question_or_unknown: "No stop",
          target_source_or_query: "query",
          decision_this_changes: "decision",
          stop_condition: "",
        })
      ).toThrow(/stop condition/);
    });

    it("E02 & E03: bounded evidence action does NOT auto-create engineering or ingestion tasks when data is missing", () => {
      const action = manager.createBoundedEvidenceAction({
        action_id: "ACT-CHECK-FX-FIXING",
        action_type: "QUERY_EXISTING_DATA",
        question_or_unknown: "Does local canonical database have daily central bank fixing rates?",
        target_source_or_query: "sbv_daily_fixing_rate",
        decision_this_changes: "Whether to model fixing buffer or hold",
        stop_condition: "Checked observations table for sbv_daily_fixing_rate",
      });

      // Data lookup finds 0 records
      const finding = manager.executeBoundedEvidenceAction(action, {
        dataLookup: () => ({ count: 0 }),
      });

      expect(finding.evidence_status).toBe("INSUFFICIENT_BUT_ACQUIRABLE");
      expect(finding.raw_observations_count).toBe(0);
      expect(finding.product_implication).toContain("Missing data does NOT imply an automatic ingestion task");
      expect(finding.next_action).toBe("ACQUIRE_EVIDENCE"); // Proposes evidence acquisition inquiry, not an engineering build
    });

    it("E05 & E06: evidence execution produces finding that directly changes PM decision", () => {
      const action = manager.createBoundedEvidenceAction({
        action_id: "ACT-CHECK-EXISTING-DATA",
        action_type: "QUERY_EXISTING_DATA",
        question_or_unknown: "Is 10y Treasury nominal yield data available locally?",
        target_source_or_query: "us10y-yield",
        decision_this_changes: "Whether to proceed with yield spread analysis",
        stop_condition: "Checked observations count",
      });

      // Data lookup finds 16,872 records
      const finding = manager.executeBoundedEvidenceAction(action, {
        dataLookup: () => ({ count: 16872, minPeriod: "1962-01-02", maxPeriod: "2026-09-02" }),
      });

      expect(finding.evidence_status).toBe("SUPPORTED");
      expect(finding.raw_observations_count).toBe(16872);
      expect(finding.next_action).toBe("QUALIFY");

      // Finding updates PM decision
      const pmDecision = manager.evaluatePMDecision({
        itemTitle: "10y Treasury Spread Analysis",
        actionType: "PROTOTYPE",
        finding,
      });

      expect(pmDecision.decision).toBe("QUALIFY");
      expect(pmDecision.founder_escalation_required).toBe(false);
      expect(pmDecision.reason).toContain("Evidence finding validated premise");
    });
  });

  // ==========================================================================
  // SECTION 35: TEST MATRIX — HOLD (H01–H07)
  // ==========================================================================
  describe("Hold Test Matrix (H01-H07)", () => {
    it("H01 & H02: Hold requires explicit reason, evidence gap, and resume condition", () => {
      const hold = manager.createHoldContract({
        hold_reason: "Lack of provider-specific false-stale cases in historical replay",
        evidence_gap: "Zero reproduced Tet or Golden Week false staleness incidents",
        resume_condition: "Authoritative holiday calendar cohort demonstrates >= 1 false-stale with zero false-fresh upgrades",
        permitted_next_action: "QUERY_EXISTING_DATA",
      });

      expect(hold.is_held).toBe(true);
      expect(hold.hold_reason).toContain("Lack of provider-specific");
      expect(hold.resume_condition).toContain("Authoritative holiday calendar");
      expect(hold.permitted_next_action).toBe("QUERY_EXISTING_DATA");

      expect(() =>
        manager.createHoldContract({
          hold_reason: "",
          evidence_gap: "gap",
          resume_condition: "condition",
          permitted_next_action: "QUERY_EXISTING_DATA",
        })
      ).toThrow(/explicit reason/);
    });

    it("H03-H06: Hold supports distinct permitted next action routes (evidence, defer, kill, wait)", () => {
      const evidenceHold = manager.createHoldContract({
        hold_reason: "Missing external fee schedule",
        evidence_gap: "API cost unknown",
        resume_condition: "Cost confirmed < $50/mo",
        permitted_next_action: "ACQUIRE_EVIDENCE",
      });
      expect(evidenceHold.permitted_next_action).toBe("ACQUIRE_EVIDENCE");

      const deferHold = manager.createHoldContract({
        hold_reason: "High complexity multi-agent contagion model exceeds H0 budget",
        evidence_gap: "Interbank exposure network data",
        resume_condition: "Strategic horizon H2 planning cycle",
        permitted_next_action: "DEFER",
      });
      expect(deferHold.permitted_next_action).toBe("DEFER");

      const killHold = manager.createHoldContract({
        hold_reason: "Violates non-advice mandate and regulatory compliance",
        evidence_gap: "None; fundamental policy conflict",
        resume_condition: "Never (policy invariant)",
        permitted_next_action: "KILL",
      });
      expect(killHold.permitted_next_action).toBe("KILL");

      const waitHold = manager.createHoldContract({
        hold_reason: "Awaiting scheduled monthly release from BLS",
        evidence_gap: "September CPI release",
        resume_condition: "Release date 2026-10-10 reached",
        permitted_next_action: "JUSTIFIED_WAIT",
      });
      expect(waitHold.permitted_next_action).toBe("JUSTIFIED_WAIT");
    });
  });

  // ==========================================================================
  // SECTION 36: TEST MATRIX — AUTONOMOUS PM (P01–P07)
  // ==========================================================================
  describe("Autonomous PM Test Matrix (P01-P07)", () => {
    it("P01, P02, P07: Ordinary PM decisions are autonomous; weak candidates rejected without Founder grooming", () => {
      const weakCandidateDecision = manager.evaluatePMDecision({
        itemTitle: "Nice to have cosmetic color changer",
        actionType: "BUILD",
        strategicHorizon: "H2",
        estimatedValue: "LOW",
      });

      expect(weakCandidateDecision.decision).toBe("DEFER");
      expect(weakCandidateDecision.founder_escalation_required).toBe(false);
      expect(weakCandidateDecision.reason).toContain("Autonomous PM decision");
    });

    it("P03: Good option can remain pending without forced execution or draining", () => {
      const inventory: QualifiedWorkItem[] = [
        {
          id: "QW-TIPS-PREMIA",
          candidate_id: "CW-1",
          title: "TIPS Liquidity Adjustment",
          action_type: "PROTOTYPE",
          qualification_status: "QUALIFIED",
          qualification_score: 95,
          qualification_reason: "High value Journey 1 model",
          allowed_paths: ["server/analytics/breakevenAdjuster.ts"],
          status: "PENDING_SELECTION",
          evidence_pack: {
            why_this_exists: "TIPS market liquidity premia",
            goal_lineage: "Fact/inference separation",
            problem_or_unknown: "False deflation signal",
            current_product_reality: "FRED unadjusted",
            supporting_evidence: ["FEDS 2020-084"],
            contradictory_evidence: ["Tranquil spreads < 10bps"],
            important_uncertainties: ["Lookback window"],
            expected_product_contribution: "Filtered breakeven",
            dependencies: [],
            related_work_ids: [],
            invalidation_conditions: [],
            verification_plan: ["Vitest backtest"],
            freshness_timestamp: new Date().toISOString(),
          },
          last_evaluated_at: new Date().toISOString(),
        },
        {
          id: "QW-EM-FX-BUFFER",
          candidate_id: "CW-2",
          title: "EM FX Reserve Buffer",
          action_type: "BUILD",
          qualification_status: "QUALIFIED",
          qualification_score: 88,
          qualification_reason: "High value Journey 2 model",
          allowed_paths: ["server/analytics/fxFixingBuffer.ts"],
          status: "PENDING_SELECTION",
          evidence_pack: {
            why_this_exists: "Fixing band stress",
            goal_lineage: "Currency stress early warning",
            problem_or_unknown: "Latent devaluation",
            current_product_reality: "Spot only",
            supporting_evidence: ["IMF benchmarks"],
            contradictory_evidence: [],
            important_uncertainties: [],
            expected_product_contribution: "Buffer decay alert",
            dependencies: [],
            related_work_ids: [],
            invalidation_conditions: [],
            verification_plan: ["Vitest"],
            freshness_timestamp: new Date().toISOString(),
          },
          last_evaluated_at: new Date().toISOString(),
        },
      ];

      const selection = manager.selectExecutionCommitment(inventory);
      expect(selection.selectedCommitment?.qualified_work_id).toBe("QW-TIPS-PREMIA");
      expect(selection.unselectedQualifiedItems).toHaveLength(1);
      expect(selection.unselectedQualifiedItems[0].id).toBe("QW-EM-FX-BUFFER");
      // The unselected item remains preserved in inventory
      expect(selection.selectionRationale).toContain("preserving 1 qualified options in inventory");
    });

    it("P04 & P05: PM can autonomously request research or evidence acquisition", () => {
      const researchDecision = manager.evaluatePMDecision({
        itemTitle: "Non-linear composite liquidity reaction",
        actionType: "BUILD",
        strategicHorizon: "H0",
      });
      expect(researchDecision.decision).toBe("RESEARCH_MORE");
      expect(researchDecision.resulting_action_type).toBe("RESEARCH");
      expect(researchDecision.founder_escalation_required).toBe(false);

      const acquireDecision = manager.evaluatePMDecision({
        itemTitle: "State Bank of Vietnam Fixing Rates",
        actionType: "BUILD",
        finding: {
          action_id: "ACT-SBV",
          finding_summary: "Local DB missing SBV fixing rate; public website publishes daily PDF/HTML",
          evidence_status: "INSUFFICIENT_BUT_ACQUIRABLE",
          provenance: "WEB_PROBE",
          limitations: [],
          product_implication: "Feasibility check required",
          next_action: "ACQUIRE_EVIDENCE",
          falsifier: "Paywall",
          refresh_condition: "Daily",
        },
      });
      expect(acquireDecision.decision).toBe("ACQUIRE_EVIDENCE");
      expect(acquireDecision.resulting_action_type).toBe("EVIDENCE_ACTION");
      expect(acquireDecision.founder_escalation_required).toBe(false);
    });

    it("P06: Duplicates are autonomously merged/rejected", () => {
      const duplicateDecision = manager.evaluatePMDecision({
        itemTitle: "Vietnam Property Decoupling V2",
        actionType: "BUILD",
        isDuplicateOf: "QW-VN-CREDIT-PROPERTY-DECOUPLING",
      });
      expect(duplicateDecision.decision).toBe("MERGE_DUPLICATE");
      expect(duplicateDecision.reason).toContain("Duplicate candidate merged");
      expect(duplicateDecision.founder_escalation_required).toBe(false);
    });

    it("Founder Escalation strictly fires ONLY for Product Goal alteration or ungrounded live advice", () => {
      const goalAlteration = manager.evaluatePMDecision({
        itemTitle: "Remove fact/inference separation requirement",
        actionType: "SIMPLIFY",
        isAlteringProductGoal: true,
      });
      expect(goalAlteration.decision).toBe("ESCALATE_FOUNDER");
      expect(goalAlteration.founder_escalation_required).toBe(true);

      const adviceKill = manager.evaluatePMDecision({
        itemTitle: "Automated crypto momentum buy/sell signals",
        actionType: "BUILD",
        isLiveProductionAdvice: true,
      });
      expect(adviceKill.decision).toBe("KILL");
      expect(adviceKill.founder_escalation_required).toBe(false); // Autonomous kill, no founder escalation needed!
    });
  });

  // ==========================================================================
  // SECTION 38: TEST MATRIX — DELIVERY & CONSUMPTION (D01–D06)
  // ==========================================================================
  describe("Delivery & Consumption Test Matrix (D01-D06)", () => {
    it("D01: Unit test alone is merely INTEGRATED, NOT product consumed", () => {
      const evalResult = manager.evaluateConsumptionStatus({
        has_unit_tests: true,
        is_committed_to_head: true,
        consumer_type: "NONE",
      });

      expect(evalResult.consumption_status).toBe("INTEGRATED");
      expect(evalResult.is_product_consumed).toBe(false);
      expect(evalResult.is_delivery_complete).toBe(false);
      expect(evalResult.reason).toContain("possesses zero runtime callers outside test files");
    });

    it("D02 & D03: Legitimate consumer may be a worker, scheduled process, pipeline, or API/UI", () => {
      // Worker consumer (e.g. adaptive poller / scheduler)
      const workerEval = manager.evaluateConsumptionStatus({
        has_unit_tests: true,
        is_committed_to_head: true,
        consumer_type: "WORKER",
        caller_reference: "server/scheduler.ts (provider ingestion loop)",
      });
      expect(workerEval.consumption_status).toBe("PRODUCT_WORKFLOW_CONSUMED");
      expect(workerEval.is_product_consumed).toBe(true);
      expect(workerEval.is_delivery_complete).toBe(true);

      // API consumer
      const apiEval = manager.evaluateConsumptionStatus({
        has_unit_tests: true,
        is_committed_to_head: true,
        consumer_type: "API",
        caller_reference: "server/index.ts:GET /api/series",
      });
      expect(apiEval.consumption_status).toBe("PRODUCT_WORKFLOW_CONSUMED");
      expect(apiEval.is_product_consumed).toBe(true);

      // Pipeline consumer
      const pipelineEval = manager.evaluateConsumptionStatus({
        has_unit_tests: true,
        is_committed_to_head: true,
        consumer_type: "PIPELINE",
        caller_reference: "server/qualitativeEvidence.ts:llmDebateRunner",
      });
      expect(pipelineEval.consumption_status).toBe("PRODUCT_WORKFLOW_CONSUMED");
      expect(pipelineEval.is_product_consumed).toBe(true);
    });

    it("D05: Effective state accurately distinguishes integration vs consumption", () => {
      const standaloneModule = manager.evaluateConsumptionStatus({
        has_unit_tests: true,
        is_committed_to_head: true,
      });
      expect(standaloneModule.consumption_status).toBe("INTEGRATED");
      expect(standaloneModule.is_product_consumed).toBe(false);

      const consumedModule = manager.evaluateConsumptionStatus({
        has_unit_tests: true,
        is_committed_to_head: true,
        consumer_type: "API",
        caller_reference: "server/index.ts:128",
      });
      expect(consumedModule.consumption_status).toBe("PRODUCT_WORKFLOW_CONSUMED");
      expect(consumedModule.is_product_consumed).toBe(true);
    });
  });

  // ==========================================================================
  // SECTION 39: TEST MATRIX — WAIT STATE (W01–W05)
  // ==========================================================================
  describe("Company Wait State Test Matrix (W01-W05)", () => {
    it("W01: READY=0 + valid research is NOT company wait (NBA is RESEARCH)", () => {
      const waitEval = manager.evaluateCompanyWaitStatus({
        ready_build_items: 0,
        actionable_research_questions: 2,
        actionable_evidence_actions: 0,
        actionable_validations: 0,
      });

      expect(waitEval.is_justified_wait).toBe(false);
      expect(waitEval.next_best_action).toBe("RESEARCH");
      expect(waitEval.reason).toContain("high-value research questions require exploration");
    });

    it("W02: Valid evidence action can become Next Best Action", () => {
      const waitEval = manager.evaluateCompanyWaitStatus({
        ready_build_items: 0,
        actionable_research_questions: 0,
        actionable_evidence_actions: 1,
        actionable_validations: 0,
      });

      expect(waitEval.is_justified_wait).toBe(false);
      expect(waitEval.next_best_action).toBe("ACQUIRE_EVIDENCE");
      expect(waitEval.reason).toContain("bounded evidence actions are actionable");
    });

    it("W03: Product validation can become Next Best Action", () => {
      const waitEval = manager.evaluateCompanyWaitStatus({
        ready_build_items: 0,
        actionable_research_questions: 0,
        actionable_evidence_actions: 0,
        actionable_validations: 3, // 3 unconsumed modules needing validation
      });

      expect(waitEval.is_justified_wait).toBe(false);
      expect(waitEval.next_best_action).toBe("VALIDATE_PRODUCT");
      expect(waitEval.reason).toContain("unconsumed capabilities require runtime product validation");
    });

    it("W04 & W05: Zero meaningful actions results in JUSTIFIED_WAIT without repeated cognition", () => {
      const waitEval = manager.evaluateCompanyWaitStatus({
        ready_build_items: 0,
        actionable_research_questions: 0,
        actionable_evidence_actions: 0,
        actionable_validations: 0,
      });

      expect(waitEval.is_justified_wait).toBe(true);
      expect(waitEval.next_best_action).toBe("JUSTIFIED_WAIT");
      expect(waitEval.reason).toContain("Zero-cognition wait is optimal");
    });
  });

  // ==========================================================================
  // SECTION 40: ADVERSARIAL TESTS (A THROUGH J)
  // ==========================================================================
  describe("Adversarial Tests (A through J)", () => {
    it("Adversarial A: Low-value candidate missing data does NOT produce ingestion task", () => {
      const action = manager.createBoundedEvidenceAction({
        action_id: "ACT-LOW-VAL-DATA",
        action_type: "QUERY_EXISTING_DATA",
        question_or_unknown: "Is speculative retail sentiment index present?",
        target_source_or_query: "retail-sentiment-speculative",
        decision_this_changes: "Whether to build retail sentiment overlay",
        stop_condition: "Database query",
      });

      const finding = manager.executeBoundedEvidenceAction(action, {
        dataLookup: () => ({ count: 0 }),
      });

      const pmDecision = manager.evaluatePMDecision({
        itemTitle: "Retail Sentiment Overlay",
        actionType: "BUILD",
        finding,
        estimatedValue: "LOW",
        strategicHorizon: "H2",
      });

      expect(pmDecision.decision).toBe("DEFER");
      expect(pmDecision.resulting_action_type).toBe("DEFER"); // Not INGESTION!
    });

    it("Adversarial B: Important question solvable by simple query becomes bounded evidence action", () => {
      const action = manager.createBoundedEvidenceAction({
        action_id: "ACT-OBS-QUERY",
        action_type: "QUERY_EXISTING_DATA",
        question_or_unknown: "Do we have historical 10y yields for the 2020 dash-for-cash period?",
        target_source_or_query: "us10y-yield",
        decision_this_changes: "Whether research on March 2020 can be performed locally",
        stop_condition: "Query date range for March 2020",
      });

      const finding = manager.executeBoundedEvidenceAction(action, {
        dataLookup: () => ({ count: 22, minPeriod: "2020-03-01", maxPeriod: "2020-03-31" }),
      });

      expect(finding.evidence_status).toBe("SUPPORTED");
      expect(finding.raw_observations_count).toBe(22);
    });

    it("Adversarial C: Strong reusable data need becomes qualified ingestion OPTION only after PM reasoning", () => {
      const action = manager.createBoundedEvidenceAction({
        action_id: "ACT-FRED-DFII10",
        action_type: "ACQUIRE_EVIDENCE",
        question_or_unknown: "Is FRED 10y TIPS yield (DFII10) open and accessible via official FRED API?",
        target_source_or_query: "FRED:DFII10",
        decision_this_changes: "Whether to qualify TIPS real yield ingestion option",
        stop_condition: "Checked FRED API documentation and license terms",
      });

      const finding = manager.executeBoundedEvidenceAction(action, {
        externalFeasibility: () => ({ isAvailable: true, isMachineReadable: true, licensingBarrier: false }),
      });

      expect(finding.evidence_status).toBe("SUPPORTED");

      const pmDecision = manager.evaluatePMDecision({
        itemTitle: "FRED 10y TIPS Ingestion Adapter",
        actionType: "BUILD",
        finding,
        estimatedValue: "HIGH",
        strategicHorizon: "H0",
      });

      expect(pmDecision.decision).toBe("QUALIFY");
    });

    it("Adversarial D: Existing unused code with weak evidence receives NO sunk-cost integration", () => {
      // Code exists on disk, but has weak evidence or missing data (e.g. FX fixing buffer without daily data)
      const finding: any = {
        action_id: "ACT-FX-BUF",
        finding_summary: "Daily fixing data unavailable locally; spot rates only",
        evidence_status: "NOT_WORTH_PURSUING",
      };

      const pmDecision = manager.evaluatePMDecision({
        itemTitle: "EM FX Fixing Buffer HTTP Endpoint",
        actionType: "BUILD",
        finding,
      });

      expect(pmDecision.decision).toBe("DEFER"); // Refuses sunk-cost integration!
    });

    it("Adversarial E: Existing unused code with strong evidence can become qualified integration work", () => {
      const finding: any = {
        action_id: "ACT-TIPS-INT",
        finding_summary: "FRED real yield DFII10 verified available and upstream tests passing",
        evidence_status: "SUPPORTED",
        next_action: "QUALIFY",
      };

      const pmDecision = manager.evaluatePMDecision({
        itemTitle: "TIPS Liquidity Adjuster API Route",
        actionType: "BUILD",
        finding,
      });

      expect(pmDecision.decision).toBe("QUALIFY");
    });

    it("Adversarial F: Empty build queue + unresolved high-value question produces research, not automatic WAIT", () => {
      const waitEval = manager.evaluateCompanyWaitStatus({
        ready_build_items: 0,
        actionable_research_questions: 1,
        actionable_evidence_actions: 0,
        actionable_validations: 0,
      });

      expect(waitEval.is_justified_wait).toBe(false);
      expect(waitEval.next_best_action).toBe("RESEARCH");
    });

    it("Adversarial G: Truly no meaningful action produces JUSTIFIED_WAIT", () => {
      const waitEval = manager.evaluateCompanyWaitStatus({
        ready_build_items: 0,
        actionable_research_questions: 0,
        actionable_evidence_actions: 0,
        actionable_validations: 0,
      });

      expect(waitEval.is_justified_wait).toBe(true);
      expect(waitEval.next_best_action).toBe("JUSTIFIED_WAIT");
    });

    it("Adversarial H: Many weak frontier items are rejected or deferred without queue bloat", () => {
      const weakItems = [
        { title: "Sentiment emoji reactor", value: "LOW" as const, horizon: "H2" as const },
        { title: "Dark mode color palette 12", value: "LOW" as const, horizon: "H2" as const },
        { title: "Auto tweet generator", value: "LOW" as const, horizon: "H2" as const },
      ];

      const decisions = weakItems.map((item) =>
        manager.evaluatePMDecision({
          itemTitle: item.title,
          actionType: "BUILD",
          estimatedValue: item.value,
          strategicHorizon: item.horizon,
        })
      );

      expect(decisions.every((d) => d.decision === "DEFER" || d.decision === "KILL")).toBe(true);
      expect(decisions.every((d) => d.founder_escalation_required === false)).toBe(true);
    });

    it("Adversarial I: Several good qualified options are all preserved in inventory while selecting few", () => {
      const inventory: QualifiedWorkItem[] = [
        { id: "QW-1", candidate_id: "C-1", title: "Option 1", action_type: "BUILD", qualification_status: "QUALIFIED", qualification_score: 95, qualification_reason: "High score", allowed_paths: [], status: "PENDING_SELECTION", evidence_pack: {} as any, last_evaluated_at: "" },
        { id: "QW-2", candidate_id: "C-2", title: "Option 2", action_type: "BUILD", qualification_status: "QUALIFIED", qualification_score: 90, qualification_reason: "High score", allowed_paths: [], status: "PENDING_SELECTION", evidence_pack: {} as any, last_evaluated_at: "" },
        { id: "QW-3", candidate_id: "C-3", title: "Option 3", action_type: "BUILD", qualification_status: "QUALIFIED", qualification_score: 85, qualification_reason: "High score", allowed_paths: [], status: "PENDING_SELECTION", evidence_pack: {} as any, last_evaluated_at: "" },
      ];

      const selection = manager.selectExecutionCommitment(inventory);
      expect(selection.selectedCommitment?.qualified_work_id).toBe("QW-1");
      expect(selection.unselectedQualifiedItems).toHaveLength(2);
      expect(selection.unselectedQualifiedItems.map((i) => i.id)).toEqual(["QW-2", "QW-3"]);
    });

    it("Adversarial J: Ordinary ambiguous PM decisions resolve autonomously without founder ping", () => {
      const ambiguousDecision = manager.evaluatePMDecision({
        itemTitle: "Lead-lag window estimation across emerging market currencies",
        actionType: "PROTOTYPE",
        strategicHorizon: "H1",
      });

      expect(["RESEARCH_MORE", "DEFER", "QUALIFY"]).toContain(ambiguousDecision.decision);
      expect(ambiguousDecision.founder_escalation_required).toBe(false);
    });
  });
});
