# Telegram Composition

Telegram delivery is disabled unless `AI_COMPANY_TELEGRAM_ENABLED=true`.
Enabling it requires runtime bot token, webhook secret and chat ID. The
composition root wires the CEO brief pipeline to the redacted API adapter and
persistent scheduler state; missing configuration fails closed at startup.
