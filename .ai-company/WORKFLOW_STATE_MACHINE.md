# Workflow State Machine v1

## Allowed transitions

```text
INTAKE → DISCOVERY → COUNCIL_REVIEW → PM_BACKLOGGED → CEO_PRIORITIZED → READY
READY → EXECUTING
EXECUTING → INDEPENDENT_VERIFICATION | REVISE | BLOCKED | HOLD | ESCALATED | CIRCUIT_OPEN
INDEPENDENT_VERIFICATION → USER_AND_DOMAIN_REVIEW | REVISE | ROLLBACK | HOLD
USER_AND_DOMAIN_REVIEW → RELEASE_GATE | REVISE | HOLD
RELEASE_GATE → RELEASED | REVISE | ROLLBACK | KILLED
RELEASED → OUTCOME_EVALUATION
OUTCOME_EVALUATION → LEARNED | ESCALATED
LEARNED → INTAKE
```

## Transition invariants

- `READY` requires one accountable owner, acceptance criteria, budget, risk
  level, dependency resolution and rollback plan.
- `RELEASED` requires independent test evidence and a release-gate decision.
- A task cannot transition directly from `EXECUTING` to `RELEASED`.
- `P0` and expired approvals enter `HOLD` or `ESCALATED`.
- `CIRCUIT_OPEN` requires an explicit reset decision and cannot self-reset.
- Every transition appends an immutable event with actor, reason and timestamp.
