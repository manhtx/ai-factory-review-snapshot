---
description: Independent process and scorecard review after every five epochs
---

# Five-Epoch Company Process Review

Run this review whenever `(last_completed_epoch % 5) == 0`, before selecting new
delivery work. It is a quality gate, not a celebratory report.

1. Read `docs/PRODUCT_GOAL.md`, `.agents/rules/scope-and-epoch-gates.md`, the
   last five epoch folders, scorecards, ledgers, diffs, tests and release logs.
2. CEO/CPO classify every initiative as `CORE_ALIGNED`, `ADJACENT_APPROVED`, or
   `OUT_OF_SCOPE`. Park/kill out-of-scope families; never rationalize them by
   technical novelty.
3. User panel proves a target job with real telemetry, interview, browser task
   or explicit `HYPOTHETICAL_PERSONA` label. No adoption score without real
   user evidence.
4. CDO/Chief Economist inspect provider identity, source URL, observation and
   release time, vintage, frequency, unit, transformations, freshness, rights,
   reconciliation and actual hydrated coverage.
5. CTO/SRE measure runtime latency, request count, error rate, persistence,
   recovery and deployed evidence. Build time is not page performance.
6. CISO/Legal/CFO review auth, quotas, abuse cost, licensing, external impact
   and approvals. Missing approval means HOLD, not ACCEPT.
7. Independent Auditor re-performs a sample of acceptance checks and records
   counter-evidence. Implementers do not sign their own result.
8. Recalculate scorecard from evidence with confidence caps. A score cannot
   increase merely because code or tests were added.
9. Produce `.ai-company/reports/process-review-epoch-NNNN.md` containing:
   findings, drift register, score correction, killed/parked work, rollback
   decisions, next five-epoch focus and open approvals.
10. Only after this report is persisted may the next epoch select work.
