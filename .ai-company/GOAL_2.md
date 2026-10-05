# AI Company Goal 2 — Expand Core Macro Coverage to G20 & ASEAN-6

Document type: Product goal execution contract
Owner: Founder / CEO Guild
Managed product: Macro OS
Status: Living goal; not complete until production evidence passes
Source: `.ai-company/ANNUAL_PLAN.md` Objective 2 and `docs/PRODUCT_GOAL.md`

## Goal

Expand Macro OS from its current coverage baseline to trustworthy, source-backed
coverage for the G20 and ASEAN-6 priority economies. Coverage means more than a
catalog entry: each series must have an explicit availability, freshness,
provenance, rights, revision and release-calendar state.

## Key results

1. Expand high-frequency and monthly series coverage across the 15 priority
   economies.
2. Provide multi-currency M2 liquidity aggregation while preserving annual and
   quarterly frequency distinctions.
3. Provide release-calendar coverage with per-series publication-lag
   monitoring.

## Non-negotiable evidence contract

No series is counted as delivered unless the system records its canonical
country/series identity, provider and series ID, frequency, observation period,
as-of time, freshness state, data state, source link, licensing/rights state,
revision behavior and latest successful audit. Missing or unavailable data must
remain visibly labeled; it must never be filled with synthetic or guessed data.

## Role workflow

```text
CEO Guild: approve scope and trade-offs
→ PM: define country/series user jobs and acceptance criteria
→ Data Engineer: provider contract, ingestion, provenance, freshness, revisions
→ Domain Expert: validate economic meaning and frequency interpretation
→ Backend Engineer: durable storage/API/runtime contract
→ Frontend Engineer: coverage and release-calendar research workflow
→ AI Engineer: grounded explanation and regression evaluation
→ SRE: reliability, backup, recovery and freshness SLO
→ Security: permissions, secrets, rights and threat review
→ Functional QA: acceptance/regression/browser behavior
→ Quality Control: lineage and evidence audit
→ Stakeholder + User Persona: usefulness, risk and unmet need
→ Release Security Gate: release/hold decision
→ Measure: coverage, freshness, task success and operational outcome
→ Learn: update memory, backlog and next priority
```

## Acceptance gates

- All additions are mapped to Macro OS Product Goal objectives 1, 2, 3, 6, 8,
  9 or 10.
- Real provider evidence exists for every claimed delivered series.
- Country, frequency and release-lag audits pass.
- Independent data/domain/QA/QC review passes.
- No provider failure hides unrelated country or indicator failures.
- User can inspect source, current state, history and release timing.
- Rollback/quarantine exists for bad or stale data.
- No forecasting or trading decision-support claim is promoted by this goal.

## Metrics

- Registered vs available vs fresh vs stale vs unavailable series.
- Freshness SLO attainment by provider/country/frequency.
- Publication-lag audit coverage.
- Reconciliation and revision error rate.
- Successful completion of the indicator research journey.
- Evidence coverage and user task success.
- Cost and latency per validated coverage addition.

## Stop, hold and kill conditions

- Hold any country/provider expansion when provenance or rights are unknown.
- Quarantine a series when freshness, revision or reconciliation checks fail.
- Reject an addition that increases breadth without improving a documented user
  research job.
- Kill redundant or persistently unreliable integrations after evidence-backed
  review; preserve the decision and its rationale in company memory.

## Completion definition

Goal 2 is not complete because a country list, endpoint, chart or test exists.
It is complete only when the 15-economy coverage slice repeatedly passes the
real-data, provenance, freshness, release-calendar, user-value and release
gates, and the measured result changes future company priorities.

## Execution reference

The implementation sequence, permissions, provider abstraction, task model,
workflow rules, recovery requirements, milestone gates and no-fake-completion
rules are defined in [MASTER_BUILD_PLAN.md](MASTER_BUILD_PLAN.md). This goal
must be executed through that plan's structured tasks and evidence ledgers,
never through untracked agent conversation.
