# Telegram Security Policy

Bot tokens and webhook secrets are runtime-only values supplied by an approved
secret manager or environment. They must never be committed, placed in company
memory, echoed in logs, or included in executive reports. Webhook requests must
be rejected when the configured secret is absent or does not match using
constant-time comparison.
