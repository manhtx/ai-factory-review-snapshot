# Worker sandbox causal repair

This bounded repair follows the already authorized local convergence mission. Product lineage: `docs/PRODUCT_GOAL.md`, Authority, Trust, and Traceable research. Worker output must not gain authority by editing controller state.

## Reproduced problem and root cause

At clean revision `96c71b0cfa81c08af6fd996fd3977abd8bef91a8`, actual `/usr/bin/sandbox-exec` processes using the current `macSandboxProfile` read a dummy private control file. With canonical fixtures under `/private/tmp`, the worker also wrote the control root. With an aliased temporary workspace path, its legitimate workspace write failed. Evidence is retained separately, without real credentials or provider calls.

The profile grants unrestricted reads, grants writes to all temporary directories, and uses lexical paths rather than canonical OS paths. Its single string test does not establish effective OS permissions. The dispatcher also supplies its checkout instead of its resolved control root.

## Approved local scope and plan

Reuse the existing profile, without adding a controller lock or state store. Canonicalize existing directory roots, reject equal roots and a workspace containing the control root, remove broad temporary writes, and deny control-root reads/writes outside the assigned workspace. Permit control-root dependency reads only through its existing `node_modules` directory. Restrict signals to the sandboxed process itself. Supply the actual control root from the dispatcher. Add real OS tests for canonical and aliased paths, nested workspaces, protected reads/writes, legitimate workspace writes, and symlink escapes. Preserve failures before repairing source. Run affected tests, full typecheck and affected lint; seal source and bind results to the exact clean revision.

## Impact, risks and acceptance

Affected modules: `macSandbox.ts`, its tests, and the optional macOS AGY dispatcher profile call. Existing optional activation remains unchanged. Reading controller Git metadata, unassigned source, or writing global temporary paths may now fail; these failures must remain visible, not be bypassed with blanket permissions. Network remains denied. This fixture proof cannot certify a real provider's complete operating workflow.

Acceptance is bounded: actual fixture workspace writes succeed while protected control reads/writes and symlink escapes fail. Missing roots and unsafe overlap fail before launch. Full regression results must retain negative evidence.

## Remaining authority debt

This does not close Block A. Opt-in activation, other runners, inherited environment credentials, reads outside the control root, hardlink aliases, dependency trust, worker access to privileged services, and the controller gateway remain open. A profile is not authenticated controller authority or independent review. Production autonomy stays disabled. Do not turn this repair into a third tactical coordinator ownership patch.
