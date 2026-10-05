import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CompanyStateStore } from './stateStore';
import { TelegramControlPlane } from './telegramControl';
import { handleTelegramWebhook } from './telegramWebhook';

const env = { AI_COMPANY_TELEGRAM_BOT_TOKEN: 'token', AI_COMPANY_TELEGRAM_WEBHOOK_SECRET: 'secret' };

describe('Telegram webhook', () => {
  it('rejects missing/invalid secrets before parsing payload', async () => {
    const control = new TelegramControlPlane(42, new CompanyStateStore(await mkdtemp(path.join(os.tmpdir(), 'ai-company-'))));
    expect((await handleTelegramWebhook({ headers: {}, body: {} }, control, env)).status).toBe(401);
    expect((await handleTelegramWebhook({ headers: { 'x-telegram-bot-api-secret-token': 'secret' }, body: {} }, control, env)).status).toBe(400);
  });

  it('accepts valid updates and passes them to the command boundary', async () => {
    const control = new TelegramControlPlane(42, new CompanyStateStore(await mkdtemp(path.join(os.tmpdir(), 'ai-company-'))));
    const result = await handleTelegramWebhook({ headers: { 'x-telegram-bot-api-secret-token': 'secret' }, body: { update_id: 7, user_id: 42, text: '/status macro-os' } }, control, env);
    expect(result).toEqual({ status: 200, body: { ok: true, message: 'accepted STATUS' } });
  });
});
