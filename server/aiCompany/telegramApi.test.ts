import { describe, expect, it, vi } from 'vitest';
import { TelegramApi } from './telegramApi';
import { DeliveryLedger } from './deliveryLedger';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const env = { AI_COMPANY_TELEGRAM_BOT_TOKEN: 'runtime-token', AI_COMPANY_TELEGRAM_WEBHOOK_SECRET: 'secret' };

describe('Telegram API adapter', () => {
  it('sends a message with bounded transport retries', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    await new TelegramApi({ fetch }, env).sendMessage('42', 'brief');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toContain('runtime-token');
    expect(JSON.parse(fetch.mock.calls[0][1].body).text).toBe('brief');
  });

  it('dead-letters after the configured retry cap', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    const onDeadLetter = vi.fn().mockResolvedValue(undefined);
    await expect(new TelegramApi({ fetch }, env).sendMessage('42', 'brief', { maxAttempts: 2, onDeadLetter })).rejects.toThrow('2 attempts');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(onDeadLetter).toHaveBeenCalledWith(expect.objectContaining({ attempts: 2, reason: 'http_503' }));
  });

  it('persists SENT and DEAD_LETTER outcomes', async () => {
    const ledger = new DeliveryLedger(await mkdtemp(path.join(os.tmpdir(), 'ai-company-')));
    const sent = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    await new TelegramApi({ fetch: sent }, env, ledger).sendMessage('42', 'brief', { reportId: 'R-SENT' });
    const failed = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    await expect(new TelegramApi({ fetch: failed }, env, ledger).sendMessage('42', 'brief', { reportId: 'R-FAILED', maxAttempts: 1 })).rejects.toThrow();
    await expect(ledger.records()).resolves.toMatchObject([{ report_id: 'R-SENT', status: 'SENT' }, { report_id: 'R-FAILED', status: 'DEAD_LETTER' }]);
  });
});
