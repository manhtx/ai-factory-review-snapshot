# Cycle contract transfer investigation

## Reproduced defect

The actual create-codex-product-cycle CLI was invoked in a fresh temporary cwd
with the roles/path/objective inputs produced by a P1 data-change route. All four
resulting assignments declare P2 and workflow codex-product-cycle-product-p2.
The selected roles and allowed paths survive; risk does not. The creator also
uses generic freshness acceptance criteria, not a supplied objective-specific
acceptance contract. Evidence: `evidence/cycle-contract-counterexample.json`.
No providers, workers or canonical state were used. Temporary files were removed.

## Cause and impact

Continuation selects and records cycleRoute.risk_level, but its cycleEnv transfers
only roles, objective and paths. Marathon likewise calculates risk/workflow while
selecting roles separately. The creator hardcodes assignment risk_level=P2 and
derives workflow from a lean flag. Thus the report and durable contract can
disagree without either interface rejecting the mismatch. Priority-to-risk
mapping is an existing caller policy, not a newly inferred business requirement.

This affects admission, review depth, role contracts and migration semantics
(mission I3, I6, I11 and I16; Product Goal trust and evidence principles). The
fixture does not attest which source revision created a historical record.

## Permanent solution proposal

Transfer a versioned, validated work contract containing objective identity,
task type, risk, acceptance, allowed/forbidden paths, required capabilities and
budgets. The creator must consume this contract without defaulting away fields;
derive roles/workflow consistently or reject a contradiction before queue writes.
Keep priority and risk distinct if policy distinguishes them. Do not widen
allowed paths to make a product request executable. If a portfolio-only task is
investigation, preserve its limited scope and require a separately admitted
implementation task instead of claiming product delivery.

Affected modules: both cycle callers, creator, execution planner, assignment
schema, queue batch admission and migration adapter. Test P0–P3, task-type
specialization, absent/unknown risk, acceptance preservation, contradictory
roles, invalid paths and zero writes on rejection. Preserve historical
contracts unchanged and mark incompatible records unverified for reconstruction.

Status: REPRODUCED_NOT_IMPLEMENTED. Incorporate this requirement into the successor
transactional work-admission design; do not start another unreviewed foundational
rewrite while G1/S1/wait verification obligations remain open.
