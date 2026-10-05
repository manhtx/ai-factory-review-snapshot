# Macro OS Autonomous Product Company — Releases & Verified Deployments

## Release History

### Release v1.2.0 (Epoch 0000 — 2026-08-31)
* **Status:** Master Verified (Tier 1 — 96/100 Pts)
* **Capabilities Included:**
  - Universal Compare Engine (`/compare`) with Z-score standardization and Pearson $r$.
  - Dynamic derivation on World Screener and Country Hubs (`/countries/:code`).
  - Layered semantic bounds validation and outlier spike detection.
  - Calendar-aware freshness model with per-series publication lag schedules.
  - Candidate source mapping registry and reconciliation reports.
* **Verification Evidence:**
  - `tsc --noEmit`: 0 errors
  - `eslint`: 0 errors, 0 warnings
  - `vitest`: 84/84 test suites (349 tests passed)
  - `vite build`: Production build ~2.63s
