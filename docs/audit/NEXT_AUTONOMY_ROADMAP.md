# AI Company — Next Autonomy Roadmap

Audit date: 2026-09-11. Recommended single strategy: **C — build the missing continuity layer**, then prove product impact. No production deployment is included.

## Immediate: continuity proof

1. Define a durable supervisor checkpoint containing run, namespace, work IDs, attempt, recovery depth, next wake and terminal reason.
2. Add a single-instance lease with stale-lease recovery and atomic append semantics for local JSONL.
3. On boot, reconcile incomplete work, provider failures, locks and orphan worktrees before scheduling new work.
4. Add bounded provider backoff/circuit-breaker/dead-letter states; never turn transport retries into duplicate role work.
5. Run kill/restart, simultaneous coordinator, interrupted append and provider-503 drills.

Acceptance: seven consecutive simulated days run without founder start/retry; every transition is idempotent; all failures end in retry or explicit escalation; no duplicate recovery/work item.

## Next: close the product loop

1. Select one Macro OS research task tied to `docs/PRODUCT_GOAL.md` and an actual user-facing metric.
2. Capture baseline → bounded change → release candidate → measurement window → outcome → learning.
3. Require outcome provenance and make verified learning alter a later backlog ranking in replay.
4. Reconcile token telemetry per provider/model/attempt and report value per token only when actual usage exists.

Acceptance: one product outcome is verified with real user/task evidence; one later decision changes because of that learning; token and failure metrics are authoritative.

## Later: controlled staging

Only after the above passes: reversible staging slice, human-gated release, rollback drill, and independent security/rights review. Production autonomy remains disabled.

## Explicit do-not-build list

- no new agent roles;
- no UI/dashboard surface;
- no Postgres migration solely for this milestone;
- no autonomous production deploy or data mutation;
- no LLM reviewer where a deterministic validator suffices;
- no token optimization claim without comparable runtime usage.
