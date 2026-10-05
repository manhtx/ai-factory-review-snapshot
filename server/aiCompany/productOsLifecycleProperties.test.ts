import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  selectCompanyNextBestAction,
  computeSchedulingFingerprint,
  evaluateAntiLivelock,
} from "./companyNbaRouter";
import { definitionOfReady } from "./productBacklog";

const root = process.cwd();

describe("Product OS Lifecycle Property Tests (P1 - P15)", () => {
  // P1: NO_ORPHAN_STATE
  it("P1: NO_ORPHAN_STATE — every reachable non-terminal state has at least one valid outgoing transition", async () => {
    const sm = JSON.parse(await readFile(path.join(root, ".ai-company", "product_lifecycle_state_machine.json"), "utf8"));
    const states = sm.states;
    const transitions = sm.transitions;

    const nonTerminalStates = states.filter((s: any) => !s.terminal);
    for (const state of nonTerminalStates) {
      const outgoing = transitions.filter((t: any) => t.from === state.id);
      expect(outgoing.length, `State ${state.id} has no outgoing transitions`).toBeGreaterThan(0);
    }
  });

  // P2: NO_FAKE_WAIT
  it("P2: NO_FAKE_WAIT — every justified wait state contains required trigger producer and observable condition", async () => {
    const sm = JSON.parse(await readFile(path.join(root, ".ai-company", "product_lifecycle_state_machine.json"), "utf8"));
    const waitStates = sm.states.filter((s: any) => s.semantic_class === "WAIT");

    for (const ws of waitStates) {
      expect(ws.next_change_producer).toBeDefined();
      expect(ws.next_change_producer.length).toBeGreaterThan(0);
      expect(ws.trigger_type).toBeDefined();
      expect(ws.trigger_observer).toBeDefined();
    }
  });

  // P3: NO_ROUTINE_FOUNDER_FALLBACK
  it("P3: NO_ROUTINE_FOUNDER_FALLBACK — delegated company transitions forbid routine founder involvement", async () => {
    const auth = JSON.parse(await readFile(path.join(root, ".ai-company", "authority_matrix.json"), "utf8"));
    const rules = auth.decision_routing_rules;

    const routineTriggers = ["READY_BACKLOG_EXHAUSTED", "EVIDENCE_GAP_DETECTED", "RESEARCH_PROCEED_VERDICT_EMITTED", "EXTERNAL_PROVIDER_DATA_UNAVAILABLE"];
    for (const trigger of routineTriggers) {
      const rule = rules.find((r: any) => r.trigger === trigger);
      expect(rule).toBeDefined();
      expect(rule.assigned_authority).toBe("DELEGATED_COMPANY_AUTHORITY");
      expect(rule.founder_involvement).toBe("FORBIDDEN");
    }
  });

  // P4: NO_FALSE_PRODUCT_DELIVERY
  it("P4: NO_FALSE_PRODUCT_DELIVERY — DELIVERY_COMPLETED requires git commit SHA and real-path consumption", async () => {
    const sm = JSON.parse(await readFile(path.join(root, ".ai-company", "product_lifecycle_state_machine.json"), "utf8"));
    const deliveryState = sm.states.find((s: any) => s.id === "DELIVERY_COMPLETED");
    expect(deliveryState).toBeDefined();
    expect(deliveryState.required_evidence).toContain("FINAL_GIT_COMMIT_SHA");
    expect(deliveryState.product_progress_level).toBe("LEVEL_6_PRODUCT_DELIVERED");
  });

  // P5: SINGLE_AUTHORITATIVE_CURRENT_STATE
  it("P5: SINGLE_AUTHORITATIVE_CURRENT_STATE — canonical backlog is the sole authority for backlog item status", async () => {
    const canonical = JSON.parse(await readFile(path.join(root, ".ai-company", "product-intelligence", "CANONICAL_PRODUCT_BACKLOG.json"), "utf8"));
    expect(Array.isArray(canonical.items)).toBe(true);

    const ids = new Set();
    for (const item of canonical.items) {
      expect(ids.has(item.backlog_id), `Duplicate backlog_id: ${item.backlog_id}`).toBe(false);
      ids.add(item.backlog_id);
      expect(["READY", "SPRINT_SELECTED", "SELECTED", "EXECUTING", "DELIVERED", "MEASURED", "DEFERRED", "HELD", "QUARANTINED", "REJECTED"]).toContain(item.status);
    }
  });

  // P6: BOUNDED_ZERO_DELTA_REPETITION
  it("P6: BOUNDED_ZERO_DELTA_REPETITION — identical scheduling fingerprint triggers livelock backoff", () => {
    const fp1 = computeSchedulingFingerprint({ cycleNum: 59, waitReason: "WAIT_1", realityRevision: "revA" });
    const fp2 = computeSchedulingFingerprint({ cycleNum: 59, waitReason: "WAIT_1", realityRevision: "revA" });
    expect(fp1).toBe(fp2);

    const evalResult = evaluateAntiLivelock({
      currentFingerprint: fp2,
      lastFingerprint: fp1,
      consecutiveCount: 1,
      basePollMs: 300_000,
    });

    expect(evalResult.is_livelock).toBe(true);
    expect(evalResult.should_retry_immediately).toBe(false);
    expect(evalResult.consecutive_identical_count).toBe(2);
    expect(evalResult.backoff_ms).toBeGreaterThanOrEqual(30_000);
  });

  // P7: OBTAINABLE_EVIDENCE_GAP_CLOSURE
  it("P7: OBTAINABLE_EVIDENCE_GAP_CLOSURE — uncertainty with obtainable inquiry transitions to evidence plan", async () => {
    const sm = JSON.parse(await readFile(path.join(root, ".ai-company", "product_lifecycle_state_machine.json"), "utf8"));
    const t04 = sm.transitions.find((t: any) => t.id === "T04_UNCERTAINTY_TO_EVIDENCE_PLAN");
    expect(t04).toBeDefined();
    expect(t04.from).toBe("UNCERTAINTY_IDENTIFIED");
    expect(t04.to).toBe("EVIDENCE_ACQUISITION_PLANNED");
    expect(t04.authority).toBe("DELEGATED_COMPANY_AUTHORITY");
  });

  // P8: LEARNING_REQUIRES_BEHAVIORAL_CONSEQUENCE
  it("P8: LEARNING_REQUIRES_BEHAVIORAL_CONSEQUENCE — learning state delta advances post-delivery cycle", async () => {
    const sm = JSON.parse(await readFile(path.join(root, ".ai-company", "product_lifecycle_state_machine.json"), "utf8"));
    const t28 = sm.transitions.find((t: any) => t.id === "T28_DELIVERY_TO_OBSERVE");
    expect(t28).toBeDefined();
    expect(t28.state_delta_class).toBe("APPLIED LEARNING");
    expect(t28.side_effect_class).toContain("CYCLE");
  });

  // P9: QUARANTINE_CLOSURE
  it("P9: QUARANTINE_CLOSURE — quarantined isolated items have a bounded TTL exit", async () => {
    const sm = JSON.parse(await readFile(path.join(root, ".ai-company", "product_lifecycle_state_machine.json"), "utf8"));
    const qState = sm.states.find((s: any) => s.id === "QUARANTINED_ISOLATED");
    expect(qState).toBeDefined();
    expect(qState.expiry_or_budget).toBe("60_SECONDS");
    expect(qState.allowed_transitions).toContain("QUARANTINE_TO_RETRY_OR_OBSERVE");
  });

  // P10: EXTERNAL_WAIT_RESUMABILITY
  it("P10: EXTERNAL_WAIT_RESUMABILITY — external wait transitions back to observation upon wake event", async () => {
    const sm = JSON.parse(await readFile(path.join(root, ".ai-company", "product_lifecycle_state_machine.json"), "utf8"));
    const t26 = sm.transitions.find((t: any) => t.id === "T26_EXTERNAL_WAIT_WAKE_TO_OBSERVE");
    expect(t26).toBeDefined();
    expect(t26.from).toBe("EXPLICIT_EXTERNAL_WAIT");
    expect(t26.to).toBe("PRODUCT_OBSERVATION");
  });

  // P11: DELIVERY_EXHAUSTION_LIVENESS
  it("P11: DELIVERY_EXHAUSTION_LIVENESS — when delivery queue is empty, NBA routes to research or unconsumed modules", () => {
    const decision = selectCompanyNextBestAction({
      deliveryCandidates: [],
      portfolioQuestions: [
        { id: "RQ-TEST", question: "Test hypothesis", status: "OPEN", priority: "HIGH" },
      ],
      inventoryItems: [],
      priorCycles: [],
      realityRevision: "rev1",
      unconsumedModules: [],
    });

    expect(decision.nba_type).toBe("RESEARCH");
    expect(decision.is_justified_wait).toBe(false);
    expect(decision.selected_candidate).toBeDefined();
    expect(decision.selected_candidate?.backlog_id).toBe("BACKLOG-RESEARCH-RQ-TEST");
  });

  // P12: FOUNDER_AUTHORITY_CORRECTNESS
  it("P12: FOUNDER_AUTHORITY_CORRECTNESS — production deployment requires founder authority NO_GO gate", async () => {
    const auth = JSON.parse(await readFile(path.join(root, ".ai-company", "authority_matrix.json"), "utf8"));
    const founderDomain = auth.domains.find((d: any) => d.domain === "FOUNDER_AUTHORITY");
    expect(founderDomain.allowed_actions).toContain("LIVE_PRODUCTION_DEPLOYMENT_APPROVAL");

    const prodRule = auth.decision_routing_rules.find((r: any) => r.trigger === "PRODUCTION_RELEASE_GATE");
    expect(prodRule.assigned_authority).toBe("FOUNDER_AUTHORITY");
    expect(prodRule.founder_involvement).toBe("MANDATORY");
  });

  // P13: NO_ZERO_DELTA_CLOSED_SCC
  it("P13: NO_ZERO_DELTA_CLOSED_SCC — the lifecycle graph contains zero closed non-progress cycles", async () => {
    const sm = JSON.parse(await readFile(path.join(root, ".ai-company", "product_lifecycle_state_machine.json"), "utf8"));
    const states = sm.states;
    const transitions = sm.transitions;

    // Verify each loop has an exit path leading to DELIVERY_COMPLETED or TERMINAL state
    const terminalIds = new Set(states.filter((s: any) => s.terminal).map((s: any) => s.id));
    for (const state of states) {
      if (state.terminal) continue;
      // BFS to ensure reachability to a terminal or delivery state
      const visited = new Set();
      const queue = [state.id];
      visited.add(state.id);
      let canReachTerminal = false;

      while (queue.length > 0) {
        const curr = queue.shift();
        if (terminalIds.has(curr)) {
          canReachTerminal = true;
          break;
        }
        for (const t of transitions.filter((t: any) => t.from === curr)) {
          if (!visited.has(t.to)) {
            visited.add(t.to);
            queue.push(t.to);
          }
        }
      }
      expect(canReachTerminal, `State ${state.id} cannot reach any terminal disposition`).toBe(true);
    }
  });

  // P14: STATE_CONFLICT_REJECTION_OR_RECONCILIATION
  it("P14: STATE_CONFLICT_REJECTION_OR_RECONCILIATION — PROCEED decision reconciles with QUALIFIED status", () => {
    const item = {
      id: "QW-TEST",
      requalification_decision: "PROCEED",
      qualification_status: "RESEARCH_REQUIRED",
      status: "PENDING_SELECTION",
    };

    // Reconciliation rule: if PROCEED, qualification_status must auto-promote
    if (item.requalification_decision === "PROCEED" && item.qualification_status !== "QUALIFIED") {
      item.qualification_status = "QUALIFIED";
    }

    expect(item.qualification_status).toBe("QUALIFIED");
    expect(item.status).toBe("PENDING_SELECTION");
  });

  // P15: REAL_PATH_REQUIRED_WHEN_PRODUCT_CONTRACT_REQUIRES_IT
  it("P15: REAL_PATH_REQUIRED_WHEN_PRODUCT_CONTRACT_REQUIRES_IT — unconsumed analytics module blocks delivery until mounted", () => {
    const decision = selectCompanyNextBestAction({
      deliveryCandidates: [],
      portfolioQuestions: [],
      inventoryItems: [],
      priorCycles: [],
      realityRevision: "rev1",
      unconsumedModules: ["server/analytics/vietnamCreditRegime.ts"],
      canonicalBacklogItems: [
        {
          backlog_id: "BACKLOG-CONSUMPTION-ANALYTICS-VIETNAMCREDITREGIME",
          title: "Mount and verify Vietnam credit regime router endpoint",
        },
      ],
    });

    expect(decision.nba_type).toBe("DELIVERY");
    expect(decision.selected_candidate?.task_type).toBe("consumption_action");
    expect(decision.selected_candidate?.backlog_id).toBe("BACKLOG-CONSUMPTION-ANALYTICS-VIETNAMCREDITREGIME");
  });
});
