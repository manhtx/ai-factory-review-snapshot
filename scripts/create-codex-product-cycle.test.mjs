import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('Codex product cycle routing policy', () => {
  it('keeps lean routing explicitly limited to product P2 cycles', async () => {
    const source = await readFile(new URL('./create-codex-product-cycle.mjs', import.meta.url), 'utf8');
    expect(source).toContain("process.env.AI_COMPANY_PRODUCT_CYCLE_LEAN === 'true'");
    expect(source).toContain("['pm', 'backend-engineer', 'functional-qa']");
    expect(source).toContain("workflow_id: productMode ? (leanMode ? 'codex-product-cycle-product-p2'");
    expect(source).toContain("risk_level: 'P2'");
    expect(source).toContain('cycle_id: runId');
    expect(source).toContain('epoch_id: epochId');
  });

  it('enforces objective-level deduplication guard (SI-006)', async () => {
    const source = await readFile(new URL('./create-codex-product-cycle.mjs', import.meta.url), 'utf8');
    expect(source).toContain('eligibilityForObjective');
    expect(source).toContain("item.assignment?.objective_id === objectiveId || item.backlog_id === objectiveId");
    expect(source).toContain('CYCLE_CREATION_REJECTED:');
  });

  it('treats an unresolved BLOCKED row as an active fail-closed blocker', async () => {
    const source = await readFile(new URL('./create-codex-product-cycle.mjs', import.meta.url), 'utf8');
    expect(source).toContain("item.state === 'BLOCKED' ? 'ACTIVE_BLOCKED'");
    expect(source).not.toContain("item.state === 'BLOCKED' ? 'STALE_BLOCKED'");
  });
});
