#!/usr/bin/env node
/** Produce a reproducible V1/V2 token comparison from persisted provider telemetry. */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const telemetryPath = process.argv[2] || path.join(root, '.ai-company/runtime/projects/macro-os/provider-telemetry.jsonl');
const outputPath = process.argv[3] || path.join(root, '.ai-company/reports/AI_COMPANY_TOKEN_BENCHMARK.json');
const rows = (await readFile(telemetryPath, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line));
const numeric = (value) => Number.isFinite(value) && value > 0 ? value : null;
const median = (values) => { const sorted = values.filter((value) => value != null).sort((a, b) => a - b); if (!sorted.length) return null; const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2); };
const summarize = (subset) => Object.fromEntries(['pm', 'functional-qa', 'quality-control', 'ceo-guild'].map((role) => {
  const values = subset.filter((row) => row.agent_role === role).map((row) => numeric(row.output_tokens));
  return [role, { samples: values.length, median_tokens: median(values), runs: [...new Set(subset.filter((row) => row.agent_role === role).map((row) => row.run_id))] }];
}));
const v2 = rows.filter((row) => row.workflow_id === 'codex-benchmark-v2' || row.run_id?.startsWith('codex-v2-'));
const v1 = rows.filter((row) => row.workflow_id === 'codex-benchmark-v1' || row.run_id?.startsWith('codex-v1-'));
const v1Summary = summarize(v1); const v2Summary = summarize(v2);
const roles = Object.fromEntries(Object.keys(v2Summary).map((role) => { const oldValue = v1Summary[role].median_tokens; const newValue = v2Summary[role].median_tokens; return [role, { v1_tokens: oldValue, v2_tokens: newValue, reduction_percent: oldValue && newValue ? Math.round((1 - newValue / oldValue) * 1000) / 10 : null, verdict: oldValue && newValue ? 'COMPARABLE' : 'NOT_COMPARABLE' }]; }));
const result = { generated_at: new Date().toISOString(), telemetry_path: telemetryPath, v1: v1Summary, v2: v2Summary, roles, comparable: Boolean(v1.length && v2.length), conclusion: v1.length && v2.length ? 'Measured from persisted telemetry.' : 'NOT_COMPARABLE: persisted telemetry does not contain both normalized V1 and V2 role samples.' };
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(result, null, 2));
