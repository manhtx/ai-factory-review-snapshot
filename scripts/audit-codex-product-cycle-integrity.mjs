#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) if (process.argv[i].startsWith('--')) args.set(process.argv[i].slice(2), process.argv[i + 1] ?? '');
const runId = args.get('run-id');
const projectId = args.get('project-id') || 'macro-os';
if (!runId) { console.error('usage: node scripts/audit-codex-product-cycle-integrity.mjs --run-id <run> [--project-id <project>]'); process.exit(2); }

const runtime = args.get('runtime-dir') || path.join(root, '.ai-company', 'runtime', 'projects', projectId);
const readJsonl = (file) => {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
};
const latest = new Map();
for (const row of readJsonl(path.join(runtime, 'role-work-queue.jsonl'))) {
  if (row.run_id === runId || row.assignment?.run_id === runId) latest.set(row.work_id, row);
}
const evidence = new Map(readJsonl(path.join(runtime, 'role-dispatch-evidence.jsonl')).filter((row) => row.run_id === runId).map((row) => [row.evidence_id, row]));
const failures = [];
const reviewRoles = new Set(['functional-qa', 'quality-control', 'critic', 'security', 'release-security-gate']);
const engineeringRoles = new Set(['coder', 'backend-engineer', 'frontend-engineer', 'data-engineer']);
for (const item of latest.values()) {
  // A PM HOLD/REVISE is an intentional terminal outcome for downstream work,
  // not a stranded queue item. Accept only this narrowly typed blocked state;
  // provider failures and unexplained BLOCKED/READY states remain failures.
  if (item.state === 'BLOCKED' && String(item.blocked_reason || '').startsWith('UPSTREAM_PM_GATE:')) continue;
  if (item.state !== 'DONE') { failures.push(`${item.work_id}: terminal state is ${item.state}`); continue; }
  const declared = new Set(item.evidence_ids ?? []);
  for (const id of item.structured_output?.evidence_ids ?? []) declared.add(id);
  for (const id of item.review_verdict?.evidence ?? []) declared.add(id);
  for (const id of declared) if (!evidence.has(id)) failures.push(`${item.work_id}: evidence does not resolve in this run: ${id}`);
  if (item.structured_output && item.structured_output.role !== item.role && !(item.role === 'coder' && item.structured_output.role === 'backend-engineer')) failures.push(`${item.work_id}: structured role mismatch (${item.structured_output.role} vs ${item.role})`);
  if (engineeringRoles.has(item.role)) {
    const summary = `${item.structured_output?.implementation_summary ?? ''} ${item.structured_output?.summary ?? ''}`;
    const embeddedRoles = [...summary.matchAll(/"role"\s*:\s*"([^"]+)"/g)].map((match) => match[1]);
    if (embeddedRoles.some((role) => role !== item.role && !(item.role === 'coder' && ['backend-engineer', 'frontend-engineer', 'data-engineer'].includes(role)))) failures.push(`${item.work_id}: embedded role payload mismatch`);
  }
  if (reviewRoles.has(item.role) && !item.review_verdict && !item.review_evidence_record) failures.push(`${item.work_id}: review contract missing`);
}
const result = { status: failures.length ? 'FAIL' : 'PASS', run_id: runId, project_id: projectId, work_count: latest.size, evidence_count: evidence.size, failures };
console.log(JSON.stringify(result, null, 2));
process.exit(failures.length ? 1 : 0);
