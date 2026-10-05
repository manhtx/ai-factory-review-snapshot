import { describe, expect, it } from 'vitest';
import { classifyWorkIntent } from './workIntent';

describe('work intent routing', () => {
  it('routes test-only regression guards deterministically without LLM roles', () => {
    const d = classifyWorkIntent({ objective: 'Add regression guard and validate current behavior', task_type: 'role-work', allowed_paths: ['server/freshness.test.ts'] });
    expect(d.intent).toBe('VALIDATION_ONLY'); expect(d.routing_class).toBe('R0'); expect(d.expected_product_behavior_change).toBe('NO');
  });
  it('routes a source bug fix to one bounded worker class', () => {
    const d = classifyWorkIntent({ objective: 'Fix freshness display bug', task_type: 'code-change', allowed_paths: ['server/freshness.ts'] });
    expect(d.intent).toBe('BUG_FIX'); expect(d.routing_class).toBe('R1');
  });
  it('keeps ambiguous work safe and explicit', () => { expect(classifyWorkIntent({}).intent).toBe('UNKNOWN'); });
});
