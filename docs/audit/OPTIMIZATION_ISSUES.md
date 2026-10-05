# AI Company — Optimization Issue Register

| ID | Severity | Area | Root cause | Impact | Recommended fix | Effort / risk |
|---|---|---|---|---|---|---|
| AC-P0-001 | P0 | Assignment protocol | Generic epoch prompt can override task-specific scope; required fields are not typed | Agents run wrong work and misclassify outcomes | Introduce validated assignment envelope and precedence rules in code | M / low |
| AC-P0-002 | P0 | Coordinator isolation | Prompt-only filesystem boundary; worker accessed/attempted control-plane state | Unsafe mutation and untrusted evidence | Allowlisted execution channel, pre/post diff audit, reject outside writes | M / medium |
| AC-P0-003 | P0 | DAG lifecycle | DAG setup can persist partial work before validation failure | Orphan tasks and inconsistent coordination | Preflight all roles/handoffs/dependencies, then atomic batch append | S / low |
| AC-P0-004 | P0 | Test health | Server test harness fails at `port` null; loopback LLM test times out | Agents waste tokens and decisions lose runtime evidence | Dedicated harness investigation and failure classification | M / medium |
| AC-P1-001 | P1 | CEO optimization | CEO returns safe HOLD but no corrective task/owner/re-review trigger | System stops safely but does not recover autonomously | Structured recovery mandate in CEO decision schema | M / low |
| AC-P1-002 | P1 | Context | Broad logs and generic epoch state are repeatedly loaded | 51k–146k tokens per bounded role | Allowlisted evidence manifest, summaries, context budget | M / medium |
| AC-P1-003 | P1 | Queue routing | `run-ready` operates on global READY pool without benchmark namespace | Unrelated work can be dispatched | Explicit project/backlog prefix or manifest filter | S / low |
| AC-P1-004 | P1 | Outcome learning | Outcome and memory ledgers are not proven to affect later prioritization | Repeated activity without compounding intelligence | Enforce verified improvement/learning gate and replay test | L / medium |
| AC-P1-005 | P1 | Provider comparison | Provider/model/version/context/quality fields are incomplete or inconsistent | Cannot compare Codex, local AI and Antigravity fairly | Normalize provider attempt telemetry and quality outcome taxonomy | M / low |
| AC-P1-006 | P1 | Product reality | No proven Problem → Change → Release → Metric → Learning trace | AI Company may optimize simulated state | Add product-impact provenance IDs and post-release measurement gate | L / medium |
| AC-P2-001 | P2 | Security audit | Role logs contain worker search commands and broad copied context | False positives and possible boundary exposure | Redact commands/paths and scan structured output only | S / low |
| AC-P2-002 | P2 | Agent portfolio | Persistent role value and duplication are not measured | AI bureaucracy and excess handoffs | Run role deletion/merge experiments using outcome evidence | M / low |
| AC-P2-003 | P2 | Scheduler | Cadence exists but value per recurring job is not measured | Polling and token waste | Add decision/value owner to each recurring job | S / low |
