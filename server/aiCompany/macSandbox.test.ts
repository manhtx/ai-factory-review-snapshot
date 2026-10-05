import { describe, expect, it } from 'vitest';
import { macSandboxProfile } from './macSandbox';

describe('macSandboxProfile', () => {
  it('allows workspace writes while denying network and unrelated writes', () => {
    const profile = macSandboxProfile('/repo', '/repo/.ai-company/worktrees/T');
    expect(profile).toContain('(allow file-write* (subpath "/repo/.ai-company/worktrees/T"))');
    expect(profile).toContain('(deny default)');
    expect(profile).not.toContain('network-outbound');
    expect(profile).not.toContain('(allow file-write* (subpath "/repo"))');
  });
});
