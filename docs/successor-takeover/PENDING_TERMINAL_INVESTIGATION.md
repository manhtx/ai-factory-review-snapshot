# Pending completion overwrites a newer terminal stop

## Problem summary and current evidence

Block A remains UNPROVEN. On root worktree queue source SHA256
`63c55fef47992d969f670011f90116ee757cf8d8207edd6bd9b3ca0017267181`,
an isolated deterministic experiment produced:
`READY -> CLAIMED -> IN_REVIEW -> BLOCKED -> DONE`.
Evidence resolution was paused after completion read IN_REVIEW. A separate
queue mutation committed BLOCKED. Resuming the old completion returned DONE
and made DONE the latest record. Actual product effects were not involved.
See `evidence/pending-terminal-counterexample.json` and the reproducible
`tools/pending-terminal-probe.mjs`. This is CURRENT_REPRODUCED, not a claim
that the live disabled runtime performed it.

## Root cause and competing explanation

`update()` reads records, awaits an arbitrary asynchronous mutation, and appends
without checking that the observed version remains current. `complete()` can
await external evidence resolution. `append()` reads the prior row solely for
forensic annotation; that read does not authorize or reject the write. Record
order then treats the stale append as latest truth. Valid evidence does not
provide mutation authority. The counterexample uses valid scoped hashes, so
missing evidence is not the cause. Provider behavior is not involved.

## Product goal alignment and requirement

This work derives from `../PRODUCT_GOAL.md` sections 9-11 and 21: uncertain or
stopped work cannot become trusted success because a delayed actor returns.
The user research question is whether the evidence supporting an automated
Macro OS change is still authorized/current when the result is consumed.
The trust capability strengthened is honest terminal status and inspectable
lineage, with no product direction change.

A transition must commit against the exact current work revision and authorized
attempt. Stop, quarantine, recovery, retry, and newer claim must invalidate an
older pending terminal result. Concurrent exclusive claimers cannot both gain
authority. Invalid/corrupt canonical input must reject without salvage.

## Scope, proposed permanent solution and design frontier

Affected: RoleWorkQueue writers, executor/coordinator callers, recovery and CLI
callers, and projection readers consuming terminal state. Do not broaden into
new scheduling, UI, agents, or provider behavior.

Use one serialized, durable authoritative mutation route with compare-and-set
work revision and attempt ownership at commit. Evidence acquisition can happen
outside that critical section; final admission must recheck the captured work,
attempt, dependency and evidence identities before terminal commit. Existing
JSONL history must be preserved and classified explicitly, not silently assigned
new trusted authority. The permanent primitive is NOT selected yet: inspect
existing transaction/lease implementations and the bounded writer census before
choosing reuse versus replacement. An in-process mutex or a final unlocked
reread cannot establish cross-process exclusion.

Existing `stateStore.withLock` steals by age and unconditionally removes the
lock name on release. Recovery file locks also reclaim by age. Neither can be
copied as a proven stale-owner fence. A new store must replace authority rather
than become a second competing canonical family. No new primitive is authorized
by mere architectural preference; the reproduced race supplies the empirical
cause, but selection still needs exact change-budget/compatibility evidence.

## Why this approach and prevention

A commit-time authority check addresses the causal race rather than changing
review verdicts or hiding stopped tasks. Preserve the deterministic interleaving
as a regression. Test every mutation route against the same authority mechanism,
including stale attempts with identical owner strings. Never infer independent
actor identity from role labels or product outcome from a terminal test.

## Risks, side effects and validation strategy

Risks: serialization latency/deadlock, crash recovery, split canonical files,
legacy identity migration, ignored alternate writers, and erroneously rejecting
legitimate correction. Validation must include pending completion versus block,
quarantine and requeue/reclaim; two claimers across processes; stale owner release;
crash before/after commit; corrupt/torn history; duplicate/retried terminal call;
valid independent completion; recovery edge regression; conservation and rollback
if persistence changes. Reuse the affected 135-test pipeline without reducing
coverage. No live migration, provider dispatch, enablement or promotion until
isolated safety and conservation proof are reviewable.

## Change budget / decision

Observed failure: stale successful append overrides newer BLOCKED.
Root cause: asynchronous read/validate/append without version/attempt fence.
Existing primitive limitation: no queue transaction; examined file locks have
age-based owner replacement and unfenced release.
New primitive added: NONE in this investigation.
Old complexity retired: NONE yet.
Authority surface added: NONE.
Authority surface removed: NONE yet.
Net complexity: diagnostic probe and bounded design requirements only.
Decision: reproduce confirmed; implementation design pending targeted primitive
and writer investigation. Founder mission section 5 preauthorizes necessary
safe local reversible implementation after the concrete design is documented;
no routine Founder approval request is needed. Production autonomy DISABLED.

## Selected first repair and approved local implementation plan

Decision date: 2026-10-02. Approved under standing mission section5 local
reversible repair authority. This is the commit-fencing step toward the stated
permanent solution; attempt capabilities and complete successor authority remain
blocking, not redefined away.

1. Keep existing JSONL as the sole queue state/history authority. Add an empty
   SQLite file only as a kernel-managed exclusive write gate (no work tables,
   no terminal state or outcome records). Native `node:sqlite` is available on
   observed Node24.18; no package/install/cloud dependency. `BEGIN IMMEDIATE`
   with zero busy timeout and bounded asynchronous retry supplies cross-process
   exclusion without synchronous wait deadlocking a local holder. Acquire by
   canonical realpath; no age-based steal or unlink of the gate database.
2. Execute commit filesystem operations synchronously inside that gate; never
   await provider/evidence callbacks there. Read exact current history, compare
   captured work and dependency revisions/record identities, then publish exact
   old bytes plus new record(s) by same-directory exclusive temp write, fsync,
   rename and directory fsync. Readers see old or new complete histories.
   Reject mismatch as stale mutation, not success. Increment queue_revision for
   guarded writes; absent legacy revision means0 only for CAS, not trust genesis.
3. Route create, createBatch and update through this gate. Batch validates current
   IDs/dependencies inside the gate. Every update CAS-checks current work and
   its declared dependency snapshots; async evidence resolution stays outside.
4. Disable the two hardcoded historical record-cycle entrypoints before any
   side effect; their synthetic DONE/report stamping capability is intentionally
   removed. Real intake/execution/evidence remain provided by existing guarded
   queue/dispatcher, not simulated by new compatibility imports. Historical files
   and evidence are retained. No package or active runtime consumer found for
   those entrypoints in the bounded source search.
5. Verify stale completion versus block/quarantine, concurrent claims/batches
   across processes, crash-released gate, atomic history preservation, aliases,
   corrupt input and existing affected pipeline. Fresh independent falsification
   is required. This step does not prove actual attempt authentication, product
   outcome, closed-world OS writer control, migration or cold start.

Change budget: one write-gate primitive and per-work queue revision field;
retire three unfenced class write paths and two synthetic direct writers. No
new canonical state family. Cost: full history rewrite per commit (existing
reads already scan history), must measure on actual queue size before enabling.
Durability after rename but before fsync failure is explicitly uncertain; do not
report a rejected operation as definitively effect-free. Crash leftover temp
files are non-authoritative; preserve until inspected, never load as queue.
Primary primitive references: https://nodejs.org/docs/latest-v24.x/api/sqlite.html
and https://www.sqlite.org/lang_transaction.html. Actual fault/concurrency tests,
not documentation alone, are required proof.

Independent design falsification found a second race: an outer stale-lease
selection can observe IN_REVIEW, then `update()` capture newer DONE and reopen
it READY. Bind outer selection row and dependency snapshots explicitly into
update CAS for recoverStaleLeases, quarantineBlocked, quarantineStaleReady and
orphan reconciliation. Do not treat a newly reread row as the old decision's
authority. Reviewer `/root/review_terminal_independent` reproduced this in an
isolated temp root. The selected implementation includes this correction,
regular-file/link-count checks, and explicit post-commit error classifications.

Implementation review adds three necessary corrections: canonical root identity
must be bound once per queue instance before any decision snapshot so retargeting
a directory symlink cannot move an in-flight result to another namespace;
revision exhaustion must reject before writing an unsafe integer; create-path
post-commit provenance errors receive the same explicit committed classification
as update. Static-disable helper calls preserve historical script bodies without
an unreachable-code lint exception or an enable flag. Invalid UTF8 history must
fail closed on reads and writes.

## Verified result and next causal frontier

151 tests/16 affected suites pass; fresh reviewer14 fence cases and independent CAS/ABA/alias/overflow/provenance probes pass. Lint changed source passes; full typecheck remains11otherdiagnostics. Root queue read-only compatibility:24,040,569bytes/2,715records. Isolated copy write cost3samples108-142ms; original prefix preserved; no runtime enable or source queue mutation. Exact worktree hashes and limitations are in `evidence/queue-fence-proof.json`.

The 20-pass evidence review considered source, interleavings, alias/corruption, crash-release, independent counterexamples, revision identity, history conservation, product claim limits, local cost and unchanged deployment envelope. Decision: scoped cooperative CAS repaired, broader System Truth remainsUNPROVEN. New counterexample `evidence/stale-attempt-counterexample.json`: old actor result accepted after new owner claim because complete has no required caller attempt handle. This does not invalidate snapshot CAS but blocks any ownership/attempt or terminal authority closure. Next design must bind actual claimed attempt and evidence, not just owner labels or the row read when complete starts.
