# Non-PASS review and dependency authority investigation

Product Goal sections 9–11: inspectable evidence and uncertainty, no unsupported
success. Mission A-11/A-12/A-14 and D recovery apply. Local reversible repair is
preauthorized by the mission; this document is the implementation plan boundary.

## Current problem and evidence

`evidence/review-terminal-counterexample.json`, exact queue SHA256
676953eb430c1d8af77458f8f8afe4373a134c9e1e000e6ec4acefc39c027ee1:
an actual validated HOLD citing resolved same-scope explicit dependency evidence
becomes DONE. Ordinary downstream work can then become CLAIMED. Fixture is isolated,
with zero provider calls and no real product task. This is CURRENT_REPRODUCED.

## Root cause and impact

Queue completion overloads review performed and positive gate outcome. claim(),
executor dependency waves, autonomous coordinator readiness/terminal aggregation,
planner review selection and recovery task dependencies consume only state=DONE.
Recovery currently depends on a failed source being marked DONE. Thus blindly
rejecting HOLD would break recovery while leaving competing success interpretations.
Parser/resolver failure is not the cause: this counterexample resolves correct
hashed evidence, validates the actual verdict, and still unlocks downstream.

## Preferred permanent solution and implementation plan

Use existing BLOCKED state for admitted non-PASS result, retaining evidence and
verdict in the same queue record. DONE must require positive review outcome where
review applies. An ordinary dependency requires successful outcome, including
rechecking historical DONE with known non-PASS verdict. Recovery must explicitly
consume a recorded failed-review condition, not gain success authority from it.
Extend the existing work dependency contract with a narrow typed condition for
that recovery source; never infer permission from a title/backlog naming pattern.
No new ledger, scheduler, agent family or state authority. A shared deterministic
dependency predicate must drive claim, dispatch waves and coordinator selection;
terminal aggregation must exclude admitted non-PASS. Prevent planner consumption
of legacy failed reviews. Preserve actual failed-source lineage for recovery.

Before coding, inspect recovery graph construction, assignment schema, queue
records/readers, existing candidate terminal reducers and all affected consumers.
Finalize condition validation and legacy adjudication in this document from that
inspection. Do not restore old HOLD success test by fabricating evidence or
weakening admission. Do not map all legacy DONE into trusted success.

## Risks, prevention and validation

Risks: deadlocked recovery dependencies, nested recovery bypass, replay of old
non-PASS records, inconsistent predicates between writers/dispatchers, schema
compatibility, retry loops. Preserve legacy bytes; fail closed on unknown conditions.
Test HOLD/REVISE/QUALITY_FAIL/BLOCKED versus PASS, ordinary dependency denial,
explicit valid recovery condition, wrong source/work/run, nested/budgeted recovery,
historical DONE non-PASS, both dispatch routes, planner consumption and duplicate
completion. Retain former test denominators and successful legitimate capability.
Require fail-before/pass-after/negative controls and fresh independent review.
Transactionality, stale-owner fencing, execution revision and real product outcomes
remain separate P0; this repair cannot certify those or A/B/C/D closure.

Status: CURRENT_REPRODUCED; detailed schema/reducer inspection required before code.

## Final scoped design after caller inspection

Existing recovery graph directly depends on its failed source; no new state family
is required. Add `recovery_source_work_id` to the existing role work contract,
explicitly set only for the corrective task by coordinateRecovery. It must name a
declared dependency; claim only permits that edge for a retained validated non-PASS
review in BLOCKED (or a known historical non-PASS DONE), same project/run/namespace.
The marker grants execution of correction, never success of the failed source.
Re-review still requires ordinary success of corrective work. Missing/invalid/mixed
scope conditions fail closed; no title-derived recovery permission.

Reuse roleWorkQueue exports for review classification, successful work and dependency
predicate. Use those predicates in claim, role executor waves, autonomous readiness/
terminal aggregation and relevant planner selection. Non-PASS ReviewVerdict,
ReviewEvidenceRecord REJECT or structured review verdict prevents DONE; store BLOCKED
with actual contracts and evidence. Validate supplied verdict even for non-review
roles. Mark non-PASS execution as blocked, not completed. Coordinator may create and
run correction/re-review but returns HOLD while original failed source remains
unresolved; passing correction alone cannot overwrite that source outcome.

Change budget: observed false-success dependency reproduced; existing depends_on
cannot distinguish correction intake from positive gate. One optional failed-source
reference added to existing work contract, one shared predicate replaces competing
state-only decisions. No new store/authority/agent/terminal family; false success
permission removed. Transactional/fenced terminal authority is still pending.
Source re-evaluation and objective-level recovery closure remain explicit debt;
do not manufacture original-source PASS to restore old aggregate SUCCESS assertions.
Standing mission sections 5/6/86 authorize this scoped implementation. Test original
PASS path, all non-PASS verdicts, ordinary denial, explicit correction admission,
wrong run/source and historical failed DONE, plus actual consumers and fresh review.

Independent integration counterexample: orphan reconciler quarantined valid explicit
same-scope correction solely because its source was BLOCKED. run-ready and continuity
kernel invoke this reconciler before dispatch. Include this existing consumer in
shared predicate migration: only a terminal dependency that does not satisfy the
work's explicit condition may cause orphan quarantine. Regression must exercise
reconcile-before-claim, not claim alone. Preserve wrong-scope/ordinary quarantine.

Reviewer source census additionally found state-only eligibility in run-ready and
role-dispatch, including AssignmentAdmission's completedWorkIds projection. Migrate
these actual entrypoints to the same per-work dependency predicate; that projection
may include a failed source only for its explicitly contracted correction edge.
Do not globally add blocked IDs to completed authority. Static syntax checks and
shared predicate regressions are safe; do not invoke live CLI runners/providers
for this review. Capture remaining script/state-only consumers as proof debt.

AssignmentAdmission context distinction: use an additive `satisfiedDependencyIds`
input for per-assignment edge conditions, retaining completedWorkIds compatibility
for existing success-only callers. A failed source never enters a global completed
set. Supplied invalid condition projections reject dependency admission. CLI passes
only its declared dependencies that satisfy the common predicate, and checks the
same edges again before dispatch. This adds no persisted authority/store.

## Scoped result

Builder combined evidence/native/terminal/caller suite and raw broad compatibility
results are recorded in evidence/review-terminal-proof.json. Fresh reviewer reproduced
the reconciler break, then confirmed correction survives reconciliation and claim.
32/32 independent tests passed; wrong scope/source, ordinary failed dependency,
legacy DONE/HOLD, conflicting PASS/REJECT, malformed legacy PASS, duplicate completion
and empty workflow negatives remain effective. Both actual script consumers now use
the common predicate; they were source-inspected/syntax-checked, not launched.
Thus actual CLI recovery remains runtime-unproven. Original source stays BLOCKED
until a separate legitimate re-evaluation. Old three-DONE/SUCCESS HOLD fixture claim
is INVALIDATED, replaced with actual bounded correction/re-review and source HOLD.
No live restart, provider, migration, candidate propagation or authority grant.
Global reducer transactionality/fencing/attempt/revision, legacy adjudication and
remaining caller compatibility still prevent A/B/C/D closure.
