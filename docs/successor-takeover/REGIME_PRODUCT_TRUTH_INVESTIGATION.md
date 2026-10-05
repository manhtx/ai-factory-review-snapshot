# Regime page product truth investigation and repair plan

Status: isolated repair approved by the mission's standing local authority; no promotion.

## Problem and evidence

`RegimeDetectionPage.tsx` substitutes 14.5% credit and 12% property growth when observations are absent, invents an observation date and `verified` status, then displays `FACTUAL` and validated data. Changing a simulation changes the same factual panel. React state initialized from initial observations also survives later hydration as though it were current data.

The property catalog defines a price level in million VND/m², while the model needs annual percentage growth. `Snapshot.changePct` is not proof of an annual transformation; the page's nonexistent `changePercent` field always selects its fallback on real typed snapshots. The API handler independently passes the property price level directly into the annual-growth calculation. This API defect is a separate affected consumer requiring a subsequent contract repair; page tests cannot close it.

The model returns classifications even for invalid/stale/misaligned inputs. Its numerical calculator is suitable for explicit scenarios, but its status must gate any observed inference. Existing page tests mock evidence eligibility to true and use `status: verified`, outside the legal data-state vocabulary, so they cannot establish product truth.

## Root cause and impact

Missing admission between hydrated observations and the model; observed and scenario state share one result; invented defaults supply evidence; source identity, units, dates and quality are not conserved. Violates mission I4/I13/I14 and Product Goal sections 9–11 (fact/interpretation/uncertainty, no unsupported current reality), and inspection requirements in sections 14/16.

Affected modules: the page, its regression tests, and a page-specific observation adapter. Preserve the numerical calculator and scenario presets. Analytics API remains an explicitly open consumer, not silently repaired through the UI.

## Permanent solution / technical design

Admit only actual verified fresh URL/series-backed VN observations, finite values, coherent snapshot/latest-point identity and valid dates. Credit must explicitly identify annual percentage growth. Property growth is either an explicitly annual percentage series or a derivation from actual same-source price-level observations exactly one calendar year apart. Missing annual comparison stays unavailable; do not substitute adjacent-period change or an assumed annualization.

Keep observed values derived from current context on each render. Store only explicit user scenario overrides. Observed facts and source links remain unchanged by simulation. Gate observed inference on complete admissible inputs and calculator status. Label scenario values and inference as assumptions, with no source claim. Reset removes overrides and rereads current evidence. Translate critical model tone to the design system's negative tone.

Independent review found contradictory metadata admitted: credit transformation `mom` with a YoY unit, and property `% MoM` with a `yoy` transformation. Tighten admission to mutually consistent explicit `% YoY` and `yoy` metadata for growth series; derive price growth only from explicit `level` transformation and the registered price unit. Unknown/custom transformation is insufficient for a verified annual-growth claim. Replay both independent cases before requesting recheck.

Methodology truth: the inspected calculator contains a configurable five-percentage-point classification rule, but no source or calibration for SBV/IMF endorsement or probabilistic risk. Remove that endorsement from page copy, expose the five-point heuristic, and label its score as an uncalibrated rule score. Keep arithmetic and classification capability; do not present heuristic text as a causal diagnosis or probability. This page-source revision supersedes the prior reviewed page hash and needs independent copy/behavior recheck.

Display spread in percentage points (`pp`), with the expanded unit in its description; growth inputs remain percentages. Declare corresponding scenario units in the API response. A difference between two growth percentages is not itself percentage growth.

## Preference, prevention, risks

This preserves the stress simulator while cutting off fabricated observation admission. A conservative annual comparison can withhold output for sparse or incompatible series; that is visible missing evidence. Do not change ingestion, source licensing, product direction or authority. Freshness initially follows the upstream contract; full source freshness/identity verification remains a separate open proof.

## Test strategy

First reproduce absent-data false validation and scenarios relabeled as facts against the existing page. Use the real evidence helper. Verify empty, unverified, stale, missing-source, invalid/date-mismatched and incompatible-unit observations; exact annual property derivation; rejection of adjacent-period change; valid zero/negative growth; hydration changes; scenario preservation; reset to latest observations. Run related calculator/data-contract tests, lint and typecheck. Rendered browser verification and independent product review are required before any promotion or product-truth closure.

## Decision

Approved scope: isolated candidate page/adapter/tests under Founder Mission section 4. Implementation follows this document. Full successor and product-data truth closure remain unproven.
