import { describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);

describe('launchd plist renderer', () => {
  it('renders an explicit local-only supervised process with stable paths', async () => {
    const { stdout } = await exec(process.execPath, ['scripts/render-ai-company-launchd-plist.mjs'], { env: { ...process.env, AI_COMPANY_PROJECT_ROOT: '/tmp/macro-os', AI_COMPANY_STATE_DIR: '/tmp/macro-state' } });
    expect(stdout).toContain('<string>com.macrolens.ai-company-supervisor</string>'); expect(stdout).toContain('<true/>'); expect(stdout).toContain('<string>DISABLED</string>'); expect(stdout).toContain('<string>/tmp/macro-os</string>');
  });
});
