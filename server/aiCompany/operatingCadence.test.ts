import { describe, expect, it } from 'vitest';
import { cadencePolicyFor, cadencePolicySnapshot, macroOsCadencePolicy } from './operatingCadence';

describe('operating cadence policy', () => {
  it('defines every executive horizon from daily through annual', () => {
    expect(macroOsCadencePolicy.map((item) => item.cadence)).toEqual(['daily', 'weekly', 'monthly', 'quarterly', 'annual']);
    expect(cadencePolicyFor('quarterly').accountable_roles).toContain('stakeholder-panel');
    expect(cadencePolicyFor('weekly').accountable_roles).toEqual(expect.arrayContaining(['backend-engineer', 'frontend-engineer', 'ai-engineer', 'functional-qa', 'quality-control']));
    expect(cadencePolicyFor('weekly').accountable_roles).toContain('release-security-gate');
  });

  it('requires evidence and makes reviews release-relevant', () => {
    expect(macroOsCadencePolicy.every((item) => item.release_blocking && item.required_evidence.length >= 3)).toBe(true);
    expect(cadencePolicySnapshot().blocking_cadences).toHaveLength(5);
  });
});
