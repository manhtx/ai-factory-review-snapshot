# Durable-state integrity and continuity containment

## Goal alignment

`docs/PRODUCT_GOAL.md` sections 9–11 and 16 require truthful evidence and
durable research continuity. Founder Mission I9/I14 require corrupted state
to become visible failure, never empty work or apparent health.

## Requirement

The current durability reader suppresses malformed JSON; its configured
continuity consumer suppresses reconciliation exceptions. Fix this single
causal boundary in an isolated successor candidate. This does not close
duplicate creation, terminal authority, recovery budgets or migration.

## Technical design

- Candidate: managed `successor-integrity` worktree at initial HEAD, overlaid
  with the restored F0 application archive to preserve uncommitted application
  dependencies. No canonical runtime, credentials or product database copied.
- Introduce one operation-state vocabulary used by runtime parsing and types.
  Decode every nonblank ledger row before reducing latest state. Reject
  malformed JSON, missing identity, unknown state and malformed control fields
  with line-numbered, content-free integrity errors. Never truncate or repair
  the original ledger automatically. Preserve missing-file initial semantics.
- Historical records without `recovery_contract` exist. Interpret their missing
  contract conservatively as DO_NOT_AUTORETRY with zero retry budget in the
  read projection; retain original bytes. Reject malformed present contracts.
  This is compatibility parsing, not trust promotion or legacy migration.
- Validate state before operation append and preserve source bytes on failure.
  Cross-process serialization and legal terminal commit remain separate open
  obligations; this change cannot claim transactional concurrency closure.
- Continuity must propagate failures from queue recovery, operation recovery,
  wait/wake and queue summary to its existing bounded error loop. No runner
  dispatch may follow a failed prerequisite. Enable dependency injection and
  import without starting the service so the actual step can be exercised
  against failing and healthy dependencies with no provider effects.
- Include stop-sentinel and marathon-owner inspection in that containment
  boundary: only ENOENT establishes absence and only ESRCH establishes a dead
  process. Invalid ownership and permission failures propagate. Supervisor
  acquisition distinguishes known contention from unknown failure.
- Apply the same ownership rule to operation-owner probes: require a complete
  positive PID identifier and propagate non-ESRCH probe failures.
  Present owner strings must be nonblank; only explicit null denotes no owner.
  Empty strings cannot skip ownership inspection through truthiness.
- Timestamps must be real UTC ISO calendar values, with seconds and optional
  three-digit milliseconds. Reject timezone-less, numeric and rollover dates.
- Serialize once, validate those exact persisted bytes, then append and return
  the decoded record. Object validation alone cannot authorize different bytes
  produced by a custom serializer. No invalid serialization may poison state.

Independent oracle review identified remaining system obligations: deletion or
truncation after initialization, recovery authority for legacy contract-less
rows, unknown queue states, earlier mutations before later prerequisite failure,
and bounded convergence of the outer retry loop. Keep all open; this candidate
cannot establish I9/I14 globally or operational closure. Legacy compatibility
parsing alone is not proof of safe recovery. Source/test identities must include
the candidate overlay, not HEAD alone.

## Affected modules and side effects

`server/aiCompany/durableOperation.ts`, new integrity decoder and tests;
`scripts/ai-company-continuity-kernel.mjs` and step integration tests. Marathon
and canary callers receive visible integrity errors instead of partial data.
Configured services remain on legacy checkout; candidate has no authority.
Existing public signatures and legal state names are preserved. Corrupt
ledgers that were silently tolerated will now block work deliberately.

## Risks and guardrails

Historical rows may omit fields: inspect actual corpus and explicitly preserve
safe schema compatibility. Do not silently add success or retry authority.
Do not include private row content in errors. Import-safe testability must not
change direct CLI startup or stop-sentinel behavior. Full F0/state migration
backup remains pending, so no service cutover or canonical writes occur.

## Validation

Before implementation, run historical corruption and unknown-state/shape
counterexamples and direct step prerequisite-failure tests against F0.
After implementation verify preserved bytes, line numbers, healthy reads,
conservative legacy parsing, rejection before append, all legal enum states,
no dispatch after each failed prerequisite, healthy dispatch, import safety,
stop sentinel, existing durability/supervision tests and targeted type/lint.
Use copied legacy ledger only for compatibility, never as trusted evidence.
Request independent falsification before any promotion. Candidate test results
do not establish live readiness or close the mission.

## Decision

Approved for isolated implementation under Founder Mission standing local
authority. 2026-09-30. No production or local-authority promotion granted.
