# Macro OS Production Data Remediation Plan

## Hard gate

`npm run audit:production-preflight` must exit `0` with
`productionSafe: true` before any production release. Synthetic generators are
not accepted as a fallback for research claims.

## Migration order

| Wave | Modules | Primary owner | Independent verifier | Acceptance evidence |
|---|---|---|---|---|
| 1 | monetary, inflation, labor | Data/Ingestion | Data Quality + Domain Expert | licensed source, durable observation rows, freshness and revision metadata |
| 2 | bonds, currency, stocks | Market Data | Reconciliation + Risk | source agreement, units/currency checks, missingness report, provenance |
| 3 | liquidity, pmi, realestate | Macro Data | Statistical Validation + UX | semantic validation, release calendar, stale-state UI, citation artifact |
| 4 | alternative, vietnam | Country/Alternative Data | Vietnam Specialist + Independent Auditor | rights record, country scope, historical continuity, attestation |

## Required per-module contract

1. Replace `mockHelpers` imports with a real-data adapter.
2. Register source identity, license/terms, retrieval timestamp and release
   calendar.
3. Persist raw response fingerprint and normalized observations durably.
4. Preserve revisions; never silently overwrite an earlier observation.
5. Emit an `EvidenceRecord` with provenance and confidence for every derived
   value shown to users.
6. Add unit, integration and stale/failure tests before removing the synthetic
   implementation.
7. Run the independent verifier and record a signed decision artifact.
8. Keep a rollback adapter until two consecutive production-preflight runs pass.

## Stop conditions

- Missing credentials, licensing, durable storage or attestation: `HOLD`.
- Provider outage: use an explicitly labelled stale state; never fabricate a
  replacement series.
- Semantic mismatch or unexplained reconciliation delta: `REVISE`.
- Any synthetic generator detected in a production path: release blocked.

This document is a remediation plan, not evidence that the migration is done.
