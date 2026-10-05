# System Improvement Ledger

> Tracks every material internal AI Company change and its validation status.
> A change is KEEP only after real product cycles support it.

---

## SI-001 — Bounded Context Policy (PM/Backend/QA)

| Field | Value |
|---|---|
| **Improvement ID** | SI-001 |
| **Source Cycles** | codex-product-cycle-1789490934832, codex-product-cycle-1789491596310 |
| **Observed Problem** | Token usage 32.51x actual vs estimated (PM: 184k input, Backend: 288k input; 4–6 tool calls) |
| **Evidence** | Measured in two consecutive cycles |
| **Frequency** | Every product cycle observed |
| **Severity** | P2 — resource efficiency; costs |
| **Product Impact** | Higher cost per cycle; slower iteration |
| **Founder Impact** | None directly |
| **Resource Impact** | ~30x overrun on provider tokens |
| **Root Cause** | Assignment inputs too wide; master context re-reads prohibited but still occurring via tool calls; no turn cap |
| **Change Needed** | Cap assignment inputs; prohibit master/historical re-reads; cap inspections at 4 turns; ban full-file/tool-output dumps |
| **Complexity Delta** | +14 contract tests |
| **Technical Validation** | Syntax/typecheck pass; 14 related tests pass |
| **Real Cycle Validation** | `Cycle-1789491596310: 448k actual vs 15k estimated (29.75x) — small reduction, not solved. Luna control: 122k PM input, then structured-output failure` |
| **Status** | `PROVISIONAL` |
| **Rollback Trigger** | If token usage increases further or if PM governance quality degrades |

---

## SI-002 — Balanced JSON Parser (Structured-Output)

| Field | Value |
|---|---|
| **Improvement ID** | SI-002 |
| **Source Cycles** | codex-product-cycle-1789491854943 (Luna failure) |
| **Observed Problem** | Dispatcher rejected valid provider output because structured-marker extraction failed on nested/pretty-printed JSON |
| **Evidence** | Luna model returned valid JSON but coordinator blocked cycle before Backend/QA |
| **Frequency** | Observed once (smaller model path) |
| **Severity** | P1 — blocks lightweight-model routes |
| **Product Impact** | Cannot use cheaper models without frontier-model fallback |
| **Founder Impact** | undefined |
| **Resource Impact** | undefined |
| **Root Cause** | Regex extraction assumed flat JSON; pretty-printed/nested output from smaller models failed the extractor |
| **Change Needed** | Parse balanced nested JSON objects; still require strict schema validation afterward |
| **Complexity Delta** | +5 structured-output tests (total 19 governance/structured-output tests) |
| **Technical Validation** | 19 tests pass; typecheck green |
| **Real Cycle Validation** | `Luna recheck 1789492190609: PM PASS, Backend PASS, QA PASS; 22/22 targeted tests; ZERO_MUTATION_UNVERIFIED; 405k actual tokens (30.82x) — completion improved, not efficiency` |
| **Status** | `PROVISIONAL` |
| **Rollback Trigger** | If valid frontier responses are rejected after this change |

---

## SI-003 — Empty-Queue Closed-Loop Discovery

| Field | Value |
|---|---|
| **Improvement ID** | SI-003 |
| **Source Cycles** | Epoch 407 (observed: empty queue → misclassified as waiting/blocking) |
| **Observed Problem** | When no executable work existed, the runtime inspected only the execution queue. Freshness evidence couldn't reach PM inbox. Empty queue misclassified as HARD_BLOCKED. |
| **Evidence** | EMPTY_QUEUE_CLOSED_LOOP_DESIGN_2026-09-16.md |
| **Frequency** | Systematic — occurred whenever queue depleted |
| **Severity** | P1 — company appeared hard-blocked when product evidence existed |
| **Product Impact** | Product opportunities (freshness degradation) not visible to PM |
| **Founder Impact** | undefined |
| **Resource Impact** | undefined |
| **Root Cause** | Next-action selector checked only execution queue; telemetry discovery was optional and missed freshness evidence |
| **Change Needed** | When no executable work: (1) check unresolved telemetry opportunity, (2) check freshness audit for delayed/outdated/unhydrated, (3) explicit wait. Freshness creates one deduplicated PM inbox candidate. Does not bypass PM gate. |
| **Complexity Delta** | Modified next-action selector logic; no new agents |
| **Technical Validation** | Design verified; implementation in progress |
| **Real Cycle Validation** | `PROVISIONAL — needs a cycle where freshness candidate flows through PM gate to authorized backlog item` |
| **Status** | `PROVISIONAL` |
| **Rollback Trigger** | If PM inbox is flooded with synthetic candidates, or if freshness evidence creates false priority signals |

---

## SI-004 — AWAITING_SCHEDULE Idle State (Coordinator)

| Field | Value |
|---|---|
| **Improvement ID** | SI-004 |
| **Source Cycles** | Epoch 407 |
| **Observed Problem** | Repeated coordinator invocations with empty dispatch set appended duplicate AWAITING_SCHEDULE rows to wait-wake.jsonl |
| **Evidence** | EMPTY_QUEUE_CLOSED_LOOP_DESIGN_2026-09-16.md (standalone coordinator idle state section) |
| **Frequency** | Every empty-queue coordinator invocation |
| **Severity** | P2 — pollutes wait ledger; not a product blocker |
| **Product Impact** | undefined |
| **Founder Impact** | undefined |
| **Resource Impact** | undefined |
| **Root Cause** | Coordinator did not check for existing active wait before appending |
| **Change Needed** | One-shot coordinator now checks for active AWAITING_SCHEDULE row; reuses it; does not append duplicate |
| **Complexity Delta** | Minimal — idempotency check in coordinator |
| **Technical Validation** | Single wait row observed after change |
| **Real Cycle Validation** | `PROVISIONAL — needs multiple empty-queue cycles to confirm deduplication holds` |
| **Status** | `PROVISIONAL` |
| **Rollback Trigger** | If wait rows stop being created (silently blocking continuation) |

---

## SI-005 — Architecture Trial Evaluator Hardening

| Field | Value |
|---|---|
| **Improvement ID** | SI-005 |
| **Source Cycles** | Architecture trial epochs 2026-09-15 to 2026-09-16 |
| **Observed Problem** | Comparator could accept arms with only engineering/process quality; no product/domain outcome required |
| **Evidence** | Multiple INVALID trials correctly rejected; discriminates_known_anchors: true calibration pass |
| **Frequency** | Per architecture trial |
| **Severity** | P0 (potential false-positive architecture selection without evidence) |
| **Product Impact** | undefined |
| **Founder Impact** | undefined |
| **Resource Impact** | undefined |
| **Root Cause** | Missing schema fields for domain_correctness and product_quality_evidence_ids |
| **Change Needed** | Require non-empty domain_correctness and product_quality_evidence_ids per arm; score without evidence refs = invalid; 9/9 architecture tests pass |
| **Complexity Delta** | +9 architecture trial tests |
| **Technical Validation** | 9/9 tests pass; calibration inline |
| **Real Cycle Validation** | `PROVISIONAL — needs a trial with actual product/domain artifacts to confirm positive selection works` |
| **Status** | `PROVISIONAL` |
| **Rollback Trigger** | If valid architecture trials are rejected due to false domain_correctness schema constraint |

---

## SI-006 — Runaway Cycle Spawn Defect (P1)

| Field | Value |
|---|---|
| **Improvement ID** | SI-006 |
| **Source Cycles** | Observed during CYCLE-001 RECONCILE (2026-09-16T09:58–11:09Z) |
| **Observed Problem** | Loop spawned 32 new product cycles every ~135s when PM was BLOCKED, instead of waiting for PM resolution. Total: 32 zombie cycles, 64 READY downstream items with no authorized PM work. |
| **Evidence** | Queue analysis: CYCLE-1789556632692 through CYCLE-1789556992078; all pm=BLOCKED, be+qa=READY; created over 72-minute window at ~135s/cycle |
| **Frequency** | Single sustained incident (2026-09-16T09:58–11:09Z) |
| **Severity** | P1 — duplicate unauthorized work items; resource waste; queue pollution |
| **Product Impact** | No product work was authorized or executed by any zombie cycle (PM BLOCKED = no authorization). However, queue grew to 80 READY items; actual authorized work was invisible. |
| **Founder Impact** | None directly — no incorrect product changes |
| **Resource Impact** | 32 cycle creation calls wasted |
| **Root Cause** | When PM execution fails with BLOCKED status, the loop continued creating new cycles with the same objective instead of waiting for PM resolution. No max-attempts-per-objective guard existed. |
| **Change Needed** | Add objective-level deduplication: if an active PM review for a backlog_id already exists (state READY, CLAIMED, IN_REVIEW, or BLOCKED), do not spawn another cycle for the same objective until the existing one resolves |
| **Complexity Delta** | Small — one guard in cycle-creation path and unit test in scripts/create-codex-product-cycle.test.mjs |
| **Technical Validation** | Guard implemented in scripts/create-codex-product-cycle.mjs and tested via scripts/create-codex-product-cycle.test.mjs; quarantine of 76 zombie READY items completed 2026-09-16T18:22Z |
| **Real Cycle Validation** | `PROVISIONAL — needs future cycle to confirm no duplicate spawn occurs when PM is blocked` |
| **Status** | `IMPLEMENTED_UNVALIDATED` |
| **Rollback Trigger** | If the guard prevents legitimate re-attempt of a previously-blocked cycle |

> **Action taken during RECONCILE: 64 READY items from zombie cycles quarantined (reason: RUNAWAY_SPAWN_DEFECT). 12 additional READY items from duplicate-spawn cycles quarantined (reason: PM_BLOCKED_DOWNSTREAM_READY). Total: 76 items quarantined. Remaining legitimate READY: 3 items across 1 cycle (Cycle 17).**

---

## Summary

| ID | Change | Status |
|---|---|---|
| SI-001 | Bounded context policy | `PROVISIONAL` — needs measured token reduction |
| SI-002 | Balanced JSON parser | `PROVISIONAL` — completion improved; efficiency not |
| SI-003 | Empty-queue discovery | `PROVISIONAL` — needs PM-authorized candidate flow |
| SI-004 | AWAITING_SCHEDULE dedup | `PROVISIONAL` — needs multi-cycle confirmation |
| SI-005 | Architecture evaluator hardening | `PROVISIONAL` — needs positive-selection validation |
| SI-006 | Runaway cycle spawn defect guard | `IMPLEMENTED_UNVALIDATED` — guard active in scripts/create-codex-product-cycle.mjs, tested; pending real-cycle proof |

**All improvements are non-final (PROVISIONAL or IMPLEMENTED_UNVALIDATED).** None has sufficient multi-cycle operational evidence for KEEP verdict. 0 improvements currently at KEEP/REVISE/REVERT status.

---

## Updated At

2026-09-30T02:49:55.439Z
