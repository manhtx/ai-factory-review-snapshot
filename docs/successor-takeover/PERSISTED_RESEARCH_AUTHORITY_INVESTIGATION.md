# Persisted research signal consumption and advisory identity

## Product alignment / requirement

Product Goal ../PRODUCT_GOAL.md: evidence remains inspectable and uncertainty explicit. Research question: does persisted research still refer to admissible current inputs, and is it an actual observation or an AI advisory? Mission A/B/D prohibits historical DONE and synthetic personas becoming authoritative user proof.

## Reproduced cause and impact

Evidence/persisted-research-authority-before.json: actual temporary queue/advisory receipts, four successful research roles synthesized, then source quarantined. Four current-success predicates false; persisted quorum stays READY_FOR_RE_SCORE. AI advisory receipts become USER_INTERVIEW/USABILITY_TEST/STAKEHOLDER_REVIEW by role alone. Signal records have no work/attempt/current input binding; quorum filters substring IDs/confidence. Opportunity scoring boosts user/evidence dimensions from these labels. Source census: runtime/CEO review, public research-quorum endpoint, admin score-with-research consumer. Prior signals must be retained, not silently certified or deleted.

## Standing-approved technical design

Extend existing ResearchSignal metadata with optional work_origin for legacy compatibility: exact work ID/attempt/queue revision plus hashes of terminal work and its transitive known dependency rows. Hash sorted input identities and full row hashes (missing known structural inputs explicitly represented); no new store/cache/actor/ledger. New synthesis always AI_ADVISORY, never infer human research from role. Current consumption requires full current queue snapshot, shared recursive success, exact origin/hash/result match, project, and exact backlog identity `${ideaId}:research:${role}`. Unknown/legacy unbound signals remain visible, excluded from quorum authority. Four legitimate advisory perspectives may request re-score; this is advisory readiness, not actual-user/product proof.

Propagate fresh currentWork to CEO review/runtime, research-quorum endpoint, and idea score-with-research. Research scoring accepts current admitted advisory signals without increasing user_value or evidence_confidence. Self-declared human/market labels alone cannot increase dimensions: reject unverified external research scoring explicitly. Capability classification: preserve raw bounded opportunity scoring and advisory four-role readiness; intentionally remove self-declared confidence-based boosts without authoritative source proof. Actual human/market evidence ingestion requires separate evidence/source admission design; do not invent verified human observations now.

Migrate unit positives to bound current advisory rows with valid task/result/attempt metadata; retain old failure evidence. Unknown external source types are not silently transformed into AI. Existing persisted records are legacy UNVERIFIED at consumption. Idempotent synthesis retains old signal IDs and history; legacy upgrades/replacement attempts can remain research incomplete pending explicit reconciliation, not overwrite history.

## Risks, validation and prevention

Hash equality detects changed work/input versions but is not independent actor, execution revision attestation or cryptographic writer authorization. Caller stale snapshots, atomic queue→signal/CEO/idea writes, subsequent withdrawal, ledger concurrency/parser corruption and legacy re-admission remain OPEN. Exact idea ID rejects substring collisions. Guard confidence finite/range and duplicate ambiguous signal identities. Source-type AI_ADVISORY must not count as real user demand, human research, measured outcome or market proof.

Fail-before/pass-after original temp producer withdrawal; healthy bound four-role positive; stale/missing/replaced input/result/hash/attempt, crossproject, ID substring collision, unbound legacy human labels, invalid confidence negatives; AI signal scoring adds zero, self-declared research boosts refused. Existing292 denominator plus synthesis/CEO/scoring/idea tests, lint/typecheck and independent exact-hash review. No live provider/company/product data/G1/candidate/public actions. All A/B/C/D remain UNPROVEN.

Decision: approved safe local mission section5; documentation first; no product direction change. Architecture budget: observed stale persisted authority requires origin metadata in existing signal; adds no authority/store, removes role-label and confidence-only success authority.

Advisory presentation: quorum includes explicit basis AI_ADVISORY_ONLY for both readiness/incomplete results. Existing status requests re-scoring, never real-user validation. Source rows need positive integer queue revision; exact hash metadata grants no independent actor attestation.

Validation boundary: builder final312tests36files PASS, scoped lint PASS, full typecheck retains11otherdiagnostics. Two preceding expanded runs had timing failures (311/312 and309/312), preserved; unchanged isolated25tests and finalsame312denominator pass. Cause of timing variability not conclusively proven. Fresh independent review was rejected automatically for possible cybersecurity risk; no retry/rephrase/substitute, REVIEW_PENDING.

New falsification: actual temp research-missing-receipt-before.json retains original receipt bytes in a temp backup then empties only that temp ledger. Evidence resolver returns null, current work hash/success remains unchanged and advisory quorum stays READY_FOR_RE_SCORE. Work/input metadata is insufficient as common evidence-consumption authority. Next decision must converge on shared current evidence re-resolution and consistency boundary across consumers before further localized patches; not declare origin repair full closure.
