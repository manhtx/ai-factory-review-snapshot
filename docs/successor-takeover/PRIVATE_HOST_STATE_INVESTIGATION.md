# Browser host state in source authority

Mission `AI_FACTORY_FINAL_CONVERGENCE_V2`; Product Goal sections 10–11 and 23.
Requirement: source authority must not include private browser profiles.

Current reproduced evidence: Git tracks 637 `.chrome-tmp/` paths, including
Cookies, History, Login Data and Web Data filenames. Current remote lineage
HEAD matches local HEAD. No secret contents were printed or adjudicated.
Root cause: profile files were added to Git, `.gitignore` does not exclude
profiles, and the existing security audit only scans `.ai-company` text for
known credential patterns. It does not inspect tracked host-state paths.

Plan authorized by mission section 5: preserve the 148 MiB local profile in a
private local backup, untrack only `.chrome-tmp/` with `git rm --cached`, add
ignore rules for browser-profile directories, and extend the existing security
audit to fail closed on tracked private browser paths or Git census failure.
No working browser data is deleted. No history is rewritten or pushed. Runtime
state separation remains a separate classification obligation; historical
forensic ledgers must not be blindly deleted.

Affected modules: `.gitignore`, Git index/current source tree, existing
`scripts/audit-ai-company-secrets.mjs` and its bounded tests. Side effects:
profile deletion appears in the next source commit, while local files remain.
Risk: history and published copies still contain prior objects. Current-tree
untracking cannot certify historical security or replace credential review.
Rollback: local files and private backup remain, but re-tracking private data
is forbidden under the mission. Keep forensic history local.

Validation: fail-before on current tracked profile; temporary clean repository
passes; temporary tracked private profile fails by path; unavailable Git census
fails; after untracking the current census contains zero private profiles;
backup byte manifest agrees with original. No secret-value output or provider
call. Independent review and historical exposure adjudication remain open.

Independent review counterexample: `ChromeProfile/Default/Preferences` and
`profiles/firefox/{logins.json,cookies.sqlite}` bypass the first path matcher.
Broaden the existing bounded matcher/ignore rules to these observed naming
classes and add negative controls. This is path-census prevention, not a claim
to detect arbitrary renamed/encrypted secret files. HEAD remains contaminated
until the source removal is committed, and old objects remain afterward.

## Next bounded host-identity separation

Fresh Git census also tracks six live host identity/projection files:
`.ai-company/.controller.lock`, `.ai-company/last-exit-code`,
`.ai-company/maintenance/lease.json`, and runtime `EXECUTION_LEASE.json`,
`HEARTBEAT.json`, `supervisor-lease.json`. Source checkout can reproduce stale
host identities. Preserve their current bytes in private local snapshots, remove
only these paths from the Git index, ignore them, and extend the existing audit
with exact path rejection and an isolated fixture. No active lock is deleted,
stolen or rewritten; state readers/writers continue using their working files.
Snapshots are sequential observations, not an atomic authority freeze.
Keep ledger history and all other stores until capability/migration adjudication.
This removes six observed source/runtime conflations, not every mutable state
authority. Cold-start and actual lease/fencing correctness remain unproven.

An adjacent source-capable false-clean path exists in the same audit:
`readFile(...).catch(() => '')` hides unreadable inspected files. A dangling
state symlink provides an isolated counterexample. Replace the empty fallback
with a nonzero `security inspection unavailable` result and test it; preserve
the declared exclusions for logs/worktrees. Never expand a bounded audit PASS
into a whole-tree/history privacy certificate.

Convergence decision: deterministic path guard is sufficient to prevent the
observed current-tree class; no new security framework needed. Filenames prove
tracking, not that a particular credential is exposed. External credential
action and history rewrite are not performed under local reversible authority.
