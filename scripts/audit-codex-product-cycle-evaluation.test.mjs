import { execFileSync } from 'node:child_process';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('product-cycle evaluator', () => {
  it('does not claim a strong product win from a UI diff without current browser evidence', async () => {
    const root = process.cwd();
    const runtime = path.join(root, '.ai-company', 'runtime', 'projects', 'macro-os');
    const queue = path.join(runtime, 'role-work-queue.jsonl');
    const original = await readFile(queue, 'utf8');
    const runId = `evaluator-test-${Date.now()}`;
    const rows = [
      { work_id: `${runId}-pm`, run_id: runId, state: 'DONE', role: 'pm', assignment: { task_type: 'product' }, structured_output: { files_changed: [] }, review_verdict: { verdict: 'PASS' } },
      { work_id: `${runId}-backend`, run_id: runId, state: 'DONE', role: 'backend-engineer', assignment: { task_type: 'code-change' }, structured_output: { files_changed: ['src/app/pages/WatchlistPage.tsx'] }, review_verdict: { verdict: 'PASS' } },
    ];
    await writeFile(queue, `${original.endsWith('\n') ? original : original + '\n'}${rows.map((row) => JSON.stringify(row)).join('\n')}\n`);
    try {
      const output = execFileSync('node', ['scripts/audit-codex-product-cycle-evaluation.mjs', '--run-id', runId], { cwd: root, encoding: 'utf8' });
      const reportPath = JSON.parse(output).report_path;
      const report = JSON.parse(await readFile(reportPath, 'utf8'));
      expect(report.product_outcome).toBe('ENGINEERING_VERIFIED_PRODUCT_VALUE_UNPROVEN');
      expect(report.cycle_value).toBe('ENGINEERING_VERIFIED_PRODUCT_VALUE_UNPROVEN');
    } finally {
      await writeFile(queue, original);
    }
  });
});
