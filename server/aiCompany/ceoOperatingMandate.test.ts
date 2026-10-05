import { describe, expect, it } from 'vitest';
import { ceoMandateSnapshot, macroOsCeoMandate } from './ceoOperatingMandate';

describe('CEO operating mandate', () => {
  it('covers near, mid and long horizons for Macro OS', () => {
    expect(macroOsCeoMandate.project_id).toBe('macro-os');
    expect(macroOsCeoMandate.horizons.map((item) => item.horizon)).toEqual(['near_term', 'mid_term', 'long_term']);
    expect(macroOsCeoMandate.horizons.at(-1)?.window).toBe('3-15 years');
  });

  it('makes release and discovery decisions evidence-bound', () => {
    const release = macroOsCeoMandate.decision_rights.find((item) => item.decision === 'authorize release');
    const discovery = macroOsCeoMandate.decision_rights.find((item) => item.decision.startsWith('promote an AI'));
    expect(release?.required_evidence).toHaveLength(6);
    expect(release?.cannot_override).toContain('unverified data');
    expect(discovery?.cannot_override).toContain('DISCOVERED-only status');
    expect(ceoMandateSnapshot()).toMatchObject({ horizon_count: 3, decision_count: 4, cadence_count: 5 });
  });
});
