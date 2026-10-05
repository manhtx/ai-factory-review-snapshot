# AI Company Migration Plan

## Current state → target state

1. **Baseline and truth:** keep `.ai-company/` as the current bounded control
   plane; keep Macro OS `docs/PRODUCT_GOAL.md` as managed-product authority.
2. **Kernel hardening:** make task/event transitions, recovery, idempotency and
   control-plane ownership authoritative outside model output.
3. **Provider layer:** retain Codex/Antigravity adapters behind one capability-
   based router with usage, failure and fallback evidence.
4. **Role execution:** expand from the verified chain to the complete role
   matrix, using structured outputs, handoffs, dependency waves and independent
   QA/QC/security gates.
5. **Product loop:** enforce `problem → evidence → decision → build → verify →
   measure → learn`; count a cycle only when improvement or valuable learning
   is verified.
6. **Memory and calibration:** promote only verified decisions, learnings,
   experiments and failures; track predictions against actual outcomes.
7. **Operations:** add restart/timeout/worktree recovery, resource pressure,
   backlog hygiene and founder-attention metrics.
8. **Autonomy:** run shadow mode first, then promote only low-risk workflows
   after repeated reliability evidence; production changes remain gated.

## Next implementation slice

Create the verified-cycle gate and one complete Macro OS improvement experiment,
then run it repeatedly before expanding infrastructure or adding UI. The
acceptance evidence must include real product telemetry/data, independent
verification, outcome measurement and durable learning.

## Non-goals

- No dashboard/UI build is required for the local operating workflow.
- No premature Kubernetes, microservices, Kafka or vector infrastructure.
- No production autonomy based only on passing tests or agent consensus.
