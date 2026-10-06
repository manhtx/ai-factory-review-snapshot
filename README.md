# AI Factory — public review snapshot

Source snapshot for external code and evidence inspection of Macro Research Platform's AI Factory. The original repository remains private. This repository starts with a new Git history; it contains no parent repository history or live machine stores.

Source carrier: `4a3325df6662819b3194215b0669198145babdb3`.

Pinned tested source candidate: `c9a1aa7af3d707a30955b2852cd387988b975537`. Its recorded clean run passed 550 tests across 54 files, full source typecheck and affected lint. Those results belong to that source candidate; they are not an independent certification or a test run of this export.

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

Gateway design and fresh bounded counterexamples are in `docs/successor-takeover/CONTROLLER_GATEWAY_DESIGN.md`: actual preclaim Git effects survive coordinator timeout/exit; an installed Codex sandbox utility reads a dummy control credential outside its workspace. The utility is not an actual model tool invocation. Enrollment/readable-root protection precedes journal issuance; the gateway is not implemented or promoted. The current application source uses explicit Codex named permission arguments; no-workspace callers fail before claim.

Current policy: `CODEX_READABLE_ROOT_POLICY.md`. Actual installed utility tests verify generated read-only/write profiles with dummy control/auth files, symlink escapes and read-only dependencies. Dispatcher transport is wired, but real model/tool surfaces, config precedence, authentication, AGY/non-workspace migration and gateway enrollment remain open. Earlier source/export runs retain their original subjects.

The first current export smoke passed14/15 and timed out in AGY fixture preparation. Three unchanged target rechecks also timed out; root target passed. A logging-only diagnostic observed queue/handoff preparation8595ms before dispatcher spawn and cleanup ENOTEMPTY. A later split diagnostic observed21/23ms and passed; the unchanged full export recheck passed15/15. Cause remains UNKNOWN; no deadline was increased. All logs are retained in `docs/successor-takeover/evidence/codex-policy-export-timing-results.json`. Fixture lifetime/cleanup debt remains open.

Current fixture lifetime repair closes fixture admission, drains initialization/dispatch jobs and actual child close before deleting owned roots. Two new real filesystem/child controls pass without increasing test deadlines. This repairs the fixture cleanup contract, not production controller/Git quiescence or unexplained preparation latency. See `FIXTURE_LIFETIME_REPAIR.md`; all prior timing failures remain historical evidence.

## Native exec/project/image evidence

`docs/successor-takeover/evidence/codex-native-exec-project-and-image-52ebd1f.json` records three clean-source native CLI configuration fixtures. A localhost dummy provider drives actual exec_command and view_image; private dummy reads/readonly writes are rejected and workspace/dependency/image positive controls succeed. The trusted final-response file is recorded. Native binary and launcher hashes are bound to the probe. Earlier invalid TMPDIR fixture is retained. This is source fixture evidence, not real model reasoning, managed-config/auth/AGY/all-tool/gateway proof, independent review, or an export rerun.

## Worker delegation removal

Current source74656d6 explicitly supplies `agents.enabled=false` through the dispatcher permission helper. Three native export fixtures advertise no multi-agent namespace or agent tools even when a trusted project requests agents enabled. Actual exec/image permission controls pass and trusted final response is saved. Current export smoke passes17 tests/3 files with temporary installed dependencies removed afterward; it is not clean npm ci. The original source run passes550 tests/54 files, tsc and affected lint. Exact source, native binary hashes and before-repair schemas are retained in `WORKER_DELEGATION_BOUNDARY.md` and its evidence. Log packaging whitespace mismatch is retained as negative evidence; original exact log bytes have been restored and hashes verified. Ordinary subprocess/provider authority, writable-mode all-tool coverage, managed configuration, AGY/auth and controller gateway remain OPEN.

## Exact attempt temp repair

Current source c9a1aa7 grants the already-created owned attempt temp child explicitly. Three writable-mode native fixtures previously rejected temp writes because the tmpdir deny was more specific than their parent grant. All six readonly/workspace-write native mode/config fixtures now pass, preserving private/control/auth/dependency/symlink denials and assigned write semantics. The attempted Git metadata write is denied; trusted controller Git effect quiescence remains OPEN. The failed source fb3f521 controls and repaired results are retained in `CODEX_ATTEMPT_TEMP_INVESTIGATION.md` and `evidence/native-attempt-temp-c9a1aa7.json`. Current source550/54 tests plus tsc/lint pass; current export17/3 tests and6 native fixture cases pass with temporary dependencies removed. Real model tool census/managed/auth/AGY/caller migration/gateway and independent assurance remain OPEN.

## Configured model code-mode failure

Latest clean probe9f031e6 and current export reproduce6 overallFAIL cases. gpt-5.6-sol native metadata carries tool definitions in input.additional_tools. The earlier dadb804 empty-top-level-schema delegation-absence claim is invalidated; the verifier now requires an observed schema and checks actual patch file effects. Actual code-mode exec permits attempt temp writes; nested apply_patch rejects temp in both modes at the native project/user-approval gate. Product patch succeeds only in write mode; private/control/auth/dependency/alias/Git patch files are not created. `NATIVE_CODE_MODE_TOOL_BOUNDARY.md` and `evidence/native-code-mode-patch-temp-9f031e6.json` retain all failures and scope. No weaker expectations, deadline change, policy override, new assurance seal or Block A closure. Production baseline candidatec9a1aa7 source550/full tsc/lint and earlier17 export tests remain revision-bound historical scoped results; not current all-tool assurance.

## Native registry metadata observation

Clean sourceaba2e89 and current export each pass6 registry-only metadata checks. Actual ALL_TOOLS contains apply_patch/exec_command/update_plan/view_image/write_stdin, with no agent method in these isolated configured-name fixtures. No effect-bearing method or denied temp patch is invoked by that probe. Isolated standalone app-server requirements are null; real Factory auth-home/plugin/hook/managed and cloud scope remain OPEN. The6 code-mode patch failures above remain unchanged. Metadata PASS is not effect PASS or assurance. See `evidence/native-registry-and-requirements-aba2e89.json`.

## User MCP startup suppression

Clean sourcef133af6 and current export pass3 synthetic startup controls: the dispatcher ignore-user-config flag suppresses a dummy user MCP startup and registry capability; the loaded-config control starts it and registers the tool/resource helpers. No dummy MCP method is called. The actual owned server PID is observed absent after CLI closes. Only owned dummy fixture/evidence is exported; actual host auth/configuration structure receipts remain private. This does not prove plugin/system/managed hook admission, real auth, AGY or controller authority. Patch6FAIL stays OPEN. See `evidence/native-user-mcp-startup-f133af6.json`.
