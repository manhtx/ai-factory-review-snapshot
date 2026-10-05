# State coverage and objective preservation investigation

## Problem and cause

Direct read-only reproduction found that `effectiveLineageState` returns a
truthy `effective_state` without runtime validation. An unknown supplied value
then matches neither active nor unknown sets and yields `ELIGIBLE`.
`selectAutonomousNextAction` handles READY and selected BLOCKED rows but allows
unknown, CLAIMED, IN_REVIEW and QUARANTINED rows to reach the empty-work fallback.
The issue is incomplete runtime state classification, not missing enum types.

## Impact and reachability

This violates mission I1, I4 and I14 and the canonical vocabulary requirement.
The product-cycle creator overwrites effective_state with ACTIVE_BLOCKED or
undefined, so the direct unknown-effective-state reproduction does **not** prove
that caller admits such state. Preserve this distinction.

The continuation script consumes the selector at line 106, records reconciliation
PASS, and proceeds into discovery. The coordinator also uses it in its result
projection. Their invocation in the currently running service is not attested.
The coordinator's `rows.every(DONE)` additionally accepts an empty selection;
the probe includes an in-memory missing-run fixture to measure that behavior.

Observed result: the empty run returns SUCCESS with zero completed work, zero
role runs and zero executor calls. Exact source hashes and all fixture outputs
are preserved in `evidence/legacy-state-counterexamples.json`.

## Proposed permanent solution

In the successor, define one runtime-validated state vocabulary and total
classification. Unknown state must request reconciliation/degraded handling;
running work must retain ownership/completion wake semantics; quarantined work
must retain explicit disposition rather than disappear. Objective satisfaction
requires an existing objective and admitted outcome evidence, not an empty or
all-DONE queue projection. Preserve dependency gates, review contracts, bounded
retry, quarantine visibility and objective fairness.

This is preferred to adding isolated string checks to every legacy projection.
The single G1 foundational mutation remains unpromoted; this investigation does
not authorize parallel live rewrites or claim a completed successor design.

## Risk and verification plan

Changing selector return types affects continuation, coordinator, audit and
canary consumers. A caller may ignore new states or assume a wait is terminal.
Require table-driven coverage of every legal state and unknown values, mixed
state precedence, empty/missing-run distinction, namespace isolation, durable
objective retention, typed wake conditions and restart reconstruction. Verify
actual callers as well as pure reducers. Do not infer runtime proof from tests.

Reproduce with `node --import tsx
docs/successor-takeover/tools/legacy-state-probe.mjs` from the repository root.
The probe only loads modules and supplies in-memory fixtures; it neither opens
canonical state nor invokes a provider. Preserve source hashes with its output.
