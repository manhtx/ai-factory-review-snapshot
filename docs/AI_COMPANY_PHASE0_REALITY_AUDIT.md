# AI Company OS — Phase 0 Reality Audit

**Date:** 2026-09-02  
**Scope:** `.ai-company/`, `.agents/`, controller scripts, and the current Macro OS project state  
**Authority:** `docs/PRODUCT_GOAL.md` and the AI Company implementation plan

## Executive finding

The repository contains a substantial governance/documentation scaffold, but it
does not yet prove that a durable, independently verified AI Company runtime
exists. Claims in state files are therefore treated as claims, not evidence.

## Evidence observed

| Area | Observation | Current assessment |
|---|---|---|
| Governance | `.agents/` contains constitutions and workflows for epochs, delivery, discovery, and reviews. | Documented scaffold exists. Runtime enforcement is unproven. |
| Company memory | `.ai-company/` contains state, ledgers, backlogs, reports, and epoch records. | Durable-looking artifacts exist; schema integrity and write ownership are not yet proven. |
| Runtime controller | `scripts/ai-company-loop.sh` invokes an external `agy` process and checks a completion marker. | External loop exists; it is not yet a durable orchestrator with event idempotency or checkpoint recovery. |
| Quota handling | The controller alternates between providers after quota-like failures and resets `consecutive_errors`. | Critical runaway risk; circuit breaker and bounded retry are required. |
| Failure volume | 1,322 files under `.ai-company/logs` match quota/error patterns during this audit. | Failure history is material and must be classified before further autonomous runs. |
| Maturity claim | `.ai-company/COMPANY_STATE.json` declares `Tier 1 — Master Verified`. | Not independently substantiated by the current evidence set; claim is downgraded to unverified. |
| Telegram | No verified Telegram control-plane implementation was found in the inspected tree. | Not implemented/proven. |

## Required corrections

1. Treat maturity as `UNVERIFIED` until an independent audit re-performs the
   scorecard from runtime evidence.
2. Stop quota failover loops after a bounded number of provider attempts.
3. Record provider, attempt, retry-after, budget, and circuit state for every
   invocation.
4. Add an explicit Phase 0 evidence-gap register before adding more agents.
5. Do not claim production readiness from build/test counts alone.

## Exit criteria for Phase 0

- A reproducible inventory exists for agents, workflows, state, ledgers, and
  external dependencies.
- The controller cannot retry indefinitely when all providers are exhausted.
- The company state distinguishes `claimed`, `implemented`, `locally_verified`,
  `production_verified`, and `released`.
- Every unresolved evidence gap has an owner, severity, and next verification.
- A clean baseline run is recorded after the safety fix.

## Phase 0 decision

**Status: `HOLD_AUTONOMOUS_EPOCHS`** until the controller circuit-breaker patch
and baseline artifacts are verified. This does not block local documentation or
deterministic tests; it blocks unbounded external agent execution.
