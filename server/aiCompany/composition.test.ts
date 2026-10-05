import { describe, expect, it } from 'vitest';
import { createConfiguredCeoBriefPipeline } from './composition';

describe('AI Company composition root', () => {
  it('is fail-closed when Telegram is not explicitly enabled', () => {
    expect(createConfiguredCeoBriefPipeline({ env: {}, health: async () => ({ total_events: 0, released_tasks: 0, revised_tasks: 0, blocked_tasks: 0, agent_failure_rate: 0, rework_rate: 0, cost_per_validated_outcome_usd: 0, evidence_coverage: 0, recovery_success_rate: 0 }) })).toBeNull();
  });

  it('requires a chat target when explicitly enabled', () => {
    expect(() => createConfiguredCeoBriefPipeline({ env: { AI_COMPANY_TELEGRAM_ENABLED: 'true', AI_COMPANY_TELEGRAM_BOT_TOKEN: 'x', AI_COMPANY_TELEGRAM_WEBHOOK_SECRET: 'y' }, health: async () => ({ total_events: 0, released_tasks: 0, revised_tasks: 0, blocked_tasks: 0, agent_failure_rate: 0, rework_rate: 0, cost_per_validated_outcome_usd: 0, evidence_coverage: 0, recovery_success_rate: 0 }) })).toThrow('CHAT_ID');
  });
});
