import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('autonomous next-action audit adapter', () => {
  it('does not reinterpret historical DONE evidence as pending review work', async () => {
    const source = await readFile(new URL('./audit-autonomous-next-action.mjs', import.meta.url), 'utf8');
    expect(source).toContain('completed: []');
    expect(source).toContain('Historical DONE rows are evidence, not pending post-cycle work');
    expect(source).toContain('pending_completed_cycle: false');
    expect(source).toContain("action.kind === 'WAITING_FOR_MEANINGFUL_WORK'");
  });
});
