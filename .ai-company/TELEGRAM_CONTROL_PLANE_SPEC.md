# Telegram Control Plane v1

Telegram is an authenticated command/report surface, never the system of
record. The adapter accepts only schema-defined commands, allowlisted Chairman
identity, update-id idempotency, and an audit checkpoint. Network delivery,
secret handling, rate limits, and outbound report policy remain separate
adapters and must pass security tests before production enablement.

Supported commands include `/status`, `/brief daily|weekly`, `/backlog
<project>`, `/prioritize <backlog-id> <P0|P1|P2|P3>`, `/approve`, `/reject`,
`/revise`, `/delegate`, `/instruct`, `/pause`, `/resume` and `/kill`.

Decision commands are written to the Decision Ledger with a 24-hour expiry and
idempotent decision ID. Expiry and action matching must be enforced again at
the workflow transition boundary; a Telegram acknowledgement alone is never
proof that an action executed.
