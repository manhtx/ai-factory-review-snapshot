# Feature Proposal — S1 total work-state classification

## Goal alignment

Product Goal sections 9–11 require unknown and unsupported claims to stay visible;
section 16 requires continuity. Research question: can unfinished or unknown
company work disappear into an apparent idle/success state while Macro OS work
still needs attention? The read-only counterexamples answer yes.

## Requirement

Preserve every recognized queue state in admission and next-action reporting.
Reject unknown persisted states before dispatch or projection. Do not report
an absent run as successful. Preserve existing role completion contracts.

## Technical design

- Add one runtime work-state vocabulary, shared by queue ingestion/summary,
  next-action selection and coordinator validation. Validate historical rows
  before latest-row reduction, so later valid rows cannot hide earlier damage.
- Runtime-check effective lineage overrides; unknown overrides map to
  UNKNOWN_LINEAGE and require reconciliation.
- Select only dependency-ready READY rows; retain active work with an explicit
  completion/ownership-change wake description and work IDs. Quarantine or
  unresolved dependencies require reconciliation; intentional PM blocks wait
  for explicit gate resolution rather than being erased as no work.
- Check unknown states before any dispatch priority. Keep ready unrelated work
  selectable among recognized states; do not invent objective fairness here.
- Reject empty scoped coordinator runs as FAILED, with no executor call.
- Continuation must reclassify after dispatch and cannot proceed into product
  discovery while an existing non-idle action is unresolved. Post-cycle JSON
  parse/shape failure must not default to clean idle. The audit uses the shared
  vocabulary for counts.

## Risks and guardrails

Scope: isolated candidate only; no canonical state changes, provider calls,
runtime restart or promotion. G1 is frozen awaiting independent verification;
S1 is the sole active implementation package. Affected modules: queue,
lineage, selector, coordinator, continuation and audit adapters plus tests.
Unknown historical states now stop reads visibly instead of being omitted.
Existing archived data is preserved; adjudication is separate from decoding.
New action kinds may expose callers with incomplete handling; test the direct
adapters. No full objective authority, authenticated ownership, evidence
admission, bounded autonomous recovery or all-state global closure is claimed.
Source/adapter tests do not prove live behavior. The product goal is unchanged.

## Validation

Fail-before tests for original fixtures; all legal/unknown states; mixed READY
and unknown; dependent READY; historical unknown followed by valid row; empty
and wrong-namespace coordinator selection; ordinary successful workflow and
recovery regressions. Test continuation in an isolated temporary working
directory with non-dispatchable work and no provider configuration. Run focused
queue/coordinator tests, lint changed modules, typecheck and compare baseline.
Update investigation/progress records with exact source identities and limits.

## Decision

Status: Approved for safe isolated implementation under Founder mission section 4.
Date: 2026-10-01.
No production promotion or verification waiver. Independent S1 review remains
required before integration. G1's incomplete review is not transferred to S1.

## S1 follow-up: stale projection invalidation

Two isolated CLI cases failed: a new failed continuation retained the previous
CONTINUATION_COMPLETE marker; an audit throwing on unknown state retained the
previous healthy latest report. These are derived projections, not primary
evidence. Invalidate the marker before startup state reads; publish RUNNING
before continuation work, and RUNNING then OBSERVED or DEGRADED for the audit.
Unknown audit counts/action are null, never empty healthy values. Remove only
the obsolete completion marker; preserve queue/evidence stores. Fail visibly
on filesystem errors, ignoring only ENOENT for marker absence. A failed report
write cannot guarantee on-disk invalidation; consumers still require revision/
attempt identity and runtime attestation before authority. No filesystem fault
or concurrent-writer closure is claimed by this projection repair.

## Independent review follow-up

Reviewer 01a0f6b3-657c-73b1-9142-cb78dc0bb09b found two missing cases: duplicate
work IDs overwrite unknown lineage before admission; coordinator result actions
derive from a READY snapshot predating persisted BLOCKED. Require ambiguous
duplicate lineage IDs to reconcile, with UNKNOWN_LINEAGE visible. Refresh scoped
queue state before each exit projection; do not return SUCCESS if refreshed
rows are absent or nonterminal. Keep failure reason and token accounting.
Tests must use duplicate in-memory lineage and an actual temporary queue with a
throwing executor. This does not establish atomic result/read fencing.
