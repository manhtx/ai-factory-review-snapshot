import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export type ProviderFailureClass = 'QUOTA_EXHAUSTED' | 'PROVIDER_TIMEOUT' | 'PROVIDER_UNAVAILABLE' | 'RATE_LIMIT' | 'AUTH_FAILURE' | 'MALFORMED_OUTPUT' | 'SCHEMA_FAILURE' | 'NETWORK_FAILURE' | 'LOCAL_RUNNER_FAILURE' | 'UNKNOWN_PROVIDER_FAILURE';
export type RetryDisposition = 'RETRYABLE' | 'NON_RETRYABLE' | 'REQUIRES_CREDENTIAL' | 'WAIT_AND_RETRY' | 'RESOURCE_EXHAUSTED';

export function isQuotaExhausted(input: { status?: number; message?: string } | Error): boolean {
  const message = (input instanceof Error ? input.message : (input.message ?? '')).toLowerCase();
  // Host-AI individual quota (Antigravity/Codex pattern)
  if (/individual quota|quota reached|usage limit|resource_exhausted|resets in \d/.test(message)) return true;
  // Gemini/OpenAI quota patterns
  if (/you have exceeded your (quota|limit)|quota exceeded|insufficient_quota/.test(message)) return true;
  return false;
}

export function parseRetryNotBefore(message: string): Date | null {
  // "Resets in 1h24m4s" / "Resets in 45m" / "Resets in 3600s"
  const match = message.match(/resets?\s+in\s+(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/i);
  if (!match) return null;
  const h = parseInt(match[1] ?? '0', 10);
  const m = parseInt(match[2] ?? '0', 10);
  const s = parseInt(match[3] ?? '0', 10);
  const totalMs = (h * 3600 + m * 60 + s) * 1000;
  if (totalMs <= 0) return null;
  return new Date(Date.now() + totalMs);
}

export function classifyProviderFailure(input: { status?: number; message?: string; timeout?: boolean } | Error): { failure_class: ProviderFailureClass; disposition: RetryDisposition } {
  const message = (input instanceof Error ? input.message : (input.message ?? '')).toLowerCase();
  const status = input instanceof Error ? undefined : input.status;
  const timeout = input instanceof Error ? false : (input.timeout ?? false);

  // Check QUOTA_EXHAUSTED before RATE_LIMIT — quota is a distinct long-duration resource state
  if (isQuotaExhausted(input)) return { failure_class: 'QUOTA_EXHAUSTED', disposition: 'RESOURCE_EXHAUSTED' };
  if (timeout || message.includes('timeout') || message.includes('abort')) return { failure_class: 'PROVIDER_TIMEOUT', disposition: 'WAIT_AND_RETRY' };
  if (status === 401 || status === 403 || message.includes('unauthorized') || message.includes('invalid api key') || message.includes('invalid_api_key')) return { failure_class: 'AUTH_FAILURE', disposition: 'REQUIRES_CREDENTIAL' };
  if (status === 429 || message.includes('rate limit') || message.includes('too many requests')) return { failure_class: 'RATE_LIMIT', disposition: 'WAIT_AND_RETRY' };
  if (status !== undefined && status >= 500) return { failure_class: 'PROVIDER_UNAVAILABLE', disposition: 'RETRYABLE' };
  // Text-pattern 503 detection (when no numeric status)
  if (message.includes('503') || message.includes('service unavailable') || message.includes('bad gateway') || message.includes('502')) return { failure_class: 'PROVIDER_UNAVAILABLE', disposition: 'RETRYABLE' };
  if (message.includes('json') || message.includes('schema')) return { failure_class: message.includes('schema') ? 'SCHEMA_FAILURE' : 'MALFORMED_OUTPUT', disposition: 'NON_RETRYABLE' };
  if (message.includes('econnrefused') || message.includes('network') || message.includes('fetch') || message.includes('connect')) return { failure_class: 'NETWORK_FAILURE', disposition: 'RETRYABLE' };
  return { failure_class: 'UNKNOWN_PROVIDER_FAILURE', disposition: 'NON_RETRYABLE' };
}

export function retryDelayMs(attempt: number, baseMs = 250, maxMs = 30_000, jitter = 0): number {
  const boundedAttempt = Math.max(0, Math.floor(attempt));
  const exponential = Math.min(maxMs, baseMs * (2 ** boundedAttempt));
  return Math.max(0, Math.min(maxMs, exponential + jitter));
}

export interface ProviderDeadLetter { dead_letter_id: string; project_id: string; work_id: string; provider_id: string; model: string; failure_class: ProviderFailureClass; reason: string; attempt: number; next_action: string; required_intervention: string | null; created_at: string; }

export class ProviderDeadLetterLedger {
  private readonly file: string;
  constructor(private readonly rootDir: string) { this.file = join(rootDir, 'provider-dead-letters.jsonl'); }
  async record(input: Omit<ProviderDeadLetter, 'dead_letter_id' | 'created_at'>): Promise<ProviderDeadLetter> {
    const row = { ...input, dead_letter_id: `PDL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, created_at: new Date().toISOString() };
    await mkdir(this.rootDir, { recursive: true }); await appendFile(this.file, `${JSON.stringify(row)}\n`, 'utf8'); return row;
  }
  async records(): Promise<ProviderDeadLetter[]> { try { return (await readFile(this.file, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line) as ProviderDeadLetter); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; } }
}
