import { describe, expect, it } from 'vitest';
import { evaluateVerifiedCycleValue } from './outcomeLedger';

const base = { outcome_id: 'O', project_id: 'macro-os', task_id: 'T', actor: 'pm' as const, persona: 'analyst', workflow: 'compare', metric: { name: 'task_success', value: 8, target: 7 }, evidence_ids: ['E'], findings: [], created_at: '' };
describe('verified cycle value', () => {
  it('credits measured improvement, not agent activity', () => expect(evaluateVerifiedCycleValue([{ ...base, verdict: 'SUCCESS' }])).toMatchObject({ verified: true, basis: 'IMPROVEMENT' }));
  it('credits evidence-backed learning when improvement is not proven', () => expect(evaluateVerifiedCycleValue([{ ...base, verdict: 'PARTIAL', metric: { name: 'task_success', value: 2, target: 7 }, findings: ['Invalidated the adoption assumption'] }])).toMatchObject({ verified: true, basis: 'LEARNING' }));
  it('does not credit blocked or unsupported cycles', () => expect(evaluateVerifiedCycleValue([{ ...base, verdict: 'BLOCKED', findings: ['agent ran'] }])).toMatchObject({ verified: false, basis: 'NONE' }));
});
