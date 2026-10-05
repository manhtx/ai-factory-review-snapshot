import { describe, expect, it } from 'vitest';
import { authorize } from './policyEngine';

describe('AI Company policy engine', () => {
  it('denies secrets and arbitrary shell for every role', () => {
    expect(() => authorize({ actor: 'ceo', action: 'READ_SECRET' })).toThrow('denied action');
    expect(() => authorize({ actor: 'coder', action: 'EXECUTE_SHELL' })).toThrow('denied action');
  });

  it('prevents coder from releasing and QA from acting as release gate', () => {
    expect(() => authorize({ actor: 'coder', action: 'RELEASE' })).toThrow('denied action');
    expect(() => authorize({ actor: 'functional-qa', action: 'TRANSITION', toState: 'RELEASED' })).toThrow('cannot transition');
  });

  it('allows only the release gate to release', () => {
    expect(() => authorize({ actor: 'release-security-gate', action: 'RELEASE', toState: 'RELEASED' })).not.toThrow();
  });

  it('requires executive authority for P0 transitions', () => {
    expect(() => authorize({ actor: 'coder', action: 'TRANSITION', toState: 'BLOCKED', riskLevel: 'P0' })).toThrow('P0 transition');
    expect(() => authorize({ actor: 'ceo', action: 'TRANSITION', toState: 'HOLD', riskLevel: 'P0' })).not.toThrow();
  });
});
