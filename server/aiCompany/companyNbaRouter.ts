import crypto from "node:crypto";
import type { CandidateWorkDescriptor, ExecutionContract } from "./executionPlanner";

export type CompanyNbaType =
  | "DELIVERY"
  | "RESEARCH"
  | "ACQUIRE_EVIDENCE"
  | "VALIDATE_PRODUCT"
  | "DISCOVERY"
  | "COMPANY_JUSTIFIED_WAIT";

export type CompanyWaitType = "NONE" | "DELIVERY_WAIT" | "COMPANY_JUSTIFIED_WAIT";

export interface CompanyNbaDecision {
  nba_type: CompanyNbaType;
  wait_type: CompanyWaitType;
  is_justified_wait: boolean;
  selected_candidate: CandidateWorkDescriptor | null;
  reason: string;
  zero_cognition: boolean;
  actionable_research_count: number;
  actionable_delivery_count: number;
  actionable_evidence_count: number;
}

export interface ResearchQuestionRecord {
  id: string;
  question?: string;
  priority?: "HIGH" | "MEDIUM" | "LOW" | string;
  status?: string;
  why_it_matters?: string;
  important_unknown?: string;
  created_at?: string;
}

export interface QualifiedWorkItemRecord {
  id: string;
  candidate_id?: string;
  title?: string;
  status?: string;
  qualification_status?: string;
  research_status?: string;
  hold_contract?: {
    is_held?: boolean;
    hold_reason?: string;
    evidence_gap?: string;
    resume_condition?: string;
    permitted_next_action?: string;
  };
}

export interface SchedulingFingerprintParams {
  cycleNum: number;
  realityRevision?: string;
  candidatePoolHash?: string;
  waitReason?: string;
  evidenceRevision?: string;
  databaseStateHash?: string;
}

export interface AntiLivelockEvaluation {
  is_livelock: boolean;
  should_retry_immediately: boolean;
  backoff_ms: number;
  consecutive_identical_count: number;
  reason: string;
}

export type SchedulingOutcomeCategory =
  | "EXPECTED_SCHEDULING_OUTCOME"
  | "RESOURCE_WAIT"
  | "OBJECTIVE_INELIGIBLE"
  | "TRANSIENT_INFRASTRUCTURE_FAILURE"
  | "STATE_RECONCILIATION_REQUIRED"
  | "FATAL_CORRUPTION";

export interface SchedulingOutcomeClassification {
  category: SchedulingOutcomeCategory;
  is_error: boolean;
  wait_type?: CompanyWaitType | "RESOURCE_EXHAUSTED" | "OBJECTIVE_INELIGIBLE";
  should_retry_immediately: boolean;
  backoff_ms: number;
  reason: string;
}

/**
 * Filter genuinely actionable research questions.
 * Excludes completed, archived, deferred, killed, held, or already attempted under same reality.
 */
export function getActionableResearchQuestions(params: {
  questions: ResearchQuestionRecord[];
  inventoryItems?: QualifiedWorkItemRecord[];
  attemptedObjectives?: Set<string>;
  realityRevision?: string;
}): ResearchQuestionRecord[] {
  const { questions, inventoryItems = [], attemptedObjectives = new Set() } = params;

  return questions.filter((q) => {
    const status = String(q.status || "").toUpperCase();
    if (!["IN_PROGRESS", "PLANNED", "RESEARCH_REQUIRED", "OPEN"].includes(status)) {
      return false;
    }

    // Check inventory record
    const invItem = inventoryItems.find(
      (item) => item.id === `QW-${q.id}` || item.candidate_id === `RESEARCH-${q.id}`
    );
    if (invItem) {
      const invStatus = String(invItem.status || "").toUpperCase();
      if (["DEFERRED", "REJECTED", "KILLED", "MERGED_SUPERSEDED", "COMPLETED"].includes(invStatus)) {
        return false;
      }
      if (invItem.hold_contract?.is_held) {
        return false;
      }
      const researchStatus = String(invItem.research_status || "").toUpperCase();
      if (["EVIDENCE_DEFER", "RESEARCH_COMPLETED"].includes(researchStatus)) {
        return false;
      }
    }

    // Check if already attempted in historical cycles
    const backlogId = `BACKLOG-RESEARCH-${q.id}`;
    if (attemptedObjectives.has(backlogId)) {
      return false;
    }

    return true;
  });
}

/**
 * Company-level Next-Best-Action (NBA) Selector.
 * Enforces:
 * 1. Delivery empty does NOT mean company empty.
 * 2. If delivery is empty but actionable research exists -> select research NBA.
 * 3. Multi-question selection is deterministic and reasoned by priority (HIGH > MEDIUM > LOW).
 * 4. Only when ALL work channels are empty or non-actionable -> COMPANY_JUSTIFIED_WAIT with zero cognition.
 */
export function selectCompanyNextBestAction(params: {
  deliveryCandidates: CandidateWorkDescriptor[];
  portfolioQuestions: ResearchQuestionRecord[];
  inventoryItems?: QualifiedWorkItemRecord[];
  priorCycles?: Array<{ objective_id?: string; execution_result?: { commit_sha?: string | null } }>;
  realityRevision?: string;
  activeCommitments?: number;
  unconsumedModules?: string[];
  canonicalBacklogItems?: Array<{
    backlog_id: string;
    status?: string;
    priority?: string;
    title?: string;
    summary?: string;
    expected_change?: string;
    allowed_paths?: string[];
  }>;
}): CompanyNbaDecision {
  const {
    deliveryCandidates = [],
    portfolioQuestions = [],
    inventoryItems = [],
    priorCycles = [],
    realityRevision = "",
    activeCommitments = 0,
    unconsumedModules = [],
    canonicalBacklogItems = [],
  } = params;

  const attemptedResearch = new Set(
    priorCycles
      .filter((cycle) => String(cycle.objective_id || "").startsWith("BACKLOG-RESEARCH-"))
      .map((cycle) => cycle.objective_id as string)
  );

  // 1. Qualified Delivery Work
  if (deliveryCandidates.length > 0) {
    const selected = deliveryCandidates[0];
    return {
      nba_type: "DELIVERY",
      wait_type: "NONE",
      is_justified_wait: false,
      selected_candidate: selected,
      reason: `${deliveryCandidates.length} qualified delivery items ready for execution. Selected: ${selected.backlog_id || selected.id}`,
      zero_cognition: false,
      actionable_research_count: 0,
      actionable_delivery_count: deliveryCandidates.length,
      actionable_evidence_count: 0,
    };
  }

  // 2. Actionable Research NBA
  const actionableQuestions = getActionableResearchQuestions({
    questions: portfolioQuestions,
    inventoryItems,
    attemptedObjectives: attemptedResearch,
    realityRevision,
  });

  if (actionableQuestions.length > 0) {
    const priorityWeights: Record<string, number> = { HIGH: 1, MEDIUM: 2, LOW: 3 };
    const sortedQuestions = [...actionableQuestions].sort((a, b) => {
      const pa = priorityWeights[String(a.priority || "").toUpperCase()] || 99;
      const pb = priorityWeights[String(b.priority || "").toUpperCase()] || 99;
      if (pa !== pb) return pa - pb;
      return String(a.id).localeCompare(String(b.id));
    });

    const topQuestion = sortedQuestions[0];
    const researchCandidate: CandidateWorkDescriptor = {
      backlog_id: `BACKLOG-RESEARCH-${topQuestion.id}`,
      title: `Product research: ${topQuestion.question || topQuestion.id}`,
      expected_change: topQuestion.important_unknown || topQuestion.why_it_matters || topQuestion.question,
      summary: topQuestion.why_it_matters || topQuestion.question,
      status: "READY",
      priority: String(topQuestion.priority || "").toUpperCase() === "HIGH" ? "P1" : "P2",
      allowed_paths: [".ai-company/product-intelligence/RESEARCH_PORTFOLIO.json"],
      source: "active-research-portfolio-replenishment",
      task_type: "research",
    };

    return {
      nba_type: "RESEARCH",
      wait_type: "NONE",
      is_justified_wait: false,
      selected_candidate: researchCandidate,
      reason: `Build queue is empty, but research question ${topQuestion.id} (${topQuestion.priority || "MEDIUM"}) is actionable. Routing to research NBA.`,
      zero_cognition: false,
      actionable_research_count: actionableQuestions.length,
      actionable_delivery_count: 0,
      actionable_evidence_count: 0,
    };
  }

  // 3. Actionable Evidence Actions
  const committedEvidence = new Set(
    priorCycles
      .filter((cycle) => Boolean(cycle.execution_result?.commit_sha) && String(cycle.objective_id || "").startsWith("BACKLOG-EVIDENCE-"))
      .map((cycle) => cycle.objective_id as string)
  );

  const actionableEvidenceItems = inventoryItems.filter((item) => {
    if (item.status !== "PENDING_SELECTION" || !item.hold_contract?.is_held) return false;
    const action = item.hold_contract.permitted_next_action || "";
    if (!["QUERY_EXISTING_DATA", "ACQUIRE_EVIDENCE", "VALIDATE_PRODUCT"].includes(action)) return false;
    const baseBacklogId = `BACKLOG-EVIDENCE-${String(item.id).replace(/^QW-/, "")}`;
    if (committedEvidence.has(baseBacklogId)) return false;
    // For read inquiries (QUERY_EXISTING_DATA), suppress only if already queried under same reality
    if (action === "QUERY_EXISTING_DATA" && priorCycles.some((c) => String(c.objective_id || "") === baseBacklogId)) {
      return false;
    }
    return true;
  });

  if (actionableEvidenceItems.length > 0) {
    const topEvidence = actionableEvidenceItems[0];
    const evidenceAction = topEvidence.hold_contract?.permitted_next_action || "QUERY_EXISTING_DATA";
    const candidate: CandidateWorkDescriptor = {
      backlog_id: `BACKLOG-EVIDENCE-${String(topEvidence.id).replace(/^QW-/, "")}`,
      title: `Evidence Action (${evidenceAction}): ${topEvidence.title || topEvidence.id}`,
      expected_change: `Execute bounded inquiry to resolve evidence gap: ${topEvidence.hold_contract?.evidence_gap || "Resolve gap"}`,
      summary: topEvidence.hold_contract?.hold_reason || topEvidence.id,
      status: "READY",
      priority: "P2",
      allowed_paths: [
        ".ai-company/product-intelligence/QUALIFIED_WORK_INVENTORY.json",
        ".ai-company/product-intelligence/RESEARCH_PORTFOLIO.json",
      ],
      source: "held-evidence-action-replenishment",
      task_type: "evidence_action",
    };

    return {
      nba_type: "ACQUIRE_EVIDENCE",
      wait_type: "NONE",
      is_justified_wait: false,
      selected_candidate: candidate,
      reason: `Research held pending evidence; actionable inquiry ${topEvidence.id} selected.`,
      zero_cognition: false,
      actionable_research_count: 0,
      actionable_delivery_count: 0,
      actionable_evidence_count: actionableEvidenceItems.length,
    };
  }

  // 4. Unconsumed Analytics Consumption NBA (Section 13: No Orphaned Code Islands)
  if (unconsumedModules.length > 0 && canonicalBacklogItems.length > 0) {
    const consumptionItem = canonicalBacklogItems.find((item) =>
      unconsumedModules.some((mod) => {
        const modBase = mod.split("/").pop()?.replace(".ts", "") || "";
        return item.backlog_id.toLowerCase().includes(modBase.toLowerCase());
      })
    );
    if (consumptionItem) {
      const candidate: CandidateWorkDescriptor = {
        backlog_id: consumptionItem.backlog_id,
        title: `Mount and verify runtime consumption: ${consumptionItem.title || consumptionItem.backlog_id}`,
        expected_change: `Implement router endpoint and register in server/routes/index.ts to consume unconsumed module.`,
        summary: consumptionItem.summary || consumptionItem.backlog_id,
        status: "READY",
        priority: "P1",
        allowed_paths: consumptionItem.allowed_paths || ["server/routes/analyticsRouter.ts", "server/routes/index.ts"],
        source: "unconsumed-analytics-consumption",
        task_type: "consumption_action",
      };
      return {
        nba_type: "DELIVERY",
        wait_type: "NONE",
        is_justified_wait: false,
        selected_candidate: candidate,
        reason: `Build queue is empty, but unconsumed analytics module requires runtime consumption. Routing to delivery NBA: ${consumptionItem.backlog_id}.`,
        zero_cognition: false,
        actionable_research_count: 0,
        actionable_delivery_count: 1,
        actionable_evidence_count: 0,
      };
    }
  }

  // 5. True Company Wait (all channels empty / non-actionable)
  return {
    nba_type: "COMPANY_JUSTIFIED_WAIT",
    wait_type: "COMPANY_JUSTIFIED_WAIT",
    is_justified_wait: true,
    selected_candidate: null,
    reason:
      "Zero eligible build, research, evidence, validation, or discovery actions exist across all search lenses. Zero-cognition wait is optimal (COMPANY_JUSTIFIED_WAIT).",
    zero_cognition: true,
    actionable_research_count: 0,
    actionable_delivery_count: 0,
    actionable_evidence_count: 0,
  };
}

/**
 * Computes deterministic scheduling fingerprint to detect unchanged state.
 */
export function computeSchedulingFingerprint(params: SchedulingFingerprintParams): string {
  const hash = crypto.createHash("sha256");
  hash.update(`cycle:${params.cycleNum}`);
  hash.update(`reality:${params.realityRevision || ""}`);
  hash.update(`pool:${params.candidatePoolHash || ""}`);
  hash.update(`reason:${params.waitReason || ""}`);
  hash.update(`evidence:${params.evidenceRevision || ""}`);
  if (params.databaseStateHash) {
    hash.update(`db:${params.databaseStateHash}`);
  }
  return hash.digest("hex");
}

/**
 * Evaluates whether current scheduling state is an unchanged retry livelock.
 */
export function evaluateAntiLivelock(params: {
  currentFingerprint: string;
  lastFingerprint: string | null;
  consecutiveCount: number;
  basePollMs?: number;
}): AntiLivelockEvaluation {
  const { currentFingerprint, lastFingerprint, consecutiveCount, basePollMs = 300_000 } = params;
  const pollMs = Math.max(30_000, basePollMs);

  if (lastFingerprint && currentFingerprint === lastFingerprint) {
    const nextCount = consecutiveCount + 1;
    return {
      is_livelock: true,
      should_retry_immediately: false,
      backoff_ms: pollMs,
      consecutive_identical_count: nextCount,
      reason: `Identical scheduling fingerprint detected (${nextCount} identical attempts). Suppressing immediate retry; enforcing poll wait of ${pollMs}ms.`,
    };
  }

  return {
    is_livelock: false,
    should_retry_immediately: true,
    backoff_ms: 0,
    consecutive_identical_count: 1,
    reason: "New or modified scheduling fingerprint.",
  };
}

/**
 * Classifies runtime errors vs expected scheduling outcomes.
 * Guarantees that expected wait states (DELIVERY_WAIT, COMPANY_JUSTIFIED_WAIT) are NEVER treated as infrastructure failures.
 */
export function classifySchedulingOutcome(errOrOutcome: unknown): SchedulingOutcomeClassification {
  const str = String(errOrOutcome instanceof Error ? errOrOutcome.message : errOrOutcome || "");

  if (
    str.includes("COMPANY_JUSTIFIED_WAIT") ||
    str.includes("JUSTIFIED_WAIT") ||
    (typeof errOrOutcome === "object" &&
      errOrOutcome !== null &&
      "wait_type" in errOrOutcome &&
      (errOrOutcome as any).wait_type === "COMPANY_JUSTIFIED_WAIT")
  ) {
    return {
      category: "EXPECTED_SCHEDULING_OUTCOME",
      is_error: false,
      wait_type: "COMPANY_JUSTIFIED_WAIT",
      should_retry_immediately: false,
      backoff_ms: 300_000,
      reason: "Expected company-wide justified wait; zero cognition and schedule polling.",
    };
  }

  if (
    str.includes("DELIVERY_WAIT") ||
    (typeof errOrOutcome === "object" &&
      errOrOutcome !== null &&
      "wait_type" in errOrOutcome &&
      (errOrOutcome as any).wait_type === "DELIVERY_WAIT")
  ) {
    return {
      category: "EXPECTED_SCHEDULING_OUTCOME",
      is_error: false,
      wait_type: "DELIVERY_WAIT",
      should_retry_immediately: false,
      backoff_ms: 300_000,
      reason: "Delivery queue empty; non-delivery NBA or scheduled poll without infrastructure error.",
    };
  }

  if (
    str.includes("quota") ||
    str.includes("RESOURCE_EXHAUSTED") ||
    str.includes("429") ||
    str.includes("usage limit")
  ) {
    return {
      category: "RESOURCE_WAIT",
      is_error: true,
      wait_type: "RESOURCE_EXHAUSTED",
      should_retry_immediately: false,
      backoff_ms: 300_000,
      reason: "Provider rate limit or quota exhaustion.",
    };
  }

  if (str.includes("CYCLE_CREATION_REJECTED")) {
    return {
      category: "OBJECTIVE_INELIGIBLE",
      is_error: false,
      wait_type: "OBJECTIVE_INELIGIBLE",
      should_retry_immediately: true,
      backoff_ms: 250,
      reason: "Candidate objective rejected by scheduler; rotate candidate.",
    };
  }

  return {
    category: "TRANSIENT_INFRASTRUCTURE_FAILURE",
    is_error: true,
    should_retry_immediately: false,
    backoff_ms: 5000,
    reason: `Unrecognized infrastructure error: ${str}`,
  };
}
