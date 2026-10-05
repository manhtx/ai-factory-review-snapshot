# AI Company — Post-Optimization System Map

Audit date: 2026-09-11. Independent, read-only forensic audit. Previous reports are claims; classifications below require repository or runtime evidence.

## Product anchor

The authoritative product direction is `docs/PRODUCT_GOAL.md`: Macro OS must provide real, traceable, freshness-aware macro research; no fabricated or unverified value may be presented as actual. Production autonomy remains `DISABLED`; production release remains `HUMAN-GATED`.

## Reality map

| Transition / capability | Implementation evidence | Classification | Limitation |
|---|---|---|---|
| Observe product state | health, freshness, real-data and telemetry modules | PARTIAL | no continuous production observation proof |
| Understand / interpret | PM structured output and research synthesis | TEST_ONLY / PARTIAL | no demonstrated product-signal-to-decision chain |
| Discover | `localDiscoveryWorker`, idea ledger, discovery attempts | INTEGRATED_NOT_PROVEN | no independent user/problem evidence producing a shipped decision |
| Decide | CEO review/guild ledgers and typed verdicts | PARTIAL | decisions are mostly cycle artifacts; value calibration absent |
| Prioritize | backlog planners, strategy ledger, cadence planners | PARTIAL | no replay showing learning changes later priority |
| Plan / assign | assignment envelope, queue, handoff ledger | REAL_RUNTIME_PROVEN | bounded local path proven by C13 artifacts and gates |
| Build / mutate | role dispatcher, worktrees, mutation policy | REAL_RUNTIME_PROVEN | limited to selected local cycles; broad product delivery not proven |
| Test / verify | Vitest, typecheck, targeted QA, review contracts | REAL_RUNTIME_PROVEN | deterministic verification dominates; semantic quality not proven |
| Review / recover | recovery coordinator and recovery proof artifacts | PARTIAL | recovery code/tests exist; repeated external failure recovery is not autonomous |
| Release | production preflight and release gates | REAL for gating | intentionally blocks production; no release execution proof |
| Measure product outcome | outcome and metric ledgers | INTEGRATED_NOT_PROVEN | no user adoption or durable production metric evidence |
| Learn / remember | outcome, research, user telemetry ledgers | PARTIAL | persistence exists, causal reuse is unproven |
| Repeat continuously | `CompanySupervisor` interval loop | PARTIAL | starts only after an external process calls `start()`; no durable wake/restart worker |

## Actual topology

```text
Founder / external CLI or process
  -> runtime.start() or cycle script
  -> ProductCycleScheduler / CompanySupervisor
  -> backlog + cadence planning
  -> readiness gate
  -> RoleWorkQueue + RoleHandoffLedger
  -> Codex role dispatcher / provider
  -> worktree + role artifact + evidence
  -> deterministic QA / CEO review / outcome ledgers
  -> local reports and gates
```

The topology is real and useful, but the arrow before `runtime.start()` is outside the autonomous company. No evidence demonstrates a durable scheduler that discovers unfinished work and resumes it after process termination without an external starter.

## Evidence boundaries

- C13 authoritative report: 3 completed cycles, 9 completed roles, 3 QA contracts, local contract-improvement outcome, production not ready.
- Transport report: 78 Codex transport logs, 433 reconnect events, 594 HTTP 503 events, 0 missing-marker events. This is strong evidence of provider instability, not a success metric.
- Operating audit: structural checks pass, while `production_ready=false`.
- Authoritative verification report is dated 2026-09-10 and records a dirty workspace at revision `775d600`; it is stale relative to current HEAD `2f2a1e1` and cannot certify the current tree.
- `FINAL_CHECKPOINT.md` is stale (C8, 2026-09-09) and must not be used as current status.

## Canonical architecture verdict

The implemented architecture is TypeScript server modules plus `.ai-company` ledgers/scripts, not the full folder tree imagined by the master plan. That simpler architecture is acceptable locally. The missing part is not more agents; it is continuity, product evidence, and causal outcome measurement.
