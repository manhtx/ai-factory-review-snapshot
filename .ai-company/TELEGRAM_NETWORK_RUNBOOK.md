# Telegram Network Adapter Runbook

The Bot API adapter is the final transport only. It accepts already-redacted
executive text, loads secrets at runtime, applies a timeout and a maximum of
five attempts, then emits a dead-letter record on failure. Network delivery is
not allowed to mutate workflow state directly; the caller must record the
delivery outcome separately.
