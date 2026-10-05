# Non-authoritative migration staging

Product Goal sections 10 and 16 require evidence honesty and continuity.
Before a trusted importer exists, rehearse a lossless unverified staging export
from the verified frozen queue. This is observer tooling, not a new authoritative
store or a migration of the running company.

Input: explicit frozen role-work-queue JSONL. Parse every nonblank record strictly,
require identity, preserve all history in original bytes and reduce latest rows
only for the staging index. Output: a new exclusive-created JSON artifact with
source digest, historical bytes encoded as base64, latest work records, separately
preserved objective/backlog/run/namespace identities, unresolved dependency
references, and MIGRATED_AS_UNVERIFIED staging classification for every item.
The label describes the staging copy only, never a trust grant. Missing identities
remain null rather than fabricated. Original row objects are preserved unchanged.

Validation: reconstruct exact original bytes from the artifact; compare hashes,
history count, latest identities, original row values and all dependency edges.
Reject existing output, malformed history and missing work IDs. Verify no output
before successful validation. Tests must prove roundtrip and rejection. No live
state, provider, source application, schema, service or authority changes.
This does not prove final import correctness, authenticated lineage, evidence
admission, concurrency, rollback or cold-start of an authoritative successor.

Standing authorization: safe isolated local rehearsal. G1/S1/wait source remains
frozen pending independent verification.

Verification must receive the expected source SHA256 from the separately captured
F0 evidence, not accept an artifact's self-declared digest as its own anchor.
Reject absent/malformed/mismatched expected digest before interpreting staging
items. A coherently rebuilt artifact for different bytes must fail against the
original anchor. Export may use the digest of its directly read frozen input;
fresh-process verification must supply the independent recorded digest explicitly.
