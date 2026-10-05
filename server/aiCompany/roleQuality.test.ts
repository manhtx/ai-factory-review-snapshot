import { describe, expect, it } from 'vitest';
import { evaluateRoleOutput } from './roleQuality';

describe('role quality evaluator', () => {
  const base = { role: 'pm', suppliedEvidence: ['freshness audit'], acceptanceCriteria: ['return bounded next action'], productGoal: 'Verified product improvement per autonomous operating cycle for Macro OS.' };
  it('fails unsupported user claims and scope drift', () => {
    expect(evaluateRoleOutput({ ...base, output: 'Based on user feedback, build a user interface.' })).toMatchObject({ content_quality: 'QUALITY_FAIL', warnings: expect.arrayContaining([expect.stringContaining('user evidence'), expect.stringContaining('UI/UX')]) });
  });
  it('passes bounded evidence-aware output', () => {
    expect(evaluateRoleOutput({ ...base, output: 'The freshness audit is the supplied evidence. Recommend validating latest-available semantics; limitation: no user outcome evidence.' }).content_quality).toBe('PASS');
  });
});
