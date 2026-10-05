import { describe, expect, it } from 'vitest';
import { computeTrialQuality } from './trialMetrics';

describe('trial quality metrics', () => {
  it('measures user acceptance and confidence separately from runtime health', () => {
    const metrics = computeTrialQuality([{ feedback_id: 'a', council_id: 'u', project_id: 'p', task_id: 't', verdict: 'ACCEPT', findings: [], confidence: .8, evidence_ids: [], created_at: '' }, { feedback_id: 'b', council_id: 'd', project_id: 'p', task_id: 't', verdict: 'REVISE', findings: ['x'], confidence: .6, evidence_ids: [], created_at: '' }]);
    expect(metrics.user_task_success).toBe(.5);
    expect(metrics.revise_rate).toBe(.5);
    expect(metrics.average_confidence).toBe(.7);
  });
});
