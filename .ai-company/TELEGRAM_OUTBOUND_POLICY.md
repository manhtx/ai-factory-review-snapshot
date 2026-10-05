# Telegram Outbound Policy

Only compact executive decision packets may be sent to Telegram. Raw traces,
prompts, secrets, full evidence payloads and unbounded logs are excluded. The
formatter redacts common API-token/bot-token patterns and enforces a message
size cap. Network delivery must be a separate adapter with retry limits and
dead-letter handling.
