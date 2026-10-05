# Backlog Intake and PM Grooming — Current-State Audit

Date: 2026-09-15 (re-verified)

## Findings

The repository currently contains several product-demand-like paths: Product Intelligence writes `OPPORTUNITY_BACKLOG.json`; legacy/runtime ledgers store backlog items; `ideaLedger` and `productOpportunityProbe` create backlog records; Founder-facing ideas exist in Markdown. The execution queue remains a separate runtime concern.

Before this change, these paths did not share one candidate contract, so provenance and deduplication semantics varied by source. The tested PM gate protected the product-cycle downstream path, but a candidate could not be shown as a first-class PM inbox record independently of execution.

## Source matrix

| Source | Current output | Destination | Can create execution | PM gate | Sprint gate | Provenance | Duplication control | Current risk | Target behavior |
|---|---|---|---|---|---|---|---|---|---|
| Founder | Natural-language idea/candidate | Founder intake / PM inbox | No | Required | Separate | Partial; source is preserved by adapter | Exact source-event dedup | Legacy helper can bypass common inbox | `FOUNDER` candidate |
| Product Discovery | `OpportunityCandidate` + recommendation | PM inbox + discovery snapshot | No after current fix | Required | Separate | Product revision/evidence preserved | Candidate source ID | Historical consumers may expect selected objective | Candidate only; PM promotes |
| Product Manager | Grooming decision / backlog item | Canonical Product Backlog | Only after approval/DoR | Is the gate | Separate planning decision | PM decision record | Backlog identity | Script rules are deterministic and narrow | Judgment and rationale, no silent Sprint commit |
| UX/UI evaluation | Structural/runtime observation | Candidate adapter when invoked | No | Required | Separate | Evidence IDs required | Exact source event | Not every evaluator is wired | Observation, not solution authority |
| Product Design evaluation | Design finding | Mostly documentation/evaluation artifacts | No intended | Partial | Separate | Varies by producer | Varies | Missing universal adapter | `SYNTHETIC_EXPERT_EVAL` candidate |
| Macro Domain Expert | Domain correctness finding | Review/evidence ledgers | No intended | Required for product change | Separate | Evidence contract | Varies | Domain incident vs product problem can be conflated | Candidate or incident with severity |
| Synthetic User | Synthetic task result | Evaluation/evidence ledger | No | Required | Separate | Explicit synthetic label | Evaluation IDs | Cannot be treated as real-user evidence | `SYNTHETIC_USER_EVAL` candidate |
| Future real user feedback | Not yet active | Extensible candidate contract | No | Required | Separate | Contract supports source ID | Gateway exact dedup | No feedback platform is intentionally built | `USER_EVIDENCE` candidate |
| QA | Test failure/defect artifact | Queue/evidence; adapter path | Only approved task scope or P0 | Required | Required | Test/evidence IDs | Partial | Unrelated defects can fork legacy backlog | QA candidate |
| QC/Critic | Critique/review verdict | Review ledger/escalation | No intended | Required | Separate | Review evidence contract | Review identity | Findings may not enter common intake | Candidate + evidence |
| Engineering | Profiling/implementation finding | Role artifact/legacy backlog | Guarded by execution policy | Required | Required | Role evidence | Varies | Solution-first “add Redis” style demand | Problem observation; architecture later |
| Backend | Runtime/data defect finding | Role artifact/legacy backlog | Guarded | Required | Required | Evidence required for DONE | Varies | Direct backlog helpers remain | Candidate |
| Performance | Latency/resource observation | Telemetry/performance ledger | No intended | Required | Separate | Metrics/profiling IDs | Varies | Metric may lack product impact | Candidate with baseline |
| Data/Evidence | Freshness/provenance/source finding | Source audits/evidence ledger | No intended | Required | Separate | Source URL/observation IDs | Source identity | Outdated series may be mistaken for demand | Candidate or data incident |
| Security | Security violation/review | Security ledger/escalation | No normal product execution | Required | Separate | Security evidence | Violation identity | Emergency handling must remain distinct | Candidate/P0 incident |
| Product telemetry | Usage opportunity | `BacklogIntakeGateway` → PM inbox | No after current fix | Required | Separate | Event IDs/metrics | Exact opportunity source ID | Local telemetry is not real-user proof | `TELEMETRY` candidate |
| Runtime telemetry | Health/scheduler/provider signal | Health/provider ledgers | No intended | Required for product change | Separate | Runtime report IDs | Provider attempt identity | Operational signal can be over-promoted | Candidate only when product relevance established |
| Product Outcome | WIN/LOSS/INCONCLUSIVE result | Outcome ledger / outcome adapter | No direct intended | Required | Separate | Outcome/evidence IDs | Task/outcome identity | Outcome adapter may write legacy backlog | Candidate adapter |
| Experiment result | Trial comparison/result | Experiment/trial ledger | No direct intended | Required | Separate | Trial ID and conditions | Trial identity | Internal score can be mistaken for product value | Evidence-backed candidate |
| Learning | Learning record | Memory/learning ledger | No direct intended | Required | Separate | Learning ID and causal links | Learning identity | Stored learning is not causal learning automatically | Candidate only when later decision impact exists |
| Recovery/incident | Failure/recovery record | Recovery/escalation ledger | Only bounded recovery | Inherited parent gate | Inherited Sprint scope | Parent work/evidence IDs | Recovery fingerprint | Recovery can be mistaken for new demand | Incident candidate, never scope expansion |

## New control boundary

`server/aiCompany/backlogIntake.ts` is now the common deterministic intake primitive. It creates `BacklogCandidate` records in `PM_INBOX`, preserves source/provenance/evidence, and deduplicates exact source events. The duplicate read and append now share one serialized critical section, so concurrent submissions of the same source event create one record. It does not promote, prioritize, select Sprint, or execute.

The live product-company runtime now routes telemetry opportunities through
`intakeTelemetryOpportunity()` and the PM inbox. PM-accepted usage insights
also enter the same inbox as `USER_EVIDENCE` candidates. The previous direct
`materializeTelemetryOpportunityBacklog()` helper remains only as a legacy
compatibility adapter for historical callers/tests; it is not used by the
runtime path, and the usage-insight endpoint no longer writes an executable
legacy backlog row directly.

The live product operating cycle now routes outcome recommendations as
`OUTCOME` candidates through the same gateway. It does not call legacy CEO
prioritization or create executable backlog rows on that runtime path.

Candidate lifecycle updates are now persisted atomically by the gateway. PM
grooming can therefore move a candidate out of `PM_INBOX` without leaving the
same record eligible for repeated promotion on the next run.

Competitive evidence refresh actions and severe post-release incidents now
also use the gateway when invoked by the live runtime. They enter as `DATA`
and `INCIDENT` candidates respectively; legacy ledger writes remain available
only for compatibility callers that do not provide the runtime intake.

Experiment learning now has a `learningToCandidate()` path that preserves the
experiment/evidence linkage and requests PM review instead of changing a
backlog priority directly. The older `applyExperimentLearningToBacklog()`
function remains an explicit compatibility authority path.

## Remaining migration work

Existing legacy producers still need small adapters into this gateway. They should be migrated incrementally while preserving historical records; no second runtime authority should be introduced. Semantic duplicate/merge decisions remain PM-owned and are not replaced by deterministic text matching.

## Directly observed bypass/duplicate paths

- `server/aiCompany/productOpportunityProbe.ts` still exposes a legacy
  `materializeTelemetryOpportunityBacklog()` helper. The live runtime no longer
  calls it, but it remains callable by legacy code and therefore should be
  deprecated or removed after downstream callers are migrated.
- `promoteAcceptedIdea()` intentionally writes a canonical backlog item after
  an accepted idea. This is a PM/CEO authority path, not an observation intake
  path, but it must remain explicit and must not be reused by raw discovery.
- Competitive review, outcome, learning, post-release and incident adapters
  still write directly to the older `BacklogLedger` in some paths. These are
  the next migration candidates; they are not silently classified as safe.
- `run-product-discovery.mjs` now persists a recommendation but sets
  `selected_opportunity` to `null`; any consumer requiring a selected objective
  must wait for PM grooming rather than bypassing the gate.
- `scripts/execute-watchlist-alert-cycle.mjs` is a historical/manual artifact
  that directly edits the role queue and writes completion artifacts. It is not
  part of the live runtime and must not be used as evidence of a valid company
  cycle; it now fails closed unless the explicit compatibility flag
  `AI_COMPANY_ALLOW_LEGACY_MANUAL_CYCLE=true` is supplied. Future execution
  should use the guarded queue/executor path.

## Re-verification

- `server/aiCompany/backlogIntake.test.ts`: 4 tests pass, including three concurrent submissions producing one candidate and two duplicate responses.
- Related intake, grooming, and Product Backlog tests: 13 tests pass.
- `git diff --check`: pass.
- This fixes exact-event concurrency deduplication only. Semantic clustering/merge, legacy producer migration, and PM judgment remain intentionally outside deterministic intake.
- Telemetry runtime path: verified by `productOpportunityProbe.test.ts`; a
  telemetry observation is persisted as `PM_INBOX` and does not create an
  executable backlog item before PM grooming.
- Outcome runtime path: `productOperatingCycle.test.ts` verifies two outcome
  recommendations become PM inbox candidates and zero legacy backlog items.
- Candidate lifecycle: `backlogIntake.test.ts` verifies a PM status update is
  durably visible after an atomic rewrite.

## Runtime verification — 2026-09-15

- Restarted the local backend after source changes; the previous process had
  been started before the new read-model route existed and returned the SPA
  fallback HTML for that route.
- `GET /api/company/backlog-candidates?projectId=macro-os`: HTTP 200 JSON.
- Runtime read model reported 6 durable candidates: 6 `PM_INBOX`, 0 promoted,
  0 held, 0 rejected.
- `/api/health`: PostgreSQL/Supabase connected, `durablePersistence=true`,
  `productionReady=false`.
- This proves the PM inbox route is present in the running backend; it does not
  imply that any candidate has PM approval or Sprint commitment.
- A real PM grooming pass then produced 2 `PROMOTED` candidates and 4
  `HOLD_FOR_EVIDENCE` candidates. The second run found zero PM inbox items,
  proving candidate status is durable and the pass is idempotent. Canonical
  backlog persistence now merges new promoted items with the prior snapshot,
  so an empty second pass cannot erase valid backlog items. No Sprint was
  selected.
- The canonical snapshot had already been emptied by the pre-fix run; it was
  rebuilt from the durable candidate ledger through the guarded grooming path.
  It now contains 2 items (`BACKLOG-QUALITATIVE-DIFF-GROUNDING` and
  `BACKLOG-INDICATOR-FRESHNESS-COVERAGE`) with no Sprint commitment.
- Competitive runtime path: `competitiveAction.test.ts` verifies missing
  competitive evidence becomes one PM inbox candidate.
- Held candidates can now be re-opened only through
  `BacklogIntakeGateway.reopenForEvidence()` with genuinely new evidence IDs.
  The provenance-regression candidate was re-intaken with 2026-09-15
  real-data/runtime-health evidence and promoted to
  `BACKLOG-PROVENANCE-REGRESSION-AUDIT` with DoR `READY`; it was not committed
  to a Sprint.
- Learning path: `learningToBacklog.test.ts` verifies linked learning becomes a
  `LEARNING` PM inbox candidate without a direct backlog decision.
