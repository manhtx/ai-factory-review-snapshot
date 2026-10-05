# Feature Proposal — Architecture-trial evidence resolution

## Goal alignment

- Product objective: trustworthy data and evidence-linked research workflow.
- User research question: can an orchestration architecture produce verifiable Macro OS progress?
- Capability strengthened: architecture comparison integrity and provenance.

## Requirement

Architecture trials must not treat an arbitrary evidence ID as proof. Every
reference used for product quality, domain correctness, or process validation
must resolve to a current, namespaced, run-matched, hash-valid source artifact.

## Technical design

- Affected module: `server/aiCompany/architectureTrial.ts`.
- Reuses the existing `IEvidenceResolver` and `validateEvidenceResolution`;
  no database or new persistence layer is introduced.
- `validateEvidence()` is an explicit asynchronous gate before a comparison is
  decision-grade. Structural comparison remains separate and synchronous.
- Missing source artifacts, mismatched run/namespace, stale, tampered, or
  self-produced evidence invalidates the affected arm.

## Risks and guardrails

- Historical deterministic harness output may remain INVALID until it writes
  real resolver records. This is intentional fail-closed behavior.
- No product score or architecture winner is created by this change.
- Production autonomy remains DISABLED and release remains HUMAN-GATED.

## Validation

- Unit tests cover fake IDs and valid sourced evidence.
- Existing architecture-trial tests and the full AI Company gate must pass.

## Decision

- Status: Shipped locally
- Decision date: 2026-09-16
- Decision notes: closes the false-evidence acceptance gap without adding infrastructure.
