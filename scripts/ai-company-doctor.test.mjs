import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('company doctor contract', () => {
  it('checks truth sources, runner, state and queue', async () => {
    const source = await readFile(new URL('./ai-company-doctor.mjs', import.meta.url), 'utf8');
    for (const term of ['PRODUCT_GOAL_MASTER.md', 'MASTER_BUILD_PLAN.md', 'RUNNER', 'company-state.json', 'role-work-queue.jsonl']) expect(source).toContain(term);
  });
});
