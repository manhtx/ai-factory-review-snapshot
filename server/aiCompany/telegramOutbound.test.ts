import { describe, expect, it } from 'vitest';
import { formatExecutiveTelegram } from './telegramOutbound';

describe('Telegram outbound policy', () => {
  it('emits compact executive packets and redacts secrets', () => {
    const message = formatExecutiveTelegram({ report_id: 'R', period: '2026-W36', health: { total_events: 1, released_tasks: 1, revised_tasks: 0, blocked_tasks: 0, agent_failure_rate: 0, rework_rate: 0, cost_per_validated_outcome_usd: 1, evidence_coverage: 1, recovery_success_rate: 1 }, weakest_area: 'none', evidence: ['api_key=sk-secret'], optimization_proposals: [], chairman_decisions_required: [], default_action_if_no_response: 'CEO_DECIDE' });
    expect(message).toContain('[REDACTED]');
    expect(message).not.toContain('sk-secret');
    expect(message.length).toBeLessThan(3801);
  });
});
