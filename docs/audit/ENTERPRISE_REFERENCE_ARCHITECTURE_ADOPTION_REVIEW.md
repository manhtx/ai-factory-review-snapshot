# Enterprise Reference Architecture Adoption Review

## 1. Executive Verdict

The reference architecture contains useful security and governance patterns, but
most of its enterprise infrastructure is wrong for the current AI Company
stage. AI Company already has a substantial local control plane; copying the
ten-layer diagram would add duplicated state, token overhead and operational
failure modes without improving Macro OS outcomes.

**Decision:** adopt no new service, graph database, mesh, swarm or WORM ledger.
Adapt three existing boundaries: task execution policy, end-to-end lineage, and
evidence-quality classification. These should be small extensions to existing
AssignmentEnvelope, policy/tool gateway, ledgers and reports—not new platforms.

Current production posture remains `PRODUCTION_NO_GO`; autonomy remains
`DISABLED` and release remains `HUMAN_GATED`.

## 2. Current AI Company Architecture Summary

The repository has structured assignment envelopes, role contracts, queue/DAG
execution, worktree isolation, recovery fingerprints, typed review contracts,
provider adapters, a local supervisor, scheduled ingestion, Supabase durable
runtime support, usage ledgers, evidence resolvers, product-cycle records and
synthetic product evaluation. This is a strong control-plane foundation.

The architecture is not yet a fully traceable production company. Some records
are JSONL/runtime projections, token usage is sometimes estimated, provider
coverage is uneven, and production evidence is intentionally fail-closed.

## 3. Current Real Weaknesses

| ID | Evidence | Severity | Impact |
|---|---|---:|---|
| W-01 | Assignment envelopes carry allowed/forbidden paths and budgets, but no universal expiring capability object is issued and revoked at every tool boundary. | High | A future worker integration could retain broader authority than the specific task needs. |
| W-02 | Limits exist across assignment, retry, queue, poller, rate-limit and recovery modules rather than one auditable execution policy. | Medium | Harder to explain total blast radius and detect cross-limit combinations. |
| W-03 | IDs such as cycle/run/work/assignment/evidence exist, but reports and ledgers are not yet a single guaranteed end-to-end lineage query. | Medium | Debugging and learning attribution require stitching files together. |
| W-04 | Evidence resolution and review contracts are strong for the hardened queue, but evidence quality dimensions such as independence, contradiction and persona relevance are not a universal decision gate. | Medium | Weak evidence can remain technically valid without being decision-sufficient. |
| W-05 | Runtime tracing is spread across request logs, provider telemetry, role evidence, usage ledgers and cycle reports; actual token provenance is not guaranteed for every Codex execution. | Medium | Cost/value diagnosis is incomplete. |
| W-06 | Scheduled ingestion is now enabled for 121 adapter-backed indicators, but unsupported/manual sources remain quarantined and the scheduler is local-supervisor dependent. | Medium | Data freshness is not a production-cloud guarantee. |

No evidence supports building a distributed mesh, graph database, multi-cloud
layer or general-purpose agent swarm.

## 4. External Architecture Concept Map

The external concepts map to existing components as follows:

| External concept | Current equivalent | Assessment |
|---|---|---|
| Capability grants | AssignmentEnvelope, policy engine, tool gateway | Partial; adapt existing |
| Policy decision point | policy engine, risk workflow, production gate | Adequate |
| Policy enforcement points | tool gateway, execution boundary, file verifier | Partial; strengthen boundary coverage |
| Blast-radius governor | queue/DAG limits, retry/recovery/rate limits | Partial; consolidate policy view |
| Separation of duties | typed reviews, CEO/QC roles, production human gate | Adequate locally; risk-adaptive |
| Workflow orchestration | queue, DAG, supervisor, wait/wake | Strong |
| Task decomposition | role dispatch and bounded product cycles | Adequate |
| Agent swarm | sequential/limited role execution | Reject as default |
| Model router | model/provider adapters | Adequate for current scale |
| Schema validation | structured role outputs and review contracts | Strong |
| JIT secrets | server-only env and redaction boundaries | Adequate locally; defer vault |
| Sandbox | worktrees, macOS sandbox and forbidden paths | Strong local boundary |
| Knowledge graph | relational ledgers and Supabase tables | Defer/reject graph DB |
| Traceability graph | IDs and evidence ledgers | Partial; adapt relational lineage |
| Data federation | provider adapters | Defer |
| Systems of record | mixed ledgers/reports/runtime state | Weak/partial; clarify authority |
| Hot/cold storage | bounded artifact retention and runtime dirs | Adequate for current stage |
| WORM ledger | append-only records, hashes, Git | Defer |
| Distributed tracing | telemetry and cycle reports | Partial; adapt semantics |
| Cost governor | token/context/retry/rate limits | Partial; consolidate |
| Evidence quality gate | resolver, review contract, product outcome validator | Partial; extend rules |
| Continuous reflection | CEO optimization and learning ledgers | Use event-driven only |
| Hybrid infrastructure | local + Supabase | Intentional, sufficient |
| Zero-trust identity mesh | task policy and server gates | Defer |

## 5. Adopt / Adapt / Experiment / Defer / Reject Matrix

### ADD NOW

None as a new standalone subsystem.

### MODIFY EXISTING

1. Add a compact `TaskExecutionPolicy` projection to AssignmentEnvelope. It
   should combine risk, allowed actions, limits, expiry and revocation state.
2. Add relational/event lineage references so cycle → task → run → provider/tool
   call → evidence → evaluation → learning can be reconstructed.
3. Extend evidence evaluation with explicit states: `SUFFICIENT`, `INSUFFICIENT`,
   `CONFLICTED`, `STALE`, `SYNTHETIC_ONLY`, `REQUIRES_MORE_EVIDENCE`.

### TEST FIRST

- Measure whether a unified policy actually reduces denied/bypassed actions and
  makes a cycle easier to reconstruct.
- Measure whether evidence classification reduces weak product decisions without
  blocking valid low-risk local work.
- Measure actual token provenance coverage before adding a cost service.

### DEFER

JIT vault, OpenTelemetry deployment, persistent Supabase Branch restore, multi-
tenant IAM, data federation, WORM retention, cloud worker fleet and hybrid
orchestration.

### REJECT NOW

Graph database, service mesh/mTLS mesh, multi-cloud platform, always-on
reflection timer, general-purpose swarm framework and duplicate orchestration
engine.

## 6. Capability Grant Review

The idea is valuable, but a new capability service is unnecessary. The current
AssignmentEnvelope already expresses project, role, path, tool, budget and risk
boundaries. The real gap is that expiry/revocation and action-level scope are
not represented as one universal object at every downstream boundary.

**Recommendation:** adapt AssignmentEnvelope with a derived, short-lived policy
projection. Validate it in the tool gateway and execution boundary. Do not put
secrets or large policy text into model context. Success requires adversarial
tests for stale grants, path escape, indirect database/tool access and expired
assignments.

## 7. Blast-Radius Governor Review

There is a real observability gap, not a missing algorithm. Queue fan-out,
retries, recovery depth, provider rate limits, context limits and token budgets
already exist separately. A small `TaskExecutionPolicy` summary can expose the
effective maximums and reject contradictory combinations before execution.

Do not introduce a policy language or central service. The measurable benefit
is fewer runaway/repeated actions and a clear reason when a task is stopped.

## 8. Traceability Review

Relational lineage is justified. The repository already has the necessary IDs,
so the right change is required references and a projection/query, not Neo4j.
The acceptance test is simple: select one product cycle and answer, from stored
records, why it existed, which evidence supported it, which model/tool ran,
which tests accepted it, what outcome was measured and what learning changed.

## 9. Evidence Quality Gate Review

This is a worthwhile extension of the existing resolver. “Evidence exists” is
not identical to “evidence is sufficient”. The gate must remain risk-adaptive:
one browser finding may be sufficient for UI polish; major data or product
claims need independent, fresh, reproducible evidence. Synthetic validation is
valid for local product testing but must not be labelled real-user evidence.

## 10. Tracing / Resource Governor Review

Use existing telemetry and usage ledgers. Add normalized fields only where
missing: parent trace ID, provider call ID, tool call ID, actual-vs-estimated
tokens, retry number and outcome. Do not deploy a tracing collector until a
real debugging benchmark shows that the current ledgers cannot answer the
question.

## 11. Security Concept Review

Prompt-injection protection should be provenance plus capability restriction,
not a text blacklist. This matters for external research documents and web
content. JIT secrets are not justified while agents receive server-only process
credentials and production autonomy is disabled. The next minimal control is
secret redaction and subprocess/environment isolation.

## 12. Knowledge / Storage Concept Review

Do not add a graph database. Supabase relational tables are sufficient for the
current lineage and product domain. The backup verification manifest is useful
as an evidence register, but it is not a backup or restore target. Hot/warm/cold
retention is adequate for current bounded local artifacts; extend only when
actual growth measurements justify it.

## 13. Swarm / Reflection Review

General swarms are rejected. Parallelism is justified only for independently
fetchable research sources with bounded aggregation. Reflection must be
event-driven: cycle completion, unexpected failure, recovery exhaustion,
provider incident or resource anomaly. A timer would spend tokens without
information gain.

## 14. Infrastructure Concept Review

Service mesh, zero-trust identity mesh, multi-cloud and enterprise IAM solve a
scale/tenant problem that does not currently exist. Supabase plus the local
supervisor is enough for this stage. Vercel/Supabase scheduling can replace a
local resident process for deployment, but it does not provide proof of local
unattended behavior by itself.

## 15. Top Candidate Improvements

| Priority | Change | Smallest implementation | Success measure |
|---:|---|---|---|
| 1 | TaskExecutionPolicy | Derived policy object in AssignmentEnvelope, checked by tool gateway and execution boundary | adversarial bypasses blocked; effective limits visible |
| 2 | Relational lineage projection | Required parent IDs plus one cycle-lineage report/query | one cycle reconstructed without manual stitching |
| 3 | Evidence quality classification | Extend existing resolver/decision gate with explicit state rules | weak/stale/conflicted evidence blocked; low-risk local flow remains usable |

## 16. Concepts Explicitly Rejected

Graph DB, service mesh, mTLS mesh, multi-cloud infrastructure, enterprise IAM
platform, general swarm framework, timer-based reflection, duplicate workflow
engine, WORM ledger and data federation mesh.

## 17. Concepts Deferred Until Later Stage

JIT vault, full distributed tracing collector, Supabase Branch with production
data, multi-tenant identity, cloud worker fleet and compliance-grade immutable
retention.

## 18. Implementation Plan

First implement only the `TaskExecutionPolicy` extension. Run adversarial and
runtime tests, then one meaningful Macro OS product cycle. If it improves
safety/clarity without increasing cycle overhead materially, promote it.

Only then implement lineage projection, followed by evidence-quality
classification. Each change must be independently measurable and reversible.

## 19. Validation Plan

- Baseline one product cycle: duration, tokens, tool calls, retries, evidence and
  time required to reconstruct the decision.
- Run the same bounded cycle after each change.
- Inject expired capability, forbidden path, provider failure, duplicate retry,
  stale evidence and conflicting review scenarios.
- Run typecheck, AI Company tests, full tests, build and gate.
- Record `PROMOTED`, `REVERTED` or `INCONCLUSIVE`; never leave experiments
  silently canonical.

## 20. Final Recommendation

The reference architecture is valuable as a checklist, not as a blueprint.
AI Company should borrow its boundary discipline and evidence language while
rejecting its infrastructure ambition. The highest-value next move is one
small policy projection that unifies existing controls. Anything larger should
wait for measured product pain.

**Review status:** COMPLETE  
**New standalone services:** 0  
**Recommended existing-system adaptations:** 3  
**Current production authorization:** NONE
