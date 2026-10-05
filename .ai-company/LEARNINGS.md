# Macro OS Autonomous Product Company — Learnings & Retrospectives

## Key Institutional Learnings

1. **Analytical Rigor Over Analytical Theater:**
   Mock indicators (like hardcoded 64th percentiles or fake verified badges) rapidly destroy user trust. Computing mathematically exact metrics directly from verified observation histories creates immense institutional credibility.

2. **URL State is a Core Research Feature:**
   Research analysts work across tabs, bookmarks, and collaborative Slack/Teams threads. Encoding series selection, transform modes, and lag parameters directly into query strings converts static dashboards into shareable research artifacts.

3. **Domain Contracts Must Enforce Economic Plausibility:**
   Syntactic validation (`typeof value === 'number'`) is insufficient. Economic data requires semantic validation: interest rates cannot be $1500\%$, quantities cannot be negative, and multi-currency aggregates must declare their exchange rate methodology.
