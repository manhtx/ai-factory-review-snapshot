# AI Company — Post-Optimization Gaps

Audit date: 2026-09-11. This register reflects current runtime evidence, not historical claims.

| ID | Severity | Current gap | Evidence and status | Next acceptance criteria |
|---|---|---|---|---|
| G-01 | P1 | Long-duration unattended continuity | Local LaunchAgent is running and checkpoint/reconcile tests pass; no literal 7-day or reboot-window proof | Controlled longer observation with persisted restart/reconcile evidence |
| G-02 | P0 | Product outcome is unverified | Local Macro funnel and synthetic/browser evidence exist; no real-user retention, conversion or production outcome | Real Macro user/task metric with baseline, window, outcome and provenance |
| G-03 | P1 | Continuous provider availability | Live Codex recovery proof and 3-cycle recovery epoch pass; external uptime is not observable continuously | Bounded recurring provider-health window with authoritative availability trend |
| G-04 | CLOSED_LOCAL | Learning causality | Persisted learning → reprioritization → backlog decision is tested and recorded | Keep validating on later comparable product cycles |
| G-05 | CLOSED_LOCAL | Token provenance | Actual provider usage is captured per call and separated from estimates; cost remains unclaimed without pricing provenance | Add pricing only when an authoritative pricing source is available |
| G-06 | CLOSED_LOCAL | Review contract quality | Semantic adversarial benchmark passes 6/6 with zero false passes/rejects; subjective LLM quality remains intentionally unclaimed | Add independently labelled semantic corpus only when useful and available |
| G-07 | CLOSED_LOCAL | Revision-bound verification | Authoritative recorder binds commands, exit codes, logs, revision and production no-go; offline check now uses an unreachable port and requires exit 1 | Regenerate after material code changes |
| G-08 | CLOSED_LOCAL | Contradictory optimization snapshot | Optimization state was reconciled to one current epoch and explicit external limitations | Preserve schema/current-state discipline |
| G-09 | P1 | Runtime artifact lifecycle | Retention dry-run identified disposable artifacts; ledgers/evidence remain local/runtime and must not become production source | Continue retention and merge-scope audits before release |
| G-10 | P1 | Real user/market discovery | Local telemetry independently surfaced hydration/funnel hypotheses; no real-user or market validation | Collect ethically sourced production/staging user evidence under human-gated policy |
| G-11 | P0 | Broken source contracts | Current authoritative URL audit found 8/133 source URLs returning 404; those indicators are recorded in `.ai-company/reports/source-contract-quarantine-latest.json` and cannot be promoted | Resolve each mapping with canonical provider/semantic evidence, or keep it quarantined; source audit must report zero unreviewed failures before promotion |

Production autonomy remains `DISABLED` and release remains `HUMAN_GATED`. These are intentional safety policies, not defects.
