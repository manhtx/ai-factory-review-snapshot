# Wait-state contract investigation

## Problem and evidence

`tools/wait-state-probe.mjs` reproduces these behaviors against the current
legacy `WaitWakeLedger` using a temporary directory only:

- FUTURE_WAKE is persisted and becomes due for the founder-approved event via
  an implicit final branch, despite not being MANUAL_APPROVAL.
- FUTURE_STATE is persisted and selected by its matching EVENT.
- A TIMER with `earliest_time: not-a-date` is persisted but is not due even at
  2099-01-01. There is no validation error or explicit invalid disposition.

Exact outputs and source hash: `evidence/wait-state-counterexamples.json`.
Temporary probe state was removed after output capture; canonical state was
not accessed. This is not evidence of a live approval or external effect.

## Cause and impact

Type declarations are used as if they validated durable JSON. `wait` and
`records` admit unchecked values, while `due` uses a nested conditional whose
default branch means manual approval. Invalid dates compare false and silently
remain pending. This affects mission I8, I9 and I14 and the typed-wait requirement.
Direct callers include runtime.ts due/resume and continuity-kernel resumeDue.
The candidate kernel already propagates errors, but the unchecked ledger does
not raise one for these cases. Runtime reachability remains unverified.

## Permanent solution and impact cone

Use explicit runtime waiting-state and wake-type vocabularies; validate both
input and serialized records before append/reduction. Use exhaustive wake
classification with no implicit default event. Enforce real UTC timer dates,
nonempty identities and wake/action contracts, and reject invalid deadlines.
Preserve invalid historical bytes for adjudication rather than silently
rewriting or discarding them. Event authorization remains a separate runtime
boundary; enum validation cannot authenticate an approval.

Affected modules: waitWake.ts, runtime due/resume consumers, continuity kernel,
continuation wait construction, and wait tests. Preserve existing legitimate
timer, event, provider and manual waiting capabilities. No product policy
change is required: Product Goal sections 10 and 16 require visible uncertainty
and continuity. Do not invent timeout business policy where none is declared.

## Validation and risks

Replay all three fixtures; cover each legal state/wake combination, unknown
enums, malformed historical rows, invalid and normalized dates, duplicate
resume, restart reconstruction and failures propagated by actual callers.
Define timer/deadline semantics before changing them; existing null deadline
waits cannot be silently deleted or auto-resumed. Concurrency, authenticated
wakes and bounded recovery require additional transactional integration.

Status: REPRODUCED_NOT_IMPLEMENTED. G1 and S1 remain unpromoted with incomplete
independent reviews. This document does not authorize global closure or label
the storage/authority problem solved.

## Isolated implementation decision

Proceed under mission standing local authority as the active wait-validation
package; G1 and S1 are frozen. Validate serialized bytes before append and every
historical row before reduction. Require explicit UTC dates (seconds or three
fractional digits); reject invalid calendar dates. TIMER requires earliest_time;
other types retain nullable earliest_time and existing event matching semantics.
All deadlines remain optional; when supplied they must be valid and not precede
earliest_time. Deadline expiry action remains an open successor policy obligation,
not an invented automatic resume. Validate resume timestamps and query clocks.
Do not enforce resumed_at >= created_at yet: legacy tests use historical replay
timestamps. No file rewrite/migration or authenticated-wake claim.
