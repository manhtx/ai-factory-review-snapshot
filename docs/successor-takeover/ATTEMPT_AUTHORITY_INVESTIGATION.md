# Claimed attempt authority and delayed output

## Problem and root cause

Current root queue SHA256 `ab70460a77a11b079c9578f5fb2e22039569741b0ce55908fd34000bed6526e7`
accepts old-owner output after BLOCKED/requeue/new-owner claim. See
`evidence/stale-attempt-counterexample.json`. CAS protects a pending mutation's
snapshot, but a delayed actor can start complete against the newer IN_REVIEW
row. No caller attempt credential is required. Executor and coordinator also
pass the original READY snapshot to provider execution rather than the actual
claimed row. CLI dispatcher currently claims after provider output, allowing
output generated without owned attempt to become newly claimed work.

## Goal alignment / requirement

Per `../PRODUCT_GOAL.md` sections9-11/21, stale uncertain work cannot silently
become current success. Research question: did this automated Macro OS effect
belong to the authorized attempt whose result is consumed? Strengthen the trust
workflow, not feature count. No product direction change.

Positive transitions CLAIMED->IN_REVIEW->terminal require the current claim's
explicit caller capability. Claim produces a random nonce; persist only its
hash and a distinct attempt_id. Raw nonce is returned once to the trusted caller,
never exposed by records, inserted into provider prompts, or written in ledgers.
Every new claim replaces attempt identity, including identical owner names.
Stop/recovery/requeue invalidate positive transition authority. Legacy active
rows without attempt identity fail closed; no fabricated historical credential.

## Technical design and affected modules

- RoleWorkQueue: claim returns ephemeral `attempt_authority` alongside its
  committed work; persisted rows contain attempt_id/token_hash only. Submit and
  complete accept explicit attempt authority and reject absent/malformed/wrong
  owner/token/attempt before terminal commit. Existing snapshot CAS still binds
  the validated row at publication. Bound control-plane block/quarantine remain
  stop authority, not permission to complete. A separate attempt-bound block
  operation lets worker error handlers stop only their current attempt.
- Executor/coordinator: capture claim handle locally, execute actual claimed
  item with capability removed, pass handle on submit/complete/attempt failure.
  A stale failure must not block a newer actor. Preclaim control stops stay
  explicit system operations with selection snapshot fencing.
- CLI dispatcher: claim before any provider dispatch, retain handle in the
  dispatcher process only; reject nonREADY input rather than adopting another
  claim. Never claim after parsing old provider output. Stop on lost attempt
  before evidence recording/terminal submission. Parent timeout/stop must bind
  its selected work/attempt, not mutate a newer generation.
- Admin mutation route: handle may be returned only by authenticated claim;
  submit/complete must receive it. No records endpoint returns raw token.
- Evidence: native own-output receipts must carry actual claimed attempt_id.
  Attempt-scoped own-output evidence must match active attempt; historical
  unbound own-output stays unresolved for new completion. Independent input
  and dependency evidence preserve original lineage rather than being assigned
  to the reviewer attempt. Exact revision/effect identity is additional open debt.
- Tests/callers: explicit claim handles and actual claimed receipt metadata;
  no implicit queue-instance handle cache or lookup of current owner to repair
  missing credentials. Missing credentials remain genuine negative controls.

## Permanent solution rationale and risks

Hash-backed caller capability fences delayed positive writes without trusting
owner labels or rereading current claim as authority. A new hash is not actor
identity authentication outside the trusted local control-plane envelope; OS
writer restrictions and exact revision binding remain blocking. Risks include
nonce leakage through object spreading, restart losing handle, wrong retry
adoption, stale worker error overwriting a newer claim, and treating advisory
receipt as actual side effect. Reject rather than recover a lost credential;
existing bounded recovery creates a new attempt only from explicit invalidation.

## Test strategy and prevention

Preserve old-attempt reproduction and demonstrate rejection/no queue append.
Test missing/wrong token/owner/attempt, same-owner reclaim, cross-instance
completion with legitimate capability, old submit/failure after newer claim,
raw nonce absent from history/provider input, pending evidence CAS, provider
failure, native receipt lineage, and correct positive runtime workflow. Preserve
all existing fixture denominators; adapt positive fixtures using returned claim
handles rather than weakening authority guards. CLI tests must show zero provider
calls on nonREADY/missing owned attempt, and no late claim after output. Broader
151-case baseline and typecheck remain recorded; no full gate success until all
required affected paths are verified.

## Change budget and decision

Observed cause: demonstrated stale positive completion and source-supported late
CLI claim. Reuse queue identity, assignment and CAS; add no store/scheduler/agent
family. Add one per-claim ephemeral capability and persisted hash/attempt fields,
and one attempt-bound negative transition method. Remove adoption of current
state as caller permission and late CLI claim. Net authority decreases: records
and labels alone cannot authorize completion. Compatibility and restart costs
remain explicit, not hidden fallbacks.

Status: implementation approved by standing Founder mission section5 local
reversible authority after documented design; fresh independent review required.
Implement in causal order queue guard -> actual claimed producer/caller -> evidence
binding -> affected compatibility -> independent review. Production remains
DISABLED; no live enabling, candidate promotion or G1 verification is implied.

Fresh design reviewer found further required caller boundaries: own-output CLI
fallback paths currently work_id-only and can replay a surviving old artifact
under a newly claimed credential. Make attempt-specific own-output/log paths or
require an authoritative attempt-bound transport record; do not relabel old
bytes. Parent child-exit handler must bind the launched attempt via trusted ACK
or defer to explicit recovery, never adopt a latest claim read after exit.
Preclaim failure/control stops require the original READY decision snapshot at
commit. A losing claim grants no authority to block the winner. Provider inputs,
argv/env/telemetry/provenance must exclude raw capability. Full CLI/output-origin
and own-output evidence taxonomy remain blocking until these are implemented.

Capability hashing must bind canonical queue identity, work_id, actual assignment
identity/content and owner in addition to the nonce. Copying a queue row into
another root or changing the work assignment must not transfer active attempt
permission. Canonical root is already immutably bound by the queue gate repair;
namespace/root migration intentionally invalidates old handles and requires
explicit new admission. Add a copied-root negative control without changing
historical records. Independent review also found the recovery-plan error stop
must use the exact admitted non-PASS source row as decision snapshot, not generic
block of a later generation.

## Current partial repair evidence

Queue guards and actual claimed runtime/coordinator inputs reviewed:26testsPASS, changed-source lintPASS, fulltypecheck11otherdiagnostics. Fresh reviewer reproduced stale invalid-plan stop; fix binds admitted source decision row, newer owner IN_REVIEW preserved. Capability hash binds canonical root/work/project/assignment/owner/nonce; copiedrootcontrol denies. Raw token absent from history/provider input in scoped fixtures. Counterexample now rejects old capability rather than completing newownerwork.

Affected compatibility remains47PASS45FAIL_OF92 with raw failures retained, chiefly older callers missing explicit handles. Previous151PASS belongs to pre-attempt source and is invalid as current broadgate. CLI/admin/ownoutput receipt binding are incomplete; plan proceeds to these paths and legitimate positivefixture migration. No global actor/terminal closure, no live enabling, no candidate promotion. The 20-pass evidence review covers fresh source/counterexamples, capability containment, staleowner/selection races, crossrootbinding, ledger preservation, caller compatibility, provider/output origin, resource/deployment boundaries and residual proof debt; decision is partial repair only.

## CLI migration implementation detail

Use a validated work/attempt artifact-name helper shared by dispatcher, parent
and worktree collector. No work-only fallback for current own output. Claim
once after assignment/dependency/handoff validation and before prompt/provider;
keep capability in dispatcher lexical state, send parent only nonsecret work_id,
attempt_id and derived output_name through the direct child IPC channel. Provider
subprocess receives no IPC or raw capability. Parent verifies ACK shape and
work identity; collects only acknowledged attempt artifact. Without ACK it does
not adopt/requeue latest claim on child exit; lease recovery remains explicit.
With ACK it may stop only a current row matching that attempt, via selection
CAS, and requeue only the exact stopped row. Dependency artifact lookup uses
producer's admitted attempt_id and preserves original bytes; historical missing
attempt must fail visibly rather than use a work-only fallback. Add optional
attempt argument to generic worktree collection to retain non-authoritative
historical tooling capability; current dispatcher path always supplies attempt.

This is still local source migration, not permission to dispatch actual providers.
Stub-provider subprocess tests must use isolated control roots and no network.

Independent CLI stub falsification: explicit BLOCKED retained same attempt_id,
so postprovider identity-only guard allowed an own-output receipt after stop.
Require postprovider CLAIMED before submit/evidence/decision mutation; BLOCKED,
READY, QUARANTINED or worker-written IN_REVIEW is not active dispatcher permission.
Provider usage/log observations may remain forensic, never semantic approval.
Forward parent SIGTERM/SIGINT to an owned detached provider process group, with
bounded SIGKILL only while the original child handle is still live. Reap before
semantic output processing; cancelled output cannot create receipt/decision.
Missing marker/nonzero no-contract exit should block the owned active attempt,
rather than rely solely on later parent/lease recovery.

Independent lifecycle follow-up: direct provider exit does not establish descendant exit. A same-group descendant may ignore TERM while the provider leader closes. Refine the existing owned-group cancellation, rather than adding a supervisor: on interruption/timeout retain one bounded escalation promise, signal the original detached group and await that group's SIGKILL escalation before dispatcher exit. Never use a discovered unrelated PID or latest queue owner. This bounds cleanup of the owned group only; escaped sessions, SIGKILL of the dispatcher, OS effect fencing, and provider side-effect reversibility remain unproven.

Final scope limits: timeout cancellation rejects even a valid emitted contract (exit 124); independent local probe validates this. The active-state guard must also preserve the prior worker-written DONE quarantine behavior, before fallback artifacts. This is a bounded transport repair, not transactional evidence admission: a concurrent stop after the state check remains possible, and receipts still need attempt/revision-aware admission. Parent ACK failure races are source-reviewed only; admin constructor/transport remains unconfigured. Do not close these broader obligations from the CLI tests.

## Admin transport causal repair plan (2026-10-04 continuation)

Current `server/index.ts:241,3638-3643` is an actual affected caller: claim returns the ephemeral capability, but submit-review drops it and complete drops both capability and typed role contracts. The queue instance lacks a resolver, so positive completion is unavailable. No repository UI consumer of this route was found by focused search; the protected local API remains the capability to preserve. Product Goal trust requirements above apply.

Implement one thin tested adapter around the existing queue (no new authority/store): accept explicit request `attempt_authority`, forward typed completion fields to queue validators unchanged; never look up a current handle or log/persist it. Bind the admin queue resolver to its actual native `RoleEvidenceLedger` root. Preserve native and CLI source lineage: this native adapter does not synthesize CLI evidence or copy receipts between stores. Existing protected claim response remains the only place to return the raw handle. A malformed/missing handle remains a negative control.

The existing route queue root is hardcoded whereas supervisor can use AI_COMPANY_STATE_DIR. Do not silently certify that mismatch: before any admin mutation require its queue root equals configured native runtime project root; otherwise fail closed. Reads and broader fixed-path ledgers remain separate root-coherence debt. Impact: admin route submit/complete contract transport; default native queue resolver; fail-closed custom-root admin writes. No executor enabling or runtime restart.

Tests: actual temporary queue + native receipt; claim/submit/complete with genuine returned capability and actual receipt bytes; absent/stale capability rejects without append; capability absent from persisted rows; custom-root mismatch guarded at route source. Existing queue/CLI/runtime suites retained; typecheck/lint scoped. Independent review required; admission attempt/revision semantics and atomic receipt race remain OPEN and are not closed by restoring transport.

## Native receipt origin counterexample and implementation decision

`evidence/native-old-receipt-result.json` reproduces DONE for a newer attempt using actual persisted native bytes from the stopped previous attempt; receipt has no attempt_id. Capability guards authenticate the completing caller, not provenance of its evidence. Restore admin completion only after this receipt boundary is repaired.

Minimal change within existing evidence model: native new receipts require UUID attempt_id from the actual claimed producer row. The native executor rejects unclaimed/missing-attempt work before calling a provider. Historical receipt rows remain readable unchanged but unbound native receipts do not resolve for current admission. StoredEvidence carries optional `evidence_kind=PROVIDER_OUTPUT` plus attempt_id; native resolver labels its actual own-output receipts. The queue rejects a provider-output receipt for its own work unless attempt matches current work. Dependency receipts must match the selected dependency attempt, preserving producer identity instead of relabeling them as reviewer output. Independent input evidence stays independently scoped; do not retrofit current attempt onto old input or receipt.

This reuses queue snapshots and resolver validation; no new store or scheduler. Side effects: native direct unit callers must claim first; historical unbound receipt success is intentionally refused; generic input evidence remains a separate scope. Tests must retain old receipt bytes and old/new attempts, demonstrate fail-before/pass-after/no queue append, valid current receipt, dependency producer lineage, malformed/missing attempt, and actual claim-based native provider execution. Exact revision/effect admission, common typed input provenance and atomic receipt publication remain critical debt, not inferred from metadata matching.

## CLI original evidence lineage repair plan

Actual temp CLI probe `evidence/cli-lineage-laundering-result.json` is the fail-before control. Current source creates a new dependency receipt using review namespace/run, and replaces declared unresolved review evidence with that new ID. Non-review structured citations and research source_reference are also replaced with an own-output receipt. This launders original provenance and hides missing references.

Plan: remove dependency receipt synthesis and all citation replacement. Preserve actual declared references in parsed role contracts. Predeclare only the nonsecret current attempt's future transcript receipt ID in the provider prompt; its receipt is created from actual received output, never a claim capability or evidence that the research assertion/effect is true. Non-review workers may cite it for advisory output; reviewers must cite actual independent inputs. Prompt includes original dependency evidence IDs, not newly reassigned copies. Missing/wrong-scope declared references fail closed.

Reuse the existing native/CLI stores with one read-only RoleEvidenceResolver adapter: resolve both original stores, refuse cross-store duplicate IDs or any corrupt source, and require attempt/work binding for the intrinsically provider-output CLI store. Historical unbound CLI bytes remain intact and unresolved. Wire actual native admin/runtime and two CLI queue constructors to this same resolver contract. No new authority/store/scheduler. This addresses demonstrated cross-transport lookup loss without copying source lineage into a second ledger.

Remove deterministic review fallback that fabricates a REVISE contract when the provider omitted a valid contract; report the missing contract as blocked. This preserves the mission's no-premature-output/no-synthetic-review rule. Change budget: one read-only adapter, no canonical entity; remove synthetic dependency writer, review fallback and three semantic-reference rewriting paths. Net success authority decreases. Actual model calls remain disabled during verification.

Tests: fail-before cross-scope+unresolved reference probe, current own receipt positive with explicitly cited receipt ID, original native dependency review same-scope positive, cross-scope and missing citation negative, old CLI attempt receipt rejection, cross-store collision/corruption rejection, unchanged original receipt bytes. Rerun native/admin/CLI/runtime regression and independent material review. Actor/effectrevision/atomicreceipt/global generic-input authority remain OPEN.

Independent shared-resolver counterexample: a bound native ID plus a same-ID legacy CLI record with missing attempt was accepted because collision detection compared only resolved outputs. Presence ambiguity must remain distinct from binding/admissibility. Repair the existing resolver readers to expose read-only identity presence together with admissible output from the same read; refuse IDs present in both stores even when one historical row is unresolved. No ledger rewriting or new state authority. Add native-bound/CLI-unbound and native-unbound/CLI-bound collision controls; retain original failing probe.
