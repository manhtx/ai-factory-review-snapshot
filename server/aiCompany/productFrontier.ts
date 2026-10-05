import { readFile } from "node:fs/promises";
import path from "node:path";

export interface ProductFrontierCapability {
  id: string;
  name: string;
  domain: "INGESTION_FRESHNESS" | "TRANSFORMATION_NORMALIZATION" | "REGIME_MODELS" | "QUALITATIVE_INTELLIGENCE" | "GOLDEN_JOURNEYS";
  description: string;
  status: "MATURE" | "PARTIAL" | "EMERGENT" | "UNADDRESSED";
  coverage_pct: number;
  evidence_paths: string[];
  gaps: string[];
}

export interface GoldenJourney {
  id: string;
  name: string;
  description: string;
  persona: string;
  indicators: string[];
  current_maturity: "LEVEL_0_RAW" | "LEVEL_1_VERIFIED" | "LEVEL_2_INTERACTIVE" | "LEVEL_3_DECISION_READY";
  blockers: string[];
  next_objective: string;
}

export interface FrontierGap {
  gap_id: string;
  domain: string;
  severity: "P0" | "P1" | "P2";
  description: string;
  candidate_opportunity: string;
}

export interface ProductFrontier {
  version: string;
  updated_at: string;
  product_thesis: {
    core_tenets: string[];
    differentiation_vs_terminals: string[];
  };
  capabilities: ProductFrontierCapability[];
  golden_journeys: GoldenJourney[];
  identified_gaps: FrontierGap[];
}

export interface FrontierCoverageEvaluation {
  overall_coverage_pct: number;
  mature_count: number;
  partial_count: number;
  unaddressed_count: number;
  golden_journey_count: number;
  total_gaps_count: number;
}

export interface FrontierOpportunity {
  id: string;
  title: string;
  priority: "P0" | "P1" | "P2";
  domain: string;
  recommended_action: "RESEARCH" | "PROTOTYPE" | "BUILD" | "SIMPLIFY" | "KILL";
  rationale: string;
}

export class ProductFrontierManager {
  private readonly frontierPath: string;

  constructor(private readonly rootDir: string) {
    this.frontierPath = path.join(rootDir, "docs", "product", "PRODUCT_FRONTIER.json");
  }

  async load(): Promise<ProductFrontier> {
    const content = await readFile(this.frontierPath, "utf8");
    return JSON.parse(content) as ProductFrontier;
  }

  evaluateCoverage(frontier: ProductFrontier): FrontierCoverageEvaluation {
    const total = frontier.capabilities.length;
    if (!total) {
      return {
        overall_coverage_pct: 0,
        mature_count: 0,
        partial_count: 0,
        unaddressed_count: 0,
        golden_journey_count: frontier.golden_journeys.length,
        total_gaps_count: frontier.identified_gaps.length,
      };
    }
    const sum = frontier.capabilities.reduce((acc, cap) => acc + cap.coverage_pct, 0);
    const mature_count = frontier.capabilities.filter((c) => c.status === "MATURE").length;
    const partial_count = frontier.capabilities.filter((c) => c.status === "PARTIAL").length;
    const unaddressed_count = frontier.capabilities.filter((c) => c.status === "UNADDRESSED").length;

    return {
      overall_coverage_pct: Math.round(sum / total),
      mature_count,
      partial_count,
      unaddressed_count,
      golden_journey_count: frontier.golden_journeys.length,
      total_gaps_count: frontier.identified_gaps.length,
    };
  }

  discoverOpportunities(frontier: ProductFrontier): FrontierOpportunity[] {
    const opportunities: FrontierOpportunity[] = [];

    for (const gap of frontier.identified_gaps) {
      let recommended_action: FrontierOpportunity["recommended_action"] = "BUILD";
      if (gap.domain === "REGIME_MODELS") recommended_action = "PROTOTYPE";
      else if (gap.severity === "P2") recommended_action = "RESEARCH";

      opportunities.push({
        id: gap.candidate_opportunity,
        title: gap.description,
        priority: gap.severity,
        domain: gap.domain,
        recommended_action,
        rationale: `Derived from frontier gap ${gap.gap_id} in domain ${gap.domain}`,
      });
    }

    for (const cap of frontier.capabilities) {
      if (cap.status === "PARTIAL" && cap.gaps.length > 0) {
        for (const capGap of cap.gaps) {
          const oppId = `OPP-${cap.id}-${capGap.replace(/[^A-Za-z0-9]/g, "-").slice(0, 20)}`.toUpperCase();
          if (!opportunities.some((o) => o.id === oppId)) {
            opportunities.push({
              id: oppId,
              title: capGap,
              priority: "P2",
              domain: cap.domain,
              recommended_action: "RESEARCH",
              rationale: `Addresses partial capability ${cap.name} (${cap.coverage_pct}% coverage)`,
            });
          }
        }
      }
    }

    return opportunities;
  }
}
