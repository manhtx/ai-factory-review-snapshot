# Frozen queue migration preflight

Structural census of the verified suspended snapshot found 9,647 history rows
and 2,715 latest work records: 1 READY, 1,573 DONE, 1,141 QUARANTINED.
No unknown historical queue state or missing dependency reference was found in
this bounded file. These observations do not validate transitions or outcomes.

Migration constraints derived from current evidence:

- 49 records lack assignment objective, run and namespace links. Preserve as
  legacy/unverified; reconstruct links only from primary evidence.
- 1,475 assignment objective IDs differ from backlog IDs. These fields can have
  different semantics; do not call this corruption or choose either as canonical
  by majority. Preserve both until creator/consumer lineage is resolved.
- One DONE record has no evidence IDs. A further 383 evidence references are
  unresolved in both captured project and runtime dispatch ledgers. The runtime
  ledger resolved none of the project-ledger misses. Other evidence sources
  remain possible; this is not a global absence claim.
- Quarantine is retained, not converted into complete, deleted or silently
  requeued. Existing READY is preserved as an unverified intent, not automatic
  successor execution authorization.

Before any importer grants trust: enumerate other evidence stores and resolvers,
resolve objective/backlog semantics from their producers, bind required evidence
to execution revision/namespace/oracle, and independently adjudicate required
legacy outcomes. A migration rehearsal must preserve row identities, dependencies,
history hashes and explicit unverified classifications. No DONE auto-import.

Evidence: `evidence/migration-queue-census-v1.json` and
`evidence/migration-evidence-crosscheck-v1.json`, including exact snapshot hashes.
The census tool reads only the explicitly supplied frozen directory. Neither
canonical state nor the backup was modified. No importer or authority transfer
was run. Product data is outside this governance census.

## Additional ledger and producer trace

`evidence/migration-evidence-locations-v2.json` locates 291 of the 383 dispatch-
ledger misses in project `role-evidence.jsonl`. The separate root evidence ledger
matches none. 92 references remain unresolved across these four checked ledgers;
this is still not global absence proof.

RoleEvidenceLedger stores output, limitation, provider/model, work/project ID and
usage, but its declared schema has no namespace/run/content_hash fields. Do not
cast these records into StoredEvidence or fabricate historical validation.
Preserve original bytes and link any reconstructed envelope explicitly to its
origin and unverified trust class. Evidence admission remains a separate step.

Product-cycle source uses assignment.objective_id from objectiveId while setting
backlog_id to the cycle prefix (`create-codex-product-cycle.mjs:68,98`). Of the
1,475 disagreements, 1,456 carry product-cycle workflow labels (90 product,
1,363 product-p2, 3 product-p1); 19 have no workflow label. Current source explains
the field distinction, not the historical loaded revision of every row. Retain
both objective and cycle/backlog identities and trace their creators before
reconstruction. Do not rename them into a single field or label all disagreements
corruption. Missing producer/loaded-revision evidence stays explicit.

## Pending intent preservation

The sole frozen READY work links to BACKLOG-BUSINESS-CYCLE-TURNING-POINTS, which
also appears READY in the captured canonical backlog. Preserve it independently
of legacy work trust. The backlog asks for turning-point/confirmation transparency
but allows only RESEARCH_PORTFOLIO.json edits; its P1 priority differs from the
P2 workflow. These may represent an investigation step versus implementation,
not necessarily corruption. Resolve the contract before dispatch and do not
invent broader allowed paths from the desired outcome.

The 92 remaining evidence references belong to 53 unlabeled work rows (74 refs),
12 benchmark-b0 rows (12 refs) and 6 product-cycle-001 rows (6 refs). Some references
are command strings or repository paths. Do not execute those strings, relabel
them as validated evidence, or delete their historical context. See
`evidence/migration-pending-intent-v1.json`.
