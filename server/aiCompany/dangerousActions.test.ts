import { describe, expect, it } from 'vitest';
import { dangerousActionForState, requiresDecision } from './dangerousActions';

describe('dangerous action policy', () => {
  it('classifies irreversible workflow transitions', () => {
    expect(dangerousActionForState('RELEASED')).toBe('RELEASE');
    expect(dangerousActionForState('KILLED')).toBe('KILL');
    expect(dangerousActionForState('ROLLBACK')).toBe('ROLLBACK');
    expect(dangerousActionForState('READY')).toBeNull();
    expect(requiresDecision('CHANGE_PERMISSION')).toBe(true);
  });
});
