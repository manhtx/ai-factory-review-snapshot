#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const runtime = path.join(root, '.ai-company', 'runtime', 'projects', 'macro-os');
const reportPath = path.join(root, '.ai-company', 'reports', 'AI_COMPANY_CURRENT_STATE_AUTHORITATIVE.json');
const readJsonl = async (name) => {
  try { return (await readFile(path.join(runtime, name), 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line)); }
  catch (error) { if (error?.code === 'ENOENT') return []; throw error; }
};
const queue = await readJsonl('role-work-queue.jsonl');
const executions = await readJsonl('role-work-executions.jsonl');
const latest = new Map();
const timestamp = (row) => Date.parse(String(row.updated_at ?? row.created_at ?? row.completed_at ?? row.claimed_at ?? '')) || 0;
for (const row of queue) {
  const id = row.work_id;
  if (!id) continue;
  const previous = latest.get(id);
  if (!previous || timestamp(row) >= timestamp(previous)) latest.set(id, row);
}
const current = [...latest.values()];
const byState = current.reduce((out, row) => { out[row.state ?? 'UNKNOWN'] = (out[row.state ?? 'UNKNOWN'] ?? 0) + 1; return out; }, {});
const active = current.filter((row) => ['READY', 'CLAIMED', 'IN_REVIEW'].includes(row.state));
const ages = active.map((row) => ({ work_id: row.work_id, state: row.state, age_ms: Math.max(0, Date.now() - timestamp(row)) })).filter((row) => row.age_ms > 0).sort((a, b) => b.age_ms - a.age_ms);
const executionByWork = new Map(executions.map((row) => [row.work_id, row]));
const report = {
  generated_at: new Date().toISOString(),
  evidence: 'latest-state-projection',
  source: path.relative(root, path.join(runtime, 'role-work-queue.jsonl')),
  raw_row_count: queue.length,
  unique_work_count: current.length,
  current_state_counts: byState,
  active_work_count: active.length,
  oldest_active: ages[0] ?? null,
  active_age_ms: { p50: percentile(ages.map((x) => x.age_ms), .5), p95: percentile(ages.map((x) => x.age_ms), .95), max: ages[0]?.age_ms ?? 0 },
  execution_linkage: { current_work_with_execution: current.filter((row) => executionByWork.has(row.work_id)).length, current_work_without_execution: current.filter((row) => !executionByWork.has(row.work_id)).length },
  limitations: ['Latest row is selected by timestamp; equal-timestamp ties preserve the last encountered row.', 'This projection does not mutate or compact append-only evidence.', 'A current state is not proof of product value or successful autonomous operation.'],
};
function percentile(values, p) { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))]; }
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ report: reportPath, raw_row_count: report.raw_row_count, unique_work_count: report.unique_work_count, current_state_counts: report.current_state_counts, active_work_count: report.active_work_count, active_age_ms: report.active_age_ms, execution_linkage: report.execution_linkage }, null, 2));
