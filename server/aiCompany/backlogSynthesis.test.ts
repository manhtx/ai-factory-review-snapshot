import { describe, expect, it } from 'vitest';
import { synthesizeBacklog } from './backlogSynthesis';

describe('PM backlog synthesis', () => {
  it('prioritizes independent rejection above revision', () => {
    const items = synthesizeBacklog('p', 't', [
      { feedback_id: 'a', council_id: 'u1', project_id: 'p', task_id: 't', verdict: 'REVISE', findings: ['mobile layout'], confidence: .8, evidence_ids: [], created_at: '' },
      { feedback_id: 'b', council_id: 'u2', project_id: 'p', task_id: 't', verdict: 'REJECT', findings: ['mobile layout'], confidence: .9, evidence_ids: [], created_at: '' },
    ]);
    expect(items[0].priority).toBe('P0');
    expect(items[0].source_feedback_ids).toEqual(['a', 'b']);
  });
});
