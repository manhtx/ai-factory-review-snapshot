import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Supabase heartbeat safety contract', () => {
  it('uses an isolated table and exact cleanup predicates', async () => {
    const source = await readFile('scripts/supabase-heartbeat.mjs', 'utf8');
    expect(source).toContain('ai_company_heartbeats');
    expect(source).toContain('heartbeat_key=eq.');
    expect(source).toContain('namespace=eq.');
    expect(source).toContain('source=eq.');
    expect(source).toContain("action === 'pulse'");
    expect(source).not.toContain('observations');
    expect(source).not.toContain('research_runs');
  });

  it('fails closed without server-side configuration', async () => {
    const { execFile } = await import('node:child_process');
    const result = await new Promise((resolve) => execFile('node', ['scripts/supabase-heartbeat.mjs', 'write'], { env: { PATH: process.env.PATH, AI_COMPANY_ENV_FILE: '/tmp/ai-company-heartbeat-missing.env' }, cwd: process.cwd() }, (error, stdout, stderr) => resolve({ code: error?.code ?? 0, stdout, stderr })));
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('missing server-side configuration');
  });
});
