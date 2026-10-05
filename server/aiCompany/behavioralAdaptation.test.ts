import { describe, expect, it } from "vitest";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { BehavioralAdaptationEngine, type PolicyAdaptationDelta } from "./behavioralAdaptation";
import type { TaskExecutionPolicy } from "./taskExecutionPolicy";

describe("BehavioralAdaptationEngine (L3 Behavioral Learning)", () => {
  const basePolicy: TaskExecutionPolicy = {
    policy_id: "POLICY:TEST-1",
    assignment_id: "ASSIGNMENT:TEST-1",
    agent_id: "backend-engineer",
    risk_level: "P1",
    allowed_tools: ["repository inspection", "targeted tests", "worktree file edits", "arbitrary_fs_write"],
    allowed_paths: ["server/qualitativeEvidence.ts", "server/qualitativeEvidence.test.ts"],
    actions: ["read", "write", "execute", "review"],
    max_child_tasks: 2,
    max_concurrent_runs: 1,
    max_provider_calls: 5,
    max_tool_calls: 20,
    max_retries: 3,
    max_tokens: 10000,
    issued_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 600000).toISOString(),
    revoked: false,
  };

  it("records adaptation deltas and injects guardrails into execution policies at target cycles", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "ai-adaptation-test-"));
    const engine = new BehavioralAdaptationEngine(tmpDir);

    const delta: PolicyAdaptationDelta = {
      adaptation_id: "ADAPT-DELIVERY-GAP-FIX",
      source_cycle_number: 18,
      trigger_outcome: "WORKTREE_STRANDED_ZERO_MERGE",
      learned_rule: "Always execute fail-closed git commit on delivery progress",
      applied_at_cycle: 19,
      policy_modifications: {
        enforce_git_merge: true,
        mandatory_regression_test: true,
        disallow_unverified_claims: true,
        allowed_paths_strict: true,
      },
      counterfactual: {
        pre_adaptation_behavior: "Requires human merge flag left changes stranded in worktree",
        pre_adaptation_failure_rate_pct: 100,
        post_adaptation_behavior: "worktreeManager.mergeToMain commits changes directly to main branch",
        post_adaptation_failure_rate_pct: 0,
        empirical_efficiency_gain: "100% first-pass delivery into git HEAD",
      },
    };

    await engine.recordAdaptation(delta);
    const loaded = await engine.loadAdaptations();
    expect(loaded).toHaveLength(1);

    // Before cycle 19 (e.g. Cycle 18): adaptation is NOT applied
    const policyBefore = engine.applyAdaptationsToPolicy(basePolicy, 18, loaded);
    expect(policyBefore.active_guardrails).toEqual([]);
    expect(policyBefore.allowed_tools).toContain("arbitrary_fs_write");

    // At cycle 19: adaptation IS applied
    const policyAt = engine.applyAdaptationsToPolicy(basePolicy, 19, loaded);
    expect(policyAt.active_guardrails).toContain("ENFORCE_FAIL_CLOSED_GIT_MERGE");
    expect(policyAt.active_guardrails).toContain("MANDATORY_REGRESSION_TEST_VERIFICATION");
    expect(policyAt.active_guardrails).toContain("DISALLOW_UNVERIFIED_PRODUCT_CLAIMS");
    expect(policyAt.active_guardrails).toContain("STRICT_PATH_SANDBOXING");
    expect(policyAt.allowed_tools).not.toContain("arbitrary_fs_write");
    expect(policyAt.max_retries).toBe(1);
  });

  it("computes rigorous counterfactual efficiency and failure reduction metrics", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "ai-adaptation-audit-"));
    const engine = new BehavioralAdaptationEngine(tmpDir);

    const deltas: PolicyAdaptationDelta[] = [
      {
        adaptation_id: "ADAPT-DELIVERY-GAP",
        source_cycle_number: 18,
        trigger_outcome: "STRANDED_WORKTREE",
        learned_rule: "Auto-merge verified delivery to main",
        applied_at_cycle: 19,
        policy_modifications: {
          enforce_git_merge: true,
          mandatory_regression_test: true,
          disallow_unverified_claims: true,
          allowed_paths_strict: true,
        },
        counterfactual: {
          pre_adaptation_behavior: "18 consecutive cycles stranded in worktrees",
          pre_adaptation_failure_rate_pct: 100,
          post_adaptation_behavior: "Automatic git commit and push to main on PASS",
          post_adaptation_failure_rate_pct: 0,
          empirical_efficiency_gain: "18 stranded cycles eliminated",
        },
      },
      {
        adaptation_id: "ADAPT-SCHEDULER-LIVELOCK",
        source_cycle_number: 18,
        trigger_outcome: "SCHEDULER_LIVELOCK",
        learned_rule: "Rotate candidate backlog items across cycles instead of hot-looping",
        applied_at_cycle: 19,
        policy_modifications: {
          enforce_git_merge: false,
          mandatory_regression_test: false,
          disallow_unverified_claims: true,
          allowed_paths_strict: false,
        },
        counterfactual: {
          pre_adaptation_behavior: "Repeatedly retried BACKLOG-INDICATOR-FRESHNESS-COVERAGE 5 times",
          pre_adaptation_failure_rate_pct: 80,
          post_adaptation_behavior: "Dynamically selects next eligible candidate in pool",
          post_adaptation_failure_rate_pct: 0,
          empirical_efficiency_gain: "Hot-loop stalls completely prevented",
        },
      },
    ];

    const audit = engine.generateCounterfactualAudit(deltas);
    expect(audit.total_adaptations).toBe(2);
    expect(audit.average_failure_reduction_pct).toBe(90);
    expect(audit.verified_interventions).toHaveLength(2);
  });
});
