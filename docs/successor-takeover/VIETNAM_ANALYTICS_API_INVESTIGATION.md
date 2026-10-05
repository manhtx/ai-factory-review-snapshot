# Vietnam analytics API contract investigation

Decision: isolated repair approved under Founder Mission standing authority; promotion remains withheld.

## Problem, cause and evidence

The route reads the latest SQLite numbers, omits unit/transformation/status/quality/source evidence, and calls an annual-growth calculator. Source contracts identify `SBV_CREDIT_GROWTH_H1` as growth versus end-2024 (not YoY), and `CW_HCMC_APT_AVG_PRIMARY_PRICE` as a quarterly USD/sqm price level. These are not the two required annual growth inputs. The query also turns read failures into missing data and substitutes indicator ID for missing source identity.

Explicit caller inputs are also returned as `factualObservations` although the route has not authenticated or verified them. Numeric coercion admits empty strings/null/booleans as numbers. Invalid calculations can still carry a balanced classification from the calculator. The route tests exercise numerical scenarios, not trustworthy observed-data admission.

## Product alignment and impacted modules

Product Goal sections 9–11 require distinct fact/interpretation/assumption/unknown, traceable source identity and visible missing evidence. Mission I4/I13/I14/I18 prohibit unsupported observed truth. Scope: this Vietnam route, its catalog entry, API contract tests and documentation. Numerical calculator, unrelated analytics routes, stores and ingestion remain unchanged. No production or canonical-state mutation.

## Permanent contract

No-input request is an observed-analytics request. Return an explicit unavailable result with null factual observations and null inference, citing the incompatible registered source semantics. Do not consult a local-only latest-number shortcut. Legitimate observed analytics require a later source-backed annual-growth adapter with compatible units/periods, storage authority, source identity and freshness; the current sources cannot meet it, and this limitation remains open rather than fabricating conversion.

If either annual-growth input is explicitly supplied, require both. Classify all caller inputs as scenario assumptions regardless of caller-supplied status/quality/series metadata. Preserve GET/POST and versioned/unversioned numerical scenario capability. Return `inputClass: scenario`, `scenarioInputs`, null `factualObservations` and an inference only when the calculator status is valid. `valid` means arithmetic admissibility, never verification. Reject coercible nonnumeric/null/boolean/empty inputs, malformed dates, unknown freshness, invalid options, custom methodology claims and unsupported request modes with 400. Numeric query strings remain supported. Dates and known freshness may constrain the calculation without granting observed trust.

The public contract changes from mislabeled facts to explicitly typed assumptions. No application caller was found in the bounded src/server search; existing tests are the known consumers. Preserve route paths, scenario arithmetic, presets and calculator semantics. Add contract metadata/limitations to the catalog. A future observed adapter is a separate required mission obligation; do not claim full API/product closure from unavailable behavior.

## Risks, prevention and validation

Previously automatic numerical output becomes unavailable because the registered inputs are semantically incompatible. Caller payloads remain useful scenarios with clear trust boundaries. Reproduce latest price-level-as-growth, fabricated caller facts and null coercion before coding. Test both route aliases and methods, paired inputs, numeric query strings, explicit zero/negative values, invalid/stale/misaligned inputs with withheld inference, option/date validation, and absence of DB reads. Use mocked DB boundaries or in-memory fixtures only. Run the full analytics router and calculator regressions, lint/typecheck and independent adversarial review before promotion.
