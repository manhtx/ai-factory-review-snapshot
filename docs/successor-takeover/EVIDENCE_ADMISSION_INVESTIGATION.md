# Evidence admission boundary investigation

Direct fixtures against `validateEvidenceResolution` returned no errors for
an invalid created_at, an evidence_id different from the requested ID, and a
timestamp in 2099 under a fixed 2026 clock. Source hash and outputs are saved
in `evidence/evidence-admission-counterexamples.json`.

Root cause: age validation only rejects finite ages above the maximum, so NaN
and negative ages pass; the validator does not compare resolved/requested IDs.
Hash equality verifies content bytes, not identity or time admissibility.

Consumers found by source search: roleWorkQueue completion, reviewEvidenceContract
and architectureTrial. Concrete JsonlEvidenceResolver filters by requested ID,
so the ID mismatch fixture is a validator-contract failure, not proof that its
current JSONL caller returns a wrong ID. Invalid/future timestamps remain
admissible directly under the current validator. No live transition tested.

Required solution: validate the complete resolved record and context, require
requested identity equality, strict valid timestamps and an explicit permitted
clock-skew policy, then enforce age, namespace/run scope and reviewer rules.
Malformed evidence must produce rejection, never an empty error list. Review
the JSONL resolver's ignored parse failures separately; do not launder damaged
history into a valid result. Preserve original evidence for adjudication.

Impact: three evidence consumers, persisted ledger compatibility, replay-clock
tests and terminal admission. Product Goal sections 9–11 and mission I4–I6 apply.
Test valid/current records, invalid/future/stale timestamps, identity mismatch,
invalid policy clocks/budgets, hash mismatch and the actual consumers. Clock
skew allowance is policy, not an arbitrary repair constant.

Status: REPRODUCED_NOT_IMPLEMENTED. Keep G1/S1/wait candidates unpromoted and
avoid another simultaneous foundational mutation while S1 is under review.

## Current mission reobservation and first repair decision (2026-10-02)

Mission `AI_FACTORY_FINAL_CONVERGENCE_V2`; Product Goal sections 9–11 and 17.
At execution revision `9483c43d72739b659552f3d5349a8cb190f66d81`,
`evidence/evidence-current-reproduction.json` reproduces wrong ID, invalid and
future time admission, valid evidence resolved through a corrupt ledger, and
DONE with unresolved evidence when the queue has no resolver. These are
CURRENT_REPRODUCED in isolated state, not observations of live transitions.
Current candidate uses the same optional resolver path and same validator.

Root causes: resolved identity is not compared; NaN/negative ages evade stale
checks; JSONL parse errors and failed concatenation recovery are silently
discarded; resolver enforcement is conditional on constructor wiring.
Alternative explanation (only concrete resolver lookup prevents wrong IDs)
does not close the public validator contract or time/parse defects.

First focused repair: harden the existing validator and JSONL reader. Validate
record shape, requested/resolved identity, content hash, canonical UTC timestamp,
finite clock and finite nonnegative age policy. Default future skew is zero
within the same local clock envelope; never invent a drift tolerance. Use the
candidate durability contract's existing UTC serialization convention, avoiding
a new authority primitive. Reject corrupt/non-record ledger rows with visible
errors; keep original bytes and never salvage concatenated objects into authority.
ENOENT remains unresolved, not valid evidence. Required source/work/attempt/
revision binding and mandatory resolver coverage remain explicit OPEN P0.

Affected modules: `evidenceResolver.ts` and its three consumers
RoleWorkQueue, reviewEvidenceContract, architectureTrial; persisted ledger
compatibility. There is no source migration or live ledger rewrite. Older
noncanonical timestamps/corrupt ledgers fail admission pending adjudication.
Risks: legitimate historical evidence may become withheld; async resolver error
paths need direct tests. Validation: fail-before malformed identity/time/policy,
corrupt/mixed/concatenated ledger fixtures, valid controls, actual consumer
regressions, independent recheck, exact source hashes. Apply to isolated candidate
only after compatibility check; do not grant successor authority or retry G1.

Convergence decision: smallest first causal repair reuses existing components.
No new canonical store, framework, UI or provider dispatch. Ledger bytes remain
forensic history. Future phases must close optional resolver construction and
terminal integration; this scoped repair cannot close A-09 by itself.
Authorized by standing mission sections 5, 6 and 86.

Independent counterexamples to the first repair: explicitly null age policy or
false/null clock silently receives defaults; null context throws before returning
rejection. Reject malformed supplied policy, distinguishing undefined default
from invalid explicit values. Add fail-before controls and repeat affected tests.
Blank expected namespace/run/reviewer fields are a separate pre-existing caller
policy gap, still OPEN; current callers deliberately pass blanks in some paths.
Do not claim universal evidence scope or independent terminal admission closure.

## Mandatory completion configuration (2026-10-02)

### Goal alignment and requirement
Product Goal sections 9–11: users must be able to inspect evidence and uncertainty.
Research question: can a completion be trusted when its referenced evidence was
never resolved? Current isolated reproduction answers no: a queue constructed
without a resolver records DONE for a nonexistent ID. Mission A-09 applies.

### Technical design and impacted modules
Keep resolver-less queue construction for existing readers, planners and intake.
Require an explicitly configured `IEvidenceResolver` inside `complete()` before
any terminal write. Remove the conditional admission bypass. Do not select a
default file: CLI dispatch records StoredEvidence in role-dispatch-evidence.jsonl,
whereas native RoleEvidenceLedger records a different receipt schema. A default
would hide missing configuration and conflate producer contracts.

CLI dispatch/run-ready already configure the matching resolver; preserve their
valid completion capability. Runtime/native executor and legacy test callers
without a resolver will visibly reject completion. They require a subsequent
explicit producer/consumer contract repair, not a fabricated resolver or legacy
lineage backfill. This limitation is blocking proof debt, not mission closure.
No existing ledger is migrated, cleared, quarantined wholesale or rewritten.

### Risks, alternatives and prevention
Affected consumers include runtime, autonomousCoordinator, executor and recovery
tests. Their missing configuration can become a visible blocked outcome; provider
dispatch before rejection remains a resource/liveness issue. Existing native
producer also fabricates coder fallback and self-review PASS; retain as OPEN P0
until causal contract repair. Do not weaken admission to preserve those claims.
Explicit construction is preferred to a guessed file or a permissive in-memory
resolver. Queue corruption/concurrency/attempt authority are unchanged and open.

### Validation and decision
Add fail-before tests for missing resolver with otherwise-valid structured output,
verify exact queue bytes unchanged on rejection, preserve read/create capability,
and test explicit resolver errors. Existing real hashed same-scope positive and
unresolved negative controls must continue passing. Run affected caller tests to
measure compatibility, retain failures and independently review exact changes.
Bind proof to source hashes/revision; no live runtime or successor promotion.
Approved for reversible local implementation by mission sections 5, 6 and 86.
This is a scoped repair of an empirically reproduced bypass using existing
primitives; A/B/C/D remain UNPROVEN.

## Native producer/consumer convergence plan (2026-10-02)

Requirement and Product Goal alignment: inspectable evidence and honest uncertainty
(sections 9–11), mission A-09/A-10/A-11. Current native producer writes receipts
without run/namespace/content hash; runtime constructs a resolver-less queue;
executor manufactures coder contract and a self-review PASS from successful text.
Source and compatibility failures above prove a causal contract mismatch, not just
obsolete tests. Avoid guessed default files or a permissive resolver.

Design: reuse RoleEvidenceLedger as its explicit IEvidenceResolver. New native
receipts store actual assignment namespace/run, original output SHA256, source
artifact referencing this ledger, and protocol RECEIVED. Historical receipts are
readable forensic history but cannot resolve without those fields; no backfill or
migration. Resolution returns stored hash (never rehash tampered bytes to make them
valid). Unknown/corrupt records reject inspection rather than becoming empty.
Runtime accepts an explicit evidenceResolver and startup passes its existing native
ledger. No default resolver selection. Executor parses actual structured output;
no prose-to-coder fallback, invented tests or automatic ReviewVerdict PASS. Real
research remains explicitly advisory. Native reviewer can only return an actual
validated ReviewVerdict with existing evidence references, never own receipt PASS.
Review dependency run/namespace conflicts remain visible; no scope laundering.

Impacted modules: ledger, executor, runtime/startup queue wiring and their tests.
Expected side effects: legacy/native malformed output no longer completes; valid
structured/research output can complete with actual hashed scoped native receipts;
review without valid independently produced dependency evidence remains blocked.
No provider enablement, public release, live state writes, candidate promotion or
architecture primitive. Scope/attempt/revision identity and transactional completion
remain separate P0. Receipt admission proves bytes and scope, not actual code effect,
independent product review, consumption or outcome.

Risks: dedup identity includes actual scope; older receipt IDs remain historical.
Malformed/duplicate ledger rows and output schema mismatch must fail visibly. Tests
must explicitly register real isolated fixtures rather than bypass admission. Run
fail-before scoped native resolution and malformed output/self-review controls,
valid native structured/research and wrong run/hash/legacy/corrupt controls, affected
caller regression and typecheck/lint. Fresh independent review after final hashes.
Before provider dispatch add deterministic configuration preflight using the queue's
same guard; preserve intake-only construction and zero-write rejection. Undo source
changes for rollback; no persisted legacy migration required. Standing reversible
local mission authority approves implementation; A/B/C/D still UNPROVEN.

Native repair result: fail-before native probes 3/3 failed as expected. Existing
ledger now resolves scoped receipts, preserves stored hashes and retains legacy
history without admission. Both model executor paths parse actual structured
contracts; native reviewer parses actual ReviewVerdict. All original structured
and top-level adapter citations are retained and must resolve. Native startup
explicitly supplies its RoleEvidenceLedger; injected runtimes must supply their
matching resolver. executeReadyRoleWork and autonomousCoordinator share the queue
configuration preflight before dispatch. Intake-only queues remain constructible.

Independent counterexample: on queue hash
ed50ea1f6313c623680c2a01f9125a613f823da3897d1f2351b17d9b25163c66,
user-persona FIXTURE-REVIEW cited its own receipt and completed PASS. Root cause
was inconsistent review classification between contract requirement and evidence
independence. Existing isReviewWork now controls both; reviewer rechecked suffix
and code_review cases, wrong scope, same-role QA and valid coder. Unresolved adapter
references also remain visible, including when structured references are valid.
Final independent run: 20/20; builder focused run: 94/94. Exact hashes and raw test
outputs in evidence/native-contract-proof.json. Broader compatibility failures
remain recorded, not dropped or redefined as passing. Full typecheck remains 11
unrelated diagnostics. No current process was restarted, no live company provider
work occurred, no ledger migrated and no successor authority was granted.

Next causal work: reconcile explicit resolver configuration in remaining legitimate
callers/fixtures, then shared workflow/dependency scope without rewriting source
lineage. Actual native provider prompts still need precise contract/dependency
packets before operating trials. Admission proves receipt bytes/scope only; attempts,
execution revision, actor independence, effect verification, terminal reducer and
non-PASS review handling remain open. Direct invocation of an executor callback
without its queue preflight is not a certified dispatch route. No global A-09/A-10/
A-11 closure is implied by this result.

Caller fixture continuation: preserve existing autonomous workflow and usage
assertions while registering hashed same-scope isolated evidence explicitly. The
QA positive control must cite its actual PM dependency artifact, rather than an
unresolved own-role ID. Keep HOLD/recovery and runtime compatibility failures
visible until their actual dependency/scope contract is reconciled. This improves
the existing test oracle; it is not operating proof or synthetic real-product work.

## Planner dependency scope repair plan

Current planner creates QA/QC with fresh default per-work run IDs, although their
evidence belongs to implementation. Pre-release work similarly creates a third
scope over two parents. Required solution: review work inherits actual dependency
assignment namespace/run; multiple parents must agree, otherwise explicit planning
error. No evidence rewriting, copied hash, new store or fabricated common scope.
Legacy mismatches remain withheld. Affected modules: planner, its positive/negative
fixtures, native runtime planned review flow. Validate direct actual review completion
with unchanged dependency evidence bytes, same-scope pre-release parents, mixed-scope
planning rejection and existing product gating. Product Goal9–11, mission A09/A11/D
apply; standing local authority approves focused repair. PM/implementation objective
binding, broader runtime packets and transactionality remain OPEN.

Recovery scenario fixture repair: configure resolver explicitly; initial QA consumes
actual backend dependency receipt in shared run/namespace; correction stores its own
scoped receipt and re-review consumes that actual corrective artifact. Original QA
QUALITY_FAIL remains BLOCKED after correction/rereview. Retain all existing recovery
creation/dedup assertions; no runtime/product outcome inferred from these fixtures.

Planner scoped result: 13/13 including actual dependency completion and mixed-scope
negative. Fresh independent reviewer completed backend→QA/QC→pre-release with
original bytes unchanged, rejected missing/blank/mixed scopes without ledger writes.
Non-string historical scope also rejects safely via generic TypeError; diagnostic
polish is deferred while material P0 remains. Recovery scenario now uses actual
registered dependency receipts and retains original failed QA. Daily injected runtime
fixture now explicitly supplies a resolver and real scoped fixture receipts; weekly
independent governance fixture still lacks the actual dependency evidence contract.
Do not generate another role's receipt to make that fixture PASS. Exact evidence and
continuation state are recorded in evidence/planner-scope-proof.json.

## Weekly runtime fixture contract

The remaining weekly integration fixture returns unresolved reviewer-own IDs. It
cannot be restored by disabling admission or relabeling reviewer output as another
CompanyRole. Provide a separate explicit unit-test input artifact (empty observation
fixture with unknown real outcomes), emitted by a deterministic fixture-input loader,
then cite its actual bytes/hash under each assigned scope. Non-review outputs keep
own-role receipt fixtures. The observer input is an isolated test source, not a real
QA report, product observation, external user or outcome. Preserve all 18 weekly
roles, cadence assertions and strict admission. Add negative control that the same
reviewer's own receipt cannot substitute for the supplied input. Scope of change:
runtime integration test only; no production provider/authority behavior. Actual
independent actor identity/effect/outcome and production cadence input packets are
still OPEN. Standing mission authorizes isolated test fixtures and verification.

### Weekly isolated contract verification result

135 tests across 14 affected suites passed; runtime has 13 tests. Fresh reviewer inspected generated ledgers: 18 weekly DONE on separate file input; five review roles BLOCKED for own receipts and weekly FAILED in negative control. This proves unit admission/scheduler compatibility only. One injected executor controls producer labels; independent actor identity and real product evidence remain OPEN. Full typecheck still has 11 other diagnostics. Exact runtime test hash and limits are in `evidence/weekly-runtime-proof.json`. No live restart or successor promotion occurred.
