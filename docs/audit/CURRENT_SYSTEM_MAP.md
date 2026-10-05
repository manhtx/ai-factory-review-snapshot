# AI Company — Current System Map

Updated: 2026-09-08. This map describes the implementation found in the repository, not the aspirational master plan.

## Runtime topology

```text
Founder / CLI
  -> scripts/ai-company-loop.sh or ai-company-run-ready.mjs
  -> RoleWorkQueue + RoleHandoffLedger
  -> ai-company-role-dispatch.mjs
  -> role contract + prompt/context assembly
  -> Codex CLI or OpenAI-compatible adapter (local Ollama-compatible endpoint)
  -> role log + RoleEvidenceLedger + dispatch evidence
  -> dependency gate / next wave
  -> CEO Guild decision ledger / release gates
  -> product cycle, outcome, usage and research ledgers
```

## Component map

| Component | Implementation | State / persistence | Failure behavior | Reality |
|---|---|---|---|---|
| Product authority | `docs/PRODUCT_GOAL.md`, `.ai-company/PRODUCT_GOAL_MASTER.md` | tracked Markdown | scope guardrails and manual review | REAL |
| Company state | `.ai-company/company-state.json`, schemas, `stateStore.ts` | JSON + tests | validation/fail closed | REAL |
| Backlog | `.ai-company/backlogs/*.json`, `backlogLedger.ts`, priority/planner modules | JSON/ledgers | evidence/priority checks | PARTIAL |
| Work queue | `roleWorkQueue.ts`, runtime `role-work-queue.jsonl` | append-only JSONL | dependency-aware READY/DONE/BLOCKED | REAL |
| Handoffs | `roleHandoffLedger.ts`, `role-handoffs.jsonl` | append-only JSONL | rejects unknown roles / bad direction | REAL |
| Dispatch | `scripts/ai-company-role-dispatch.mjs` | role logs + dispatch ledger | marker, evidence and mutation checks | PARTIAL |
| Scheduler | `productCycleScheduler.ts`, `briefScheduler.ts`, loop scripts | state adapters | dedupe and cadence gates | PARTIAL |
| Provider abstraction | `modelAdapter.ts`, `openaiCompatibleRoleAdapter.ts`, provider ledgers | provider attempts/usage | retries/circuit evidence | PARTIAL |
| Local Codex execution | Codex CLI through `run-ready` | role logs | CLI exit and control-plane guard | REAL, bounded |
| Local AI/Ollama | OpenAI-compatible HTTP adapter | provider attempts | fail closed when unavailable | PARTIAL |
| Tool gateway | `toolGateway.ts`, `macSandbox.ts` | runtime evidence | allowlist and sandbox tests | PARTIAL |
| Worktree isolation | `worktreeManager.ts` | filesystem/worktree metadata | refuses unsafe cleanup | PARTIAL |
| QA/QC | role contracts + dispatch markers + tests | role logs/evidence | independent verdicts | PARTIAL |
| CEO Guild | `ceoGuildDecision.ts`, decision ledger | JSONL decision records | HOLD / dissent / no self-approval | PARTIAL |
| Product outcomes | `outcomeLedger.ts`, cycle attempt ledger, value evaluator | JSONL | tracks learning candidates | PARTIAL |
| Memory | research signal, user insight and outcome ledgers | JSONL | bounded persistence | PARTIAL; retrieval/use is weak |
| Product reality | Macro OS APIs, ingestion, telemetry, provider health | app DB/telemetry | fail closed for missing evidence | PARTIAL; no complete company bridge |
| Release | pre-release, production and rollback gates | ledgers | blocks unsupported release | REAL for gates, not end-to-end autonomy |
| Observability | role logs, provider attempts, usage ledger, telemetry routes | JSONL/read models | logs can be oversized and noisy | PARTIAL |

## Actual end-to-end capability

The implemented reliable path is **bounded local role dispatch with durable queue, handoff, evidence and CEO safety review**. The full aspirational path — real product signal → autonomous discovery → evidence-backed decision → isolated implementation → staged release → product metric → memory changing a future decision — is not yet proven. The missing proof is concentrated in product telemetry linkage, outcome evaluation, recovery, and provider-independent execution.

The repository contains no top-level `company/`, `agents/`, or `runtime/` architecture matching the master plan. The actual architecture is TypeScript server modules plus `.ai-company` ledgers and scripts. This is simpler than the plan and should be documented as the canonical current design rather than migrated mechanically to the planned folder tree.
