# Successor takeover — initial engineering decision

## Goal alignment

Product authority: `docs/PRODUCT_GOAL.md`, especially sections 6, 9–11,
16–18 and 23. The research question is whether a user can inspect trustworthy
evidence, distinguish uncertainty, and resume a macro investigation without
fabricated current data or unsupported company delivery claims.

## Requirement and immutable contract

Execute the full `FOUNDER_MISSION.md`, mission
`AI_COMPANY_FINAL_SUCCESSOR_TAKEOVER`. No phase or closure class is waived.
Contract identity: SHA-256 of UTF-8 text with trailing whitespace removed:
`b9892948a34a9f97b88337b5f4d1dd5f63d846898de5db4f883057669085f2ad`.
This identity matches the user attachment; only the terminal newline differs.
The full contract retains I1–I20, reserved authority, all closure requirements,
the three closure classes and bootstrap retirement. This document is a plan,
not canonical operating state or a closure certificate.

## Instruction audit

- KEEP: repository AGENTS.md, Product Goal, evidence and security constraints,
  documentation before implementation, focused changes, verification.
- KEEP: `.ai-company/AI_COMPANY_CONSTITUTION.md`: separation of duties,
  fail-closed authority and versioned policy decisions.
- SUPERSEDE for this mission: routine per-step approval/continue loops under
  the Engineering Constitution's planning rules, using the later explicit
  standing local authorization in Founder Mission sections 4 and 6.
  Plans remain required; product direction and reserved authority remain gated.
- HISTORICAL_ONLY: earlier report-only/zero-change audit mandates and success
  narratives. Research artifacts identify experiments; they do not prove the
  present checkout or authorize promotion.
- REAL_CONFLICT: none established for read-only investigation, isolated
  experiments or mission documentation. Independent verification remains
  required before foundational promotion.

## Technical design and sequence

1. Capture F0 identity, existing dirty application files and required state;
   measure backup size and verify recovery before material state mutation.
2. Census entrypoints, writers, canonical readers, services and stores;
   classify capability, reachability, state vocabulary and subsystem disposition.
3. Replay historical counterexamples in temporary namespaces. Inspect actual
   candidate packages before reuse. Freeze target direction from these results.
4. Implement one foundational causal change at a time in isolated state;
   replay failures, adversarial cases and affected downstream consumers.
5. Follow phases B–H of the full contract: product truth, independent trust
   genesis, rehearsed migration, fenced handoff, structural and temporal proof,
   governed improvement and prompt retirement.

Affected modules include `server/aiCompany`, company callers in `scripts`
and `server/index.ts`, company ledgers, runtime supervision and product/data
adapters identified by the census. Exact implementation impact cones remain
pending reproduction. No whole-system rewrite decision has been made.

## Risks and guardrails

Existing tracked/untracked work must be preserved. Main checkout is not an
attested execution revision. A listening process is not readiness evidence.
Company governance history and product data have distinct trust semantics.
Candidate experiments use temporary state and no provider or external writes.
No public release, purchases, external communication, credential changes or
irreversible third-party action is authorized. Backups containing private state
stay local. Do not expose secret values in reports.

## Validation

Verify mission fingerprint; capture bounded source and process evidence;
reproduce original failures with current modules and isolated state; verify
backup restore before migration; maintain proof dependencies by execution
revision. Test legal/illegal transitions, malformed state, stale/duplicate
writers, concurrent claims, restart and recovery. Product closure separately
requires source-to-consumer identity/freshness/provenance checks. Final closure
requires every requirement in Founder Mission sections 55–57, not test count.

## Decision

Status: initial takeover investigation authorized by standing Founder directive.
Date: 2026-09-30. Architecture/promotion decisions are not yet made.
All three closure classes remain UNPROVEN. TRUST_EPOCH_1 does not yet exist.
