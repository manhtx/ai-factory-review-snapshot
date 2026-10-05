# Unblock and Safe Product Readiness Plan

## Definition of done

Macro OS may enter a product canary only when every mandatory gate below has a
passing, timestamped artifact. Local tests passing alone are insufficient.

## Track A — work executable in this repository

### A1. Workspace isolation

- register project/worktree identity and immutable `project_id`;
- reject writes outside the project adapter and approved artifact roots;
- use feature flags for every real-data replacement;
- preserve synthetic fixtures only under test scope;
- add a dry-run mode for ingestion and migrations.

### A2. Data-plane replacement

Migrate in waves from `PRODUCTION_DATA_REMEDIATION_PLAN.md`. Every indicator
must have source, license classification, release calendar, durable observation
identity, revision history, freshness state and provenance evidence. Missing
data is `unavailable` or `stale`, never fabricated.

### A3. Recovery and rollback

- checkpoint before every external write;
- idempotency key for every ingestion and workflow command;
- bounded retry plus circuit breaker;
- restore drill in an isolated database;
- rollback verification before enabling a flag.

### A4. Product safety

- production gate defaults to deny;
- no agent can approve its own output;
- release requires independent QA, UX/user review and domain review;
- P0 stops; P1 remains within CEO guardrails; P2/P3 continue safely;
- secrets never enter logs, artifacts or prompts.

### A5. Evidence and operations

- persist preflight, corpus, cost and incident artifacts;
- produce CEO health/optimization reports per sprint;
- require two consecutive passing preflights before canary;
- maintain an explicit unresolved-risk register.

## Track B — external prerequisites

These cannot be invented by code and must be supplied by an authorized owner:

1. Managed Postgres/Supabase project and server-side secret manager.
2. Remote migration and backup/restore access.
3. Provider terms/licensing approval for each production source.
4. Attested deployment identity and signed runtime revision.
5. Approved domain, monitoring and incident contact.

## Execution gates

```text
G0 inventory and baseline
G1 workspace isolation tests
G2 one real-data vertical slice
G3 durable persistence + migration evidence
G4 recovery/rollback drill
G5 independent product review
G6 two consecutive production preflights
G7 canary with automatic rollback
G8 post-canary outcome review
```

Failure at any gate returns to `HOLD` or `REVISE`; no gate may be bypassed by
changing a status flag. This plan is itself not evidence of readiness.
