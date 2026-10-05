import { describe, expect, it } from 'vitest';
import { loadTelegramSecrets, validateWebhookSecret } from './telegramSecurity';

describe('Telegram security', () => {
  it('uses constant-time secret validation and rejects missing/mismatched values', () => {
    expect(validateWebhookSecret('abc', 'abc')).toBe(true);
    expect(validateWebhookSecret('abc', 'abd')).toBe(false);
    expect(validateWebhookSecret('abc', undefined)).toBe(false);
  });

  it('loads secrets only from runtime environment', () => {
    expect(loadTelegramSecrets({ AI_COMPANY_TELEGRAM_BOT_TOKEN: 'token', AI_COMPANY_TELEGRAM_WEBHOOK_SECRET: 'secret' })).toEqual({ botToken: 'token', webhookSecret: 'secret' });
    expect(() => loadTelegramSecrets({})).toThrow('not configured');
  });
});
