# Current Product Backlog and Sprint Flow — independent audit

Date: 2026-09-14

## Actual current flow

```text
PRODUCT_GOAL + route observation
  -> .ai-company/product-intelligence/CURRENT_PRODUCT_OBSERVATION.json
  -> PRODUCT_BACKLOG.json (candidate + selected opportunity)
  -> create-codex-product-cycle.mjs
  -> RoleWorkQueue / handoff ledger
  -> PM role
  -> coordinator PM approval gate
  -> backend / QA tasks
  -> role artifacts and evaluation
```

The queue is execution state, not a product backlog. The existing `.ai-company/runtime/backlog.jsonl` is a legacy backlog-like ledger and is not currently the sole canonical product planning source. No first-class Sprint record was found in the current runtime path; therefore sprint authority is not yet proven.

## Evidence and verdict

| Question | Current evidence | Verdict |
|---|---|---|
| Product observation exists | `CURRENT_PRODUCT_OBSERVATION.json` | Proven |
| Evidence-backed candidates | `OPPORTUNITY_BACKLOG.json`, discovery run output | Proven |
| PM runs before implementation | cycle queue and `PM_APPROVAL_REQUIRED` guard | Proven for product cycle path |
| PM can reject/hold work | cycles `1789384946273`, `1789385322323` | Proven |
| Canonical durable ProductBacklogItem | multiple legacy ledgers plus JSON opportunity file | Partial |
| First-class Sprint and Sprint Backlog | no authoritative runtime Sprint entity found | Failed / missing |
| Engineer bypass without PM | coordinator blocks downstream after PM HOLD | Proven on tested path |
| Product execution requires sprint selection | no active-sprint authority in current dispatch path | Not proven |
| R0 test/validation exception | existing WorkIntent routing and tests | Proven |

## Recent real IDs

- `codex-product-cycle-1789385322323`: PM `HOLD`; backend `BLOCKED` with `PM_APPROVAL_REQUIRED`.
- `codex-product-cycle-1789385458064`: cycle records were created but had not yet executed at audit time.
- `OPP-PROVENANCE-TRACEABILITY`: selected from observed indicator/provenance evidence.

## Main gap

PM approval is now upstream of the tested product-cycle implementation path, but “approved product work” is still conflated with “cycle assignment”. A canonical backlog item, Definition of Ready, and active Sprint selection must be persisted and referenced before normal product mutation is admitted. This is the next control-plane boundary; it must not be inferred from a queue row or DAG.
