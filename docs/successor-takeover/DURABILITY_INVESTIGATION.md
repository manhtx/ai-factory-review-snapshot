# Durable operation boundary investigation

## Problem summary

Current source accepts contradictory operation creation, unsupported completion,
terminal revival and silently skipped malformed durable state. These violate
Founder Mission I3, I5–I7, I9 and I14 and threaten the Product Goal's evidence
and continuity requirements. Raw observations are in
`INITIAL_FAILURE_EVIDENCE.json`.

## Root cause and evidence

`DurableOperationLedger.createOperation` appends without create-if-absent
serialization or checking the existing semantic identity. Concurrent calls with
the same operation ID both fulfilled and the later conflicting semantics won.
`transition` serializes per operation but has no complete legal-transition
table. The isolated replay accepted SUBMITTED → DONE → RUNNING. Its optional
fencing is not sufficient to establish authority or evidence admission.
`getAll` catches JSON parse failures per line and omits the failed row; a
malformed trailing record returned one prior row without an integrity error.

These are current-source reproductions, not inferred from old reports.
Source SHA-256 is recorded with the observations. A single run of
`node_modules/.bin/vitest run server/aiCompany/durableOperation.test.ts
--maxWorkers=1 --minWorkers=1` passed all 20 tests on 2026-09-30 at 12:13 local.
The existing idempotent-DONE test calls DONE directly after creation, so its
acceptance oracle does not enforce evidence-before-truth. Passing this suite
cannot close these invariants. Correcting that oracle is a separate change
from candidate implementation and must be reviewed on the mission contract.

## Scope and reachability

Non-test symbol census found consumers in the continuity kernel, marathon,
final canary, founder-zero canary, crash-window and adversarial scripts.
The marathon directly transitions a newly created operation to RUNNING and
later DONE. The continuity kernel calls orphan reconciliation and catches
errors into `{ orphaned_count: 0, reconciled: [] }`, an additional source-level
observability concern requiring reproduction. Installed launchd configuration
runs that kernel. This establishes configured reachability; it does not prove
the current process has executed the failing paths.

## Proposed permanent solution

Decide the successor transaction boundary after the writer/reader census:
one canonical durable authority must serialize semantic creation and state
changes, enforce expected revision/fencing and legal state transitions, and
require admitted evidence at authoritative terminal commit. Malformed or
unknown durable state must surface an integrity failure and inhibit mutation.
Durable integrity, evidence admission and projections must share the same
authoritative outcome. Keep product observations separate from governance
trust epochs. Preserve historical rows as legacy evidence.

Do not tighten the current transition method piecemeal before tracing all
callers: current callers and tests rely on the permissive behavior. A coherent
transaction boundary is preferred because several independent methods now
read, derive and append truth without one atomic semantic contract.

## Prevention, risks and validation

Preserve these four cases as executable historical counterexamples. Add
unknown-state, concurrent-process, interrupted-commit, stale-writer and restart
cases with an independently specified oracle. Census direct file writers as
well as class callers. Reject bypasses and verify downstream error projections.
Risks include stranded legacy operations, incompatible caller transitions,
false completion during migration, lost updates and partial state recovery.
Rehearse migration on a copy and preserve rollback to exactly one authority.
The source archive was restored and byte-compared; live control-state capture
is only forensic observation, not a transactionally consistent migration backup.

## Decision

Failures reproduced; implementation decision pending completion of Phase A
authority/capability census. No repair or closure claim is made here.
