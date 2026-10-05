# AI Company Runtime Runbook

## Startup

1. Set `NODE_ENV=production` only with `AI_COMPANY_REQUIRE_RELEASE_GATE=true`.
2. If Telegram is enabled, configure bot token, allowlisted user ID, chat ID and webhook secret.
3. Run `npm run typecheck`, `npx vitest run server/aiCompany` and `npm run ai-company:validate`.
4. Refuse deployment if any command fails or if the production gate has unresolved blockers.

## Normal operation

- Workers communicate through durable artifacts and events, not transcript state.
- CEO briefs run daily/weekly when Telegram is explicitly enabled.
- P0 decisions stop by default; P1 stays within CEO guardrails; P2/P3 continue and report.
- Risk-adaptive routing is mandatory: eligible P2 work may use the lean PM → engineering → Functional QA route; P0/P1, security, migration, production-operation, or any task whose envelope requires QC/CEO must use the full guild. Lean routing never removes evidence, typed-output or independent-QA requirements.
- Quarantined agents are not dispatched until an evaluation trend recommends release.

## Incident response

1. Pause the affected project through the authenticated control plane.
2. Inspect `events.jsonl`, `usage.jsonl`, `decisions.jsonl`, `evaluations.jsonl` and delivery dead letters.
3. Do not delete evidence. Create an incident artifact and checkpoint the last known safe cursor.
4. Roll back only with a valid, unexpired decision and independent verification.
5. Resume only after the production gate returns `ready=true`.

## Macro OS regression and improvement trial

Run the bounded local harness before changing agent principles or promoting a
workflow:

```bash
npx vitest run server/aiCompany/trialEvaluation.test.ts server/aiCompany/macroOsTrial.test.ts
```

The A/B harness compares an independent baseline against an explicitly injected
intervention behavior. Its result is evidence of harness behavior only; it is
not proof of live model quality. Promote a principle only when the delta is
non-regressive across failure, evidence, rework, cost and user-task success,
with at least one strict improvement. Otherwise retain the prior version and
record a rollback/hold decision.

Run `npm run audit:real-data` for the data-plane audit. Each run writes a
timestamped JSON artifact under `.ai-company/reports/`, including blocked runs.
CI may set `AUDIT_ARTIFACT_DIR` to an isolated directory and must preserve the
artifact as a build output.

This runbook is operational guidance, not proof that external provider, Telegram or disaster-recovery infrastructure has been tested in production.
## Local role-company execution

The AI Company is an operator workflow on the checkout, not a product UI. The
planner creates role work and durable handoffs; `ai-company:run-ready` is the
coordinator that dispatches only handoff-backed, dependency-ready work to one
bounded Codex worker at a time or in a configured wave. This installation has
Codex-only execution enabled; other runners are rejected before invocation.

```sh
npm run ai-company:role -- --project-id macro-os --role pm --work-id <WORK_ID> --runner codex --model gpt-5.6-sol
npm run ai-company:run-ready -- --runner codex --model gpt-5.6-sol --max-concurrent 2
```

For a governed product-improvement cycle, enable the evidence gate explicitly:

```sh
AI_COMPANY_REQUIRE_VERIFIED_CYCLE_VALUE=true
```

The Codex product-cycle harness supports the bounded P2 route with:

```sh
AI_COMPANY_PRODUCT_CYCLE=true \
AI_COMPANY_PRODUCT_CYCLE_LEAN=true \
node --import tsx scripts/create-codex-product-cycle.mjs
```

Use the lean flag only for a P2 assignment. It is an efficiency policy, not a
release policy; production autonomy remains disabled and release remains
human-gated.

With this gate enabled, a cycle is not successful merely because agents or
tests completed. It must record either a target-reaching product improvement
or an evidence-backed learning; otherwise the cycle is persisted as `FAILED`
and its scheduler checkpoint does not advance.

Every worker must return durable evidence and, for research roles, a structured
`ROLE_RESEARCH_RESULT_JSON` record. The dispatcher owns queue transitions and
dispatch evidence. Epoch governance (`company-state.json` and
`epoch-ledger.jsonl`) is owned by the coordinator/governance roles; ordinary
workers must not edit it. A missing handoff, incomplete dependency, invalid
research result, or absent evidence blocks the work item instead of allowing a
claim to pass.

If a Codex process exits non-zero, the dispatcher may attempt terminal recovery
only when the role has already emitted its required typed marker(s). The normal
artifact, evidence, schema and review guards still run; missing markers remain
an immediate block. The original exit code stays in provider telemetry. This is
not an approval or release bypass.

## Engineering workspace isolation

The worktree manager owns task workspaces under `.ai-company/worktrees/` and
records lifecycle state under the project runtime. It refuses dirty cleanup,
does not delete unknown/orphaned worktrees, and returns a diff for independent
review. Use `WorktreeManager.create(taskId)` before engineering execution.

For enforcement mode, provide the isolated path and enable the guard:

```sh
AI_COMPANY_REQUIRE_WORKTREE=true \
npm run ai-company:role -- --role coder --work-id <WORK_ID> \
  --runner codex --model gpt-5.6-sol --workspace <ISOLATED_WORKTREE>
```

The control-plane checkout remains separate; merge is a human/release-gate
decision after tests, QA and review. `run-ready` now creates/reuses the
worktree automatically. Codex engineering workers default to the native
`workspace-write` sandbox and receive no control-plane write directory.
When a downstream role depends on an engineering role, `run-ready` overlays the
dependency's product diff into the downstream worktree before dispatch. The
overlay excludes `.ai-company` state and harness files and fails closed if any
propagated path is outside the downstream assignment's `allowed_paths`. This
keeps artifact handoff and executable source handoff distinct and prevents QA
from validating a stale snapshot or an out-of-scope change.

Each project/run coordinator holds an atomic PID lock under the project runtime;
a live duplicate coordinator is rejected and an owner whose PID is no longer
alive may be recovered as stale. Durable role artifacts are limited to 16 KB by
default (`AI_COMPANY_MAX_ROLE_ARTIFACT_BYTES`); raw provider logs remain
separate for audit and are not treated as downstream context.
Codex receives the isolated workspace boundary and is the only enabled worker
runner for this installation. Provider changes require a separately reviewed
implementation and must not be enabled by environment-variable drift.
