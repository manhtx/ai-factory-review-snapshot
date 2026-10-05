# AI Company — Founder Dependency Map

Audit date: 2026-09-11. This maps remaining human boundaries after local automation evidence was re-verified.

| Dependency | Category | Current evidence / reality | Autonomy impact |
|---|---|---|---|
| Start and supervise a local process | PARTIALLY_AUTOMATED | LaunchAgent is installed and running; app lease/checkpoint/reconcile are active | Long-duration and reboot proof remain limited |
| Provide credentials/provider availability | EXTERNAL_DEPENDENCY | Live bounded Codex recovery passes; managed storage is unavailable and production persistence is absent | Blocks production claims, not local control-plane execution |
| Decide whether production may release | LEGITIMATE_SAFETY_APPROVAL | Production autonomy is disabled and release is human-gated | Must remain human-controlled |
| Provision durable remote storage/backups | LEGITIMATE_FOUNDER_GATE | Health reports SQLite and `durablePersistence=false` | Blocks production durability/readiness |
| Select strategic product objective | LEGITIMATE_STRATEGIC_DECISION | Product Goal is protected from autonomous rewrite | Strategy remains founder-owned |
| Diagnose routine provider/runtime incidents | MOSTLY_AUTOMATED_LOCAL | Recovery coordinator, backoff, deduplication and re-review are runtime-proven locally | Continuous external provider recovery remains unobservable |
| Validate real user outcome | EXTERNAL_UNOBSERVABLE | Local funnel evidence is not real-user adoption evidence | Product loop cannot claim market value |
| Approve migrations, deletion, rights/security changes | LEGITIMATE_SAFETY_APPROVAL | Explicit gates and no-go policy remain enforced | Must remain human-gated |
| Interpret production/business evidence | LEGITIMATE_FOUNDER_GATE | No production telemetry or commercial outcome is available | Prevents false autonomy claims |

## Current boundary

Routine local coordination, bounded execution, recovery, QA, telemetry measurement and next-action selection are automated and evidence-backed. Strategy, credentials, irreversible operations, production persistence and real-user/commercial validation remain intentional external or founder gates.
