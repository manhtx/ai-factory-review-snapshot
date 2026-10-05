import type { TelegramControlPlane, TelegramInbound } from './telegramControl';
import { loadTelegramSecrets, validateWebhookSecret } from './telegramSecurity';

export interface WebhookRequest { headers: Record<string, string | undefined>; body: unknown }
export interface WebhookResponse { status: number; body: { ok: boolean; message: string } }

export async function handleTelegramWebhook(request: WebhookRequest, control: TelegramControlPlane, env: NodeJS.ProcessEnv = process.env): Promise<WebhookResponse> {
  let secrets;
  try { secrets = loadTelegramSecrets(env); } catch { return { status: 503, body: { ok: false, message: 'webhook not configured' } }; }
  if (!validateWebhookSecret(secrets.webhookSecret, request.headers['x-telegram-bot-api-secret-token'])) return { status: 401, body: { ok: false, message: 'invalid webhook secret' } };
  if (!isInbound(request.body)) return { status: 400, body: { ok: false, message: 'invalid update payload' } };
  const result = await control.handle(request.body);
  return { status: result.accepted ? 200 : 400, body: { ok: result.accepted, message: result.message } };
}

function isInbound(value: unknown): value is TelegramInbound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return Number.isInteger(candidate.update_id) && typeof candidate.user_id === 'number' && typeof candidate.text === 'string';
}
