# Successor governance transaction boundary

Status: selected for isolated implementation after independent architecture review.
Scope: governance plane only. Product SQLite/Supabase remain separate.

## Product and mission alignment

Product Goal sections 10, 11 and 16 require truthful evidence and continuity.
Founder Mission I1/I3/I5–I11/I18 require conserved objectives, fenced authority,
admitted evidence, coherent terminal commit and durable reconstruction.

## Current failure and decision evidence

The current ExecutionLeaseManager accepts eight concurrent commands with
expectedRevision=1 when every contender reads before any saves. All return
revision 2; only the last writer remains. Source SHA-256:
`b14aa289bdac1905a399f9e7f297b3e01c26a40813b33ba2803c1248ef5c218a`.
The temporary reproduction is `successor-authority-race-iZ1sx8` under the host's
temporary directory. This is a deliberately synchronized valid interleaving,
not a scheduler-frequency estimate. No provider calls occurred.

Direct file appenders and best-effort durable-start handling are documented
in EXECUTION_SURFACE_DESIGN.md. One class lock cannot fence all these paths.

Two disposable alternatives used the same command/revision/receipt oracle:

- Serialized files: Python POSIX flock, bounded acquisition, one complete state
  snapshot, temporary-file fsync, atomic rename, directory fsync. OS lock
  release handles process death; no stale mkdir-lock shortcut was used.
- SQLite: Node's existing built-in SQLite, BEGIN IMMEDIATE, FULL synchronous,
  WAL, bounded busy timeout, conditional revision update and receipt in one
  transaction.

Both admitted one of eight competing commands and rejected seven as stale.
Both replayed the committed command without another revision. Both survived a
confirmed kill after preparation but before publication: no interrupted
receipt/revision, automatic lock release, next command succeeded and reopened
state was revision 3. Evidence is in `evidence/file-transaction-feasibility.json`
and `evidence/sqlite-transaction-feasibility.json`, with exact harness hashes.
An initial SQLite harness setup had an incorrectly double-quoted SQL literal;
it failed before workers ran and was corrected to a bound parameter. This was
an experiment implementation failure, not evidence against either engine.

## Proposed choice

Use a separate SQLite governance store inside an isolated successor namespace.
Both engines satisfy the exercised storage properties. SQLite is preferred
within this macOS/Node operating envelope because the existing runtime already
provides the driver, transactions and indexed row/receipt operations. The file
prototype adds a Python locking worker; a Node-native file design would need a
proven OS-lock adapter or a separately supervised single writer. Whole-state
publication also requires a scaling/compaction protocol for growing history.
These are engineering costs, not proof that file storage cannot work.

No performance superiority, power-loss guarantee or general corruption
recovery is inferred from these experiments. A new DB does not resolve
incorrect transition semantics, effect duplication or unauthorized callers.

Independent review (agent 01a0f56b-42ad-73f1-9fb1-48fc07f8faa2) found the
comparison fair and the scoped results supported. It requires all-process
cold-start, lost acknowledgement, mid-publication and actual gateway policy
tests before broader claims. Python/whole-snapshot cost is specific to the
evaluated file design, not inherent to all possible file authorities.

### First implementation package: G1 storage and authority fencing

Implement an isolated `successorGovernanceStore.ts` with explicit create-new
and open-existing interfaces, schema/mission/envelope/policy/trust-epoch binding,
one current authority row, and command-digest-bound transactional receipts.
Advance-authority validates the supplied trusted-gateway actor against current
owner and expected revision in the same transaction; command replay cannot
change state and changed-payload command-ID reuse rejects. The caller identity
is not authenticated by a string: production runtime authentication and writer
exclusion remain required adapters before authority is granted.

Validation: existing-file genesis refusal, missing-store refusal, unknown schema
or binding refusal, payload collision, stale/unauthorized actor, duplicate replay,
independent concurrent processes against one expected revision, and reopened
state/receipt coherence. No generic arbitrary-SQL or arbitrary-reducer API.
The existing product store and live JSONL writers are unchanged. This package
does not yet implement objective/evidence semantics or grant successor trust.

G1 independent breaker found that a trusted version label is insufficient:
an added trigger suppressed receipt insertion, a modified receipt contradicted
its payload digest, and deleted history was accepted on reopen. The revised
schema is version 2 (isolated genesis only, no automatic v1 migration). Validate
the exact declared tables/index definitions and reject unknown triggers/views;
pin connection durability settings; retain genesis owner plus full canonical
command fields; reduce every receipt in revision order, validating payload
digest, actor chain and expected revision against the authority projection.
Reads use one snapshot; command admission and post-write verification run in
the same write transaction. Require one inserted receipt. Fail visibly on any
schema/history mismatch, preserving the damaged store for adjudication.
This detects inconsistent damage, not coherent rollback or forgery of every
stored byte by a privileged writer; external identity/epoch anchoring remains
part of the required runtime integration.

## Minimal trusted core and implementation plan

1. Versioned explicit genesis and open-existing-only startup, pinned mission,
   envelope, policy and trust epoch identities. Missing established state must
   be an integrity error, never automatic reinitialization.
2. One command gateway: validate actor/scope/current epoch, expected entity
   revisions, legal transition and semantic command identity inside one
   transaction. Command IDs must bind payload digests; changed payload reuse
   rejects. Replay must not authorize a new effect.
3. Explicit objective → work → attempt identities. Objective disposition and
   accepted work/outcome commit together where dependent. Queue DONE cannot
   independently satisfy an objective.
4. Evidence admission is a separate deterministic boundary with source,
   namespace, revision, freshness and oracle context. Only admitted evidence
   can authorize terminal outcome. Model proposals remain untrusted.
5. Intent/receipt/reconciliation protocol for external effects. Database
   atomicity cannot make provider calls or Git writes atomic.
6. Reader projections derive from committed revision. Unknown schema/state,
   missing storage, corruption and stale proof must surface as degraded state.
7. Legacy API adapters preserve DAG, role contracts, review, metric contracts,
   waits, retry budgets and quarantine capabilities. Direct legacy writers
   cannot access the successor namespace or acquire successor authority.
8. Copy-based migration maps legacy rows to trusted/unverified/reconstructed/
   superseded/legacy-only classes. No legacy DONE auto-imports as trusted.
9. Rehearse rollback/fail-forward and authority transfer; then independently
   attack and run real/cold-start/Founder-absent proof before promotion.

## Risks and required verification

Treat snapshot truncation/deletion, process death, power/storage failure,
concurrent takeover/recovery/completion, stale attempts, command-ID collisions,
misbound evidence, incomplete migrations and incompatible read projections as
separate proof obligations. Preserve all historical data and candidate isolation.
The current experiments cover only storage feasibility. No closure class,
TRUST_EPOCH_1, local authority or retirement is granted by this decision.
