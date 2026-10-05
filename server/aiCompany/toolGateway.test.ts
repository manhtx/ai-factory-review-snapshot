import { describe, expect, it } from 'vitest';
import { ToolGateway } from './toolGateway';

describe('ToolGateway', () => {
  const gateway = new ToolGateway('/repo');
  it('fails closed for shell and control-plane access', () => {
    expect(gateway.authorize({ agent: 'coder', task: 'T', tool: 'shell', action: 'run' }, '/repo/.ai-company/worktrees/T')).toBe('DENY');
    expect(gateway.authorize({ agent: 'coder', task: 'T', tool: 'filesystem', action: 'write', resource: '/repo/src/a.ts' }, '/repo')).toBe('DENY');
    expect(gateway.authorize({ agent: 'coder', task: 'T', tool: 'filesystem', action: 'write', resource: '/repo/src/a.ts' }, '/repo/.ai-company/worktrees/T')).toBe('DENY');
  });
  it('allows scoped reads and requires approval for writes', () => {
    const workspace = '/repo/.ai-company/worktrees/T';
    expect(gateway.authorize({ agent: 'coder', task: 'T', tool: 'filesystem', action: 'read', resource: `${workspace}/src/a.ts` }, workspace)).toBe('ALLOW');
    expect(gateway.authorize({ agent: 'coder', task: 'T', tool: 'filesystem', action: 'write', resource: `${workspace}/src/a.ts` }, workspace)).toBe('APPROVAL_REQUIRED');
  });
});
