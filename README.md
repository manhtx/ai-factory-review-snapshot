# AI Factory — public review snapshot

Source snapshot for external code and evidence inspection of Macro Research Platform's AI Factory. The original repository remains private. This repository starts with a new Git history; it contains no parent repository history or live machine stores.

Source carrier: `86f1ff0859654dcf415ae2013fe246701503c5b1`.

Pinned tested source candidate: `e5420707853c3a18bd84f6b3e769597a0867e893`. Its recorded clean run passed 543 tests across 53 files, full source typecheck and affected lint. Those results belong to that source candidate; they are not an independent certification or a test run of this export.

## Inspect

- `PUBLIC_SNAPSHOT_MANIFEST.json`: exact exported file hashes, source identities, scope and exclusions.
- `server/aiCompany/`: Factory implementation and tests.
- `scripts/`: controller, dispatch, recovery and audit entrypoints.
- `.agents/` and static `.ai-company/` documentation, schemas, prompts and workflows.
- `docs/successor-takeover/SOURCE_CANDIDATE_SEAL.json`: source proof association and limits.
- `docs/successor-takeover/CHECKPOINT.json`: continuation state.
- `docs/successor-takeover/CONTROLLER_AUTHORITY_ROOT_CAUSE_REOPENED.md`: actual coordinator and execution-selection counterexamples.
- `docs/successor-takeover/PROOF_DEBT_LEDGER.json`: open proof requirements.
- `unpromoted-candidate/server/aiCompany/`: historical transactional governance component, retained as unpromoted source with authority NONE and G1 review pending.

All four closure blocks A/B/C/D remain UNPROVEN. Production autonomy is DISABLED. Prior independent-review safety rejection is retained; publication does not retry or substitute that review. Historical reports and green tests must not be interpreted as current operational authority or product outcomes.

## Local inspection

Use Node.js 24 with built-in `node:sqlite`. Install dependencies with `npm ci` and inspect the source. A bounded temporary-store smoke test is:

```sh
npm test -- server/aiCompany/resourceGovernor.test.ts server/aiCompany/resourceAdmissionAuthority.test.ts server/aiCompany/resourceAdmissionProcess.test.ts server/aiCompany/cliResourceAdmission.test.ts
```

The retained forensic harnesses record original absolute source paths; adapt those paths to your checkout before replaying them. They are isolated temporary-store experiments, not instructions to operate a live Factory.

Historical first-publication export verification is recorded in `PUBLIC_SNAPSHOT_VERIFICATION.json` and `snapshot-verification/`. The first local smoke run passed 37/38 and observed EPERM instead of ESRCH during an OS group-absence check. An unchanged CLI recheck passed 4/4 and an unchanged complete smoke recheck passed 38/38. The original failure is retained; its cause remains UNKNOWN. Dependencies were linked temporarily from the installed local tree for these checks, not installed with a clean `npm ci`.

This is an inspection snapshot, not a deployment package. Static relative module imports are included. Dynamic file reads, full product data/assets and live operational stores are outside that closure. Runtime/provider logs, credentials, browser profiles, cookies, databases, locks, leases and host configuration are excluded. No license grant beyond the original owner's publication request is inferred.

Current update includes explicit two-runner worker environment transport, attempt-local config/cache/temp and the reopened data/metadata/child-signal profile contract. Ten OS/dispatcher fixture tests include a real nested Vitest native-config process exiting zero, not just a passing test marker. Root-source full regression is exact and clean; previous export logs remain historical. HOME/CODEX_HOME/private history, real-provider authentication/compatibility, activation coverage, outside-control-root reads, hardlinks and the controller gateway remain open.
