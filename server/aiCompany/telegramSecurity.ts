import { timingSafeEqual } from 'node:crypto';

export interface TelegramSecrets { botToken: string; webhookSecret: string }

export function loadTelegramSecrets(env: NodeJS.ProcessEnv = process.env): TelegramSecrets {
  const botToken = env.AI_COMPANY_TELEGRAM_BOT_TOKEN;
  const webhookSecret = env.AI_COMPANY_TELEGRAM_WEBHOOK_SECRET;
  if (!botToken || !webhookSecret) throw new Error('Telegram secrets are not configured');
  return { botToken, webhookSecret };
}

export function validateWebhookSecret(expected: string, received: string | undefined): boolean {
  if (!received) return false;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}
