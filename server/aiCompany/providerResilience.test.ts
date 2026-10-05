import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classifyProviderFailure, isQuotaExhausted, parseRetryNotBefore, ProviderDeadLetterLedger, retryDelayMs } from './providerResilience';

// ── E8: Provider Error Separation ──────────────────────────────────────────────

describe('providerResilience — E8 error separation', () => {
  it('classifies QUOTA_EXHAUSTED before RATE_LIMIT for individual quota messages', () => {
    expect(classifyProviderFailure(new Error('Individual quota reached. Resets in 1h24m4s.'))).toMatchObject({ failure_class: 'QUOTA_EXHAUSTED', disposition: 'RESOURCE_EXHAUSTED' });
    expect(classifyProviderFailure(new Error('Error: Individual quota reached. Please upgrade your subscription. Resets in 45m.'))).toMatchObject({ failure_class: 'QUOTA_EXHAUSTED' });
    expect(classifyProviderFailure(new Error('usage limit exceeded'))).toMatchObject({ failure_class: 'QUOTA_EXHAUSTED' });
    expect(classifyProviderFailure(new Error('resource_exhausted: quota'))).toMatchObject({ failure_class: 'QUOTA_EXHAUSTED' });
    expect(classifyProviderFailure(new Error('insufficient_quota'))).toMatchObject({ failure_class: 'QUOTA_EXHAUSTED' });
  });

  it('classifies RATE_LIMIT for transient rate limits (different from quota)', () => {
    expect(classifyProviderFailure(new Error('Rate limit exceeded: too many requests'))).toMatchObject({ failure_class: 'RATE_LIMIT', disposition: 'WAIT_AND_RETRY' });
    expect(classifyProviderFailure({ status: 429 })).toMatchObject({ failure_class: 'RATE_LIMIT' });
    expect(classifyProviderFailure(new Error('too many requests in the last 60 seconds'))).toMatchObject({ failure_class: 'RATE_LIMIT' });
  });

  it('classifies PROVIDER_UNAVAILABLE for 503 and service errors', () => {
    expect(classifyProviderFailure({ status: 503 })).toMatchObject({ failure_class: 'PROVIDER_UNAVAILABLE', disposition: 'RETRYABLE' });
    expect(classifyProviderFailure({ status: 502 })).toMatchObject({ failure_class: 'PROVIDER_UNAVAILABLE' });
    expect(classifyProviderFailure(new Error('503 Service Unavailable'))).toMatchObject({ failure_class: 'PROVIDER_UNAVAILABLE' });
    expect(classifyProviderFailure(new Error('Service unavailable: provider down'))).toMatchObject({ failure_class: 'PROVIDER_UNAVAILABLE' });
  });

  it('classifies NETWORK_FAILURE for connection errors', () => {
    expect(classifyProviderFailure(new Error('ECONNREFUSED network failure'))).toMatchObject({ failure_class: 'NETWORK_FAILURE', disposition: 'RETRYABLE' });
    expect(classifyProviderFailure(new Error('fetch error: network unreachable'))).toMatchObject({ failure_class: 'NETWORK_FAILURE' });
    expect(classifyProviderFailure(new Error('connect ETIMEDOUT 1.2.3.4:443'))).toMatchObject({ failure_class: 'NETWORK_FAILURE' });
  });

  it('classifies AUTH_FAILURE for credential errors', () => {
    expect(classifyProviderFailure({ status: 401 })).toMatchObject({ failure_class: 'AUTH_FAILURE', disposition: 'REQUIRES_CREDENTIAL' });
    expect(classifyProviderFailure(new Error('Unauthorized: invalid API key'))).toMatchObject({ failure_class: 'AUTH_FAILURE' });
    expect(classifyProviderFailure(new Error('invalid_api_key provided'))).toMatchObject({ failure_class: 'AUTH_FAILURE' });
  });

  it('does NOT map QUOTA_EXHAUSTED to WAIT_AND_RETRY — distinct long-duration semantics', () => {
    const r = classifyProviderFailure(new Error('Individual quota reached. Resets in 1h24m4s.'));
    expect(r.disposition).not.toBe('WAIT_AND_RETRY');
    expect(r.disposition).toBe('RESOURCE_EXHAUSTED');
  });

  it('does NOT map 503 to QUOTA_EXHAUSTED — distinct semantics', () => {
    const r = classifyProviderFailure({ status: 503 });
    expect(r.failure_class).not.toBe('QUOTA_EXHAUSTED');
    expect(r.failure_class).toBe('PROVIDER_UNAVAILABLE');
  });
});

// ── isQuotaExhausted ──────────────────────────────────────────────────────────

describe('providerResilience — isQuotaExhausted', () => {
  it('detects actual Antigravity quota message format', () => {
    expect(isQuotaExhausted(new Error('Error: Individual quota reached. Please upgrade your subscription to increase your limits. Resets in 1h24m4s.'))).toBe(true);
  });

  it('returns false for transient rate-limit messages', () => {
    expect(isQuotaExhausted(new Error('Rate limit exceeded: try again in 30 seconds'))).toBe(false);
  });

  it('returns false for 503 service unavailable', () => {
    expect(isQuotaExhausted({ status: 503, message: 'Service Unavailable' })).toBe(false);
  });
});

// ── parseRetryNotBefore ───────────────────────────────────────────────────────

describe('providerResilience — parseRetryNotBefore', () => {
  it('parses h/m/s combined format from Antigravity actual quota message', () => {
    const before = Date.now();
    const result = parseRetryNotBefore('Resets in 1h24m4s');
    const after = Date.now();
    expect(result).not.toBeNull();
    const expectedMs = (1 * 3600 + 24 * 60 + 4) * 1000;
    expect(result!.getTime()).toBeGreaterThanOrEqual(before + expectedMs - 200);
    expect(result!.getTime()).toBeLessThanOrEqual(after + expectedMs + 200);
  });

  it('parses minutes-only format', () => {
    const result = parseRetryNotBefore('Resets in 45m');
    expect(result).not.toBeNull();
    expect(result!.getTime() - Date.now()).toBeGreaterThan(44 * 60 * 1000);
  });

  it('returns null for unrecognized formats', () => {
    expect(parseRetryNotBefore('some error message')).toBeNull();
    expect(parseRetryNotBefore('')).toBeNull();
  });
});

// ── Existing tests ────────────────────────────────────────────────────────────

describe('provider resilience — existing', () => {
  it('classifies failures correctly using object input', () => {
    expect(classifyProviderFailure({ status: 401 })).toMatchObject({ failure_class: 'AUTH_FAILURE', disposition: 'REQUIRES_CREDENTIAL' });
    expect(classifyProviderFailure({ message: 'malformed JSON response' })).toMatchObject({ failure_class: 'MALFORMED_OUTPUT', disposition: 'NON_RETRYABLE' });
    expect(classifyProviderFailure({ status: 503 })).toMatchObject({ failure_class: 'PROVIDER_UNAVAILABLE', disposition: 'RETRYABLE' });
  });

  it('bounds exponential backoff and persists dead letters', async () => {
    expect(retryDelayMs(20, 100, 1000)).toBe(1000);
    const dir = await mkdtemp(join(tmpdir(), 'ai-company-provider-'));
    const ledger = new ProviderDeadLetterLedger(dir);
    await ledger.record({ project_id: 'macro-os', work_id: 'W1', provider_id: 'codex', model: 'test', failure_class: 'PROVIDER_TIMEOUT', reason: 'timeout', attempt: 2, next_action: 'retry after cooldown', required_intervention: null });
    await expect(ledger.records()).resolves.toHaveLength(1);
  });
});
