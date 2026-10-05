import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

export type ProductDecisionType = "RESEARCH" | "PROTOTYPE" | "BUILD" | "SIMPLIFY" | "KILL";

export interface DeepResearchFinding {
  hypothesis: string;
  data_sources_examined: string[];
  provider_limitations_found: string[];
  contradictions_identified: string[];
  assumptions_rejected: string[];
  remaining_unknowns: string[];
}

export interface ProductDiscoveryDecision {
  decision_id: string;
  opportunity_id: string;
  golden_journey_id: string;
  domain: string;
  title: string;
  decision_type: ProductDecisionType;
  deep_research: DeepResearchFinding;
  decision_rationale: string;
  recorded_at: string;
  actor: string;
}

export class ProductDiscoveryDecisionLedger {
  private readonly ledgerFile: string;

  constructor(private readonly rootDir: string) {
    this.ledgerFile = path.join(rootDir, ".ai-company", "product-intelligence", "DISCOVERY_DECISIONS.jsonl");
  }

  async record(decision: ProductDiscoveryDecision): Promise<void> {
    await mkdir(path.dirname(this.ledgerFile), { recursive: true });
    await writeFile(this.ledgerFile, JSON.stringify(decision) + "\n", { flag: "a", encoding: "utf8" });
  }

  async list(): Promise<ProductDiscoveryDecision[]> {
    try {
      const content = await readFile(this.ledgerFile, "utf8");
      return content.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
    } catch {
      return [];
    }
  }

  evaluateDecisionDiversity(decisions: ProductDiscoveryDecision[]): {
    unique_decision_types: ProductDecisionType[];
    has_diversity: boolean;
    has_kill_or_simplify: boolean;
    journey_coverage: string[];
  } {
    const types = [...new Set(decisions.map((d) => d.decision_type))];
    const journeys = [...new Set(decisions.map((d) => d.golden_journey_id))];
    return {
      unique_decision_types: types,
      has_diversity: types.length >= 3,
      has_kill_or_simplify: types.includes("KILL") || types.includes("SIMPLIFY"),
      journey_coverage: journeys,
    };
  }
}
