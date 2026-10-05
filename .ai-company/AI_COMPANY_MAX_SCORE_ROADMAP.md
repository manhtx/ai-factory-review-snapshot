# AI Company Max-Score Deployment Roadmap

Baseline: **68/100 local-first** in `AI_COMPANY_SCORECARD.md`. A score increases
only when the evidence artifact and independent gate named below exist.

## Wave 1 — local excellence (68 → 75)

**Owner:** CEO + CTO. **No external credentials required.**

- Add golden task corpus for Macro OS (requirements, evidence, UX and release
  safety cases) and run it on every change.
- Add model/prompt regression snapshots, hallucination and tool-use safety
  checks; quarantine regressions automatically.
- Add cost budget tests, token attribution and early-exit/cache assertions.
- Add property/chaos tests for duplicate events, crash recovery, stale locks,
  partial completion and circuit-open behavior.
- Add project-scoped feature-flag and artifact-path enforcement tests.

**Gate:** full check passes; 3 consecutive corpus runs pass; no unbounded retry;
all release-bound events have evidence IDs.

## Wave 2 — real-data vertical slices (75 → 82)

**Owner:** Data Source Scout + Ingestion + Domain Expert. **External rights
review required.**

Migrate in this order: monetary/inflation/labor → bonds/currency/stocks →
liquidity/PMI/real-estate → alternative/Vietnam. For each indicator:

- licensed source and source-series identity;
- durable raw fingerprint and normalized observations;
- revision and release-calendar metadata;
- freshness/stale/unavailable state;
- reconciliation and semantic tests;
- independent evidence/citation review.

**Gate:** synthetic-path audit count reaches zero for production paths; two
  consecutive real-data audits pass; no silent fallback.

## Wave 3 — durable operations (82 → 88)

**Owner:** CTO + SRE. **Managed Postgres/Supabase required.**

- apply and verify remote migrations;
- move event/task/evidence/usage ledgers to durable storage;
- add transactional idempotency and outbox/replay;
- execute backup/restore drill in an isolated target;
- execute kill/restart and network-failure drills;
- publish RPO/RTO and SLO dashboards.

**Gate:** `durablePersistence=true`, remote migration artifact, restore checksum,
  successful replay, and three consecutive recovery drills.

## Wave 4 — security and governance audit (88 → 93)

**Owner:** CISO + Ombudsman + Independent Quality Auditor.**

- threat model all tools and agent permissions;
- test prompt injection, confused deputy, replay and privilege escalation;
- verify secret redaction and supply-chain lockfile policy;
- independent audit of decision rights, release gates and evidence provenance;
- record findings and verified remediation.

**Gate:** zero open critical/high findings; signed independent audit artifact;
  all exceptions have expiry and owner.

## Wave 5 — canary and measurable value (93 → 95+)

**Owner:** CEO + Product + SRE.**

- deploy an attested canary with project isolation;
- measure user task success, latency, cost per validated outcome and failure
  escape rate for at least 10 comparable runs;
- automatic rollback on SLO or evidence breach;
- review agent/prompt/model performance and retire weak capabilities;
- run quarterly board review and re-score from artifacts.

**Gate:** two consecutive canary windows meet SLO, no critical incident, user
  task success target met, and external audit accepts the evidence package.

## Non-negotiable scoring rules

- A passing unit test cannot substitute for production evidence.
- A feature that increases surface area without reducing a measured risk earns
  zero points.
- Synthetic data may remain in test fixtures but never in a production path.
- Missing evidence means the criterion stays at its previous score.
- Any critical security, provenance or recovery regression triggers rollback.
