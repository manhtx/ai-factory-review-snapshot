import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

describe('bounded AI Company lifecycle audit', () => {
  it('terminates with an explicit truncated result under a small entry budget', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'ai-company-lifecycle-'));
    const output = path.join(root, 'report.json');
    await writeFile(path.join(root, 'a.jsonl'), '{}\n');
    await writeFile(path.join(root, 'b.cache'), '{}\n');
    const result = await exec('node', ['scripts/audit-ai-company-lifecycle.mjs'], { env: { ...process.env, AI_COMPANY_LIFECYCLE_ROOT: root, AI_COMPANY_LIFECYCLE_REPORT: output, AI_COMPANY_LIFECYCLE_MAX_ENTRIES: '1' } });
    const report = JSON.parse(await readFile(output, 'utf8'));
    expect(result.stdout).toContain('"visited_entries": 1');
    expect(report.truncated).toBe(true);
    expect(report.policy.deletes_performed).toBe(false);
  });
});
