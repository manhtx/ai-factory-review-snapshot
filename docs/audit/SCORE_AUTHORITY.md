# AI Company score authority

The repository intentionally tracks different measurements. They must not be
combined or presented as one score:

| Measurement | Authoritative artifact | Current value | Meaning |
|---|---|---:|---|
| Operating score | `.ai-company/scorecard.json` and `.ai-company/company-state.json.scorecard_summary` | 78/100 | Evidence-based company operating baseline |
| Current-stage autonomy | `.ai-company/mission/AUTONOMY_100_STATE.json.current_score` | 91/100 | Current-stage autonomy assessment under the master mission |

Historical Markdown reports and legacy `COMPANY_STATE.json` values are not
current authority. They remain historical evidence unless a dated audit
explicitly promotes them. `npm run ai-company:score-audit` verifies that the
two operating-score JSON authorities agree; it does not merge the two metrics
or authorize production.

Production autonomy remains `DISABLED` and production release remains
`HUMAN_GATED`.
