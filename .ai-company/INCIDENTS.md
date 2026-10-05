# Macro OS Autonomous Product Company — Incidents Register

## Production & Quality Incidents

| Incident ID | Date | Severity | Description | Root Cause | Remediation | Status |
|---|---|:---:|---|---|---|:---:|
| **INC-001** | 2026-08-31 | High | Quality Gate Breakdown (14 TS errors & ESLint failures) | Code modifications without running comprehensive `npm run check`. | Fixed all types, restored 0-warning lint policy, made `npm run check` mandatory. | ✅ Resolved |
| **INC-002** | 2026-08-31 | High | Global M2 False Aggregate Assumption | Summing multi-country M2 with mismatched annual/monthly cadences. | Renamed indicator, standardized on annual World Bank contract, documented FX methodology. | ✅ Resolved |
