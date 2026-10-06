# Worker environment and cache repair

Product lineage: `docs/PRODUCT_GOAL.md`, Authority, Trust and Traceable. This is local reversible work under the standing convergence mission; no production operation or independent-review promotion.

## Investigation and causal scope

Current dispatcher source spreads the controller's entire `process.env` into both AGY and Codex workers. `server/index.ts` uses `MACRO_ADMIN_KEY` for administrative authorization; cron and Supabase credentials also live in that environment. Filesystem restrictions cannot remove already inherited environment values. The same dispatcher instructs workers to use a global `/tmp` Vitest config/cache; the corrected optional macOS profile deliberately denies writes outside the assigned workspace. These are earlier prerequisites to a credible controller gateway, not a new coordinator lock repair.

Before source repair, run actual dispatcher stubs with dummy privileged markers and attempt the supplied cache write. Retain failures. No real secrets, network requests, models, provider calls or live company stores are needed.

## Standing local implementation plan

At the existing spawn boundary, replace ambient environment inheritance with an explicit baseline of process locale/identity/path variables. Preserve existing explicit `CODEX_HOME`; do not forward administrator, database, cron, SSH-agent, loader injection, arbitrary application variables or ambient provider credentials. There is no generic environment override or test-only bypass. Provider-specific ambient auth compatibility remains pending explicit requirements; do not silently restore blanket inheritance.

Place the generated Vitest config, cache and child temporary directory under the assigned execution root in an attempt-specific directory. Bind the prompt to that actual config path. Validate/make these paths before provider issuance, and reject symlink redirection into control state. Move fixture mode transport from environment to a private fixture file so production policy does not acquire a test exception. Reuse existing dispatcher and profile primitives; no new store or scheduler.

Installed Vite source (`bundleAndLoadConfigFile`) still bundles an ESM config beneath the nearest `node_modules/.vite-temp`, even when `cacheDir` is assigned. Installed Vitest exposes `configLoader`; use `--configLoader=native` with the generated plain MJS config to remove that shared dependency write. Attempt directories are ignored as execution artifacts. Actual two-runner tests at unchanged source `e216b13` reproduced privileged environment inheritance; the optional AGY sandbox also denied the supplied global cache/temp paths. The retained red log records both failures.

An actual minimal Vitest OS probe then reproduced a second compatibility failure: native config loaded and its fixture test passed, but Vitest exited 1 when terminating its own forked worker (`kill EPERM`). The existing self-only signal rule is too narrow for owned child cleanup. The local OS compiler accepts `(target children)`. Extend the existing signal rule only to children, and verify an actual owned child signal succeeds while a separate trusted fixture process remains protected. Add a real native-config Vitest run under the profile; do not weaken unrelated-process or filesystem protection, replace failure evidence, or infer real-provider compatibility from this one tool.

## Profile root cause reopened: operation categories

The nested-workspace tool test also fails when Vite explicitly `lstat`s a control-root ancestor. The original profile was accepted from bounded read/write fixtures, not a complete declared worker API contract. Its blanket `file-read*` denial conflates content/enumeration with metadata traversal. This is the same permission-design frontier; stop accumulating path bypasses or broad read allowances. The optional whole-provider profile cannot serve as authenticated controller authority, and cannot certify full provider operation while network/auth/host isolation remain unresolved.

Replace the monolithic control-root read denial with separate data and metadata invariants in the existing profile: protected content and directory enumeration denied outside workspace/dependencies; protected file metadata denied; metadata only for the known control root and exact ancestors of the assigned nested workspace permitted for canonical path traversal. Child signalling is scoped to actual children, not unrelated actors. No new sandbox, authority store, ownership layer or scheduler is introduced. Verify private reads, private stat, root enumeration, symlink escape, foreign signal denial, canonical writes and actual nested Vitest exit together. The old broad temporary allowance and blanket read-denial approach are retired, not wrapped. This is a broader causal policy correction after reopened analysis; any additional material profile failure requires a fresh contract/architecture decision, not another exception.

Independent review and actual provider compatibility remain pending. These fixture results must not confer gateway or operating authority.

Affected modules: dispatcher, actual CLI transport fixtures, and documentation. Verify both runners' environment boundaries with dummy markers, actual optional sandbox cache writes, symlink negative paths, all previously scoped convergence regression, full typecheck, affected lint and clean exact-revision sealing.

## Risks and limits

Workers relying on ambient credentials, proxies, injected loaders or global temporary writes will fail visibly. CLI authentication via existing HOME/CODEX_HOME remains a separate host/private-state issue; this repair does not establish full host privacy, provider compatibility, OS confinement for every runner, authenticated controller actor identity, effect admission or Block A closure. Actual product outcomes and independent review remain unproven. Negative evidence and historical timing failures must be retained.
