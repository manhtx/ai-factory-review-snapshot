# CODEX FINAL CAUSAL TRUTH & REPAIR DECISION

**Date:** 2026-09-23 (Asia/Ho_Chi_Minh)  
**Scope:** AI Company control plane, Macro OS, runtime state, Forecast Trust delivery claim, and Cycles 59–61  
**Mode:** read-only independent investigation; no repair, normalization, commit, deploy, migration, or status mutation

## Executive page

### What system do we actually have?

We have a local TypeScript/Node control plane around a Vite/React Macro OS product. It includes a queue/DAG, assignment envelopes, an execution planner, role dispatch, worktree/path controls, review contracts, append-only ledgers, supervisor/lease/checkpoint mechanisms, and many state/report projections.

Actual topology:

    host process / launchd / Founder prompt
      -> supervisor or cycle script
      -> candidate/backlog selection
      -> PM and execution contract
      -> RoleWorkQueue / dependency DAG
      -> role dispatcher / provider
      -> artifact + evidence + tests
      -> QA/QC/review
      -> merge or hold
      -> product consumer and outcome measurement

This is a bounded local engineering platform. It is not yet a proven founder-independent product organization.

### What is proven to work?

- Assignment/admission contracts reject many malformed or unsafe inputs.
- ExecutionPlanner derives a product-code path when source paths are present and a state/report path when only state/report paths are present.
- Queue/DAG dependency handling and structured-output validation exist and have credible contract tests.
- Worktree/path/security boundaries and human-gated production controls exist.
- PM approval/HOLD can block downstream work on the tested product-cycle path.
- Forecast Trust formulas and UI component code exist in the current working tree, and the supplied targeted test artifact reports 20/20 local tests passing.
- ForecastCenterPage imports the Forecast Trust functions and calls the forecast-accuracy API.

These are mainly repository and bounded local execution claims. They are not automatically product-value claims.

### What only appears to work?

- Cycle 61 appears delivered in narrative/status files, but authoritative marathon state still says the last verified company cycle is 60.
- The latest executable Forecast Trust cycle has one PM work item, files_changed empty, has_mutation false, disposition REVISE, and product_outcome BLOCKED_OR_REVISE.
- Forecast Trust source changes are uncommitted working-tree changes, not mainline-integrated delivery.
- The live server data paths can label a latest observation available without checking verified status/quality.
- “0 Founder interruption” is not independently instrumented in the cycle ledger.
- “L5 real consumer path” proves code import/call/render structure, not real data or improved user decisions.

### Cycle 61 attribution

**Mixed, predominantly external prompt-guided recovery.** The overnight narrative supplied the diagnosis, target objective, allowed-path correction, delivery objective, and operating protocol. Current authoritative records do not show autonomous engineering and QA completion. The strongest defensible claim is an externally guided working-tree repair, not autonomous end-to-end delivery.

### Is the allowed_paths failure local or systemic?

The immediate bad value was local to BACKLOG-FORECAST-EVALUATION-TRUST: it pointed at a state/report file while acceptance criteria required product code and QA. The failure class is systemic execution-contract generation/validation because the planner did not reject an implementation objective whose mutation surface could not satisfy its acceptance criteria.

### Is Forecast Trust using real, semantically valid data?

**Not proven; the live server path has a material truth defect.** The strict batch evaluator requires exact target date, actual status, verified quality, and finite value. In contrast, server/db.ts selects a latest observation by vintage/ingestion time without status/quality filtering, and server/supabase.ts receives only date/value from latest observations and marks an exact date match available. The UI therefore depends on a weaker contract than the strict evaluator.

### Most overstated claim

The claim that Cycle 61 achieved first product delivery proven, PRODUCT_DELIVERED, L5 real consumer path, and 100% verified Forecast Trust value. Evidence supports local uncommitted code and tests plus a reachable consumer path, not mainline delivery, verified live-data lineage, or product decision value.

### Material issue found independently

Forecast accuracy data-state drift between the strict batch evaluator and the live server API. A provisional, estimated, quarantined, or otherwise unverified exact-date observation can be marked available by the live path.

### Earliest broken product-loop edge

PRODUCT REALITY -> OBSERVATION -> EVIDENCE -> DECISION is the earliest materially broken edge for the current Forecast Trust claim: the system can create an opportunity and PM specification, but cannot prove the observation paired to the forecast is a verified release on the live endpoint.

### Four bottlenecks

- Product: truthful product-data lineage.
- Autonomy: execution-contract sufficiency and objective continuity.
- Truth/reliability: competing state authorities plus weak live data-state enforcement.
- Token/cognition: oversized PM context and provider amplification before executable scope is proven.

### Do not touch now

Do not add agents, a scheduler, a database, a new memory architecture, production autonomy, multi-model swarm, global token optimization, or forecast/trading scope. Preserve the Product Goal, human-gated production boundary, queue/DAG safety controls, worktree isolation, explicit pending/unverified states, and append-only evidence history.

### Final disposition

**B. TARGETED_REPAIR_THEN_OPERATE.** Two bounded causal repairs are justified:

1. Reject implementation-ready objectives whose acceptance criteria, allowed paths, mutation scope, or roles are insufficient; require mainline diff/consumer evidence before DELIVERED.
2. Unify local and Supabase Forecast Trust evaluation around verified actual status/quality, release/vintage metadata, and fail-closed pending/unverified states.

Then run one isolated real Forecast Trust objective and, if successful, three small Macro objectives. Do not expand the architecture before that trial.

## 1. Audit independence and contamination

The supplied brief, prior reports, Cycle 61 narrative, tests, labels, and status files were treated as leads. Current source, Git, runtime state, backlog, cycle artifacts, Forecast Trust code, API paths, and tests were inspected directly.

No source, database, runtime state, backlog, lease, test, configuration, prompt, or production gate was modified. No cycle, build, test, server, deployment, commit, migration, or normalization command was run.

The worktree was already heavily dirty. Existing Forecast Trust changes and AI Company artifacts are not attributed to this audit.

## 2. Evidence model

| Plane | Meaning | Current Cycle 61 ceiling |
|---|---|---|
| T0 | narrative/status/report | claims delivery and L5 |
| T1 | source/Git/configuration | uncommitted Forecast Trust diff exists |
| T2 | observed execution | PM-only cycle record; no engineering/QA delivery record |
| T3 | actual data/provenance | live API status/quality enforcement insufficient |
| T4 | meaningful product effect | not proven |

Counterfactual firewalls:

- If reports disappeared, source diff/API wiring/tests remain, but Cycle 61 delivery and product value do not.
- If AI-written tests were distrusted, local code remains, but live verified-release lineage and integration do not.
- If all status labels became UNKNOWN, Cycle 61 reduces to PM-only recorded execution, no mutation in its cycle artifact, uncommitted source changes, and a weakened live data contract.

## 3. Current executable system

| Subsystem | Primary implementation | Current classification |
|---|---|---|
| Execution planning | server/aiCompany/executionPlanner.ts | active; sufficiency invariant missing |
| Product cycle creation | scripts/create-codex-product-cycle.mjs | active; can stop at PM |
| Role dispatch | scripts/ai-company-role-dispatch.mjs | active; provider constrained |
| Queue/DAG | server/aiCompany/roleWorkQueue.ts | active |
| Review | QA/QC/review contracts | active; independence bounded |
| Forecast Center | src/app/pages/ForecastCenterPage.tsx | active in dirty tree; mainline not proven |
| Forecast API | server/index.ts | active; data-state defect |
| Local accuracy source | server/db.ts:listForecastAccuracy | active; no status/quality filter |
| Supabase accuracy source | server/supabase.ts:supabaseForecastAccuracy | active; date/value only |
| Strict batch evaluator | server/batchForecastEvaluation.ts | active; not live API source |
| Supervisor | CompanySupervisor and durable state | active; fresh-process product resume limited |

## 4. Current authoritative state

| Source | Observed value |
|---|---|
| .ai-company/mission/AI_COMPANY_MARATHON_STATE.json | verified_company_cycle_number 60; last_completed_cycle 60; current_cycle_number 61; next_safe_action WRITE_FORENSIC_REPORT_0051_0060 |
| .ai-company/CURRENT_CYCLE.md | claims Cycle 61 VERIFIED_AND_DELIVERED and PRODUCT_DELIVERED |
| latest product-cycle evaluation | one PM role; files_changed empty; has_mutation false; REVISE; BLOCKED_OR_REVISE |
| canonical backlog dirty diff | Forecast item READY -> DELIVERED with implementation/evaluation/learning IDs |
| Git | Forecast source/tests are uncommitted working-tree modifications; no Cycle 61 integration commit |
| latest review | Cycle 60 says REVISE with local claim ceiling and “proceed to Cycle 61” |

Conclusion: **Cycle 61 is claimed/drafted, not independently delivered.**

## 5. Bottleneck migration

The observed progression is exposure of deeper boundaries, not random independent bugs:

1. Earlier work exposed queue, worktree, provider, and scheduler constraints.
2. Cycles 59–60 exposed PM-only continuation and high cognition burn with no product delta.
3. The overnight operation diagnosed and corrected the bad allowed_paths value.
4. This investigation exposes the next boundary: status can advance without mainline proof, and the live Forecast API can weaken the verified-data contract.

The next bottleneck is not another role or scheduler. It is an upstream invariant connecting contract -> mutation -> integration -> data truth.

## 6. Central product causal chain

| Edge | Verdict | Reason |
|---|---|---|
| Product reality -> observation | SUPPORTED | route/code observations; no real-user evidence |
| Observation -> opportunity | SUPPORTED | backlog and PM framing |
| Opportunity -> evidence | PARTIAL | structural/runtime evidence; verified lineage incomplete |
| Evidence -> decision | PARTIAL | PM PROCEED exists; prior scope was wrong |
| Decision -> priority | SUPPORTED | P1 selection |
| Priority -> executable objective | CONTRADICTED for prior path | state-only allowed paths caused PM-only plan |
| Objective -> execution contract | PARTIAL | planner exists; semantic sufficiency missing |
| PM -> engineering | NOT_PROVEN for Cycle 61 | latest record is PM only |
| Engineering -> QA | NOT_PROVEN for Cycle 61 | no engineering/QA work items |
| QA -> correction | SUPPORTED in selected prior paths | review/recovery contracts |
| Correction -> integration | NOT_PROVEN for Cycle 61 | uncommitted diff/no commit |
| Integration -> consumer | PARTIAL | page consumes code in dirty tree |
| Consumer -> verified data | CONTRADICTED/unsafe | live API lacks status/quality filter |
| Product delta -> new observation | NOT_PROVEN | no real product metric |
| Observation -> learning | PARTIAL | records exist; changed decision not shown |

Earliest broken edge: **Decision -> executable objective** for the Cycle 61 delivery claim. Next broken edge: **Consumer -> verified data**.

## 7. Cycles 59–61

### Cycle 59

Existing marathon evidence describes a zero-cognition/justified wait after candidates were treated as terminal. This supports safe waiting in that scenario, not autonomous discovery or product delivery.

### Cycle 60

The relevant product-cycle evaluation records one PM item for BACKLOG-FORECAST-EVALUATION-TRUST, 132,028 actual tokens, 15,783 estimated tokens, no mutation, and BLOCKED_OR_REVISE. The PM report says PROCEED, but this is a specification, not engineering delivery.

### Cycle 61

The overnight report and CURRENT_CYCLE.md claim delivery and six material source/test changes. Current executable evidence does not support the claim: no authoritative engineering+QA evaluation record, marathon state still says Cycle 60 is last verified, and the changes remain uncommitted.

Attribution: **mixed, predominantly external prompt-guided recovery**. The external operation supplied diagnosis, target, scope correction, and success narrative.

## 8. Forecast Trust lineage attack

Actual path:

    ForecastCenterPage
      -> fetchForecastAccuracy
      -> GET /api/forecast-accuracy
      -> local SQLite or Supabase accuracy adapter
      -> exact date/value pairing
      -> accuracyState available/pending
      -> calculateForecastAccuracyMetrics
      -> MAE/RMSE UI

The strict batch evaluator checks exact date, actual status, verified quality, finite value, and baseline. The live SQLite query chooses latest vintage/ingestion row but does not filter status or quality. The Supabase adapter fetches rows as date/value and marks an exact match available. This is a real semantic divergence.

| Claim | Verdict |
|---|---|
| Forecast Trust arithmetic exists | PROVEN at T1/T2 pure-function level |
| Forecast Center consumes it | SUPPORTED in dirty tree |
| Live data is verified actual | NOT_PROVEN; current code can weaken it |
| Vintage/release semantics are preserved | NOT_PROVEN |
| MAE/RMSE is statistically meaningful across current data | NOT_PROVEN |
| User decisions improve | NOT_PROVEN |

The most important surviving mutation is to replace a verified observation with a same-date provisional/estimated/quarantined observation. The expected result is pending/unverified; the current live paths can return available.

## 9. Execution contract attack

ExecutionPlanner has a useful conservative path derivation, but it lacks this invariant:

> Every implementation-ready objective must expose a mutation surface and role set sufficient to satisfy its acceptance criteria.

Before correction, Forecast Trust had product acceptance criteria but a state/report-only allowed path. The planner therefore derived COMPANY_STATE_MUTATION and selected PM only. The system should reject this before provider spend, not let PM complete and then infer delivery.

| Objective state | Required | Configured | Verdict |
|---|---|---|---|
| Forecast Trust before correction | product data/UI/server/tests | research portfolio state file | PM-only truncation |
| Forecast Trust current dirty tree | product data/UI/server/tests | six product/test paths | structurally executable; delivery uncommitted |
| research/evidence items | docs/domain evidence | state/docs paths | executable as research, not product mutation |

## 10. PM, engineering, QA and integration

The queue supports PM, engineering and QA waves, and prior bounded cycles show the path can work. Cycle 61 does not prove it: roles_invoked contains only PM, work_items is 1, files_changed is empty, and no QA pass is recorded.

A PM role report can say PASS/PROCEED while the product-cycle evaluator says REVISE/BLOCKED_OR_REVISE. This is acceptable only if projections clearly distinguish PM completion from product delivery. Current reports do not consistently do so.

## 11. Tests and mutation confidence

The reported 20/20 Forecast Trust tests are useful for formulas, null/pending handling, grouping, and mocked page rendering. The page test is untracked, so it is not committed-baseline evidence. These tests do not exercise live SQLite/Supabase data with provisional/quarantined observations, release metadata, or vintage semantics.

Test quality:

| Area | Oracle trust |
|---|---|
| pure MAE/RMSE arithmetic | STRONG |
| pure pending/null behavior | STRONG |
| page rendering with mocked API | ADEQUATE |
| live API verified-state behavior | MISSING |
| source/vintage/release provenance | MISSING |
| mainline delivery status | MISSING |
| real user/product value | MISSING |

## 12. Discovery, prioritization and learning

Discovery includes hardcoded/rule-driven opportunity branches keyed by evidence IDs. Without the predefined catalog/rules, open-ended novel objective generation is not proven.

Priority metadata exists, but there is no decisive isolated replay proving that changing only priority/evidence/value changes selection independently of array order and current state.

Memory and learning records exist, but Cycle 61 was driven by explicit external diagnosis and prompt guidance. No defensible Observation -> belief update -> later changed decision chain is proven. Current learning is INFORMATION_RECORDED, not causal learning.

## 13. Recovery, wait/resume and continuity

Queue recovery, stale leases, checkpoints, and wait records exist. They support bounded safety. They do not prove fresh-process restoration of the same objective through engineering, QA, integration, and product measurement.

The contradiction between marathon state and CURRENT_CYCLE is itself evidence that state authority is weak. A wait record is not an observed external event, and a resumed timestamp is not proof of resumed objective work.

Safety is stronger than liveness: the system often holds safely, but the current objective can remain in contradictory running/delivered/next-report projections.

## 14. Provider and token truth

The current dispatcher is Codex-only, while historical runtime rows include other providers. These histories are not equivalent to current provider capability.

| Cycle | Actual tokens | Estimated tokens | Ratio |
|---|---:|---:|---:|
| 1790159575213 | 132,028 | 15,783 | 8.37x |
| 1790157331390 | 143,704 | 11,782 | 12.2x |

The exact 140K PM decomposition is UNKNOWN. The evidence does not separate system prompt, objective, history, context files, tool output, retries, provider accounting, and output. The defensible finding is material context/cognition amplification before executable scope was proven.

## 15. Founder dependency map

| Dimension | Level | Evidence |
|---|---|---|
| Click | MEDIUM | external start/cycle initiation |
| Task | MEDIUM | queue dispatch exists; Cycle 61 did not continue |
| Priority | HIGH | strategy/selection remains human and prompt-sensitive |
| Strategy | HIGH | Product Goal and production direction human-owned |
| Diagnosis | HIGH for novel delivery failures | allowed-path diagnosis supplied externally |
| Recovery | MEDIUM | bounded code; fresh-process product recovery unproven |
| Domain knowledge | HIGH | macro semantics, rights, and source validity |
| Authority | HIGH | release, production, rights, and migrations |
| Prompt dependency | HIGH for Cycle 61 | detailed overnight prompt supplied causal repair |

## 16. Claim ledger

| ID | Claim | Verdict | Confidence |
|---|---|---|---:|
| C01 | founder-silent execution | PARTIAL | 0.80 |
| C02 | founder-independent task formation | NOT_PROVEN | 0.85 |
| C03 | founder-independent strategy | NOT_PROVEN | 0.95 |
| C04 | legitimate objective selection | SUPPORTED | 0.75 |
| C05 | causal prioritization | NOT_PROVEN | 0.85 |
| C06 | executable backlog contracts | PARTIAL | 0.95 |
| C07 | objective continuity | PARTIAL | 0.80 |
| C08 | PM to engineering continuation in Cycle 61 | NOT_PROVEN | 0.90 |
| C09 | engineering execution locally | SUPPORTED | 0.80 |
| C10 | independent QA in Cycle 61 | NOT_PROVEN | 0.90 |
| C11 | QA to correction | SUPPORTED | 0.70 |
| C12 | Cycle 61 integration | NOT_PROVEN | 0.95 |
| C13 | real-path Forecast Center consumption | PARTIAL | 0.80 |
| C14 | truthful Cycle 61 delivery | CONTRADICTED | 0.95 |
| C15 | genuine Cycle 61 product delivery | CONTRADICTED | 0.98 |
| C16 | Cycle 61 real data | NOT_PROVEN | 0.95 |
| C17 | Cycle 61 domain validity | NOT_PROVEN | 0.85 |
| C18 | user decision value | NOT_PROVEN | 0.98 |
| C19 | evidence acquisition | PARTIAL | 0.75 |
| C20 | evidence-driven discovery | PARTIAL | 0.70 |
| C21 | open-ended discovery | NOT_PROVEN | 0.90 |
| C22 | causal learning | NOT_PROVEN | 0.95 |
| C23 | bounded recovery | SUPPORTED | 0.70 |
| C24 | quarantine closure | NOT_PROVEN | 0.75 |
| C25 | livelock prevention | NOT_PROVEN | 0.75 |
| C26 | live wait/resume | PARTIAL | 0.75 |
| C27 | restart continuity | NOT_PROVEN | 0.90 |
| C28 | provider resilience | PARTIAL | 0.80 |
| C29 | token telemetry validity | PARTIAL | 0.80 |
| C30 | context efficiency | NOT_PROVEN | 0.85 |
| C31 | failure containment | SUPPORTED | 0.80 |
| C32 | production human gate | PROVEN | 0.95 |
| C33 | product-over-meta orientation | PARTIAL | 0.85 |

## 17. Issue register

### I-01 — Acceptance-to-execution contract insufficiency

**Severity:** P1. **Failure class:** EXECUTION_CONTRACT_GENERATION_FAILURE. **Scope:** systemic, observed in Forecast Trust.

Product criteria plus state-only allowed paths produced COMPANY_STATE_MUTATION and PM-only execution. The root cause is missing semantic sufficiency validation between acceptance criteria and mutation surface/roles. Impact is no product delta, external diagnosis, and 132K–144K cognition burn before engineering was possible.

Repair direction: reject invalid contracts before provider dispatch and require mainline diff/consumer/review evidence before DELIVERED.

Falsification: state-only paths with code-change criteria must hard-reject; valid paths must dispatch PM -> engineering -> QA.

### I-02 — Forecast Trust live data-state drift

**Severity:** P0. **Failure class:** DATA_PROVENANCE_AND_STATE_VALIDATION_FAILURE. **Scope:** systemic across local/Supabase live API adapters.

The strict batch evaluator checks status and quality; live API paths do not. A provisional/estimated/quarantined exact-date row can become available and enter MAE/RMSE. Product truth is directly threatened.

Repair direction: one canonical evaluator and verified status/quality/vintage/release metadata through both APIs.

Falsification: inject same-date provisional/estimated/quarantined rows and require pending/unverified on both adapters.

### I-03 — Delivery status outruns integration truth

**Severity:** P1. **Failure class:** STATE_AUTHORITY_FRAGMENTATION.

Current Cycle 61 narrative/backlog state says delivered while Git and cycle evaluation show no authoritative product delivery. Require delivery status to derive from commit/diff, consumer, review, and reproducible evidence.

### I-04 — PM context amplification

**Severity:** P2. **Failure class:** CONTEXT_AMPLIFICATION.

Actual tokens greatly exceed estimates; exact decomposition is unknown. Measure before optimizing role architecture.

## 18. Minimal causal cut

The smallest high-leverage cut is:

1. Contract sufficiency: acceptance criteria -> required mutation surfaces/roles -> admission.
2. Truthful delivery/data: actual commit + consumer + verified observation lineage -> DELIVERED/scored.

These two gates break the largest chains: PM-only token burn, false Cycle 61 delivery, false Forecast Trust scoring, and status/report divergence.

## 19. NOW repair specifications (not implementation)

### NOW-1 — Execution Contract Sufficiency Gate

Goal: prevent implementation-ready work from entering a PM-only/state-only path when acceptance criteria require product mutation.

Components: server/aiCompany/executionPlanner.ts, backlog/work descriptor validation, cycle creation, delivery-state reducer, tests.

Invariant: if criteria or expected change require code, data, API, UI, consumer, or scheduled-ingestion mutation, the contract must contain matching allowed paths, mutation scope, worktree requirement, engineering role, and verification methods; otherwise reject as INVALID_EXECUTION_CONTRACT before provider spend.

In scope: path/criteria sufficiency, role sufficiency, PM-only rejection, delivery requiring mainline diff evidence. Out of scope: new roles, scheduler, architecture rewrite, production autonomy.

Acceptance:

- Static: frontend, backend, mixed, data, research, config, test-only, and state-only descriptors derive or reject correctly.
- Property: every implementation criterion maps to a mutation surface and role.
- Adversarial: wrong paths, empty paths, test-only paths for code criteria, state-only paths for UI criteria, and omitted roles fail closed.
- Empirical: one valid objective runs PM -> engineering -> QA; one invalid objective stops before provider call.
- Product: DELIVERED is impossible without mainline diff/consumer/review evidence.
- Rollback: revert gate and retain safe hold behavior.

### NOW-2 — Forecast Trust Live-Lineage Gate

Goal: score only exact, verified historical releases and preserve the evidence state to the UI.

Components: server/db.ts, server/supabase.ts, server/index.ts, shared Forecast Trust types/evaluator, API tests, Forecast Center tests.

Invariant: available requires exact indicator/target period, finite value, actual/released status, verified quality, and auditable source/vintage/release record. Everything else is pending/unverified and excluded.

In scope: unify local/Supabase semantics, preserve status/quality/vintage/release metadata, prevent live API drift. Out of scope: new providers, model expansion, trading signals, unrelated redesign.

Acceptance:

- Static: both adapters call the same evaluator/contract.
- Property: provisional, estimated, quarantined, missing, future, mismatched, or non-finite observations never produce available.
- Adversarial: same-date wrong-quality row, revised vintage, missing release date, zero actual, non-finite value, mismatched indicator/frequency.
- Empirical: local and Supabase fixtures agree.
- Product: UI shows verified metrics only for verified pairs and exposes pending/unverified/provenance.
- Rollback: revert to pending-only rather than score unverified values.

## 20. Repair DAG and next trial

    NOW-1 Contract Sufficiency Gate
      -> valid engineering/QA work can be dispatched
      -> delivery evidence reducer can receive a real diff

    NOW-2 Forecast Trust Live-Lineage Gate
      -> the real product diff can be tested against truthful data
      -> Forecast Center can be operated as one bounded Macro slice

    One-objective empirical trial
      -> if both pass, operate three small Macro objectives
      -> if either fails, repair that invariant; do not rotate objectives

Trial hypothesis: the two gates prevent PM-only truncation and false Forecast Trust scoring for one representative objective.

Start in a disposable worktree and test database. Freeze Product Goal, production gate, credentials, canonical production state, and existing history. Allow only Forecast Trust code/test/API adapter changes and isolated cycle evidence.

Expected path: candidate -> valid contract -> PM -> engineering -> QA -> commit/diff -> API with one verified and one provisional observation -> UI scorecard -> delivery evidence.

Success: invalid state-only contract rejected; valid contract dispatches required roles; real commit observed; provisional pair pending; verified pair scored; delivery derived from evidence; no routine Founder prompt after start.

Failure: PM-only work recurs, status becomes delivered without commit, provisional data scores, or projections disagree. Stop at first violated invariant.

## 21. Do-not-fix register

| Item | Why not now | Justifying evidence later |
|---|---|---|
| New agents/roles | failure is contract/data truth | valid contracts repeatedly blocked by missing capability |
| New scheduler/daemon | continuity is downstream | three valid objectives fail only on wake/restart |
| New DB/memory architecture | evaluator/authority is the problem | bounded repair cannot support lineage |
| Open-ended discovery | delivery/data truth unproven | three trusted cycles plus novel useful discovery |
| Multi-model swarm | cognition already amplified | measured provider-independent ROI |
| Global token optimization | decomposition unknown | reconciled component cost ledger |
| Production autonomy | production gates incomplete | durable data, security, rollback, release proof |
| Forecast/trading expansion | trust boundary itself is not live-safe | verified lineage and user value |
| Architecture rewrite | two bounded repairs address current failures | repairs fail despite enforced invariants |

## 22. More audit versus operation

More audit is justified only for: exact deployed Supabase status/quality schema; isolated property/mutation tests for NOW-1/NOW-2; a fresh-process recovery drill after a valid objective exists; and actual provider token decomposition.

Real operation should answer: whether Forecast Trust improves analyst decisions; whether users understand pending/verified states; whether prioritization changes from outcomes; whether three objectives remain Founder-light; and whether release revisions improve calibration.

## 23. Stop-building-AI-Company gate

Stop speculative control-plane construction after three consecutive bounded Macro objectives demonstrate: legitimate work without routine Founder prompting; objective continuity; sufficient contracts before provider spend; real product mutation and mainline consumer; independent QA catching seeded defects; verified data states to UI; safe wait/recovery; evidence-derived delivery status; no routine Founder intervention; and at least one honestly measured product outcome.

## 24. Final claim ceiling

- L1/L2 bounded control-plane execution: supported/proven on selected local paths.
- Cycle 61: externally guided claimed delivery with no authoritative autonomous delivery proof.
- Forecast Trust code: implemented in dirty tree; targeted tests reported passing; mainline and live-data truth unproven.
- Forecast Center consumer: code-integrated in dirty tree; real data and user value unproven.
- Production: human-gated and not ready.
- Causal learning: not proven.
- Founder-light continuous operation: not proven for the claimed delivery path.

## 25. Final disposition

**B — TARGETED_REPAIR_THEN_OPERATE.**

The evidence does not justify OPERATE_NOW because the feature under review has a P0 data-truth defect and Cycle 61 delivery is contradicted by primary runtime/Git evidence. It does not justify a control-plane rewrite: the failure is concentrated in two repairable upstream invariants—contract sufficiency/delivery authority and live Forecast Trust lineage.

Implement no architecture expansion until those two repairs are implemented and falsified in the smallest isolated trial. If they pass, operate three real Macro objectives. If they fail, the failure class—not another feature—becomes the next engineering target.

## Evidence index

Primary current-state evidence:

- .ai-company/mission/AI_COMPANY_MARATHON_STATE.json
- .ai-company/CURRENT_CYCLE.md
- .ai-company/REVIEW_LATEST.md
- .ai-company/product-intelligence/CANONICAL_PRODUCT_BACKLOG.json
- .ai-company/product-intelligence/QUALIFIED_WORK_INVENTORY.json
- .ai-company/reports/product-cycles/CYCLE_codex-product-cycle-1790159575213_EVALUATION.json
- .ai-company/reports/role-output-CYCLE-1790159575213-pm.md
- .ai-company/AI_COMPANY_OVERNIGHT_PRODUCT_OPERATION_REPORT.md

Forecast Trust and data path:

- src/app/data/forecastTrust.ts
- src/app/data/forecastTrust.test.ts
- src/app/pages/ForecastCenterPage.tsx
- src/app/pages/ForecastCenterPage.test.tsx
- server/forecastTrust.ts
- server/batchForecastEvaluation.ts
- server/batchForecastEvaluation.test.ts
- server/db.ts:listForecastAccuracy
- server/supabase.ts:supabaseForecastAccuracy
- server/index.ts:/api/forecast-accuracy
- src/app/services/platformApi.ts:fetchForecastAccuracy

Execution contract path:

- server/aiCompany/executionPlanner.ts
- server/aiCompany/executionPlanner.test.ts
- server/aiCompany/assignmentEnvelope.ts
- server/aiCompany/roleWorkQueue.ts
- scripts/create-codex-product-cycle.mjs

Historical/adversarial leads:

- .ai-company/reports/ANTI_CONVERGENCE_ZERO_TRUST_FORENSIC_AUDIT.md
- .ai-company/reports/marathon/AI_COMPANY_MARATHON_CYCLES_0051_0060.md
- .ai-company/reports/PRODUCT_DELTA_LEDGER.json
- .ai-company/historical_counterexamples.jsonl

## Completion confirmation

- The supplied mission brief was read in full.
- Current source, Git, runtime state, backlog, cycle artifacts, Forecast Trust code/API paths, and tests were inspected.
- Prior reports were challenged rather than accepted.
- No implementation, repair, architecture rewrite, database mutation, runtime cycle, build, test, deployment, commit, migration, or status mutation was performed.
- This file is the only intentional write from this mission.

