# AI Company Operating System — Evidence Scorecard

**Assessment date:** 2026-09-08
**Status:** local-first, not production-certified (PRODUCTION_NO_GO)

This score is for the AI Company platform itself. It is deliberately separate
from the Macro OS product score in `SCORECARD.md`.

## Current score: 72 / 100

| Dimension | Weight | Score | Evidence / gap |
|---|---:|---:|---|
| Governance and decision rights | 15 | 13 | Constitution, RACI, policy engine and decision ledger exist; independent external audit not yet performed |
| Durable orchestration and recovery | 20 | 14 | State machine, checkpoints, idempotency, bounded retry, stale-lock recovery, CEO recovery coordinator with 12 failure classes; remote durable store and crash drill on production absent |
| Independent quality and user/domain review | 15 | 12 | QA/UX/domain council, structured output validation, and release gate exist; live user outcomes are not measured |
| Evidence, provenance and auditability | 15 | 14 | Ledgers, artifact schemas, persisted audits, separate actual/estimated telemetry, and a strict portable synthetic audit with zero production-path matches |
| Security and permission isolation | 15 | 12 | Policy boundary, project-scoped stores/flags, secret audit, semantic assignment admission with scope checks; deployment threat model and external pen-test absent |
| Cost/token and operational excellence | 10 | 5 | Usage ledger, L0/L1/L2 context manifest budgeting, bounded local-provider execution; real provider cost telemetry and sustained SLOs absent |
| Product/release readiness | 10 | 2 | Local build/regression is strong; production preflight is correctly `NO-GO` |
| **Total** | **100** | **72** | **Control-plane local hardening completed; production capability unproven** |

## What would reach 85+

- two consecutive preflights with durable persistence and attested runtime;
- real-data vertical slices replacing all production synthetic paths;
- verified backup/restore and crash/restart drills;
- independent security and quality audit;
- measured user task success and cost per validated outcome over multiple sprints.

## What would reach 95+

In addition to 85+ requirements: multi-project isolation in a deployed
environment, provider rights evidence for every source, sustained SLOs, chaos
testing, model/prompt regression benchmarks, and an external board-level audit.

Passing local tests does not increase this score unless the corresponding
production evidence is recorded.
