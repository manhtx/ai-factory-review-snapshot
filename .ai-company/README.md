# AI Company Platform

## Start here

1. Read `PRODUCT_GOAL_MASTER.md` for the AI Company North Star.
2. Read `MASTER_BUILD_PLAN.md` for the implementation specification.
3. Read `AI_COMPANY_CONSTITUTION.md` and `AGENT_REGISTRY.md`.
4. Read `AI_COMPANY_RUNBOOK.md` for operating procedures.
5. Run `npm run ai-company:gate` before changing runtime or enabling production.
6. Run `npm run ai-company:manifest` when preparing a clean-room migration.
7. Treat `../docs/PRODUCT_GOAL.md` as the managed Macro OS product source of
   truth; AI Company documents govern the company operating layer and must not
   silently replace the product goal.

## Canonical goal documents

- `PRODUCT_GOAL_MASTER.md` — AI Company system North Star and operating
  principles.
- `MASTER_BUILD_PLAN.md` — 200-point local-first build specification.
- `GOAL_2.md` — Macro OS Objective 2 execution contract (G20 and ASEAN-6
  coverage), derived from `../.ai-company/ANNUAL_PLAN.md` and
  `../docs/PRODUCT_GOAL.md`.
- `AI_COMPANY_OPERATING_UPDATE_2026-09-04.md` — latest evidence-based
  operating assessment and required updates.
- `AI_COMPANY_WEAKNESS_RESEARCH_2026-09-08.md` — detailed weakness register,
  evidence, risks, acceptance criteria and remediation sequence.

## Current maturity

The platform is locally verified with durable state, bounded orchestration,
independent evaluation, project-scoped ledgers, Telegram controls and release
gates. It is not yet production-certified: live provider/Telegram integration,
clean-room package migration, chaos recovery and independent security audit are
still required.
