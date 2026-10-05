#!/usr/bin/env node
/** Deterministic adversarial benchmark for review-quality contracts. */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { validateReviewEvidenceRecord } from '../server/aiCompany/reviewEvidenceContract.ts';

const root = process.cwd();
const now = new Date().toISOString();
const base = (overrides = {}) => ({ review_id: `BENCH-${Math.random().toString(36).slice(2, 8)}`, work_id: 'BENCH-WORK', role: 'functional-qa', cycle_round: 1, verdict: 'PASS', commands_run: [{ command: 'npm test', exit_code: 0 }], test_results: [{ test_framework: 'vitest', test_file: 'server/freshness.test.ts', test_name: 'regression', status: 'PASS' }], changed_files_verified: ['server/freshness.ts'], evidence_ids: ['EVID-BENCH-1'], created_at: now, ...overrides });
const context = { task_type: 'code-change', test_policy: 'targeted', allowed_paths: ['server/freshness.ts'], mutation_policy: 'isolated_workspace', workspace_root: root, expected_namespace: 'bench-ns', expected_run_id: 'bench-run' };
const cases = [
  ['valid pass', base(), false],
  ['pass without tests', base({ test_results: [] }), true],
  ['pass with failing command', base({ commands_run: [{ command: 'npm test', exit_code: 1 }] }), true],
  ['pass with invalid evidence id', base({ evidence_ids: ['not valid'] }), true],
  ['pass outside allowed scope', base({ changed_files_verified: ['../.env'] }), true],
  ['read-only mutation', base({ changed_files_verified: ['server/freshness.ts'] }), true, { ...context, mutation_policy: 'read_only' }],
];
const results = cases.map(([name, record, shouldReject, caseContext]) => {
  const errors = validateReviewEvidenceRecord(record, caseContext ?? context);
  const rejected = errors.length > 0;
  return { name, expected: shouldReject ? 'REJECT' : 'PASS', actual: rejected ? 'REJECT' : 'PASS', passed: rejected === shouldReject, errors };
});
const output = { benchmark: 'semantic-review-contract-adversarial-v1', generated_at: new Date().toISOString(), deterministic: true, cases: results, passed: results.every((r) => r.passed), false_passes: results.filter((r) => r.expected === 'REJECT' && r.actual === 'PASS').length, false_rejects: results.filter((r) => r.expected === 'PASS' && r.actual === 'REJECT').length, limitation: 'This benchmarks deterministic review contract semantics, not subjective LLM review quality.' };
if (!output.passed) throw new Error(`Semantic benchmark failed: ${JSON.stringify(output)}`);
const report = path.join(root, '.ai-company', 'reports', 'semantic-review-benchmark-latest.json');
await mkdir(path.dirname(report), { recursive: true });
await writeFile(report, JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ passed: output.passed, cases: results.length, false_passes: output.false_passes, report: path.relative(root, report) }, null, 2));
