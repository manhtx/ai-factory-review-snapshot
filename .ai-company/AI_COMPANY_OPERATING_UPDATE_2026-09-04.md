# AI Company Operating Update — 2026-09-04

## Executive assessment

The AI Company operating layer is operationally healthy, but it is not yet
safe to treat local-model output as autonomous product judgment. The control
plane, queue, handoffs, evidence ledgers and fail-closed behavior are working.
The quality bar is not yet met for autonomous PM or product decisions.

Overall status: `HEALTHY / QUALITY-GATED / NOT PRODUCTION-READY`

## Verified current state

- Company doctor: `HEALTHY`; epoch `407`; stop requested: `false`.
- Queue: `12` tracked, `7` DONE, `5` BLOCKED, `0` active after the local probe.
- AI Company test suite: `92` files, `211` tests passed.
- Full structural gate, typecheck, workflow, security and synthetic audits have
  passed in the current operating baseline.
- No UI or product release was performed by the local run.
- Product Goal authority remains `.ai-company/PRODUCT_GOAL_MASTER.md`, with
  Macro OS product scope linked through `docs/PRODUCT_GOAL.md`.

## Local AI evidence

The Ollama `qwen3:8b` model ran two discovery probes and one PM role probe.

### What worked

- Local endpoint was reachable and the model produced schema-valid output on
  retry.
- Queue → handoff → provider attempt → server-owned evidence → DONE lifecycle
  completed for PM task `WORK-1788520906577-1gpnn2`.
- Provider latency was `41,763 ms` for the PM role; cost metadata was zero for
  local inference.
- Missing handoffs for three unrelated daily roles were detected and blocked,
  rather than bypassed.

### What failed or needs review

- Full Product Goal discovery first returned malformed JSON and was correctly
  rejected.
- The PM role output invented user feedback/usage evidence not in its input,
  proposed UI despite a workflow-only task, and described the Product Goal
  inaccurately.
- Therefore protocol completion is `PASS`, but content quality is
  `QUALITY_FAIL`; the resulting evidence is advisory and must not be promoted.
- The provider attempt currently records provider id `openai-compatible` even
  when the endpoint is native Ollama. This must be corrected to `ollama-local`
  so future comparisons with Codex and Antigravity are trustworthy.

## Required updates

1. Add a grounding validator that rejects unsupported claims, invented sources,
   and scope-expanding deliverables (especially UI when the task is workflow-
   only) before role evidence can be treated as review-ready.
2. Separate `protocol_status` from `content_quality` in role evidence and
   provider reports. A DONE queue state must not imply a good recommendation.
3. Normalize native Ollama provider identity to `ollama-local` in all ledgers.
4. Triage the five existing BLOCKED queue items and create explicit handoffs or
   close them with reasons; do not let stale smoke tasks distort readiness.
5. Repeat the same evidence bundle with Ollama, Codex and Antigravity before
   assigning comparative quality scores. Compare latency, grounding,
   scope-discipline, rework, evidence completeness and recovery—not just
   whether the CLI returned successfully.

## Three-day review marker

- Review after: `2026-09-07T11:20:18+07:00`
- Primary reports:
  - `LOCAL_AI_EVALUATION_2026-09-04.md`
  - `local-ai-company-probe-2026-09-04.json`
  - `local-ai-company-role-probe-2026-09-04.json`
- Primary ledgers:
  - `runtime/projects/macro-os/discovery-attempts.jsonl`
  - `runtime/projects/macro-os/provider-attempts.jsonl`
  - `runtime/projects/macro-os/role-evidence.jsonl`
  - `runtime/projects/macro-os/role-work-queue.jsonl`

## Decision

Keep local AI enabled for bounded discovery and advisory role experiments only.
Keep PM/CEO Guild promotion, implementation, release and Product Goal changes
behind independent grounding, QA/QC and release gates until the required
updates above are implemented and the three-day comparison shows non-regressive
quality.
