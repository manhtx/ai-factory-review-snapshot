# Scope, Evidence & Epoch Acceptance Gates

This is a hard operating rule for every Macro OS company epoch.

## Product Goal lock

Every proposed or implemented item MUST map to one or more objectives in
`docs/PRODUCT_GOAL.md`: indicator library, time-series context, relationships,
cycles, early-warning evidence, disciplined investment research, or trust/data
infrastructure that directly enables those workflows. If the mapping cannot be
written in one sentence with a target persona and measurable user outcome, the
item is `REJECTED_OUT_OF_SCOPE`.

The following are parked by default and MUST NOT be implemented or marked done:
CBDC settlement, DvP/PvP execution, auto-hedging or arbitrage execution,
sanctions screening, tokenized debt clearing, quantum cryptography, regulatory
capital engines, and any other transaction-execution infrastructure. They may
only return after Product Goal change, human approval, legal review, business
case and real user evidence.

## Evidence gates

An epoch cannot be `verified_done` from a green build alone. It needs the
appropriate evidence types: user/task evidence, source/provider evidence,
runtime/API evidence, data-quality evidence, and independent review. Synthetic
personas are labelled `HYPOTHETICAL_PERSONA`; they never count as adoption.

## Score caps

When production or real-user evidence is absent, the scorecard must say
`UNKNOWN`/`LOCALLY_VERIFIED` and apply conservative caps. A feature existing,
a test passing, or a build completing cannot raise Adoption, Production
Readiness, Global Coverage, Performance, Security or Business Viability to a
production-level score.

## Independent review and rollback

The implementer cannot be the final reviewer. Auditor and Success Auditor must
write a verdict with counter-evidence. Any scope drift, unsupported claim,
P0/P1 regression, data-trust regression or failed acceptance criterion requires
`ROLLBACK` or `REVISE`; preserve the diff and evidence, then revert safely when
authorized. Do not mark the epoch complete merely because the model emitted the
completion token.

## Five-epoch review

At every fifth completed epoch, pause new feature selection and run a Company
Process Review: Product Goal alignment, scope drift, user-value proof,
independent-review integrity, data/provider/runtime evidence, production
readiness, approval gates, rollback quality, scorecard calibration and backlog
health. The review may freeze or kill a whole initiative family.
