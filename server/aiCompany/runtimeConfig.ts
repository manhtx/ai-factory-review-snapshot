export function validateRuntimeConfig(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return;
  if (env.AI_COMPANY_REQUIRE_RELEASE_GATE !== 'true') throw new Error('production requires AI_COMPANY_REQUIRE_RELEASE_GATE=true');
  if (env.AI_COMPANY_TELEGRAM_ENABLED === 'true' && !env.AI_COMPANY_TELEGRAM_WEBHOOK_SECRET) throw new Error('telegram webhook secret is required');
}
