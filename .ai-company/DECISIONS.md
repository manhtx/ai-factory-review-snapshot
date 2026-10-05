# Macro OS Autonomous Product Company — Decisions Log

## Architecture & Product Decisions (ADR)

| ADR ID | Date | Title | Approver | Context & Rationale | Status |
|---|---|---|---|---|:---:|
| **ADR-001** | 2026-08-31 | Dynamic Derivation for World & Country Views | CPO / CDO | Replaced all hard-coded mock strings with dynamic lookups from `state.indicators`. | ✅ Approved |
| **ADR-002** | 2026-08-31 | Canonical Route Parameter Handling | CTO / CPO | Enforce `/countries/:code` with explicit Unsupported screen instead of silent US fallback. | ✅ Approved |
| **ADR-003** | 2026-08-31 | Universal Compare Engine & URL State | CPO / CTO | Unified comparison, overlays, Z-scores, and lead/lag into `/compare` with full URL serialization. | ✅ Approved |
| **ADR-004** | 2026-08-31 | Major 4-Economy M2 Basket Normalization | Chief Economist / CDO | Renamed global M2 to 4-economy annual basket to accurately reflect World Bank data reality. | ✅ Approved |
| **ADR-005** | 2026-08-31 | Layered Semantic Bounds & Outlier Gates | CDO / Data QC | Enforced economic range validation (rates $[-10\%, 100\%]$, quantities $\ge 0$) and $>20\times$ spike warnings. | ✅ Approved |
| **ADR-006** | 2026-08-31 | Calendar-Aware Freshness & Publication Lags | CDO / SRE | Replaced 730-day blanket freshness with per-series release calendar schedules. | ✅ Approved |
| **ADR-007** | 2026-08-31 | Autonomous Product Company Governance | Board / CEO | Established multi-tier separation of duties and multi-horizon autonomous execution model. | ✅ Approved |
