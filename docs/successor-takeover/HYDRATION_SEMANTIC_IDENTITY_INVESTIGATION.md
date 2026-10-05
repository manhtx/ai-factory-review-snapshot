# Hydration semantic identity — investigation and scoped design

## Goal alignment / requirement

Product Goal §§9–11: a displayed value must retain its actual series identity,
frequency, unit, transformation and freshness. Research question: does the
observation actually support the comparison the user is making? Mission I13/I14.
This is a product/data-plane repair, not governance promotion or source authentication.

## Problem, root cause and evidence

`hydrateActualIndicators` fetches a snapshot and a series separately, then combines
snapshot trust fields with catalog units/frequency/transformation and series values.
It does not validate payload/row indicator IDs, source identity, semantic coherence,
or snapshot/latest-series agreement. Type assertions are not network validation.

The registered apartment source is quarterly USD/sqm, while the catalog is monthly
Tr VND/m². Credit is registered semiannual growth versus end-2024, not catalog YoY.
Ingestion stores FRED transformation codes (`pc1`, `pch`, `lin`, `chg`, `ch1`), not
client enum names. Hydration currently ignores those codes. The server freshness
module already contains a pure, indicator-specific release calendar; hydration
currently trusts the supplied snapshot label without checking observation age.

Scope is SOURCE_CAPABLE and called by MacroContext/bootstrap. No claim that a
currently running canonical process uses the candidate. Network-mocked tests of
the real hydrator will replay these failures before application edits.

## Technical design / permanent solution

1. Validate snapshot list, unique IDs and series payload at the hydration boundary.
   Admit only registered source-series identities; reject malformed/mixed identities,
   impossible/future/unsorted/duplicate dates and nonfinite numbers. Require snapshot
   agreement with the latest row for value/date/source/semantic/trust fields. A race
   between the two endpoints withholds that indicator rather than inventing coherence.
2. Normalize registered/API frequencies and transformation codes explicitly. Preserve
   actual row source/frequency/transformation. Add semiannual to the existing client
   frequency vocabulary, period alignment and minimum-gap map. Correlation uses its
   real rank, not monthly fallback. No new chart/design pattern.
3. Use explicit row unit or registered unit. A missing unit may use the catalog
   definition only when source identity, frequency and transformation all match the
   registered contract AND the catalog frequency/transformation. Explain this bounded
   definition fallback in provenance notes. Incompatible/missing definitions withhold
   the observation; do not convert currencies or invent annual growth.
   Explicit units must also agree with a compatible registered/catalog definition;
   supplied metadata cannot self-certify an arbitrary unit. Require the registered
   citation URL for the current API contract; future alternate citations need an
   explicit registered mapping, not an unrestricted URL fallback.
4. Move the existing pure freshness implementation unchanged into shared client data;
   retain `server/freshness.ts` as a compatibility re-export. Compute hydration freshness
   with the existing indicator release schedule and observation date. Combine it with
   server freshness conservatively: missing/unknown stays unavailable; never upgrade
   a server downgrade. No new age thresholds or calendar policy in this repair.
5. Respect explicit evidence-operation rejection; absent eligibility remains an open
   upstream contract limitation rather than fabricated authorization. Failed indicators
   are omitted from research state as today; telemetry records rejected count/reasons,
   and ready reports whether hydration is partial. Stored observations remain untouched.

## Impact, side effects and risks

Affected: platformApi hydration, new boundary validator/shared freshness module,
client frequency type, series period-key/minimum-gap and correlation rank, server
freshness import compatibility. Existing company foundations remain frozen.

Some previously displayed but semantically incompatible values become unavailable.
This preserves valid observations and historical storage, not the misleading display.
Registered source/config identity is not independent source authenticity; source
geography/definition, store authority, release calendars and full annual adapters
remain separate obligations. Snapshot/series races can temporarily reduce availability;
no retry-until-green or silent fallback is added. Unknown schedules remain unavailable.
Semiannual support does not validate all analytical algorithms for that cadence.

## Why preferred / prevention

One admission boundary prevents labels from laundering incompatible values into
research state. Shared freshness avoids divergent client/server rules. Compatibility
re-export preserves existing callers. Original counterexamples become regression
tests; malformed responses cannot rely on TypeScript casts. No API/storage migration.

## Validation strategy

Real hydrate function with fetch/telemetry mocked: wrong payload/row/source IDs,
snapshot-series races, mixed units/transforms/frequencies, actual metadata preservation,
null/invalid/future/old dates, old data mislabeled fresh, server downgrades, unsupported
evidence operation, malformed arrays and duplicate snapshots. Happy-path registered
series and isolated rejection/progress. Shared freshness regression, source-backed
data contract, period alignment, page/annual-admission/API/bootstrap regression,
changed-file lint, typecheck comparison and build. Independent product-only review;
no live provider, database initialization or canonical service writes.

## Decision / authority

Plan presented before application edits; approved scope derives from the explicit
standing local reversible mission authority. Isolated successor worktree only.
Status: isolated implementation; independent review pending. Original real-hydrator
replay: 26 failures / 3 passes. Two subsequent coherent-citation/unit attacks also
failed before their repair. Current combined regression: 156 passes, no failures;
build and changed-file lint pass. Global typecheck retains six existing company
diagnostics; not a green repository claim.

## Historical capability rehearsal

`tools/replay-hydration-backup.mjs` verifies the exact F0 backup hash and opens it
read-only. Replaying all 126 stored indicator snapshots with current catalog/API
fallback shapes admits 96 and withholds 30. Every withheld result is retained in
`evidence/hydration-f0-replay-v1.json`; none is deleted from storage.

The 30 lack a compatible explicit unit definition. Several are genuinely important
capabilities (rates, liquidity, FX, Vietnamese macro and index data), not optional
deletions. Many level series carry catalog `custom` metadata; others have cadence
or scale mismatches (e.g. K claims, B USD, annual versus monthly/quarterly). Do NOT
fix this by treating `custom` as level or relabeling units without source evidence.
Promotion is blocked until required source-unit/scale definitions are reconciled
and replayed. This is measured assurance debt, not product-capability closure.
