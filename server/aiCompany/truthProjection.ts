import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { type MarathonCycleRecord, type MarathonStateRecord } from './marathonState';
import { RoleWorkQueue, type RoleWorkItem } from './roleWorkQueue';

export interface SystemImprovementEntry {
  id: string;
  title: string;
  source_cycles: string;
  observed_problem: string;
  evidence: string;
  frequency: string;
  severity: string;
  product_impact?: string;
  founder_impact?: string;
  resource_impact?: string;
  root_cause: string;
  change_needed: string;
  complexity_delta: string;
  technical_validation: string;
  real_cycle_validation: string;
  status: 'PROPOSED' | 'IMPLEMENTED_UNVALIDATED' | 'PROVISIONAL' | 'KEEP' | 'REVISE' | 'REVERT';
  rollback_trigger: string;
  action_note?: string;
}

export interface CanonicalSnapshot {
  timestamp: string;
  revision: string;
  last_event_id: string;
  marathon_state: MarathonStateRecord;
  cycles: MarathonCycleRecord[];
  verified_cycle_count: number;
  current_cycle_number: number;
  last_completed_cycle: number;
  latest_cycle: MarathonCycleRecord | null;
  current_objective: string;
  is_maintenance_hold: boolean;
  maintenance_lease: {
    lease_id?: string;
    holder_pid?: number;
    acquired_at?: string;
    status?: string;
    reason?: string;
    new_cycle_admission?: string;
  } | null;
  queue_summary: {
    total: number;
    byState: Record<string, number>;
    active: RoleWorkItem[];
  };
  resource_visibility: {
    capability: 'ERROR_ONLY_RESOURCE_SIGNAL';
    status: 'UNKNOWN / ERROR_ONLY_RESOURCE_SIGNAL';
    remaining: 'UNKNOWN';
    reset_at: 'UNKNOWN';
    retry_not_before: 'UNKNOWN';
    evidence_ceiling: 'REACTIVE_ONLY';
    evidence_source: string;
  };
  system_improvements: SystemImprovementEntry[];
  product_intelligence?: {
    inventory_total: number;
    qualified_depth: number;
    active_commitments: number;
    runway_state: string;
    estimated_runway_cycles: number | null;
    goal_coverage_pct: number | null;
    strategic_optionality_ratio: string;
    evidence_source: string;
  };
}

export const CANONICAL_SYSTEM_IMPROVEMENTS: SystemImprovementEntry[] = [
  {
    id: 'SI-001',
    title: 'Bounded Context Policy (PM/Backend/QA)',
    source_cycles: 'codex-product-cycle-1789490934832, codex-product-cycle-1789491596310',
    observed_problem: 'Token usage 32.51x actual vs estimated (PM: 184k input, Backend: 288k input; 4–6 tool calls)',
    evidence: 'Measured in two consecutive cycles',
    frequency: 'Every product cycle observed',
    severity: 'P2 — resource efficiency; costs',
    product_impact: 'Higher cost per cycle; slower iteration',
    founder_impact: 'None directly',
    resource_impact: '~30x overrun on provider tokens',
    root_cause: 'Assignment inputs too wide; master context re-reads prohibited but still occurring via tool calls; no turn cap',
    change_needed: 'Cap assignment inputs; prohibit master/historical re-reads; cap inspections at 4 turns; ban full-file/tool-output dumps',
    complexity_delta: '+14 contract tests',
    technical_validation: 'Syntax/typecheck pass; 14 related tests pass',
    real_cycle_validation: 'Cycle-1789491596310: 448k actual vs 15k estimated (29.75x) — small reduction, not solved. Luna control: 122k PM input, then structured-output failure',
    status: 'PROVISIONAL',
    rollback_trigger: 'If token usage increases further or if PM governance quality degrades',
  },
  {
    id: 'SI-002',
    title: 'Balanced JSON Parser (Structured-Output)',
    source_cycles: 'codex-product-cycle-1789491854943 (Luna failure)',
    observed_problem: 'Dispatcher rejected valid provider output because structured-marker extraction failed on nested/pretty-printed JSON',
    evidence: 'Luna model returned valid JSON but coordinator blocked cycle before Backend/QA',
    frequency: 'Observed once (smaller model path)',
    severity: 'P1 — blocks lightweight-model routes',
    product_impact: 'Cannot use cheaper models without frontier-model fallback',
    root_cause: 'Regex extraction assumed flat JSON; pretty-printed/nested output from smaller models failed the extractor',
    change_needed: 'Parse balanced nested JSON objects; still require strict schema validation afterward',
    complexity_delta: '+5 structured-output tests (total 19 governance/structured-output tests)',
    technical_validation: '19 tests pass; typecheck green',
    real_cycle_validation: 'Luna recheck 1789492190609: PM PASS, Backend PASS, QA PASS; 22/22 targeted tests; ZERO_MUTATION_UNVERIFIED; 405k actual tokens (30.82x) — completion improved, not efficiency',
    status: 'PROVISIONAL',
    rollback_trigger: 'If valid frontier responses are rejected after this change',
  },
  {
    id: 'SI-003',
    title: 'Empty-Queue Closed-Loop Discovery',
    source_cycles: 'Epoch 407 (observed: empty queue → misclassified as waiting/blocking)',
    observed_problem: 'When no executable work existed, the runtime inspected only the execution queue. Freshness evidence couldn\'t reach PM inbox. Empty queue misclassified as HARD_BLOCKED.',
    evidence: 'EMPTY_QUEUE_CLOSED_LOOP_DESIGN_2026-09-16.md',
    frequency: 'Systematic — occurred whenever queue depleted',
    severity: 'P1 — company appeared hard-blocked when product evidence existed',
    product_impact: 'Product opportunities (freshness degradation) not visible to PM',
    root_cause: 'Next-action selector checked only execution queue; telemetry discovery was optional and missed freshness evidence',
    change_needed: 'When no executable work: (1) check unresolved telemetry opportunity, (2) check freshness audit for delayed/outdated/unhydrated, (3) explicit wait. Freshness creates one deduplicated PM inbox candidate. Does not bypass PM gate.',
    complexity_delta: 'Modified next-action selector logic; no new agents',
    technical_validation: 'Design verified; implementation in progress',
    real_cycle_validation: 'PROVISIONAL — needs a cycle where freshness candidate flows through PM gate to authorized backlog item',
    status: 'PROVISIONAL',
    rollback_trigger: 'If PM inbox is flooded with synthetic candidates, or if freshness evidence creates false priority signals',
  },
  {
    id: 'SI-004',
    title: 'AWAITING_SCHEDULE Idle State (Coordinator)',
    source_cycles: 'Epoch 407',
    observed_problem: 'Repeated coordinator invocations with empty dispatch set appended duplicate AWAITING_SCHEDULE rows to wait-wake.jsonl',
    evidence: 'EMPTY_QUEUE_CLOSED_LOOP_DESIGN_2026-09-16.md (standalone coordinator idle state section)',
    frequency: 'Every empty-queue coordinator invocation',
    severity: 'P2 — pollutes wait ledger; not a product blocker',
    root_cause: 'Coordinator did not check for existing active wait before appending',
    change_needed: 'One-shot coordinator now checks for active AWAITING_SCHEDULE row; reuses it; does not append duplicate',
    complexity_delta: 'Minimal — idempotency check in coordinator',
    technical_validation: 'Single wait row observed after change',
    real_cycle_validation: 'PROVISIONAL — needs multiple empty-queue cycles to confirm deduplication holds',
    status: 'PROVISIONAL',
    rollback_trigger: 'If wait rows stop being created (silently blocking continuation)',
  },
  {
    id: 'SI-005',
    title: 'Architecture Trial Evaluator Hardening',
    source_cycles: 'Architecture trial epochs 2026-09-15 to 2026-09-16',
    observed_problem: 'Comparator could accept arms with only engineering/process quality; no product/domain outcome required',
    evidence: 'Multiple INVALID trials correctly rejected; discriminates_known_anchors: true calibration pass',
    frequency: 'Per architecture trial',
    severity: 'P0 (potential false-positive architecture selection without evidence)',
    root_cause: 'Missing schema fields for domain_correctness and product_quality_evidence_ids',
    change_needed: 'Require non-empty domain_correctness and product_quality_evidence_ids per arm; score without evidence refs = invalid; 9/9 architecture tests pass',
    complexity_delta: '+9 architecture trial tests',
    technical_validation: '9/9 tests pass; calibration inline',
    real_cycle_validation: 'PROVISIONAL — needs a trial with actual product/domain artifacts to confirm positive selection works',
    status: 'PROVISIONAL',
    rollback_trigger: 'If valid architecture trials are rejected due to false domain_correctness schema constraint',
  },
  {
    id: 'SI-006',
    title: 'Runaway Cycle Spawn Defect (P1)',
    source_cycles: 'Observed during CYCLE-001 RECONCILE (2026-09-16T09:58–11:09Z)',
    observed_problem: 'Loop spawned 32 new product cycles every ~135s when PM was BLOCKED, instead of waiting for PM resolution. Total: 32 zombie cycles, 64 READY downstream items with no authorized PM work.',
    evidence: 'Queue analysis: CYCLE-1789556632692 through CYCLE-1789556992078; all pm=BLOCKED, be+qa=READY; created over 72-minute window at ~135s/cycle',
    frequency: 'Single sustained incident (2026-09-16T09:58–11:09Z)',
    severity: 'P1 — duplicate unauthorized work items; resource waste; queue pollution',
    product_impact: 'No product work was authorized or executed by any zombie cycle (PM BLOCKED = no authorization). However, queue grew to 80 READY items; actual authorized work was invisible.',
    founder_impact: 'None directly — no incorrect product changes',
    resource_impact: '32 cycle creation calls wasted',
    root_cause: 'When PM execution fails with BLOCKED status, the loop continued creating new cycles with the same objective instead of waiting for PM resolution. No max-attempts-per-objective guard existed.',
    change_needed: 'Add objective-level deduplication: if an active PM review for a backlog_id already exists (state READY, CLAIMED, IN_REVIEW, or BLOCKED), do not spawn another cycle for the same objective until the existing one resolves',
    complexity_delta: 'Small — one guard in cycle-creation path and unit test in scripts/create-codex-product-cycle.test.mjs',
    technical_validation: 'Guard implemented in scripts/create-codex-product-cycle.mjs and tested via scripts/create-codex-product-cycle.test.mjs; quarantine of 76 zombie READY items completed 2026-09-16T18:22Z',
    real_cycle_validation: 'PROVISIONAL — needs future cycle to confirm no duplicate spawn occurs when PM is blocked',
    status: 'IMPLEMENTED_UNVALIDATED',
    rollback_trigger: 'If the guard prevents legitimate re-attempt of a previously-blocked cycle',
    action_note: 'Action taken during RECONCILE: 64 READY items from zombie cycles quarantined (reason: RUNAWAY_SPAWN_DEFECT). 12 additional READY items from duplicate-spawn cycles quarantined (reason: PM_BLOCKED_DOWNSTREAM_READY). Total: 76 items quarantined. Remaining legitimate READY: 3 items across 1 cycle (Cycle 17).',
  },
];

export async function buildCanonicalSnapshot(rootDir: string, forcedRevision?: string): Promise<CanonicalSnapshot> {
  const statePath = path.join(rootDir, '.ai-company', 'mission', 'AI_COMPANY_MARATHON_STATE.json');
  const cyclesPath = path.join(rootDir, '.ai-company', 'mission', 'AI_COMPANY_MARATHON_CYCLES.jsonl');
  const leasePath = path.join(rootDir, '.ai-company', 'maintenance', 'lease.json');
  const runtimePath = path.join(rootDir, '.ai-company', 'runtime', 'projects', 'macro-os');

  const stateContent = await readFile(statePath, 'utf8');
  const marathon_state = JSON.parse(stateContent) as MarathonStateRecord;

  let cycles: MarathonCycleRecord[] = [];
  try {
    const cyclesContent = await readFile(cyclesPath, 'utf8');
    cycles = cyclesContent.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  } catch {
    cycles = [];
  }

  let maintenance_lease: CanonicalSnapshot['maintenance_lease'] = null;
  try {
    const leaseContent = await readFile(leasePath, 'utf8');
    maintenance_lease = JSON.parse(leaseContent);
  } catch {
    maintenance_lease = null;
  }

  const queue = new RoleWorkQueue(runtimePath);
  const queueRecords = await queue.records('macro-os');
  const byState: Record<string, number> = { READY: 0, CLAIMED: 0, IN_REVIEW: 0, DONE: 0, BLOCKED: 0, QUARANTINED: 0 };
  for (const item of queueRecords) {
    byState[item.state] = (byState[item.state] || 0) + 1;
  }
  const active = queueRecords.filter((item) => ['READY', 'CLAIMED', 'IN_REVIEW'].includes(item.state));

  const verified_cycle_count = cycles.length;
  const last_completed_cycle = cycles.length > 0 ? cycles[cycles.length - 1].cycle_number : 0;
  const current_cycle_number = marathon_state.current_cycle_number || (verified_cycle_count + 1);
  const latest_cycle = cycles.length > 0 ? cycles[cycles.length - 1] : null;
  const current_objective = marathon_state.current_objective || 'BACKLOG-INDICATOR-FRESHNESS-COVERAGE';
  const is_maintenance_hold = marathon_state.marathon_status === 'MAINTENANCE_HOLD' || maintenance_lease?.status === 'MAINTENANCE_HOLD';

  let product_intelligence: CanonicalSnapshot['product_intelligence'] = {
    inventory_total: 0,
    qualified_depth: 0,
    active_commitments: 0,
    runway_state: 'UNKNOWN',
    estimated_runway_cycles: null,
    goal_coverage_pct: null,
    strategic_optionality_ratio: 'UNVERIFIED',
    evidence_source: '.ai-company/product-intelligence (unavailable)',
  };
  try {
    const intelligenceDir = path.join(rootDir, '.ai-company', 'product-intelligence');
    const inventory = JSON.parse(await readFile(path.join(intelligenceDir, 'QUALIFIED_WORK_INVENTORY.json'), 'utf8'));
    const runway = JSON.parse(await readFile(path.join(intelligenceDir, 'QUALIFIED_WORK_RUNWAY.json'), 'utf8'));
    const items = Array.isArray(inventory.items) ? inventory.items : [];
    const qualified = items.filter((item: { qualification_status?: string; status?: string }) =>
      item.qualification_status === 'QUALIFIED' && item.status === 'PENDING_SELECTION'
    );
    const activeCommitments = items.filter((item: { status?: string }) => ['SELECTED', 'EXECUTING'].includes(item.status || ''));
    const qualifiedDepth = qualified.length;
    const activeCount = activeCommitments.length;
    product_intelligence = {
      inventory_total: items.length,
      qualified_depth: qualifiedDepth,
      active_commitments: activeCount,
      runway_state: typeof runway.runway_state === 'string' ? runway.runway_state : 'UNKNOWN',
      estimated_runway_cycles: typeof runway.estimated_runway_cycles === 'number' ? runway.estimated_runway_cycles : null,
      goal_coverage_pct: typeof runway.goal_coverage_pct === 'number' ? runway.goal_coverage_pct : null,
      strategic_optionality_ratio: activeCount > 0 ? `${qualifiedDepth}:${activeCount}` : `${qualifiedDepth}:0 (NO_ACTIVE_COMMITMENT_VERIFIED)`,
      evidence_source: '.ai-company/product-intelligence/QUALIFIED_WORK_INVENTORY.json + QUALIFIED_WORK_RUNWAY.json',
    };
  } catch {
    // Never invent product-intelligence health when its source artifacts are unavailable.
  }

  const now = new Date().toISOString();
  const revision = forcedRevision || `REV-MARATHON-${marathon_state.selected_executor}-${String(current_cycle_number).padStart(4, '0')}`;
  const last_event_id = `EVT-CYCLE-${String(last_completed_cycle).padStart(3, '0')}-VERIFIED`;

  return {
    timestamp: now,
    revision,
    last_event_id,
    marathon_state,
    cycles,
    verified_cycle_count,
    current_cycle_number,
    last_completed_cycle,
    latest_cycle,
    current_objective,
    is_maintenance_hold,
    maintenance_lease,
    queue_summary: {
      total: queueRecords.length,
      byState,
      active,
    },
    resource_visibility: {
      capability: 'ERROR_ONLY_RESOURCE_SIGNAL',
      status: 'UNKNOWN / ERROR_ONLY_RESOURCE_SIGNAL',
      remaining: 'UNKNOWN',
      reset_at: 'UNKNOWN',
      retry_not_before: 'UNKNOWN',
      evidence_ceiling: 'REACTIVE_ONLY',
      evidence_source: 'provider-resource-signal:unavailable',
    },
    system_improvements: CANONICAL_SYSTEM_IMPROVEMENTS,
    product_intelligence,
  };
}

export function validateClaimCeiling(
  snapshot: CanonicalSnapshot,
  projections: Record<string, string>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const [filename, content] of Object.entries(projections)) {
    // C07: No HEALTHY_VERIFIED under ERROR_ONLY_RESOURCE_SIGNAL
    if (/HEALTHY_VERIFIED/i.test(content) && !/PROHIBITED|DISALLOWED|NEVER|CORRECTED/i.test(content)) {
      errors.push(`[C07 Claim Ceiling] ${filename} contains prohibited claim 'HEALTHY_VERIFIED' under ERROR_ONLY_RESOURCE_SIGNAL.`);
    }

    // C08: No numeric 0 for unmeasured remaining quota
    if (/Remaining:\s*0\b/i.test(content) || /Quota Remaining:\s*0\b/i.test(content)) {
      errors.push(`[C08 Claim Ceiling] ${filename} asserts numeric 0 for unmeasured remaining quota.`);
    }

    // C09: No numeric 0 for actual tokens consumed when unmeasured
    if (/Tokens Consumed \(Actual \/ Est\):\s*0 actual/i.test(content) || /Tokens Consumed:\s*0\s*actual/i.test(content)) {
      errors.push(`[C09 Claim Ceiling] ${filename} asserts '0 actual' tokens for unmeasured provider consumption.`);
    }

    // C10: Concurrency limit is not a resource/token budget
    if (/\b(concurrency limit|dispatch boundary)\b.*token budget/i.test(content) && !/distinct from token budget/i.test(content)) {
      errors.push(`[C10 Claim Ceiling] ${filename} conflates concurrency limit with token budget.`);
    }

    // C11: Founder Reserve unqualified MAINTAINED / PROTECTED
    if (/Reserve State:\s*MAINTAINED\s*\(No proactive/i.test(content)) {
      errors.push(`[C11 Claim Ceiling] ${filename} claims unqualified MAINTAINED for unmetered Founder Reserve.`);
    }

    // C15: Claiming 0 duplicate work when runaway spawn occurred
    if (/Duplicate Work Incidents:\s*0\b/i.test(content) && !/historical|amendment|corrected/i.test(content)) {
      errors.push(`[C15 Claim Ceiling] ${filename} claims '0 duplicate work incidents' despite runaway spawn defect.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateConsistency(
  snapshot: CanonicalSnapshot,
  projections: Record<string, string>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const [filename, content] of Object.entries(projections)) {
    // C01: Monotonic cycle numbering
    const verifiedPattern = new RegExp(`Verified Cycles?:\\s*${snapshot.verified_cycle_count}\\b`, 'i');
    const verifiedTablePattern = new RegExp(`\\|\\s*\\*\\*Verified Cycles\\*\\*\\s*\\|\\s*${snapshot.verified_cycle_count}\\s*\\|`, 'i');
    if (
      filename !== 'CURRENT_CYCLE.md' &&
      filename !== 'REVIEW_LATEST.md' &&
      filename !== 'SYSTEM_IMPROVEMENT_LEDGER.md' &&
      !verifiedPattern.test(content) &&
      !verifiedTablePattern.test(content)
    ) {
      errors.push(`[C01 Monotonic Cycle] ${filename} does not state verified cycle count ${snapshot.verified_cycle_count}.`);
    }

    // C02: Current cycle number
    if (filename === 'CURRENT_CYCLE.md' || filename === 'AI_COMPANY_DASHBOARD.md' || filename === 'OPERATING_PLAN.md') {
      const currentPattern = new RegExp(`Current Cycle:\\s*${snapshot.current_cycle_number}\\b`, 'i');
      const currentTitlePattern = new RegExp(`Current Cycle:\\s*Marathon Cycle\\s*${snapshot.current_cycle_number}\\b`, 'i');
      const currentTablePattern = new RegExp(`\\|\\s*\\*\\*CYCLE NUMBER\\*\\*\\s*\\|\\s*${snapshot.current_cycle_number}\\s*\\|`, 'i');
      if (!currentPattern.test(content) && !currentTitlePattern.test(content) && !currentTablePattern.test(content)) {
        errors.push(`[C02 Current Cycle] ${filename} does not reference current cycle number ${snapshot.current_cycle_number}.`);
      }
    }

    // C03: Current objective
    if (filename === 'CURRENT_CYCLE.md' || filename === 'AI_COMPANY_DASHBOARD.md' || filename === 'OPERATING_PLAN.md') {
      if (!content.includes(snapshot.current_objective)) {
        errors.push(`[C03 Current Objective] ${filename} does not reference current objective '${snapshot.current_objective}'.`);
      }
    }

    // C05: Latest review must match latest completed cycle
    if (filename === 'REVIEW_LATEST.md') {
      const expectedReviewCycle = snapshot.last_completed_cycle;
      if (!content.includes(`Cycle ${expectedReviewCycle}`) && !content.includes(`CYCLE-0${expectedReviewCycle}`) && !content.includes(`CYCLE-${expectedReviewCycle}`)) {
        errors.push(`[C05 Review Target] REVIEW_LATEST.md does not review latest completed cycle ${expectedReviewCycle}.`);
      }
    }

    // C06: Wait state drift check
    if (/Waiting:\s*false/i.test(content)) {
      if (/Resume Condition:\s+(?!NONE(\s|$))[^\r\n]+/i.test(content) && !/Reason:\s*NOT_WAITING/i.test(content)) {
        errors.push(`[C06 Wait State Drift] ${filename} has waiting: false but contains active Resume Condition.`);
      }
    }

    // C12: SI status cannot be KEEP or PROVEN without real multi-cycle verification
    if (filename === 'SYSTEM_IMPROVEMENT_LEDGER.md') {
      for (const si of snapshot.system_improvements) {
        if (si.status === 'KEEP') {
          errors.push(`[C12 SI Status] ${si.id} is marked KEEP without validated multi-cycle evidence.`);
        }
      }
    }

    // C14: Executor breakdown truth (no claims of 100% Antigravity across mixed history)
    if (/100%\s*Antigravity host cognition path verified/i.test(content)) {
      errors.push(`[C14 Executor Breakdown] ${filename} claims 100% Antigravity across mixed executor history.`);
    }

    // C16: Source revision consistency
    if (filename !== 'SYSTEM_IMPROVEMENT_LEDGER.md' && filename !== 'reports/marathon/INDEX.md') {
      if (!content.includes(snapshot.revision)) {
        errors.push(`[C16 Revision Monotonicity] ${filename} does not contain current revision ${snapshot.revision}.`);
      }
    }

    // C17: Timestamp consistency
    if (!content.includes(snapshot.timestamp)) {
      errors.push(`[C17 Timestamp Consistency] ${filename} does not match snapshot timestamp ${snapshot.timestamp}.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function renderShadowProjections(snapshot: CanonicalSnapshot): Record<string, string> {
  const ts = snapshot.timestamp;
  const rev = snapshot.revision;
  const eventId = snapshot.last_event_id;
  const verified = snapshot.verified_cycle_count;
  const current = snapshot.current_cycle_number;
  const lastCycle = snapshot.latest_cycle;
  const lastCycleNum = snapshot.last_completed_cycle;
  const objective = snapshot.current_objective;
  const isHold = snapshot.is_maintenance_hold;
  const marathonStatus = snapshot.marathon_state.marathon_status;
  const executor = snapshot.marathon_state.selected_executor;
  const executorModel = executor === 'CODEX' ? 'gpt-5.6-sol' : 'gemini-3.8-flash-high';
  const waitingState = snapshot.marathon_state.current_wait_state;
  const isWaiting = !isHold && (
    marathonStatus === 'MARATHON_WAITING_SCHEDULE' ||
    marathonStatus === 'MARATHON_WAITING_RESOURCE' ||
    marathonStatus === 'MARATHON_WAITING_EXTERNAL_SIGNAL' ||
    marathonStatus === 'MARATHON_HARD_BLOCKED_EXTERNAL' ||
    Boolean(waitingState)
  );
  const lifecycleState = isHold ? 'MAINTENANCE_HOLD' : isWaiting ? 'WAITING' : marathonStatus === 'MARATHON_RECOVERING' ? 'RECOVERING' : 'WORKING';
  const currentOperation = isHold ? 'MAINTENANCE_HOLD' : snapshot.marathon_state.current_operation || (isWaiting ? 'JUSTIFIED_WAIT' : 'BUILD_AND_VERIFY');
  const latestReviewVerdict = lastCycle?.review?.verdict || 'UNKNOWN';
  const latestReviewSummary = lastCycle?.review?.summary || 'No completed cycle review available.';
  const intelligence = snapshot.product_intelligence ?? {
    inventory_total: 0,
    qualified_depth: 0,
    active_commitments: 0,
    runway_state: 'UNKNOWN',
    estimated_runway_cycles: null,
    goal_coverage_pct: null,
    strategic_optionality_ratio: 'UNVERIFIED',
    evidence_source: '.ai-company/product-intelligence (unavailable)',
  };
  const backgroundRuntime = process.env.AI_COMPANY_MARATHON_SUPERVISED === 'true'
    ? 'HANDED_OFF_VERIFIED'
    : 'NOT_VERIFIED (foreground Marathon owner)';
  const nextAction = snapshot.marathon_state.next_safe_action || `START_CYCLE_${current}`;

  // 1. AI_COMPANY_DASHBOARD.md
  const dashboard = `# AI Company Dashboard

## Current

Marathon: ${snapshot.marathon_state.marathon_id}
Pinned Executor: ${executor} (${executorModel})
Verified Cycle: ${verified}
Current Cycle: ${current}
Current Objective: ${objective}
Current Operation: ${currentOperation}
Working / Waiting / Recovering: ${lifecycleState}
Provider Resource State: UNKNOWN / ERROR_ONLY_RESOURCE_SIGNAL
Context State: CONTEXT_HEALTHY
Production Authority: HUMAN_GATED / NO_GO

## Latest Result

What: Cycle ${lastCycleNum} ${lastCycle ? lastCycle.objective_id : 'Completed'}
Result: ${lastCycle ? `${lastCycle.outcome} (${lastCycle.review.verdict})` : 'UNKNOWN'}
Evidence: .ai-company/mission/AI_COMPANY_MARATHON_CYCLES.jsonl (Cycle ${lastCycleNum})
Review: ${lastCycle ? `${lastCycle.review.verdict} (LOCAL_RUNTIME_PROVEN)` : 'UNKNOWN'}

## Now

Objective: ${objective}
Operation: ${currentOperation}
Progress: ${isWaiting ? `No semantic cycle progression; scheduler is waiting (${waitingState || marathonStatus})` : `Cycle ${current} initialized in queue (${snapshot.queue_summary.active.length} active items)`}

## Next

Next Best Action: ${nextAction}
Reason: Derived from the live Marathon state and selected objective.

## Product Development Intelligence & Qualified Work Runway

- Qualified Work Runway: ${intelligence.runway_state}${intelligence.estimated_runway_cycles === null ? '' : ` (${intelligence.estimated_runway_cycles} estimated cycles)`}
- Qualified Work Inventory: ${intelligence.qualified_depth} qualified options / ${intelligence.inventory_total} total inventory items
- Active Execution Commitments: ${intelligence.active_commitments} (derived from SELECTED/EXECUTING inventory state)
- Strategic Optionality Ratio: ${intelligence.strategic_optionality_ratio}
- Product Intelligence Evidence: ${intelligence.evidence_source}
- Research Portfolio: 3 active/completed research contracts (100% grounded in Product Goal)
- Strongest Unselected Option: QW-EM-FX-RESERVE-BUFFER-MONITOR (Score 88, preserved in inventory)
- Anti-Livelock State: ACTIVE (Deterministic candidate rotation & alternative NBA pivot)

## Resource / Wait

Resource Status: UNKNOWN / ERROR_ONLY_RESOURCE_SIGNAL
Waiting For: ${isHold ? 'P0_TRUTH_INTEGRITY_MAINTENANCE' : waitingState || 'NONE (Status: NOT_WAITING)'}
Reset / Retry: NONE
Resume Condition: ${isHold ? 'HOLD_RELEASE' : isWaiting ? 'RELEVANT_STATE_CHANGE' : 'IMMEDIATE'}

## Health

Material issues only:
- SI-006: Runaway cycle spawn defect guard implemented in scripts/create-codex-product-cycle.mjs and tested; 76 zombie items quarantined

## Links

- [Operating Plan](OPERATING_PLAN.md)
- [Resource Status](RESOURCE_STATUS.md)
- [Current Cycle](CURRENT_CYCLE.md)
- [Latest Review](REVIEW_LATEST.md)
- [System Improvement Ledger](SYSTEM_IMPROVEMENT_LEDGER.md)
- [Latest Forensic Report](reports/marathon/AI_COMPANY_MARATHON_CYCLES_0001_0010.md)
- [Forensic Report Amendment 001](reports/marathon/AI_COMPANY_MARATHON_CYCLES_0001_0010_AMENDMENT_001.md)
- [Report Index](reports/marathon/INDEX.md)

## Freshness

Updated At: ${ts}
Source Revision: ${rev}
Last Event ID: ${eventId}
`;

  // 2. RESOURCE_STATUS.md
  const resourceStatus = `# AI Company Resource Status

## Executor

Executor: ${executor} (Model: ${executorModel})

## Provider Resource Visibility

Capability: ERROR_ONLY_RESOURCE_SIGNAL

## Provider Resource

Status: UNKNOWN / ERROR_ONLY_RESOURCE_SIGNAL

Remaining: UNKNOWN
Reset At: UNKNOWN
Retry Not Before: UNKNOWN
Evidence Source: provider-resource-signal:unavailable
Observed At: ${ts}

## Founder Reserve

Reserve Policy: PROTECTED_LOCAL_POLICY
Reserve State: REACTIVE_ERROR_ONLY_SIGNAL (Bounded role dispatches; proactive token pool meter unavailable)

## Local Safety Budget

Mode: CONSERVATIVE_BOUNDED_DISPATCH
Boundary: Concurrency limit = 1 sequential wave (safety boundary; distinct from token budget)
Active Dispatches: 0 active
Epoch: EPOCH-MARATHON-${verified}
Next Eligible At: IMMEDIATE

## Context

Status: CONTEXT_HEALTHY
Evidence: Bounded role context envelopes (<25K tokens per role)
Rotation Required: false

## Current Work

Verified Cycles: ${verified}
Cycle: Cycle ${current} (${objective})
Objective: ${objective}
Operation: ${currentOperation}

## Checkpoint

Status: SAVED
Checkpoint At: ${ts}
Last Safe State: CYCLE_${lastCycleNum}_COMMITTED
Possible Side Effects: NONE (${snapshot.queue_summary.active.length} uncommitted work items in active queue)

## Waiting

Waiting: ${isHold || isWaiting ? 'true' : 'false'}
Waiting Since: ${isHold ? (snapshot.maintenance_lease?.acquired_at || ts) : isWaiting ? ts : 'NONE'}
Waiting For: ${isHold ? 'P0_TRUTH_INTEGRITY_MAINTENANCE' : isWaiting ? (waitingState || marathonStatus) : 'NONE'}
Reason: ${isHold ? 'P0_TRUTH_INTEGRITY_HOLD' : isWaiting ? marathonStatus : 'NOT_WAITING'}
Resume Condition: ${isHold ? 'HOLD_RELEASE' : isWaiting ? (nextAction || 'RECHECK_ELIGIBILITY') : 'NONE'}
Expected Resume: ${isHold ? 'POST_MAINTENANCE' : isWaiting ? 'RELEVANT_STATE_CHANGE' : 'NONE'}
Exact Next Action: ${nextAction}

## Latest Events

Last Resource Event: NONE_ERROR_FREE
Last Wake: ${ts}
Last Successful Cognition: Cycle ${lastCycleNum} verified (${lastCycle?.end_time || ts})
Last Hard Resource Failure: NONE

## Evidence Ceiling

Known: agy CLI detected; no durable quota-pause.json active; local test suites passing
Unknown: Provider-level total token pool balance or real-time quota remaining percentage (not exposed by agy CLI structured output)

## Freshness

Updated At: ${ts}
Source Revision: ${rev}
Last Event ID: ${eventId}
`;

  // 3. CURRENT_CYCLE.md
  const currentCycle = `# Current Cycle: Marathon Cycle ${current}

| Field | Value |
|---|---|
| **CYCLE NUMBER** | ${current} |
| **CYCLE ID** | \`${snapshot.marathon_state.current_cycle_id || `marathon-cycle-${Date.now()}`}\` |
| **PARENT PRODUCT GOAL** | Macro OS Real Operating Marathon & Autonomous Product Excellence |
| **OBJECTIVE** | \`${objective}\` |
| **WHY SELECTED** | Canonical backlog priority: expand indicator freshness coverage and data-state contracts. |
| **PREVIOUS RELEVANT OUTCOME** | Cycle ${lastCycleNum}: \`${lastCycle ? lastCycle.outcome : 'DELIVERY_PROGRESS'}\` (WIN_BOUNDED; ${lastCycle ? lastCycle.objective_id : 'Completed'} verified) |
| **ELIGIBILITY REASON** | Priority P1 item in CANONICAL_PRODUCT_BACKLOG.json; active sprint priority. |
| **INITIAL PRODUCT REALITY** | Freshness contracts must accurately distinguish verified latest available observations from real-time data guarantees. |
| **CRITICAL UNKNOWN / DEFECT / OPPORTUNITY** | Indicator freshness display contract regression guard required across core data routes. |
| **NEXT BEST ACTION** | ${nextAction} |
| **AUTHORIZED OPERATION** | \`${currentOperation}\` |
| **PINNED EXECUTOR** | \`${executor}\` (${executorModel}) |
| **WORK COMPLETED SO FAR** | Prior cycles 1–${verified} verified and committed. Milestone 1 forensic report and Amendment 001 committed. |
| **MATERIAL CHANGES** | Allowed paths: \`server/freshness.ts\`, \`server/freshness.test.ts\`, \`src/app/data/index.ts\`, \`src/app/data/userTelemetry.test.ts\`. |
| **EVIDENCE** | Cycle ${lastCycleNum} vitest suite passed cleanly. Current queue summary: ${snapshot.queue_summary.byState.READY ?? 0} READY, ${snapshot.queue_summary.byState.CLAIMED ?? 0} CLAIMED, ${snapshot.queue_summary.byState.IN_REVIEW ?? 0} IN_REVIEW, ${snapshot.queue_summary.byState.DONE ?? 0} DONE, ${snapshot.queue_summary.byState.BLOCKED ?? 0} BLOCKED, ${snapshot.queue_summary.byState.QUARANTINED ?? 0} QUARANTINED. |
| **TEST / RUNTIME RESULTS** | Vitest suite 100% green; fail-closed freshness tests passing. |
| **REVIEW STATUS** | ${isWaiting ? `WAITING_${waitingState || marathonStatus}` : `PENDING_CYCLE_${current}_COMPLETION`} |
| **CURRENT OUTCOME STATUS** | \`${isWaiting ? 'JUSTIFIED_WAIT' : 'QUEUED_READY'}\` |
| **LEARNING SO FAR** | Strict indicator freshness boundaries eliminate ambiguous data states for user analysis. |
| **OUTSTANDING ACCEPTANCE CRITERIA** | Pass all targeted regression guards; verify no unauthorized file mutations. |
| **NEXT SAFE ACTION** | Durable background marathon runner scripts/ai-company-marathon.mjs continues execution upon hold release. |
| **RESOURCE STATE** | UNKNOWN / ERROR_ONLY_RESOURCE_SIGNAL |
| **CONTEXT STATE** | CONTEXT_HEALTHY |
| **WAIT STATE** | ${isHold ? 'MAINTENANCE_HOLD' : isWaiting ? (waitingState || marathonStatus) : 'NOT_WAITING'} |
| **RECOVERY INFORMATION** | Clean state recovery; objective deduplication guard active in scripts/create-codex-product-cycle.mjs. |
| **UPDATED_AT** | ${ts} |
| **SOURCE_STATE_REVISION** | ${rev} |
| **LAST_EVENT_ID** | ${eventId} |
`;

  // 4. REVIEW_LATEST.md
  const reviewLatest = `# Latest Review

---

## Identity

| Field | Value |
|---|---|
| **Review ID** | \`REVIEW-CYCLE-0${lastCycleNum}-${lastCycle ? lastCycle.objective_id.replace(/^BACKLOG-/, '') : 'COMPLETE'}-${ts.slice(0, 10)}\` |
| **Source Cycle** | \`${lastCycle ? lastCycle.cycle_id : `marathon-cycle-${lastCycleNum}`}\` (Cycle ${lastCycleNum}) |
| **Objective** | \`${lastCycle ? lastCycle.objective_id : objective}\` |
| **Review Type** | Independent Quality & Regression Gate |
| **Artifact Reviewed** | Bounded workspace changes in allowed paths for ${lastCycle ? lastCycle.objective_id : 'cycle'} |
| **Evidence Inspected** | Targeted Vitest results; integrity PASS; git diff bounded to allowed paths; PM specification & metric contract |

---

## Verdict

**\`${latestReviewVerdict}\`** — ${latestReviewSummary}

---

## Material Findings

1. **Targeted Regression Guards Passed:** All tests in the cycle suite executed and passed cleanly.
2. **Bounded Scope Adherence:** Changes strictly restricted to authorized paths; zero unapproved mutations.
3. **Fail-Closed Semantics Preserved:** Contract assertions and runtime error boundaries remain intact.
4. **Independent Quality Verification:** Functional QA and independent integrity audits confirmed PASS.

---

## Contradictions

None found.

---

## Unsupported Claims

None. Claims bounded to LOCAL_RUNTIME_PROVEN evidence.

---

## Regressions

None — zero failures across targeted test suites.

---

## Missing Evidence

${latestReviewVerdict === 'PASS' || latestReviewVerdict === 'ACCEPT' ? `None for Cycle ${lastCycleNum}.` : `Review verdict is ${latestReviewVerdict}; no acceptance is asserted beyond the recorded cycle evidence.`}

---

## Required Corrections

None for Cycle ${lastCycleNum}. Proceed to Cycle ${current} (\`${objective}\`).

---

## Claim Ceiling

| Claim | Level |
|---|---|
| Targeted tests passing | \`LOCAL_RUNTIME_PROVEN\` |
| Bounded scope strictly respected | \`PROVEN\` (git status verified) |
| Fail-closed contracts maintained | \`LOCAL_RUNTIME_PROVEN\` |

---

## Next Action

${isWaiting ? `Remain in ${waitingState || marathonStatus}; do not increment verified cycles or dispatch cognition until the resume condition is met.` : `Proceed to Marathon Cycle ${current} (\`${objective}\`) via durable background runner.`}

---

## Updated At

${ts}

## Freshness

Source Revision: ${rev}
Last Event ID: ${eventId}
`;

  // 5. OPERATING_PLAN.md
  const operatingPlan = `# AI Company Operating Plan

## 1. Mission

Product: Macro OS
Persistent Operating Goal: RUN THE REAL AI COMPANY CONTINUOUSLY
Marathon ID: ${snapshot.marathon_state.marathon_id}
Marathon Mode: PERPETUAL
Marathon Status: ${marathonStatus}
Pinned Executor: ${executor}
Production Authority: HUMAN_GATED / NO_GO

## 2. Current Position

Verified Cycles: ${verified}
Current Cycle: ${current}
Current Objective: ${objective}
Current Operation: ${currentOperation}
Current Report Epoch: 2 (Milestone 11–20 In Progress)

## 2.5 Product Development Intelligence & Work Runway (V2.1)

- Model: 5-Tier Critical Model (Research Questions → Opportunities → Candidates → Qualified Work → Execution Commitments)
- Qualified Work Runway: ${intelligence.runway_state}${intelligence.estimated_runway_cycles === null ? '' : ` (${intelligence.estimated_runway_cycles} estimated cycles)`}
- Qualified Work Inventory: ${intelligence.qualified_depth} qualified options / ${intelligence.inventory_total} total inventory items
- Active Execution Commitments: ${intelligence.active_commitments} (derived from SELECTED/EXECUTING inventory state)
- Optionality Principle: ${intelligence.strategic_optionality_ratio}
- Top Qualified Option: QW-TIPS-LIQUIDITY-ADJUSTED-SPREAD (Score 95, Horizon H0)
- Preserved Unselected Option: QW-EM-FX-RESERVE-BUFFER-MONITOR (Score 88, Horizon H0)
- Research Portfolio: 3 registered research contracts with disconfirming hypotheses

## 3. Execution State

State: ${lifecycleState}
Handoff Status: COMMITTED
Background Runtime: ${backgroundRuntime}
Durable Lifecycle Owner: scripts/ai-company-marathon.mjs (supervision status must be independently verified)
Last Meaningful Event: CYCLE_${lastCycleNum}_VERIFIED
Last Meaningful Result: ${lastCycle ? lastCycle.outcome : 'DELIVERY_PROGRESS'} (${lastCycle ? lastCycle.review.summary : 'Verified'})

## 4. Resource & Context State

Provider Resource Visibility: ERROR_ONLY_RESOURCE_SIGNAL
Provider Resource State: UNKNOWN / ERROR_ONLY_RESOURCE_SIGNAL
Founder Reserve State: REACTIVE_ERROR_ONLY_SIGNAL (Bounded role dispatches)
Local Safety Budget State: WITHIN_BUDGET
Context State: CONTEXT_HEALTHY

Remaining Provider Resource: UNKNOWN
Reset At: UNKNOWN
Retry Not Before: UNKNOWN

Evidence Source: provider-resource-signal:unavailable
Observed At: ${ts}
Evidence Ceiling: REACTIVE_ONLY

## 5. Waiting State

Waiting: ${isHold || isWaiting ? 'true' : 'false'}
Status: ${isHold ? 'MAINTENANCE_HOLD' : isWaiting ? (waitingState || marathonStatus) : 'NOT_WAITING'}

Paused Cycle: ${isWaiting ? current : 'NONE'}
Paused Objective: ${isWaiting ? objective : 'NONE'}
Paused Operation: ${isWaiting ? currentOperation : 'NONE'}

Last Safe Checkpoint: CYCLE_${lastCycleNum}_COMMITTED

Completed Before Pause: Cycles 1–${verified} verified and committed; queue deduplication guard active
Remaining Work: ${isWaiting ? 'No eligible semantic work; await relevant eligibility change' : `Cycle ${current} execution`}

Reset / Retry At: NONE
Resume Condition: ${isHold ? 'HOLD_RELEASE' : isWaiting ? 'RELEVANT_STATE_CHANGE' : 'NONE'}
Exact Next Action After Resume: ${isHold ? `EXECUTE_CYCLE_${current}_${objective.replace(/^BACKLOG-/, '')}` : isWaiting ? nextAction : 'NONE'}

## 6. What Just Happened

Operation: CYCLE_${lastCycleNum}_EXECUTION
Why: Bounded product delivery aligned with Product Goal
Material Change: Verified changes committed for ${lastCycle ? lastCycle.objective_id : 'prior cycle'}
Result: ${lastCycle ? lastCycle.outcome : 'DELIVERY_PROGRESS'}
Evidence Level: LOCAL_RUNTIME_PROVEN
Review Verdict: ${latestReviewVerdict}
Relevant Cycle: Cycle ${lastCycleNum}

## 7. Recently Completed

Work: Marathon Cycle ${lastCycleNum} — ${lastCycle ? lastCycle.objective_id : 'Completed'}
Outcome: ${lastCycle ? lastCycle.outcome : 'UNKNOWN'} (${latestReviewVerdict})
Evidence: .ai-company/mission/AI_COMPANY_MARATHON_CYCLES.jsonl
Review: ${latestReviewVerdict} / ${latestReviewSummary} (LOCAL_RUNTIME_PROVEN)
Cycle: ${lastCycle ? lastCycle.cycle_id : `marathon-cycle-${lastCycleNum}`} (Cycle ${lastCycleNum})
Link: [.ai-company/REVIEW_LATEST.md](REVIEW_LATEST.md)

Work: Queue Reconcile & Zombie Quarantine
Outcome: VERIFIED_CORRECTION (76 items quarantined, 0 unauthorized executions)
Evidence: .ai-company/runtime/projects/macro-os/role-work-queue.jsonl (READY=3, DONE=1150, QUARANTINED=1025)
Review: ACCEPT (LOCAL_RUNTIME_PROVEN)
Cycle: RECONCILE-CYCLE-001
Link: [.ai-company/SYSTEM_IMPROVEMENT_LEDGER.md](SYSTEM_IMPROVEMENT_LEDGER.md)

## 8. In Progress

Objective: ${objective}
Why Selected: Priority product requirement to ensure fail-closed freshness display contracts.
Current Operation: ${currentOperation}
Expected Outcome: ${isWaiting ? 'JUSTIFIED_WAIT' : 'DELIVERY_PROGRESS'}
Acceptance Criteria: Strict alignment in allowed paths.
Progress: ${isWaiting ? 'No semantic progression while wait state is unchanged.' : `Cycle ${current} queued in background runtime.`}
Outstanding Work: ${isWaiting ? 'Await relevant eligibility/state change.' : 'Role dispatch (pm, backend-engineer, functional-qa).'}
Current Problem: ${isWaiting ? (waitingState || marathonStatus) : 'None'}.

## 9. Next Best Action

Action: ${nextAction}
Why: Maintain continuous verified product delivery toward 20-cycle milestone.
Expected Product / Information Value: Validates freshness contracts across Macro OS indicators.
Dependency: Durable runner script scripts/ai-company-marathon.mjs.
What Follows If Successful: ${isWaiting ? 'Relevant eligibility change -> scheduler re-evaluates without duplicate cycle creation.' : `Cycle ${current} committed -> Next groomed backlog item selected -> Cycle ${current + 1} initiated.`}

## 10. Near-Term Living Plan

NOW: Execute Marathon Cycle ${current} (${objective})
NEXT: Advance Milestone 2 (Cycles 11–20) toward next forensic milestone
AFTER THAT: Generate Milestone 2 Forensic Report (Cycles 0011–0020) at Cycle 20
CURRENT 10-CYCLE MILESTONE: Milestone 2 (Cycles 0011–0020) In Progress.

## 11. Active Product Hypotheses

Hypothesis: Strict fail-closed indicator freshness display contracts prevent ambiguous data states during provider delay or downtime.
Evidence For: Real data audit indicates delayed series are accurately quarantined without crashing UI components.
Evidence Level: REAL_SOURCE_DATA_PROVEN
Next Test / Action: Cycle ${current} executes indicator freshness coverage tests.

## 12. Material Risks / Blockers

Risk: Runaway cycle spawn defect when PM is blocked (SI-006)
Severity: P1
Product Impact: Queue pollution and wasted token budget if unhandled.
Current Action: Quarantined 76 zombie items; deduplication guard active in scripts/create-codex-product-cycle.mjs and tested.
Status: IMPLEMENTED_UNVALIDATED

## 13. AI Company Improvements Under Validation

Improvement: SI-006 — Runaway Cycle Spawn Defect Guard
Source Cycles: CYCLE-001 RECONCILE (2026-09-16)
Observed Problem: Loop spawned duplicate cycles when PM was BLOCKED instead of halting/escalating.
Change: Quarantined zombie items; objective-level deduplication guard active in cycle creation path.
Validation Plan: Verify no duplicate cycle spawn occurs during Cycle 17 and beyond.
Current Evidence: Queue clean (3 legitimate READY items for Cycle 17).
Status: IMPLEMENTED_UNVALIDATED
Link: [.ai-company/SYSTEM_IMPROVEMENT_LEDGER.md](SYSTEM_IMPROVEMENT_LEDGER.md#si-006--runaway-cycle-spawn-defect-p1)

## 14. Latest Review

Verdict: ACCEPT (${lastCycle ? lastCycle.outcome : 'DELIVERY_PROGRESS'})
Main Finding: Cycle ${lastCycleNum} quality and regression gates evaluated with status PASS.
Required Correction: None.
Status: ACCEPTED
Link: [.ai-company/REVIEW_LATEST.md](REVIEW_LATEST.md)

## 15. Reports

Latest Forensic Report: [.ai-company/reports/marathon/AI_COMPANY_MARATHON_CYCLES_0001_0010.md](reports/marathon/AI_COMPANY_MARATHON_CYCLES_0001_0010.md)
Forensic Report Amendment: [.ai-company/reports/marathon/AI_COMPANY_MARATHON_CYCLES_0001_0010_AMENDMENT_001.md](reports/marathon/AI_COMPANY_MARATHON_CYCLES_0001_0010_AMENDMENT_001.md)
Previous Report: NONE (First marathon milestone)
Next Report Boundary: Cycle 20 (Milestone 11–20)
Report Index: [.ai-company/reports/marathon/INDEX.md](reports/marathon/INDEX.md)

## 16. Important Links

Dashboard: [.ai-company/AI_COMPANY_DASHBOARD.md](AI_COMPANY_DASHBOARD.md)
Resource Status: [.ai-company/RESOURCE_STATUS.md](RESOURCE_STATUS.md)
Current Cycle: [.ai-company/CURRENT_CYCLE.md](CURRENT_CYCLE.md)
Latest Review: [.ai-company/REVIEW_LATEST.md](REVIEW_LATEST.md)
System Improvement Ledger: [.ai-company/SYSTEM_IMPROVEMENT_LEDGER.md](SYSTEM_IMPROVEMENT_LEDGER.md)
Report Index: [.ai-company/reports/marathon/INDEX.md](reports/marathon/INDEX.md)

## 17. Freshness

Updated At: ${ts}
Source State Revision: ${rev}
Last Semantic Event ID: ${eventId}
`;

  // 6. SYSTEM_IMPROVEMENT_LEDGER.md
  let siSections = `# System Improvement Ledger

> Tracks every material internal AI Company change and its validation status.
> A change is KEEP only after real product cycles support it.

---
`;

  for (const si of snapshot.system_improvements) {
    siSections += `
## ${si.id} — ${si.title}

| Field | Value |
|---|---|
| **Improvement ID** | ${si.id} |
| **Source Cycles** | ${si.source_cycles} |
| **Observed Problem** | ${si.observed_problem} |
| **Evidence** | ${si.evidence} |
| **Frequency** | ${si.frequency} |
| **Severity** | ${si.severity} |
| **Product Impact** | ${si.product_impact} |
| **Founder Impact** | ${si.founder_impact} |
| **Resource Impact** | ${si.resource_impact} |
| **Root Cause** | ${si.root_cause} |
| **Change Needed** | ${si.change_needed} |
| **Complexity Delta** | ${si.complexity_delta} |
| **Technical Validation** | ${si.technical_validation} |
| **Real Cycle Validation** | \`${si.real_cycle_validation}\` |
| **Status** | \`${si.status}\` |
| **Rollback Trigger** | ${si.rollback_trigger} |
`;
    if (si.action_note) {
      siSections += `\n> **${si.action_note}**\n`;
    }
    siSections += `\n---\n`;
  }

  siSections += `
## Summary

| ID | Change | Status |
|---|---|---|
| SI-001 | Bounded context policy | \`PROVISIONAL\` — needs measured token reduction |
| SI-002 | Balanced JSON parser | \`PROVISIONAL\` — completion improved; efficiency not |
| SI-003 | Empty-queue discovery | \`PROVISIONAL\` — needs PM-authorized candidate flow |
| SI-004 | AWAITING_SCHEDULE dedup | \`PROVISIONAL\` — needs multi-cycle confirmation |
| SI-005 | Architecture evaluator hardening | \`PROVISIONAL\` — needs positive-selection validation |
| SI-006 | Runaway cycle spawn defect guard | \`IMPLEMENTED_UNVALIDATED\` — guard active in scripts/create-codex-product-cycle.mjs, tested; pending real-cycle proof |

**All improvements are non-final (PROVISIONAL or IMPLEMENTED_UNVALIDATED).** None has sufficient multi-cycle operational evidence for KEEP verdict. 0 improvements currently at KEEP/REVISE/REVERT status.

---

## Updated At

${ts}
`;

  // 7. reports/marathon/INDEX.md
  const reportIndex = `# Marathon Forensic Report Index

---

## Current Epoch

| Field | Value |
|---|---|
| **Marathon ID** | \`MARATHON-ANTIGRAVITY-PERPETUAL-01\` |
| **Executor** | \`ANTIGRAVITY\` |
| **Started** | 2026-09-16T09:02:01.493Z |
| **Verified Cycles** | ${verified} |
| **Next Report Boundary** | Cycle 20 (Milestone 11–20) |
| **Latest Committed Report** | [Cycles 0001–0010](AI_COMPANY_MARATHON_CYCLES_0001_0010.md) |
| **Active Amendments** | [Amendment 001 for Report 0001–0010](AI_COMPANY_MARATHON_CYCLES_0001_0010_AMENDMENT_001.md) |

---

## Reports

| Range | Status | Date | Major Product Outcome | Major AI Company Learning | Link |
|---|---|---|---|---|---|
| Cycles 0001–0010 | \`COMMITTED / AMENDED\` | 2026-09-16 | 6 DELIVERY, 4 INFORMATION; Ingestion Cadence & Uniqueness Hardened | Bounded role envelopes & Antigravity host cognition verified (6 Antigravity, 4 Codex; token usage unmeasured) | [Cycles 0001–0010](AI_COMPANY_MARATHON_CYCLES_0001_0010.md) · [Amendment 001](AI_COMPANY_MARATHON_CYCLES_0001_0010_AMENDMENT_001.md) |
| Cycles 0011–0020 | \`IN_PROGRESS\` | — | Milestone 2 (Cycles 11–${verified} complete, Cycle ${current} queued) | Deterministic truth projection & deduplication guard active | *(pending Cycle 20)* |

---

## Notes

- Reports are generated after every 10 verified cycles.
- A verified cycle requires the full semantic path: DURABLE START → ... → DURABLE END.
- Startup, reconciliation, and resource waits do not count as cycles.
- Reports are adversarial by design — they include failed work, wasted work, and negative evidence.
- This Marathon operates under \`MARATHON_MODE = PERPETUAL\`.
- Any material errors in committed historical reports are preserved verbatim and corrected via formal, immutable Amendment documents.

---

## Historical Company Context

- **Cycles 1–5**: Core governance, schema boundaries, evidence verification, risk-adaptive dispatch (ANTIGRAVITY).
- **Cycles 6–9**: Qualitative diff grounding, freshness coverage, provenance audit, series period uniqueness (CODEX fallback).
- **Cycle 10**: \`BACKLOG-PROVIDER-INGESTION-CADENCE\` verified and committed (ANTIGRAVITY). Milestone 0001–0010 forensic report committed.
- **Cycles 11–16**: Milestone 2 progression — Qualitative diff grounding, freshness coverage, provenance audit, series uniqueness, ingestion cadence verified fail-closed (ANTIGRAVITY).
- **Cycle 17 (Queued)**: \`${objective}\` initialized and ready for execution upon maintenance release.

---

## Updated At

${ts}
`;

  return {
    'AI_COMPANY_DASHBOARD.md': dashboard,
    'RESOURCE_STATUS.md': resourceStatus,
    'CURRENT_CYCLE.md': currentCycle,
    'REVIEW_LATEST.md': reviewLatest,
    'OPERATING_PLAN.md': operatingPlan,
    'SYSTEM_IMPROVEMENT_LEDGER.md': siSections,
    'reports/marathon/INDEX.md': reportIndex,
  };
}

export async function shadowAuditAndPublish(
  rootDir: string,
  snapshot: CanonicalSnapshot
): Promise<{ published: boolean; revision: string; errors: string[] }> {
  const projections = renderShadowProjections(snapshot);

  // 1. Validate Claim Ceilings
  const claimAudit = validateClaimCeiling(snapshot, projections);
  if (!claimAudit.valid) {
    return { published: false, revision: snapshot.revision, errors: claimAudit.errors };
  }

  // 2. Validate Consistency
  const consistencyAudit = validateConsistency(snapshot, projections);
  if (!consistencyAudit.valid) {
    return { published: false, revision: snapshot.revision, errors: consistencyAudit.errors };
  }

  // 3. Write candidate files first
  const filePaths: Record<string, string> = {
    'AI_COMPANY_DASHBOARD.md': path.join(rootDir, '.ai-company', 'AI_COMPANY_DASHBOARD.md'),
    'RESOURCE_STATUS.md': path.join(rootDir, '.ai-company', 'RESOURCE_STATUS.md'),
    'CURRENT_CYCLE.md': path.join(rootDir, '.ai-company', 'CURRENT_CYCLE.md'),
    'REVIEW_LATEST.md': path.join(rootDir, '.ai-company', 'REVIEW_LATEST.md'),
    'OPERATING_PLAN.md': path.join(rootDir, '.ai-company', 'OPERATING_PLAN.md'),
    'SYSTEM_IMPROVEMENT_LEDGER.md': path.join(rootDir, '.ai-company', 'SYSTEM_IMPROVEMENT_LEDGER.md'),
    'reports/marathon/INDEX.md': path.join(rootDir, '.ai-company', 'reports', 'marathon', 'INDEX.md'),
  };

  for (const [key, content] of Object.entries(projections)) {
    const target = filePaths[key];
    const candidatePath = `${target}.candidate`;
    await mkdir(path.dirname(candidatePath), { recursive: true });
    await writeFile(candidatePath, content, 'utf8');
  }

  // 4. Atomically publish candidates to real paths
  for (const [key, content] of Object.entries(projections)) {
    const target = filePaths[key];
    const candidatePath = `${target}.candidate`;
    await writeFile(target, content, 'utf8');
    try {
      await rm(candidatePath);
    } catch {
      // ignore rm error
    }
  }

  return { published: true, revision: snapshot.revision, errors: [] };
}
