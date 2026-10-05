import { describe, expect, it } from 'vitest';
import { validateRuntimeConfig } from './runtimeConfig';

describe('runtime config', () => {
  it('fails closed for production without mandatory release gate', () => {
    expect(() => validateRuntimeConfig({ NODE_ENV: 'production' })).toThrow('REQUIRE_RELEASE_GATE');
    expect(() => validateRuntimeConfig({ NODE_ENV: 'test' })).not.toThrow();
  });
  it('requires a webhook secret when Telegram is enabled', () => {
    expect(() => validateRuntimeConfig({ NODE_ENV: 'production', AI_COMPANY_REQUIRE_RELEASE_GATE: 'true', AI_COMPANY_TELEGRAM_ENABLED: 'true' })).toThrow('webhook secret');
  });
});
