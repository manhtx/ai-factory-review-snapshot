import { describe, expect, it } from 'vitest';
import { parseStructuredRoleOutput } from './structuredRoleOutput';

describe('provider confidence compatibility', () => {
  it('normalizes a known PM confidence label without accepting arbitrary text', () => {
    const base = {
      role: 'pm', problem: 'p', target_user: 'u', product_goal_objective: 'g',
      evidence_ids: ['E1'], facts: ['f'], assumptions: [], scope: ['s'],
      non_goals: [], recommendation: 'PROCEED', unknowns: [], confidence: 'high',
    };
    expect(parseStructuredRoleOutput('pm', JSON.stringify(base)).valid).toBe(true);
    expect(parseStructuredRoleOutput('pm', JSON.stringify({ ...base, confidence: 'certain' })).valid).toBe(false);
    const qualified = parseStructuredRoleOutput('pm', JSON.stringify({ ...base, confidence: 'high for bounded sprint selection; low for outcome impact' }));
    expect(qualified.valid).toBe(true);
    expect((qualified.structured as { confidence?: number } | undefined)?.confidence).toBe(0.75);
  });
});
