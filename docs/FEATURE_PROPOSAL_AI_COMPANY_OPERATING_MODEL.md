# Feature Proposal — AI Company Operating Model for Macro OS

## Goal alignment

- Product objective: strengthen the trustworthy Macro OS research workflow and
  move it toward a daily global intelligence product without weakening data,
  provenance, security, licensing, or release guardrails.
- User research question addressed: can Macro OS continuously discover, build,
  verify, release, measure, and improve product value for macro researchers and
  investment-intelligence users?
- Capability strengthened: the complete `Discover → Inspect evidence → Compare
  → Save → Monitor → Revisit` loop, plus the trust and operational capability
  required to run it continuously.

## Requirement

Macro OS needs a company-shaped operating system focused on this product only.
CEO, Product, Data, Backend, Frontend, AI, SRE, Security, QA, QC, domain,
stakeholder, and user perspectives must be explicit, independently reviewable,
and connected to measurable outcomes. The system must support near-term issue
handling, daily product improvement, weekly/monthly/quarterly/annual governance, and a
10–15 year strategic direction. It must continuously update backlog and ideas,
but may not autonomously release unverified work or create activity without
evidence of user, product, data, or operational value.

## Technical design

### Operating layers

1. **CEO / strategy:** Product Goal alignment, capital and risk budget,
   portfolio priorities, hold/rollback/kill decisions, and long-range vision.
2. **Product:** user segments, JTBD, discovery, roadmap, acceptance criteria,
   prioritization, product metrics, and post-release outcome evaluation.
3. **Delivery:** Data Engineering, Backend, Frontend, AI/ML, Platform/SRE,
   Security, QA, QC, UX, and macro-domain reviewers with scoped contracts.
4. **Independent assurance:** product, domain, data, UX, security, QA, and
   stakeholder review separated from the implementing worker.
5. **Evidence and learning:** event ledger, evidence ledger, usage/cost
   telemetry, runtime health, real-data freshness, user feedback, and outcome
   measurement.

### Workflow state machine

`INTAKE → DISCOVERY → COUNCIL_REVIEW → PM_BACKLOGGED → CEO_PRIORITIZED → READY
→ EXECUTING → INDEPENDENT_VERIFICATION → USER_AND_DOMAIN_REVIEW → RELEASE_GATE
→ RELEASED → OUTCOME_EVALUATION → LEARNED → INTAKE`

Failure states are `REVISE`, `HOLD`, `BLOCKED`, `ROLLBACK`, `ESCALATED`,
`CIRCUIT_OPEN`, and `KILLED`. A missing evidence item is never treated as a
successful outcome.

### Required runtime capabilities

- Durable job/event queue with checkpoints, idempotency, leases, heartbeats,
  dead-letter handling, retry budgets, and crash/restart recovery.
- Enforced role/action permissions; documentation alone is insufficient.
- Provider/model attempt ledger containing provider, attempt, budget, retry,
  latency, circuit state, and outcome.
- Company health service exposing agent failures, evidence coverage, cost per
  validated outcome, rework, backlog age, provider freshness, and SLOs.
- Product telemetry and privacy-bounded feedback ingestion.
- Real-data vertical slice from licensed provider to durable store, API, UI,
  evidence bundle, and grounded AI explanation.
- Golden corpus and regression evaluation for facts, citations, inference,
  limitations, and model/prompt drift.

The product runtime also publishes the latest readiness snapshot (ready state,
blockers and check time) alongside supervisor status. A cycle that is blocked
by readiness remains visible to CEO/PM rather than appearing as an empty or
successful tick.

Role execution is deliberately injected through `RoleWorkExecutor`: an agent
may claim only READY work, must return evidence, and failed execution becomes
BLOCKED with its error preserved. The runtime does not synthesize completion
when no worker/provider is configured.
Each execution is also persisted in `role-work-executions.jsonl` so CEO, PM and
QC can audit role throughput, evidence coverage and failure/rework without
reconstructing history from mutable queue state.
The read model is available through `GET /api/company/work-executions` with
DONE/BLOCKED counts for the CEO Console and operational review.
`GET /api/company/executive-snapshot` composes these ledgers into one
timestamped CEO decision surface, including readiness, P0 backlog, work queue,
execution, opportunity and escalation counts.
`GET /api/company/cycle-attempts` exposes the persisted cycle history for CEO/PM
triage, with bounded pagination and the newest attempts first.
The CEO snapshot also includes the privacy-sanitized user telemetry scorecard;
until an external durable telemetry sink is configured, its evidence scope is
process-local and must not be treated as historical production adoption.
Telemetry events are additionally appended to a local recovery ledger when
`AI_COMPANY_STATE_DIR` is available; startup hydration and external sink
reconciliation remain required before claiming durable production adoption.
The deterministic user-insight synthesizer may report observed workflow demand
(for example repeated comparison or export activity) with the contributing
event IDs. It never labels sentiment, causality or product-market fit without
explicit user research/outcome evidence.
An insight enters the PM disposition ledger before backlog creation. Only an
authenticated PM `ACCEPT` with rationale and the original event evidence may
create one idempotent P1 backlog item; `REJECT` is retained as a decision and
does not create work.
The evidence-producing role adapter treats provider output as untrusted input
and writes a server-owned `role-evidence.jsonl` artifact containing task scope,
provider metadata, validated output, usage and limitation before returning its
generated evidence ID.
The explicit provider factory uses the existing `MACRO_LLM_ENDPOINT`,
`MACRO_LLM_MODEL`, `MACRO_LLM_PROVIDER_ID` and optional API key/cost settings;
it bounds timeout and retries, records token/cost metadata, and returns no
adapter when configuration is absent or invalid. Configuration is never
treated as a successful provider call.
Role prompts also carry a bounded output-token budget (`AI_COMPANY_ROLE_MAX_TOKENS`,
default 256, capped at 2,048) so a slow/local model cannot monopolize a cycle.
The read-only `GET /api/company/provider-attempts` surface exposes bounded
provider-attempt history for CEO/SRE review without returning credentials.
The read-only `GET /api/company/provider-circuit` surface derives the current
provider circuit state from the durable attempt ledger for CEO/SRE capacity
review without exposing credentials.
The executive snapshot includes the same provider success/failure/retry counts
and latest attempt so CEO decisions use one consistent operational scorecard.
Each provider attempt is append-only recorded in `provider-attempts.jsonl`
when a ledger is supplied, including project/work scope, attempt number,
latency, outcome, retryability, token usage and estimated cost; failed calls
remain visible to CEO/SRE and are never converted into completion.
The server composition root injects the evidence-producing executor only when
`AI_COMPANY_ROLE_EXECUTOR_ENABLED=true` and the factory returns a configured
adapter. Readiness reports a separate blocker when enablement is requested but
provider configuration is absent; no role work is silently marked complete.
Production readiness additionally requires a configured LLM provider and an
explicitly enabled role executor; configuration alone is not treated as a
successful execution proof.

Every scheduled product cycle also writes an append-only attempt record to
`product-cycle-attempts.jsonl`, including period, start/end time, outcome and
readiness blockers or runtime error. This survives process restart and gives
CEO/PM an authoritative audit of skipped, blocked, failed and completed cycles;
an in-memory supervisor status is only a live convenience view.
If any planned role execution is blocked, the cycle is recorded as `FAILED` and
the scheduler cadence checkpoint is not advanced; a cycle cannot be `DONE`
while role work is blocked.

Local discovery uses `generateDiscoveryIdea` with Ollama structured JSON. It
requires a non-empty server-owned evidence bundle and can only emit a
`DISCOVERED` idea. PM/CEO scoring, user/domain validation and backlog promotion
remain separate gates.
The authenticated `POST /api/admin/company/discovery` endpoint is the control
plane entrypoint; it requires an explicit endpoint/model configuration and
never enables local discovery implicitly.
The same worker can be injected into the daily product runtime with a
server-owned evidence supplier; each cycle adds only a `DISCOVERED` idea and
leaves all scoring, validation and promotion gates intact.
Discovery IDs are deterministic for the project, evidence bundle and proposal
fingerprint, so repeated cycles with unchanged evidence do not grow duplicate
ideas.

### Operating cadence

### CEO guild decision protocol

Ideas and material product proposals are reviewed as a guild packet, not as a
single-agent opinion. The packet records the PM proposal, user/value evidence,
data and domain constraints, stakeholder dissent, delivery feasibility, and
security/release risk. The guild may decide `ACCEPT`, `VALIDATE`, `HOLD`, or
`REJECT`; every decision requires evidence IDs, rationale, a decision owner,
and (for `ACCEPT`) an accountable PM plus a validation metric. `ACCEPT` may
promote an idea to backlog, but never authorizes release. Release remains an
independent release-security-gate decision.

The executable CEO operating mandate is exposed as the read-only
`GET /api/company/ceo-mandate`. It binds the near-term (0–90 days), mid-term
(3–36 months), and long-term (3–15 years) objectives to decision rights,
required evidence, non-overridable safety boundaries, stop conditions, and
the roles required at each cadence. This is a decision contract, not a claim
that the corresponding production outcomes already exist.

The shared cadence policy is exposed as `GET /api/company/cadence-policy`.
It is the canonical mapping from daily through annual reviews to accountable
roles, required evidence and release-blocking behavior; runtime integrations
must consume this policy instead of inventing cadence-specific requirements.
Every persisted cycle attempt also carries the applied cadence policy snapshot,
including accountable roles and required evidence, so a CEO review can audit
which operating contract governed a success or failure after restart.
When role execution is enabled, the runtime evaluates a cadence quorum after
execution. Every accountable role for that period must be `DONE` with at least
one evidence ID; otherwise the cycle is `FAILED` and its scheduler checkpoint
does not advance. Unconfigured dry runtime remains governed by the separate
readiness gate and is never production-certified.

- **Daily:** runtime/data health, user feedback, CEO brief, PM backlog update,
  bounded delivery, independent review, release/outcome logging.
- **Weekly:** core workflow review, adoption, task success, freshness, errors,
  rework, cost, blockers, and backlog aging.
- **Monthly:** product-market signals, competitor/market research, licensing,
  experiments, and kill/retain decisions.
- **Quarterly:** board-style strategy, scorecard recalibration, SLO/security/
  recovery review, and roadmap reset.
- **10–15 years:** staged direction from data/provenance foundation to a
  globally trusted macro research operating system; long-range goals never
  override current evidence gates.

## Affected modules

- `server/aiCompany/` orchestration, state, policy, evaluation, health, and
  release boundaries.
- `.ai-company/` role registry, decision/evidence/backlog/runtime ledgers,
  scorecards, runbooks, and recovery artifacts.
- `server/`, ingestion, provider health, persistence, and production preflight.
- `src/app/` research workflow, user-visible evidence, telemetry, and UX QA.
- `docs/PRODUCT_GOAL.md`, implementation status, operations, and release
  evidence documentation.

## Data sources and data states

AI workers may consume only server-owned evidence bundles. Every observation
must preserve source, series ID, as-of time, frequency, freshness, rights, and
data state (`actual`, `forecast`, `scenario`, `simulated`, `unverified`,
`stale`, or `unavailable`). Raw provider endpoints must not become an AI
shortcut.

## Risks and guardrails

- **False autonomy:** external `agy` execution can generate artifacts without
  product value. Require durable runtime evidence and outcome evaluation.
- **Self-approval:** implementing agents cannot approve their own release.
- **Data hallucination:** fail closed on missing, stale, synthetic, or
  rights-limited evidence.
- **Runaway cost/retry:** enforce per-task, per-provider, and company budgets;
  circuit-open requires explicit reset.
- **Scope drift:** all initiatives must map to Product Goal and a user JTBD;
  out-of-scope work is parked or killed.
- **Privacy/security:** telemetry is minimized, secrets stay server-side, and
  production enablement requires security and recovery evidence.

## Rollout and validation

1. Governance reset: reconcile scorecards, blockers, roles, and maturity claims.
2. Durable orchestration: checkpoint, restart, idempotency, circuit breaker,
   supervisor, and failure-drill tests.
3. Product operating model: role contracts, proposal pipeline, review gates,
   backlog/idea prioritization, and outcome ledger.
4. Real-data vertical slice: provider → durable DB → API → UI → evidence → AI.
5. User/stakeholder loop: privacy-safe telemetry, feedback, UX/accessibility,
   and task-success measurement.
6. Production certification: two consecutive preflights, backup/restore,
   independent security/quality audit, real cost/SLO telemetry, and rollback.

Each wave requires functional, regression, edge/error, security, data-quality,
and runtime tests. Browser/user workflow tests are required for user-visible
changes. A wave can finish only with persisted evidence and a documented next
backlog; the company loop itself remains continuous.

### CEO Console read model

The operating console exposes persisted read models for the `macro-os` project:
platform health, product outcomes, open operating backlog, cycle reliability,
and PM-disposed user insights.
`GET /api/company/backlog` reads `.ai-company/backlog.jsonl`, filters the
ledger's `PROPOSED` items as open, and returns priority counts plus the item
details. The console is read-only; backlog decisions and mutations remain
behind the existing admin control plane. This prevents the dashboard from
becoming a second source of truth while giving CEO/PM a visible constraint
list during each operating review.

### Cross-functional role work queue

Backlog items can be decomposed into durable role work items in
`role-work-queue.jsonl`. Each item is assigned to one validated company role
and follows `READY → CLAIMED → IN_REVIEW → DONE` (or `BLOCKED`). Completion is
rejected without evidence IDs, and append-only history is reduced to the
latest state when read. This is the execution bridge between PM/CEO priority
and independent Data, Engineering, QA, QC, UX, domain and release reviews.

After implementation work reaches `DONE` with evidence, the daily planner
creates separate Functional QA and Quality Control review items. These review
items use distinct role identities and are idempotent per backlog item, making
independence an executable workflow property rather than a documentation-only
expectation.

Once both Functional QA and QC work items for an implementation are complete
with evidence, the planner opens independent pre-release reviews for the
stakeholder panel, user persona, UX researcher and domain expert. These are
separate queue identities and therefore can block release without relying on
the implementing role's self-assessment.

`GET /api/company/release-gate?backlogId=...` evaluates the six-role quorum
(QA, QC, stakeholder, user, UX and domain). It fails closed when any review is
missing, unfinished, blocked or lacks evidence, and returns the exact blocker
list for CEO/PM escalation.

Promotion enforcement uses the same quorum through the admin-only
`POST /api/admin/company/promote` control. An incomplete quorum returns
`HOLD_AND_ESCALATE` with HTTP 409 and a rollback signal; promotion is only
reported as ready when every required review is evidence-backed.

The queue also records explicit `BLOCKED` reasons and optional `due_at`
deadlines. Its triage read model reports blocked and overdue items for CEO/PM
escalation; an item cannot be silently treated as complete or ignored because
its worker stopped making progress.

## Decision

- Status: Proposed
- Decision date: 2026-09-04
- Decision notes: This proposal is the implementation boundary. The existing
  local AI Company gate is not production certification; autonomous epochs
  remain held until the durable runtime and real-data gates are proven.

## Vertical slice decision: US CPI

The first real-data slice is US CPI (`cpi-us` / FRED `CPIAUCSL`) because it has
an identified public FRED CSV contract, an existing durable ingestion adapter,
an existing API route, and existing evidence/research consumers. The slice is
complete only when one provider payload is fetched, validated, persisted with
provenance, served by the API, rendered by the UI, and consumed by an AI
explanation without synthetic substitution. Missing provider access remains
`unavailable`; it must never silently fall back to generated series.

Implementation note: `server/ingestion.ts` already supports the public CSV path
when `FRED_API_KEY` is absent, while `server/macroDataRouter.ts` currently only
uses the keyed JSON path. Aligning those paths is the first implementation
step, followed by route and provenance tests.

## Product outcome interface

The operating loop now exposes a persisted product-outcome interface. User
personas, UX research, stakeholder panels, domain experts and PM may be
represented as outcome actors, but every recorded outcome must carry a scoped
workflow, measurable metric, evidence IDs and an explicit verdict. CEO/PM
review reads the ledger; it does not infer satisfaction from page views or
successful HTTP responses. The write endpoint is admin-protected and the
public read surface exposes the ledger without secrets.

The company also exposes a single read-only operating-status contract for the
CEO and PM. It classifies the current company state as `operating`, `degraded`,
or `blocked` from the authoritative readiness snapshot, supervisor activity,
latest cycle attempts, provider attempts, and hydrated real-data state. This is
an observability projection only: it never upgrades production readiness or
replaces the underlying evidence ledgers.

User-persona and UX work follows the canonical `.ai-company/USER_JOURNEY_MATRIX.md`.
This gives the guild repeatable tasks across daily intelligence, comparison,
evidence tracing, reproducibility and accessibility; a successful HTTP request
cannot be counted as user success.

The product operating runtime is now started with the API process. Its
supervisor wakes on the configured interval and runs the daily/weekly/monthly/
quarterly/annual scheduler when due. Annual governance is due on January 1 after
the UTC 08:00 boundary and is checkpointed independently by year. A cycle is blocked unless managed storage is
connected and backup/restore evidence is present; this makes the CEO/PM loop
continuous while preserving the production safety gate.

Runtime health exposes both `startedAt` and `lastTickAt`. Operators must treat
an active process with no completed tick as `starting`, not healthy; scheduler
errors remain visible per scheduler and are never converted into a successful
company cycle.

The admin-only `POST /api/admin/company/rollback` endpoint executes a durable
`RELEASED → ROLLBACK` transition. It requires a non-empty reason and incident
evidence IDs, and stores those IDs in the state event payload for replay and
audit. The transition graph explicitly permits rollback from a released
aggregate.

CEO review actions are persisted in `escalations.jsonl` and exposed through
`GET /api/company/escalations`. The runtime creates idempotent P1 escalations
for research-ready re-score requests and material opportunity score drift,
with explicit CEO/PM ownership and an auditable open status.
The admin-only `POST /api/admin/company/escalations` endpoint enforces the
owner transition `OPEN → ACKNOWLEDGED → RESOLVED`; resolution requires
evidence IDs, and the read model collapses append-only lifecycle events to the
latest state per escalation.

Research-role completion requires a structured research result (question,
source reference, finding and bounded confidence). The runtime synthesizes
completed User/UX/Stakeholder/Domain work into the research signal ledger
idempotently, preserving the link between the work item, evidence and the next
CEO/PM score review.

CEO review snapshots now include `ready_for_rescore_ideas` when all four
research perspectives reach quorum. The runtime synthesizes research before
creating the snapshot; it does not invent missing baseline dimensions, so the
actual re-score remains an explicit PM/CEO action through `score-with-research`.

`GET /api/company/research-quorum?ideaId=...` evaluates whether User Persona,
UX, Stakeholder and Domain signals are all present with minimum confidence.
Only `READY_FOR_RE_SCORE` ideas should enter the next score/CEO review; an
incomplete quorum remains explicitly incomplete.

The cadence planner creates research work for ideas with no persisted score or
with a `DISCOVER` decision, assigning independent User Persona, UX,
Stakeholder and Domain roles. This ensures low-confidence ideas generate the
evidence needed for the next decision rather than being silently prioritized.

Competitive intelligence is recorded in dated reports under
`.ai-company/reports/` with official source URLs, observed capabilities and
explicit limitations. Reports feed opportunity validation; they do not
convert competitor marketing claims into facts about market share, user
preference or legal rights.

The competitive evidence ledger (`competitive-evidence.jsonl`) requires HTTPS
sources, a bounded observed claim and an explicit limitation. It is exposed
through `GET /api/company/competitive-evidence`; writes are admin-controlled.
This keeps external research auditable and prevents unsupported competitor
claims from driving CEO/PM prioritization.

The admin idea control also supports `score-with-research`. It loads the
project's persisted research signals, applies bounded adjustments to user
value and evidence confidence, and persists the resulting score/decision for
the next CEO review. Missing signals leave the base score unchanged.

`GET /api/company/competitive-review` provides the periodic freshness check
for this ledger. Evidence older than the review window produces
`REFRESH_REQUIRED` and concrete refresh/re-score actions; no stale competitive
snapshot is silently treated as current.

Market and user learning is recorded in `research-signals.jsonl` through
`GET /api/company/research-signals` and the admin write endpoint. Signals must
identify a persona, research question, source reference, finding and bounded
confidence. This evidence can inform idea scoring, but cannot silently promote
an idea without the existing PM/CEO decision boundary.

The append-only CEO review ledger (`ceo-reviews.jsonl`) records periodic
opportunity snapshots and flags score drift of at least one point as
`REDECIDE`. It is exposed through `GET /api/company/ceo-reviews`; review
creation is admin-controlled and also runs after product cycles.

The CEO/PM opportunity portfolio is exposed at
`GET /api/company/opportunities`. It sorts only persisted scores and keeps
unscored ideas explicitly marked `UNSCORED`; no ranking is inferred from a
missing evidence set.

Each scheduled review also creates one idempotent P1 backlog action when
competitive evidence is absent or stale (`CI-EVIDENCE-DISCOVERY` or
`CI-REFRESH-REQUIRED`). The action is then handled by the normal PM/role queue
and must not bypass evidence and release gates.

The idea ledger and `GET /api/company/ideas` provide a durable discovery
pipeline. Baseline ideas are explicitly tied to the Product Goal and require a
persona, differentiation hypothesis and validation metric; discovery does not
automatically authorize implementation or release.

Idea decisions are admin-controlled through `POST /api/admin/company/ideas`.
Only an `ACCEPTED` idea can be promoted into a P1 backlog item; decisions are
append-only and the read model exposes the latest state. This creates an
explicit CEO/PM discovery-to-delivery boundary.

Opportunity dimensions and the resulting decision are persisted on each idea
through the admin idea control plane. This makes prioritization auditable and
allows later CEO reviews to compare the original hypothesis with validation and
outcome evidence.

Opportunity prioritization uses a bounded score across user value, strategic
fit, defensibility, feasibility, evidence confidence and risk. Low evidence
always remains `DISCOVER`, regardless of the numerical score; this prevents a
clever but unverified competitive hypothesis from jumping directly into
delivery.

Post-release health is evaluated by `GET /api/company/post-release-monitor`.
The monitor reports `HEALTHY`, `ATTENTION` or `ROLLBACK_RECOMMENDED` from
failure, rework, evidence and recovery SLOs. It never mutates release state;
any rollback recommendation must pass the authorized rollback workflow.

The CEO strategy read model is exposed at `GET /api/company/strategy` with
explicit H0/H1/H3/H10 horizons, Product Goal references, accountable roles,
success metrics and current risk state. It is a decision frame, not a claim
that future outcomes have already been achieved.

When the runtime has a health provider, a severe post-release regression also
creates one idempotent P0 incident in the project backlog. This closes the
observability-to-improvement loop without allowing monitoring to mutate release
state directly.
