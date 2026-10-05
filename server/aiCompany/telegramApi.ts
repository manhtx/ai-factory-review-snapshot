import { loadTelegramSecrets } from './telegramSecurity';
import { DeliveryLedger } from './deliveryLedger';

export interface TelegramTransport { fetch(input: string, init: RequestInit): Promise<Response> }
export interface DeadLetter { chatId: string; text: string; reason: string; attempts: number }

export class TelegramApi {
  constructor(private readonly transport: TelegramTransport = { fetch: globalThis.fetch }, private readonly env: NodeJS.ProcessEnv = process.env, private readonly ledger?: DeliveryLedger) {}

  async sendMessage(chatId: string, text: string, options: { maxAttempts?: number; timeoutMs?: number; reportId?: string; onDeadLetter?: (item: DeadLetter) => Promise<void> } = {}): Promise<void> {
    const secrets = loadTelegramSecrets(this.env);
    const maxAttempts = Math.max(1, Math.min(options.maxAttempts ?? 2, 5));
    const timeoutMs = options.timeoutMs ?? 5000;
    let lastReason = 'unknown failure';
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await this.transport.fetch(`https://api.telegram.org/bot${secrets.botToken}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text }), signal: controller.signal });
        if (response.ok) {
          await this.ledger?.record({ channel: 'telegram', target: chatId, report_id: options.reportId ?? 'unspecified', status: 'SENT', attempts: attempt });
          return;
        }
        lastReason = `http_${response.status}`;
      } catch (error: unknown) { lastReason = error instanceof Error ? error.message : 'transport failure'; }
      finally { clearTimeout(timer); }
      if (attempt < maxAttempts) await new Promise((resolve) => setTimeout(resolve, 20 * attempt));
    }
    await options.onDeadLetter?.({ chatId, text, reason: lastReason, attempts: maxAttempts });
    await this.ledger?.record({ channel: 'telegram', target: chatId, report_id: options.reportId ?? 'unspecified', status: 'DEAD_LETTER', attempts: maxAttempts, error: lastReason });
    throw new Error(`Telegram delivery failed after ${maxAttempts} attempts: ${lastReason}`);
  }
}
