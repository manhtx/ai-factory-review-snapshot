import { describe, expect, it } from 'vitest';
import { createCeoBriefPipeline } from './ceoBriefPipeline';

describe('CEO brief pipeline', () => {
  it('runs health → report → redacted send → persisted schedule state', async () => {
    const sent: Array<{ text: string; reportId: string }> = [];
    const memory = new Map<string, string>();
    const pipeline = createCeoBriefPipeline({
      now: () => new Date('2026-09-08T08:00:00Z'),
      health: async () => ({ total_events: 10, released_tasks: 1, revised_tasks: 2, blocked_tasks: 0, agent_failure_rate: 0.2, rework_rate: 0.3, cost_per_validated_outcome_usd: 2, evidence_coverage: 0.5, recovery_success_rate: 1 }),
      send: async (text, reportId) => { sent.push({ text, reportId }); },
      state: { get: async (key) => memory.get(key) ?? null, set: async (key, value) => { memory.set(key, value); } },
    });
    expect(await pipeline.tick()).toEqual(['daily']);
    expect(sent[0].text).toContain('OPT-FAILURE');
    expect(sent[0].reportId).toMatch(/^RPT-/);
    expect(memory.get('brief:daily')).toBe('2026-09-08');
  });
});
