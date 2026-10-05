import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const exec = promisify(execFile);

describe('compare funnel authoritative verifier', () => {
  it('is fail-closed and excludes legacy events instead of backfilling them', async () => {
    const source = await readFile(new URL('./audit-compare-funnel-contract.mjs', import.meta.url), 'utf8');
    expect(source).toContain("status: denominator > 0 ? 'LOCAL_DESCRIPTIVE_ONLY' : 'INSUFFICIENT_EVIDENCE'");
    expect(source).toContain("source_provenance: 'LOCAL_RUNTIME_UNATTESTED'");
    expect(source).toContain('missing_comparison_id');
    expect(source).toContain('Events without comparison_id are excluded rather than backfilled.');
    expect(source).toContain('No target or minimum sample gate is inferred from this report.');
    expect(source).toContain("compare_follow_up_started");
    expect(source).toContain('follow_up_after_explanation');
    expect(source).toContain('eligibility_diagnostics');
    expect(source).toContain('compare_not_success');
    const page = await readFile(new URL('../src/app/pages/RelationshipsPage.tsx', import.meta.url), 'utf8');
    expect(page).toContain('eventType: "compare_follow_up_started"');
    expect(page).toContain('comparison_id: comparisonId');
    expect(page).toContain('follow_up_state: "provenance_open_requested"');
  });

  it('computes eligible compare, explanation and follow-up keys from an explicit fixture', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'compare-funnel-'));
    const input = path.join(dir, 'telemetry.jsonl');
    const output = path.join(dir, 'report.json');
    const rows = [
      { eventType: 'indicator_compare', sessionId: 's1', timestamp: '2026-09-14T00:00:00Z', metadata: { comparison_id: 'c1', user_initiated: true, compare_state: 'success' } },
      { eventType: 'compare_explanation_opened', sessionId: 's1', timestamp: '2026-09-14T00:01:00Z', metadata: { comparison_id: 'c1', user_initiated: true, explanation_state: 'opened' } },
      { eventType: 'compare_follow_up_started', sessionId: 's1', timestamp: '2026-09-14T00:02:00Z', metadata: { comparison_id: 'c1', user_initiated: true, follow_up_state: 'provenance_open_requested' } },
      { eventType: 'indicator_compare', sessionId: 's2', timestamp: '2026-09-14T00:00:00Z', metadata: {} },
    ];
    await writeFile(input, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`);
    await exec(process.execPath, ['scripts/audit-compare-funnel-contract.mjs'], { env: { ...process.env, AI_COMPANY_TELEMETRY_INPUT: input, AI_COMPANY_FUNNEL_OUTPUT: output } });
    const report = JSON.parse(await readFile(output, 'utf8'));
    expect(report).toMatchObject({ status: 'LOCAL_DESCRIPTIVE_ONLY', numerator: 1, denominator: 1, eligible_follow_up_keys: 1, follow_up_after_explanation: 1, missing_comparison_id: 1 });
    expect(report.eligibility_diagnostics.compare_missing_id).toBe(1);
  });
});
