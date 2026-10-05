import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('codex product epoch auditor contract', () => {
  it('does not hardcode structured_output false for functional QA', async () => {
    const source = await readFile(new URL('./audit-codex-product-epoch.mjs', import.meta.url), 'utf8');
    expect(source).not.toContain("structured_output: role === 'functional-qa' ? false : structured");
    expect(source).toContain('structured_output: structured');
    expect(source).toContain('epochCandidates');
    expect(source).toContain('assignment?.epoch_id');
  });
});
