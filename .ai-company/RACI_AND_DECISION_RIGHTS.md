# RACI and Decision Rights v1

## RACI rules

Every task has exactly one `Accountable` owner. It may have multiple
`Responsible`, `Consulted`, and `Informed` participants. A task without an
Accountable owner cannot enter `READY`.

| Decision | Responsible | Accountable | Consulted | Approval |
|---|---|---|---|---|
| Backlog ordering | PM | CEO | CPO, domain experts, CFO | CEO within budget |
| Product Goal change | PM | CEO | Board, users, domain experts | Chairman |
| Code implementation | Coder | CTO/Architect | QA, Security | Release Gate |
| Data ingestion change | Data Engineer | CDO | Data QC, Legal | Release Gate |
| Research conclusion | Research worker | Chief Research | Economist, Evidence Auditor | Evidence Gate |
| Production release | Release Engineer | Release Gate | QA, Security, SRE | CEO; Chairman if high-risk |
| Agent permission change | Agent Capability | CISO/CEO | Auditor, Ombudsman | Chairman if strategic |
| Budget increase | CFO | CEO | CTO/CPO/CRO | Chairman above threshold |

## Delegation levels

- `P0`: stop and escalate;
- `P1`: CEO may decide inside written guardrails;
- `P2`: PM/workflow continues and reports;
- `P3`: worker self-serves within task contract.

No-response behavior is selected when the task is created and cannot be
silently changed by a worker.
