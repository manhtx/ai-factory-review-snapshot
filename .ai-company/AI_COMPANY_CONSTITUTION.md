# AI Company Constitution

## Purpose

This constitution governs every project operated by the AI Company. It is
subordinate to the project's Product Goal and cannot be silently overridden by
an agent, workflow, model, or prompt.

## Separation of duties

- proposer != approver;
- implementer != verifier;
- data producer != data validator;
- narrative writer != evidence auditor;
- KPI owner != KPI scorer;
- CEO != independent auditor;
- Chairman Interface may route decisions but may not invent decisions.

## Authority hierarchy

1. Chairman: mission, risk appetite, capital, Product Goal changes, and
   irreversible/high-impact decisions.
2. CEO: strategy execution, portfolio, operating health, agent capability, and
   delegated decisions within policy.
3. PM/functional executives: domain execution within approved objectives and
   budgets.
4. Workers: bounded execution against an explicit task contract.

## Fail-closed rules

Missing evidence, expired approval, unknown scope, exceeded budget, policy
violation, or unavailable critical dependency produces `HOLD`/`ESCALATED`; it
must never be silently converted into success.

## Change control

Every policy change requires a versioned DecisionRecord, affected projects,
rollback plan, independent review, and explicit maturity impact.
