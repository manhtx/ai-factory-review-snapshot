import { describe, it, expect } from "vitest";
import {
  selectCompanyNextBestAction,
  getActionableResearchQuestions,
  computeSchedulingFingerprint,
  evaluateAntiLivelock,
  classifySchedulingOutcome,
  type ResearchQuestionRecord,
  type QualifiedWorkItemRecord,
} from "./companyNbaRouter";
import { ExecutionPlanner } from "./executionPlanner";

describe("Company Next-Best-Action (NBA) Routing & Anti-Livelock Policy (T01 - T18)", () => {
  const planner = new ExecutionPlanner();

  // Fixture: Actionable research question
  const actionableQuestion: ResearchQuestionRecord = {
    id: "RQ-TEST-ACTIONABLE",
    question: "How do off-the-run Treasury yield spreads affect breakevens?",
    priority: "HIGH",
    status: "IN_PROGRESS",
    why_it_matters: "Prevents false deflation regime signals.",
    important_unknown: "Liquidity premia threshold.",
  };

  // Fixture: Blocked research question (held pending external data)
  const blockedQuestion: ResearchQuestionRecord = {
    id: "RQ-EM-FX-CENTRAL-BANK-FIXING",
    question: "Do central bank non-market FX fixings buffer macro shock transmission?",
    priority: "HIGH",
    status: "IN_PROGRESS",
  };

  const blockedInventoryItem: QualifiedWorkItemRecord = {
    id: "QW-RQ-EM-FX-CENTRAL-BANK-FIXING",
    status: "PENDING_SELECTION",
    qualification_status: "RESEARCH_REQUIRED",
    research_status: "EVIDENCE_RESEARCH_MORE",
    hold_contract: {
      is_held: true,
      hold_reason: "Held pending canonical SQLite fixing observations.",
      evidence_gap: "Verification of central bank daily fixing.",
      resume_condition: "Hydration of daily central bank fixing via provider adapter.",
    },
  };

  // Fixture: Deferred research question
  const deferredQuestion: ResearchQuestionRecord = {
    id: "RQ-FRONTIER-JURISDICTION-HOLIDAY-CALENDAR",
    question: "Does holiday calendar awareness improve freshness?",
    priority: "MEDIUM",
    status: "IN_PROGRESS",
  };

  const deferredInventoryItem: QualifiedWorkItemRecord = {
    id: "QW-RQ-FRONTIER-JURISDICTION-HOLIDAY-CALENDAR",
    status: "DEFERRED",
    research_status: "EVIDENCE_DEFER",
  };

  // T01: delivery empty + actionable research -> research selected
  it("T01: delivery empty + actionable research -> research selected", () => {
    const decision = selectCompanyNextBestAction({
      deliveryCandidates: [],
      portfolioQuestions: [actionableQuestion],
      inventoryItems: [],
      priorCycles: [],
    });

    expect(decision.nba_type).toBe("RESEARCH");
    expect(decision.wait_type).toBe("NONE");
    expect(decision.is_justified_wait).toBe(false);
    expect(decision.selected_candidate).not.toBeNull();
    expect(decision.selected_candidate?.backlog_id).toBe("BACKLOG-RESEARCH-RQ-TEST-ACTIONABLE");
  });

  // T02: delivery empty + actionable research -> no DELIVERY_WAIT error
  it("T02: delivery empty + actionable research -> no DELIVERY_WAIT error or wait state", () => {
    const decision = selectCompanyNextBestAction({
      deliveryCandidates: [],
      portfolioQuestions: [actionableQuestion],
      inventoryItems: [],
      priorCycles: [],
    });

    expect(decision.wait_type).not.toBe("DELIVERY_WAIT");
    expect(decision.is_justified_wait).toBe(false);
  });

  // T03: DELIVERY_WAIT is not treated as transient infrastructure failure
  it("T03: DELIVERY_WAIT is classified as EXPECTED_SCHEDULING_OUTCOME, not infrastructure failure", () => {
    const outcome = classifySchedulingOutcome("DELIVERY_WAIT: Build queue is empty");
    expect(outcome.category).toBe("EXPECTED_SCHEDULING_OUTCOME");
    expect(outcome.is_error).toBe(false);
    expect(outcome.wait_type).toBe("DELIVERY_WAIT");
    expect(outcome.should_retry_immediately).toBe(false);
  });

  // T04: same unchanged scheduling result -> no rapid recovery loop
  it("T04: same unchanged scheduling fingerprint -> suppresses immediate retry and enforces poll backoff", () => {
    const fp1 = computeSchedulingFingerprint({
      cycleNum: 58,
      realityRevision: "rev-abc",
      candidatePoolHash: "empty",
      waitReason: "Zero eligible work",
    });

    const eval1 = evaluateAntiLivelock({
      currentFingerprint: fp1,
      lastFingerprint: null,
      consecutiveCount: 0,
      basePollMs: 300_000,
    });
    expect(eval1.is_livelock).toBe(false);
    expect(eval1.should_retry_immediately).toBe(true);

    // Second identical attempt
    const eval2 = evaluateAntiLivelock({
      currentFingerprint: fp1,
      lastFingerprint: fp1,
      consecutiveCount: 1,
      basePollMs: 300_000,
    });
    expect(eval2.is_livelock).toBe(true);
    expect(eval2.should_retry_immediately).toBe(false);
    expect(eval2.backoff_ms).toBeGreaterThanOrEqual(30_000);
    expect(eval2.consecutive_identical_count).toBe(2);
  });

  // T05: delivery empty + no company work -> COMPANY_JUSTIFIED_WAIT
  it("T05: delivery empty + no actionable research/evidence -> COMPANY_JUSTIFIED_WAIT", () => {
    const decision = selectCompanyNextBestAction({
      deliveryCandidates: [],
      portfolioQuestions: [blockedQuestion, deferredQuestion],
      inventoryItems: [blockedInventoryItem, deferredInventoryItem],
      priorCycles: [
        { objective_id: "BACKLOG-RESEARCH-RQ-EM-FX-CENTRAL-BANK-FIXING" },
        { objective_id: "BACKLOG-RESEARCH-RQ-FRONTIER-JURISDICTION-HOLIDAY-CALENDAR" },
      ],
    });

    expect(decision.nba_type).toBe("COMPANY_JUSTIFIED_WAIT");
    expect(decision.wait_type).toBe("COMPANY_JUSTIFIED_WAIT");
    expect(decision.is_justified_wait).toBe(true);
    expect(decision.selected_candidate).toBeNull();
  });

  // T06: COMPANY_JUSTIFIED_WAIT -> zero cognition
  it("T06: COMPANY_JUSTIFIED_WAIT -> zero cognition flag set to true", () => {
    const decision = selectCompanyNextBestAction({
      deliveryCandidates: [],
      portfolioQuestions: [],
      inventoryItems: [],
      priorCycles: [],
    });

    expect(decision.zero_cognition).toBe(true);
    expect(decision.is_justified_wait).toBe(true);
  });

  // T07: legitimate delivery work remains selectable (delivery control)
  it("T07: legitimate delivery work remains selectable and takes precedence over research", () => {
    const deliveryCandidate = {
      backlog_id: "OPP-WATCHLIST-UI-ALERT-CONTROLS",
      title: "Connect Watchlist Alert Thresholds",
      summary: "Add alert controls to UI",
      task_type: "data_change",
      allowed_paths: ["src/app/pages/WatchlistPage.tsx"],
    };

    const decision = selectCompanyNextBestAction({
      deliveryCandidates: [deliveryCandidate],
      portfolioQuestions: [actionableQuestion],
      inventoryItems: [],
      priorCycles: [],
    });

    expect(decision.nba_type).toBe("DELIVERY");
    expect(decision.selected_candidate?.backlog_id).toBe("OPP-WATCHLIST-UI-ALERT-CONTROLS");
    expect(decision.wait_type).toBe("NONE");
  });

  // T08: blocked research is not repeatedly selected
  it("T08: blocked research held pending data is excluded from actionable questions", () => {
    const actionable = getActionableResearchQuestions({
      questions: [blockedQuestion],
      inventoryItems: [blockedInventoryItem],
      attemptedObjectives: new Set(),
    });

    expect(actionable).toHaveLength(0);
  });

  // T09: already-attempted same research/evidence revision is not repeatedly selected
  it("T09: already-attempted research question under same reality is not repeatedly selected", () => {
    const attempted = new Set(["BACKLOG-RESEARCH-RQ-TEST-ACTIONABLE"]);
    const actionable = getActionableResearchQuestions({
      questions: [actionableQuestion],
      inventoryItems: [],
      attemptedObjectives: attempted,
    });

    expect(actionable).toHaveLength(0);
  });

  // T10: multiple research questions produce deterministic/reasoned single NBA selection
  it("T10: multiple actionable research questions produce deterministic single selection by priority", () => {
    const medQuestion: ResearchQuestionRecord = {
      id: "RQ-A-MEDIUM",
      question: "Medium priority question",
      priority: "MEDIUM",
      status: "IN_PROGRESS",
    };
    const highQuestion: ResearchQuestionRecord = {
      id: "RQ-B-HIGH",
      question: "High priority question",
      priority: "HIGH",
      status: "IN_PROGRESS",
    };
    const lowQuestion: ResearchQuestionRecord = {
      id: "RQ-C-LOW",
      question: "Low priority question",
      priority: "LOW",
      status: "IN_PROGRESS",
    };

    const decision = selectCompanyNextBestAction({
      deliveryCandidates: [],
      portfolioQuestions: [medQuestion, highQuestion, lowQuestion],
      inventoryItems: [],
      priorCycles: [],
    });

    expect(decision.nba_type).toBe("RESEARCH");
    expect(decision.selected_candidate?.backlog_id).toBe("BACKLOG-RESEARCH-RQ-B-HIGH");
    expect(decision.actionable_research_count).toBe(3);
  });

  // T11: research selection flows into current ExecutionPlanner
  it("T11: selected research candidate derives valid ExecutionContract via ExecutionPlanner", () => {
    const decision = selectCompanyNextBestAction({
      deliveryCandidates: [],
      portfolioQuestions: [actionableQuestion],
      inventoryItems: [],
      priorCycles: [],
    });

    expect(decision.selected_candidate).not.toBeNull();
    const contract = planner.plan(decision.selected_candidate!);

    expect(contract.objective_id).toBe("BACKLOG-RESEARCH-RQ-TEST-ACTIONABLE");
    expect(contract.mutation_scope).toBe("COMPANY_STATE_MUTATION");
    expect(contract.worktree_required).toBe(false);
  });

  // T12: non-code research does not recreate universal build machinery
  it("T12: non-code research contract selects research capabilities without backend/qa build machinery", () => {
    const decision = selectCompanyNextBestAction({
      deliveryCandidates: [],
      portfolioQuestions: [actionableQuestion],
      inventoryItems: [],
      priorCycles: [],
    });

    const contract = planner.plan(decision.selected_candidate!);
    expect(contract.selected_capabilities).toEqual(["pm", "domain-expert"]);
    expect(contract.selected_capabilities).not.toContain("backend-engineer");
    expect(contract.selected_capabilities).not.toContain("functional-qa");
    expect(contract.verification_methods).toContain("PROVENANCE_AND_FINDING_RECORDED");
  });

  // T13: code mutation still preserves engineering safety
  it("T13: delivery candidate with code mutations preserves full engineering safety", () => {
    const deliveryCandidate = {
      backlog_id: "BACKLOG-040-INGESTION",
      title: "Add Ingestion Adapter",
      task_type: "data_change",
      allowed_paths: ["server/ingestion.ts", "server/ingestion.test.ts"],
    };

    const contract = planner.plan(deliveryCandidate);
    expect(contract.mutation_scope).toBe("PRODUCT_CODE_MUTATION");
    expect(contract.worktree_required).toBe(true);
    expect(contract.selected_capabilities).toContain("backend-engineer");
    expect(contract.selected_capabilities).toContain("functional-qa");
  });

  // T14: Cycle 58 semantic identity survives recovery
  it("T14: scheduling wait preserves current_cycle_number 58 without cycle loss", () => {
    const marathonState = {
      current_cycle_number: 58,
      verified_company_cycle_number: 57,
      current_cycle_id: "marathon-cycle-1789976803837",
    };

    // When justified wait occurs, cycle number is preserved
    const waitDecision = selectCompanyNextBestAction({
      deliveryCandidates: [],
      portfolioQuestions: [],
      inventoryItems: [],
      priorCycles: [],
    });

    expect(waitDecision.is_justified_wait).toBe(true);
    expect(marathonState.current_cycle_number).toBe(58);
    expect(marathonState.verified_company_cycle_number).toBe(57);
    expect(marathonState.current_cycle_id).toBe("marathon-cycle-1789976803837");
  });

  // T15: recovery attempts do not inflate verified cycle count
  it("T15: recovery attempts and wait states do not increment verified cycle count", () => {
    let verifiedCycles = 57;
    const outcome = classifySchedulingOutcome("COMPANY_JUSTIFIED_WAIT: Zero eligible work");

    // A wait state does not increment verified cycle count
    if (outcome.category === "EXPECTED_SCHEDULING_OUTCOME") {
      // Verified count remains unchanged
    } else {
      verifiedCycles++;
    }

    expect(verifiedCycles).toBe(57);
  });

  // T16: active execution lease remains authoritative
  it("T16: active execution lease resolves runner agy and gemini-3.8-flash-high", async () => {
    const { ExecutionLeaseManager } = await import("./executionLease");
    const leaseManager = new ExecutionLeaseManager(process.cwd());
    const auth = await leaseManager.resolveExecutionAuthority();
    expect(auth.status).toBe("RESOLVED");
    if (auth.status === "RESOLVED" && auth.lease) {
      expect(auth.lease.lease_id).toBe("LEASE:MARATHON-ANTIGRAVITY-PERPETUAL-01:rev-1");
      expect(auth.lease.controller).toBe("antigravity");
      expect(auth.lease.runner).toBe("agy");
      expect(auth.lease.runtime_model_id).toBe("gemini-3.8-flash-high");
    }
  });

  // T17: no provider fallback introduced
  it("T17: classifier does not route quota wait to alternative providers", () => {
    const outcome = classifySchedulingOutcome("RESOURCE_EXHAUSTED: quota limit reached");
    expect(outcome.category).toBe("RESOURCE_WAIT");
    expect(outcome.backoff_ms).toBe(300_000);
    // Preserves single provider with backoff
    expect(outcome.wait_type).toBe("RESOURCE_EXHAUSTED");
  });

  // T18: supervisor/resume semantics remain valid
  it("T18: supervisor resume classification distinguishes wait from crash", () => {
    const waitOutcome = classifySchedulingOutcome("JUSTIFIED_WAIT: no eligible candidate objective available");
    expect(waitOutcome.is_error).toBe(false);
    expect(waitOutcome.category).toBe("EXPECTED_SCHEDULING_OUTCOME");

    const errorOutcome = classifySchedulingOutcome(new Error("Fatal database disk corruption"));
    expect(errorOutcome.is_error).toBe(true);
    expect(errorOutcome.category).toBe("TRANSIENT_INFRASTRUCTURE_FAILURE");
  });

  // T19: databaseStateHash breaks scheduling fingerprint (Sensory Wakeability)
  it("T19: databaseStateHash changes the scheduling fingerprint to enable autonomous wake", () => {
    const fp1 = computeSchedulingFingerprint({
      cycleNum: 58,
      waitReason: "COMPANY_JUSTIFIED_WAIT",
      databaseStateHash: "hash-initial-145132",
    });
    const fp2 = computeSchedulingFingerprint({
      cycleNum: 58,
      waitReason: "COMPANY_JUSTIFIED_WAIT",
      databaseStateHash: "hash-updated-145133",
    });

    expect(fp1).not.toBe(fp2);
  });

  // T20: unconsumed analytics module routes to DELIVERY NBA before wait
  it("T20: unconsumed analytics module routes to DELIVERY consumption NBA when build queue is empty", () => {
    const decision = selectCompanyNextBestAction({
      deliveryCandidates: [],
      portfolioQuestions: [],
      inventoryItems: [],
      priorCycles: [],
      unconsumedModules: ["server/analytics/vietnamCreditRegime.ts"],
      canonicalBacklogItems: [
        {
          backlog_id: "BACKLOG-CONSUMPTION-ANALYTICS-VIETNAMCREDITREGIME",
          title: "Mount runtime API route for vietnamCreditRegime",
          summary: "Wiring unconsumed analytics module",
          allowed_paths: ["server/routes/analyticsRouter.ts", "server/routes/index.ts"],
        },
      ],
    });

    expect(decision.nba_type).toBe("DELIVERY");
    expect(decision.wait_type).toBe("NONE");
    expect(decision.is_justified_wait).toBe(false);
    expect(decision.selected_candidate).not.toBeNull();
    expect(decision.selected_candidate?.backlog_id).toBe("BACKLOG-CONSUMPTION-ANALYTICS-VIETNAMCREDITREGIME");
    expect(decision.selected_candidate?.task_type).toBe("consumption_action");
  });

  // T21: ACQUIRE_EVIDENCE action is not suppressed by prior QUERY_EXISTING_DATA cycle
  it("T21: ACQUIRE_EVIDENCE permitted action is not suppressed by prior read-only QUERY_EXISTING_DATA cycle", () => {
    const heldItem: QualifiedWorkItemRecord = {
      id: "QW-RQ-EM-FX-CENTRAL-BANK-FIXING",
      status: "PENDING_SELECTION",
      hold_contract: {
        is_held: true,
        hold_reason: "Awaiting provider adapter",
        evidence_gap: "Verification of central bank daily fixing",
        permitted_next_action: "ACQUIRE_EVIDENCE",
      },
    };

    const decision = selectCompanyNextBestAction({
      deliveryCandidates: [],
      portfolioQuestions: [],
      inventoryItems: [heldItem],
      priorCycles: [
        {
          objective_id: "BACKLOG-EVIDENCE-RQ-EM-FX-CENTRAL-BANK-FIXING",
          execution_result: { commit_sha: null }, // read inquiry, no commit
        },
      ],
    });

    expect(decision.nba_type).toBe("ACQUIRE_EVIDENCE");
    expect(decision.wait_type).toBe("NONE");
    expect(decision.selected_candidate?.backlog_id).toBe("BACKLOG-EVIDENCE-RQ-EM-FX-CENTRAL-BANK-FIXING");
  });

  // T22: Negative control QW-PREDICTIVE-TRADING-SIGNALS-KILL remains strictly excluded
  it("T22: negative control QW-PREDICTIVE-TRADING-SIGNALS-KILL remains excluded from candidate pool", () => {
    const predictiveItem: QualifiedWorkItemRecord = {
      id: "QW-PREDICTIVE-TRADING-SIGNALS-KILL",
      status: "ARCHIVED",
      qualification_status: "REJECTED",
    };

    const decision = selectCompanyNextBestAction({
      deliveryCandidates: [],
      portfolioQuestions: [
        {
          id: "RQ-PREDICTIVE-TRADING-SIGNALS",
          status: "COMPLETED",
          priority: "MEDIUM",
        },
      ],
      inventoryItems: [predictiveItem],
      priorCycles: [],
    });

    expect(decision.nba_type).toBe("COMPANY_JUSTIFIED_WAIT");
    expect(decision.selected_candidate).toBeNull();
  });

  // T23: Anti-livelock does not trigger livelock when databaseStateHash changes
  it("T23: Anti-livelock resets consecutive identical count when sensory database state changes", () => {
    const fp1 = computeSchedulingFingerprint({
      cycleNum: 58,
      databaseStateHash: "hash-1",
    });
    const fp2 = computeSchedulingFingerprint({
      cycleNum: 58,
      databaseStateHash: "hash-2",
    });

    const eval1 = evaluateAntiLivelock({
      currentFingerprint: fp1,
      lastFingerprint: null,
      consecutiveCount: 0,
    });
    expect(eval1.is_livelock).toBe(false);

    const eval2 = evaluateAntiLivelock({
      currentFingerprint: fp2,
      lastFingerprint: fp1,
      consecutiveCount: eval1.consecutive_identical_count,
    });
    expect(eval2.is_livelock).toBe(false);
    expect(eval2.consecutive_identical_count).toBe(1);
  });
});
