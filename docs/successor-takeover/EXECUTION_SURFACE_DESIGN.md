# Execution surface registry and authority decision

Product Goal sections 10–11 and Founder Mission I3/I7/I18 require a bounded
inventory of executable writers and explicit authority before promotion.

The class-caller census found direct queue appends in
`scripts/record-disclaimer-banner-cycle.mjs:197` and
`scripts/record-workspace-synthesis-cycle.mjs:246`. Both bypass queue completion
contracts. `scripts/ai-company-marathon.mjs` catches durable start failure at
1112 and proceeds to dispatch, then records cycle closure before best-effort
operation completion at 1313. Therefore a class-only repair cannot establish
one canonical commit boundary. These are source-capable paths; runtime use
of those direct writers is not established.

## Registry design

Capture every executable/config file under server, api, scripts, src, .github,
and root package/config entrypoints. Include tests and experiments in the
inventory rather than assuming names prove isolation. Record SHA-256, imports,
call sites for filesystem/DB/network/process effects and an explicit provisional
plane classification. Scan TypeScript/JavaScript AST without executing source;
retain shell/Python and workflows as opaque surfaces requiring review.
Unresolved calls and dynamic execution remain explicit; lexical census cannot
prove absence of hidden effects. A check against the complete scoped file/hash
manifest must fail for additions, removals, or changed content, even when the
new effect evades pattern matching. This is a bounded change detector, not an
authorization mechanism or global closed-world proof.

The registry is generated evidence, written only to a new explicit local
output file. Never overwrite an earlier capture. A scope definition change
invalidates the old denominator. Candidate replay uses its own registry;
legacy hashes are not candidate proof.

## Authority decision

The successor needs one durable transactional commit surface shared by the
objective/work/attempt/evidence state changes that must agree. Direct legacy
file appenders must be excluded from successor namespaces and retired or
migrated through explicit adapters. Lease CAS without terminal evidence and
objective lineage is insufficient. Product observation storage remains separate.
Do not enable a second scheduling authority during this work.

Before choosing the transaction implementation, compare a serialized file
authority against a separate local transactional store using the same
concurrent-create, stale-writer, crash/interruption and recovery counterexamples.
Required capability preservation is in TARGET_SYSTEM_MAP.json. A new store
does not become canonical merely by existing. Rehearsed state migration and a
fenced handoff remain required.

## Validation and risks

Test capture/check agreement, new opaque executable detection, source change,
removed source, output outside scan scope, symlink rejection and no module
execution. Inspect discovered direct writers and consumers manually. False
negatives in call classification must not bypass whole-file change detection.
Do not follow symlinks into dependencies, unrelated user projects or backups.
No service/DB/provider actions are part of registry generation.

Authorized as local read-only inspection tooling under standing mission authority.
