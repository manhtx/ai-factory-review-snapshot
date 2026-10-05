# AI Company 10/10 Remediation Plan

## What 10/10 means

10/10 means the system is demonstrably safe, effective and economical for a
defined risk class. It does **not** mean infinitely autonomous or universally
optimal. Every criterion needs reproducible evidence and an independent check.

## Remediation matrix

| Weakness | Corrective work | Required evidence | Exit gate |
|---|---|---|---|
| Deterministic-only workers | Implement provider-neutral model adapter; run fixed prompts and golden inputs through real models; retain raw/normalized traces | model/prompt/version, outputs, latency, token counts, evaluator scores | ≥30 repeated tasks, no critical regression, reproducible fingerprints |
| One generic failure pattern | Expand corpus with stale-data, provenance-loss, revision overwrite, UX misunderstanding, gate bypass, prompt injection, timeout and partial-write faults | per-fault incident and recovery artifact | every fault reaches safe terminal state; no unsafe release |
| Evidence coverage delta = 0 | Add evidence completeness, provenance depth, citation correctness, freshness and contradiction checks | linked `EvidenceRecord` plus independent citation verdict | ≥95% release-bound evidence coverage; zero unsupported critical claims |
| Cost delta = 0 | Capture input/output tokens, provider cost, cache hits, retries and cost per validated outcome; add model routing | signed usage ledger and budget report | budget never exceeded; ≥20% cheaper route with equal quality, or documented trade-off |
| No real user outcome | Run blinded persona/user studies on fixed tasks; instrument completion, time-to-insight, comprehension and accessibility | anonymized task telemetry and UX review | ≥90% task success; no unresolved critical accessibility issue |
| Local-only recovery | Add kill/restart, outbox replay, duplicate claim, storage outage and restore drills | checkpoint/replay/restore checksums, RPO/RTO | 3 consecutive drills pass; no lost committed artifact |
| Principles not causal | Freeze corpus; compare baseline vs one principle change; use repeated seeds and confidence intervals | experiment manifest, raw scores, statistical report | non-regression in all safety metrics and statistically credible improvement |
| Production data gaps | Replace every production synthetic path with licensed real-data adapter; preserve revisions and stale state | source/license/provenance/reconciliation artifacts | synthetic production path count = 0; two consecutive preflights pass |
| Governance not independently audited | External review of permissions, decisions, release gates, prompt/tool safety and exception expiry | signed independent audit and remediation log | zero open critical/high findings |

## Execution order

```text
R0 freeze baseline and corpus
R1 realistic faults + evidence evaluator
R2 model adapter + prompt regression
R3 token/cost telemetry + budget enforcement
R4 user and accessibility evaluation
R5 chaos/replay/restore drills
R6 real-data migration and licensing
R7 independent security/governance audit
R8 canary, rollback and outcome review
R9 final re-score
```

Each release of a principle, prompt, model or tool must pass R0–R5 regression
before it can enter R6–R8. A failed gate records `HOLD`/`REVISE`; it cannot be
overridden by the CEO or by editing the scorecard.

## 10/10 score rules

- Missing evidence scores zero for that criterion.
- A local mock can validate control flow, never model quality or user value.
- Safety metrics are hard constraints, not averages that can be offset by speed.
- Cost savings do not count if evidence quality or user success regresses.
- “10/10” is valid only for the tested risk class and deployment context.
