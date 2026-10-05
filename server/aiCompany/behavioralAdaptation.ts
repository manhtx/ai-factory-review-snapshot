import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { TaskExecutionPolicy } from "./taskExecutionPolicy";

export interface PolicyAdaptationDelta {
  adaptation_id: string;
  source_cycle_number: number;
  trigger_outcome: string;
  learned_rule: string;
  applied_at_cycle: number;
  policy_modifications: {
    enforce_git_merge: boolean;
    mandatory_regression_test: boolean;
    disallow_unverified_claims: boolean;
    allowed_paths_strict: boolean;
  };
  counterfactual: {
    pre_adaptation_behavior: string;
    pre_adaptation_failure_rate_pct: number;
    post_adaptation_behavior: string;
    post_adaptation_failure_rate_pct: number;
    empirical_efficiency_gain: string;
  };
}

export class BehavioralAdaptationEngine {
  private readonly ledgerPath: string;

  constructor(private readonly rootDir: string) {
    this.ledgerPath = path.join(rootDir, ".ai-company", "optimization", "BEHAVIORAL_ADAPTATIONS.jsonl");
  }

  async recordAdaptation(delta: PolicyAdaptationDelta): Promise<void> {
    await mkdir(path.dirname(this.ledgerPath), { recursive: true });
    await writeFile(this.ledgerPath, JSON.stringify(delta) + "\n", { flag: "a", encoding: "utf8" });
  }

  async loadAdaptations(): Promise<PolicyAdaptationDelta[]> {
    try {
      const content = await readFile(this.ledgerPath, "utf8");
      return content.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
    } catch {
      return [];
    }
  }

  applyAdaptationsToPolicy(
    basePolicy: TaskExecutionPolicy,
    activeCycleNumber: number,
    adaptations: PolicyAdaptationDelta[]
  ): TaskExecutionPolicy & { active_guardrails: string[] } {
    const applicable = adaptations.filter((a) => a.applied_at_cycle <= activeCycleNumber);
    const guardrails: string[] = [];

    let maxRetries = basePolicy.max_retries;
    let allowedTools = [...basePolicy.allowed_tools];

    for (const adapt of applicable) {
      if (adapt.policy_modifications.enforce_git_merge) {
        guardrails.push("ENFORCE_FAIL_CLOSED_GIT_MERGE");
      }
      if (adapt.policy_modifications.mandatory_regression_test) {
        guardrails.push("MANDATORY_REGRESSION_TEST_VERIFICATION");
      }
      if (adapt.policy_modifications.disallow_unverified_claims) {
        guardrails.push("DISALLOW_UNVERIFIED_PRODUCT_CLAIMS");
        // Limit retries if unverified claims are detected
        maxRetries = Math.min(maxRetries, 1);
      }
      if (adapt.policy_modifications.allowed_paths_strict) {
        guardrails.push("STRICT_PATH_SANDBOXING");
        allowedTools = allowedTools.filter((t) => t !== "arbitrary_fs_write");
      }
    }

    return {
      ...basePolicy,
      max_retries: maxRetries,
      allowed_tools: allowedTools,
      active_guardrails: [...new Set(guardrails)],
    };
  }

  generateCounterfactualAudit(adaptations: PolicyAdaptationDelta[]): {
    total_adaptations: number;
    average_failure_reduction_pct: number;
    verified_interventions: Array<{
      adaptation_id: string;
      pre_vs_post: string;
    }>;
  } {
    if (!adaptations.length) {
      return { total_adaptations: 0, average_failure_reduction_pct: 0, verified_interventions: [] };
    }

    const reductions = adaptations.map(
      (a) => a.counterfactual.pre_adaptation_failure_rate_pct - a.counterfactual.post_adaptation_failure_rate_pct
    );
    const avgReduction = Math.round(reductions.reduce((a, b) => a + b, 0) / reductions.length);

    const verified = adaptations.map((a) => ({
      adaptation_id: a.adaptation_id,
      pre_vs_post: `Pre: ${a.counterfactual.pre_adaptation_behavior} (${a.counterfactual.pre_adaptation_failure_rate_pct}% fail) -> Post: ${a.counterfactual.post_adaptation_behavior} (${a.counterfactual.post_adaptation_failure_rate_pct}% fail)`,
    }));

    return {
      total_adaptations: adaptations.length,
      average_failure_reduction_pct: avgReduction,
      verified_interventions: verified,
    };
  }
}
