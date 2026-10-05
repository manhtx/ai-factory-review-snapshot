# Evidence Gap Register — Phase 0

| ID | Gap | Severity | Owner | Required evidence | Status |
|---|---|---:|---|---|---|
| GAP-001 | Tier 1 maturity claim lacks independent re-performance | P0 | Board Audit | Re-run all scorecard dimensions from artifacts/runtime | OPEN |
| GAP-002 | External controller can cycle providers after quota failures | P0 | COO / SRE | Bounded circuit-breaker test and log evidence | FIX IN PROGRESS |
| GAP-003 | Durable checkpoint/restart semantics are not proven | P0 | CTO | Kill/restart test with state continuity | OPEN |
| GAP-004 | Agent permissions are documented but not enforced by a policy engine | P0 | CISO / CTO | Deny-by-default integration tests | OPEN |
| GAP-005 | Telegram control plane is not present/proven | P1 | COO | Authenticated command and audit tests | OPEN |
| GAP-006 | Independent QA/User/Domain reports are not linked to release gates | P1 | CPO / Quality | End-to-end artifact lineage | OPEN |
| GAP-007 | Token cost per validated outcome is not measured | P1 | CFO | Per-run usage and outcome ledger | OPEN |
| GAP-008 | Existing quota/error logs are not classified by root cause | P1 | Failure Analysis | Aggregated failure taxonomy and remediation plan | OPEN |
