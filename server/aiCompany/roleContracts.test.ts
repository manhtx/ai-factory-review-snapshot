import { describe, expect, it } from 'vitest';
import { authorizeCompanyOperation, getRoleContract, roleContracts, validateRoleContracts } from './roleContracts';

describe('AI Company role contracts', () => {
  it('defines the cross-functional operating roster', () => {
    expect(roleContracts.map((role) => role.role_id)).toEqual(expect.arrayContaining([
      'ceo', 'pm', 'data-engineer', 'backend-engineer', 'frontend-engineer',
      'coder',
      'ai-engineer', 'sre', 'security', 'functional-qa', 'quality-control',
      'ux-research', 'stakeholder-panel', 'user-persona', 'domain-expert',
      'release-security-gate',
    ]));
  });

  it('requires explicit outputs and independence for every role', () => {
    expect(validateRoleContracts()).toEqual([]);
    expect(getRoleContract('ceo').cannot_self_approve).toBe(true);
    expect(getRoleContract('release-security-gate').allowed_states).toContain('RELEASED');
  });

  it('fails closed for unknown roles', () => {
    expect(() => getRoleContract('unknown')).toThrow('unknown company role');
  });

  it('denies unsafe operations and role self-approval', () => {
    expect(() => authorizeCompanyOperation('coder', 'RELEASE')).toThrow('cannot perform');
    expect(() => authorizeCompanyOperation('ceo', 'READ_SECRET')).toThrow('denied company operation');
    expect(() => authorizeCompanyOperation('pm', 'RELEASE')).toThrow('cannot perform');
  });

  it('supports legacy review workers through explicit compatibility mapping', () => {
    expect(() => authorizeCompanyOperation('functional-qa', 'REVIEW')).not.toThrow();
    expect(() => authorizeCompanyOperation('domain-expert', 'IMPLEMENT')).toThrow('cannot perform');
  });
});
