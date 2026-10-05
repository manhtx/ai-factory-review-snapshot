import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';

describe('Supabase heartbeat launchd schedule', () => {
  it('runs only the heartbeat writer at midnight with production disabled', () => {
    const output = execFileSync('node', ['scripts/render-supabase-heartbeat-launchd-plist.mjs'], { encoding: 'utf8', env: { ...process.env, AI_COMPANY_PROJECT_ROOT: '/tmp/macro-os' } });
    expect(output).toContain('com.macrolens.ai-company-heartbeat');
    expect(output).toContain('supabase-heartbeat.mjs');
    expect(output).toContain('<key>Hour</key><integer>0</integer>');
    expect(output).toContain('<key>Minute</key><integer>0</integer>');
    expect(output).not.toContain('StartInterval');
    expect(output).toContain('<key>PRODUCTION_AUTONOMY</key><string>DISABLED</string>');
    expect(output).not.toContain('observations');
  });
});
