# AI Company Weakness Research and Improvement Register

**Assessment date:** 2026-09-08  
**Scope:** local-first AI Company operating layer for Macro OS  
**Authorities:** `PRODUCT_GOAL_MASTER.md`, `MASTER_BUILD_PLAN.md`,
`docs/PRODUCT_GOAL.md`, runtime ledgers, tests and audit reports  
**Assessment status:** `HEALTHY CONTROL PLANE / QUALITY-GATED / NOT PRODUCTION-READY`

## 1. Executive conclusion

The repository contains a meaningful local operating system for coordinating
AI roles. It is no longer only documentation: queue transitions, handoffs,
dependency waves, provider attempts, evidence records, worktrees and release
boundaries are executable and tested.

However, it is not yet an autonomous product company in the sense defined by
the master Product Goal. The strongest evidence proves control-flow safety and
local orchestration. It does not yet prove reliable product judgment, real user
value, production durability, or repeated self-improvement. The main risk is
that a technically successful role run can be mistaken for a good product
decision.

**Decision:** keep autonomous authority restricted to bounded local experiments,
discovery and advisory work. Do not promote model output to implementation,
release, Product Goal change or strategic acceptance without independent
grounding, QA/QC, security and outcome evidence.

## 2. Evidence baseline

| Area | Current evidence | What it proves | What it does not prove |
|---|---|---|---|
| Control plane | Doctor `HEALTHY`, epoch 407, stop flag false | Required files/state/runner are present | Correctness of all claims in state files |
| Queue | 12 tracked, 7 DONE, 5 BLOCKED, 0 active at last audit | Durable lifecycle and fail-closed blocking exist | Healthy throughput or completed product work |
| Tests | 92 AI Company files, 211 tests passed | Local code contracts currently pass | Production reliability or model quality |
| Worktree | Manager + run-ready allocation + tests | Engineering isolation baseline exists | OS-level isolation for every runner |
| Tool policy | Gateway tests and Codex sandbox path | Policy boundary can deny known operations | Every internal CLI capability is intercepted |
| Local model | Ollama `qwen3:8b`: one successful PM protocol run, one malformed-JSON failure | Local inference and ledger integration work | Autonomous-quality PM judgment |
| Product outcome | No verified improvement cycle | The system correctly avoids claiming one | User value, adoption, retention or insight improvement |
| Production | Structural operating audit passes with `production_ready=false` | Trust boundaries are declared | Durable remote persistence, live release or recovery |

Evidence is concentrated around 2026-09-04. The assessment must not be read as
proof of activity between that date and 2026-09-08.

## 3. Detailed weakness register

### W-01 — Protocol success is confused with content quality

**Severity:** P0  **Status:** observed  
**Evidence:** local PM task `WORK-1788520906577-1gpnn2` reached `DONE` and
produced `ROLE-EVIDENCE-869f0112e47a06f0b723`, while the output invented user
feedback, proposed UI outside the task scope and misdescribed the Product Goal.

**Root cause:** queue completion requires evidence presence, not a grounded
claim-verification verdict. `RoleEvidenceLedger` stores advisory output but
does not independently check citations, scope or unsupported assertions.

**Impact:** a malformed or strategically wrong recommendation can look healthy
to the coordinator and contaminate later decisions.

**Required improvement:** add a grounding evaluator that checks every factual
claim against supplied evidence, Product Goal references, scope constraints and
role authority. Store `protocol_status` and `content_quality` separately.

**Acceptance criteria:** unsupported critical claim causes `QUALITY_FAIL` and
prevents promotion; evidence IDs must resolve; scope-expanding work is flagged;
one independent evaluator result is persisted for every model role output.

### W-02 — Product Goal grounding is not injected consistently into role context

**Severity:** P0  **Status:** partial  
**Evidence:** the CLI dispatcher tells agents to read Product Goal files, but
the model adapter sends only the generic role contract and task JSON. The local
PM output subsequently used an inaccurate goal description.

**Root cause:** context construction is split between prompts, dispatcher text
and adapter code rather than one server-owned context builder.

**Impact:** different runners receive different truths and may optimize for
their own generic assumptions.

**Required improvement:** create a canonical, versioned context bundle containing
Product Goal hash/version, relevant Macro OS objective, evidence IDs, scope,
permissions, acceptance criteria and known dissent. Pass the same bundle to all
providers and persist its fingerprint.

**Acceptance criteria:** identical task context fingerprint across local AI,
Codex and Antigravity; missing or stale Product Goal context blocks execution.

### W-03 — Role output contracts are too weak for PM/CEO-level work

**Severity:** P0  **Status:** partial  
**Evidence:** generic role evidence accepts arbitrary non-empty text. Structured
markers exist for CEO Guild, Tech Lead and Critic, but no equivalent schema
validates PM assumptions, evidence mapping, scope and recommendation quality.

**Root cause:** transport schemas were implemented before semantic schemas.

**Impact:** local models can satisfy protocol while bypassing disciplined
product reasoning.

**Required improvement:** define JSON schemas per role, including facts,
inferences, assumptions, evidence mapping, dissent, recommendation, confidence,
limitations and prohibited actions.

**Acceptance criteria:** schema-invalid or missing evidence mapping cannot reach
`DONE`; PM and CEO outputs require explicit fact/inference separation.

### W-04 — No complete verified product-improvement cycle

**Severity:** P0  **Status:** missing  
**Evidence:** current runs are governance, discovery and read-only role probes;
the outcome gate exists but no cycle proves `observe → decide → build → verify
→ measure → learn` on a real Macro OS change.

**Impact:** the North Star, “Verified Product Improvement per Autonomous
Operating Cycle,” remains unproven.

**Required improvement:** select one bounded, low-risk Macro OS improvement;
capture baseline; obtain CEO/PM/Tech Lead decision; build in worktree; run
independent QA/QC/security; measure a predeclared metric; persist learning.

**Acceptance criteria:** no cycle counts as successful without baseline,
post-change measurement, independent verdict and durable learning.

### W-05 — User value and market validation are absent or weak

**Severity:** P0  **Status:** missing  
**Evidence:** user persona/UX role contracts exist, but no sustained
real-user task telemetry or blinded usability evidence establishes time to
insight, comprehension, retention or accessibility success.

**Impact:** the company can optimize internal artifacts rather than user value.

**Required improvement:** run fixed user journeys with anonymized telemetry,
baseline/control comparison and independent UX review.

**Acceptance criteria:** task success, time-on-task, comprehension and failure
reasons are recorded; no adoption claim is allowed without source telemetry.

### W-06 — Queue contains stale or invalid work requiring reconciliation

**Severity:** P1  **Status:** observed  
**Evidence:** 5 of 12 latest queue items are BLOCKED, including old smoke tasks
and daily roles blocked for missing handoffs.

**Root cause:** test/probe tasks share production-like queue state, while
cleanup/expiry and handoff repair are not automatic.

**Impact:** readiness, throughput and blocker counts are misleading.

**Required improvement:** distinguish `experiment`, `operational`, and
`production-candidate` work; add expiry, owner, blocker triage and close/retry
policy; never delete evidence.

**Acceptance criteria:** every BLOCKED item has owner, severity, next action and
expiry/review date; stale probes cannot affect production readiness.

### W-07 — JSONL is not a sufficient durable multi-writer store

**Severity:** P1  **Status:** architectural gap  
**Evidence:** ledgers use append-only local JSONL; concurrent writes and
crash-consistent transactions are not equivalent to the Postgres target in the
master plan.

**Impact:** partial writes, duplicate transitions, difficult queries and
cross-machine recovery remain possible.

**Required improvement:** retain JSONL export but move authoritative state,
idempotency keys, leases, evidence and outbox events to transactional storage.

**Acceptance criteria:** crash/restart, concurrent claim, duplicate event,
backup/restore and replay drills pass with checksums and measured RPO/RTO.

### W-08 — Tool Gateway is advisory for some execution paths

**Severity:** P0  **Status:** partial  
**Evidence:** application gateway denies known calls and Codex has a native
workspace sandbox; Antigravity receives a workspace boundary but its CLI is not
fully intercepted by the gateway. The macOS sandbox is opt-in.

**Impact:** a runner-specific capability could bypass application policy.

**Required improvement:** use a mandatory process adapter for every runner,
capability tokens, OS sandbox profiles, syscall/path/network tests and a
fail-closed startup mode when enforcement is unavailable.

**Acceptance criteria:** prohibited filesystem, git, shell, network, secret and
deployment operations are demonstrably denied for each supported runner.

### W-09 — Worktree lifecycle is not yet review-to-merge complete

**Severity:** P1  **Status:** partial  
**Evidence:** create/status/diff/cleanup/recover exist and run-ready allocates
worktrees; `merge()` returns a diff and `requires_human_merge`, not a governed
review/approval/merge transaction.

**Impact:** engineering isolation exists, but delivery still depends on manual
coordination outside the durable workflow.

**Required improvement:** add test artifact capture, QA verdict, security verdict,
review decision, merge authorization, conflict recovery and cleanup policy.

**Acceptance criteria:** no merge path exists without all required independent
verdicts; dirty/orphan/conflicted worktrees remain recoverable.

### W-10 — Provider identity and benchmark comparability have been immature

**Severity:** P1  **Status:** improving  
**Evidence:** native Ollama was previously recorded as `openai-compatible`;
current code defaults to `ollama-local`, but historical records remain mixed.

**Impact:** latency, cost, quality and failure comparisons with Codex and
Antigravity can be wrong.

**Required improvement:** normalize provider, runner, model, version, prompt
fingerprint, hardware, context size, retries and outcome taxonomy.

**Acceptance criteria:** a benchmark report can reproduce which runner/model
produced each artifact and distinguish transport success from quality success.

### W-11 — Local AI evaluation sample is too small and not blinded

**Severity:** P1  **Status:** insufficient evidence  
**Evidence:** one malformed full-goal discovery, one successful synopsis retry
and one PM role probe.

**Impact:** no reliable conclusion about Qwen performance can be generalized.

**Required improvement:** freeze a shared corpus, run identical prompts/evidence
through local AI, Codex and Antigravity, blind evaluators and repeat at least 30
role tasks before model routing decisions.

**Acceptance criteria:** report confidence intervals or at least sample counts,
failure classes, rework and independent quality scores.

### W-12 — Recovery and operations are not demonstrated under failure

**Severity:** P1  **Status:** missing  
**Evidence:** stale lease recovery and circuit-breaker code exists, but no
three-consecutive crash/restart, outbox replay, provider outage and restore
drill is recorded for the current integrated path.

**Impact:** autonomous operation may lose work or stall silently.

**Required improvement:** run controlled failure drills and persist checkpoint,
replay, duplicate and recovery evidence.

**Acceptance criteria:** three consecutive drills pass with no lost committed
artifact, no duplicate release and bounded recovery time.

### W-13 — Governance state has conflicting score and freshness claims

**Severity:** P1  **Status:** observed  
**Evidence:** `AI_COMPANY_SCORECARD.md` says 69/100, max-score roadmap says
68/100, while `company-state.json` says 78/100 and `current_state_audit.md`
reports 78/100. Dates and evidence bases differ but no canonical score version
resolves the conflict.

**Impact:** leadership may believe maturity has improved when only local
features or bookkeeping changed.

**Required improvement:** generate score only from a versioned evidence manifest;
record dimension-level evidence IDs, assessment date, assessor and confidence.

**Acceptance criteria:** one canonical current score; historical scores remain
immutable and explainable; tests fail on conflicting active score claims.

### W-14 — Production data trust remains a Macro OS blocker

**Severity:** P0  **Status:** open  
**Evidence:** company state freezes P0 hydration/freshness work; production
readiness is false; real-data, licensing, revision and latest-available proof
are not complete for the target coverage.

**Impact:** AI Company may make excellent workflow decisions about data that is
still not safe or current enough for users.

**Required improvement:** complete licensed provider contracts, raw/vintage
retention, freshness semantics, per-series isolation, reconciliation and
independent data review before expanding scope.

**Acceptance criteria:** two consecutive real-data audits pass with zero
synthetic production paths and explicit stale/unavailable states.

### W-15 — Business, finance, legal and operations roles are under-realized

**Severity:** P1  **Status:** partial  
**Evidence:** stakeholder role exists, but explicit runtime contracts and
durable metrics for runway, unit economics, licensing, commercial risk,
customer support and operational capacity are incomplete.

**Impact:** product prioritization can be technically coherent but commercially
or legally unsafe.

**Required improvement:** add role contracts, inputs, outputs, decision rights,
cadences and evidence schemas for finance, growth, legal/licensing and
operations.

**Acceptance criteria:** consequential roadmap decisions include explicit
capital, legal, commercial and operational review or a recorded reason why not.

### W-16 — Self-improvement is not causally validated

**Severity:** P1  **Status:** missing  
**Evidence:** principles, optimization and trial modules exist, but no repeated
real-model experiment proves that a prompt/principle/model change improved safe
outcomes rather than merely changing text.

**Impact:** the company may learn from noise and regress while believing it is
improving.

**Required improvement:** freeze corpus, compare baseline vs one intervention,
repeat seeds/tasks, measure safety/quality/cost/rework and require rollback on
non-regression failure.

**Acceptance criteria:** every promoted principle has a reproducible experiment
manifest and independent evaluation.

## 4. Priority remediation sequence

### R0 — Truth and quarantine (immediate)

- Make `AI_COMPANY_WEAKNESS_RESEARCH_2026-09-08.md` the current gap register.
- Mark local PM evidence `QUALITY_FAIL`; do not promote it.
- Separate probe queues from operational queues and triage all 5 blockers.
- Reconcile the 68/69/78 score conflict.

### R1 — Grounded role runtime

- Build canonical Product Goal/evidence context bundles.
- Add role-specific semantic schemas and grounding evaluator.
- Add explicit quality verdicts and promotion gates.

### R2 — Reproducible model benchmark

- Freeze shared Macro OS role corpus.
- Run local Qwen, Codex and Antigravity under equivalent task conditions.
- Compare grounding, scope discipline, latency, rework, cost and recovery.

### R3 — One real value cycle

- Choose one low-risk data-trust or research workflow improvement.
- Measure baseline and outcome.
- Require PM, Tech Lead, QA, QC, domain and release-security evidence.

### R4 — Durable operations and enforcement

- Move authority to transactional storage/outbox.
- Make runner sandbox mandatory.
- Execute crash/replay/restore and permission-escape drills.

### R5 — Production and scale

- Complete real-data/licensing gates.
- Add business/finance/legal/operations contracts.
- Require 10 comparable verified cycles before broader autonomy.

## 5. Current operating rules

1. `DONE` means protocol completion, not product-quality approval.
2. Local-model output is advisory until independently grounded.
3. No model may change Product Goal, permissions or production release state.
4. No stale, synthetic or unlicensed data may be presented as current evidence.
5. Every blocker must have an owner, reason, next action and review date.
6. Every model comparison must identify provider and runner truthfully.
7. Tests prove implementation contracts; they do not prove user value or
   production readiness.

## 6. Reassessment exit criteria

This document should be superseded only when the next assessment can show:

- one canonical, evidence-generated score;
- zero unresolved P0 control-plane or data-trust gaps for the chosen risk class;
- 30 comparable model tasks with independent quality scoring;
- one complete verified product-improvement cycle;
- three successful recovery drills;
- runner-level permission escape tests passing;
- measured user outcome and cost per validated outcome;
- explicit independent QA/QC/security/release verdicts.

## 7. Remediation progress — 2026-09-08

Implemented in the local runtime after this research:

- `roleQuality.ts` now performs a conservative semantic screen for unsupported
  user claims, Product Goal context weakness and scope-expanding UI/UX output.
- Role evidence now separates `protocol_status` from `content_quality`, stores
  quality warnings and persists a context fingerprint.
- Native Ollama provider identity is normalized to `ollama-local` for new runs.
- The new evaluator has dedicated tests and is wired into the evidence-producing
  role executor.

Verification: 11 focused tests passed, TypeScript passed, `ai-company:doctor`
returned `HEALTHY`, and `git diff --check` passed.

Not yet solved: the evaluator is intentionally conservative and not a complete
claim-level citation verifier; it still needs a canonical context bundle,
evidence resolution, role-specific schemas and independent review before it can
become a hard promotion gate.
