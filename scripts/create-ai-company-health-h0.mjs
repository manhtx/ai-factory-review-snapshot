#!/usr/bin/env node
import { readFile, stat, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const runtime = path.join(root, '.ai-company', 'runtime');
const reports = path.join(root, '.ai-company', 'reports');
const now = new Date().toISOString();
const readJsonl = async (file) => {
  try { return (await readFile(file, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line)); }
  catch (error) { if (error?.code === 'ENOENT') return []; throw error; }
};
const files = [];
const walk = async (dir) => {
  for (const name of await (await import('node:fs/promises')).readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) await walk(full); else { const s = await stat(full); files.push({ path: path.relative(root, full), bytes: s.size }); }
  }
};
await walk(runtime);
const read = async (name) => readJsonl(path.join(runtime, name));
const [queue, executions, providerAttempts, providerTelemetry, evidence, usage, handoffs, security] = await Promise.all([
  read('projects/macro-os/role-work-queue.jsonl'), read('projects/macro-os/role-work-executions.jsonl'), read('projects/macro-os/provider-attempts.jsonl'), read('projects/macro-os/provider-telemetry.jsonl'), read('projects/macro-os/role-dispatch-evidence.jsonl'), read('projects/macro-os/ai-usage-events.jsonl'), read('projects/macro-os/role-handoffs.jsonl'), read('projects/macro-os/security-violation-events.jsonl'),
]);
const countBy = (rows, key) => rows.reduce((out, row) => { const value = row[key] ?? 'UNKNOWN'; out[value] = (out[value] ?? 0) + 1; return out; }, {});
const git = (args) => { try { return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim(); } catch { return 'UNKNOWN'; } };
const actualTokenEvents = providerTelemetry.filter((row) => Number.isFinite(Number(row.total_tokens_actual ?? row.total_tokens)) && row.input_tokens_estimated == null).length;
const estimatedTokenEvents = providerTelemetry.filter((row) => row.input_tokens_estimated != null || row.total_tokens_actual == null && row.total_tokens != null).length;
const report = {
  audit_id: `AI_COMPANY_HEALTH_H0_${Date.now()}`,
  generated_at: now,
  evidence_class: 'CURRENT_RUNTIME_BASELINE',
  git_revision: git(['rev-parse', 'HEAD']),
  branch: git(['branch', '--show-current']),
  dirty_state: git(['status', '--porcelain']).split('\n').filter(Boolean).length > 0 ? 'DIRTY' : 'CLEAN',
  runtime_revision: process.env.GIT_COMMIT_SHA ?? 'local-unattested',
  production_autonomy: process.env.PRODUCTION_AUTONOMY ?? 'DISABLED',
  production_release: 'HUMAN_GATED',
  runtime: { file_count: files.length, bytes: files.reduce((n, f) => n + f.bytes, 0), supervisor: 'measured-separately' },
  ledgers: { queue_rows: queue.length, execution_rows: executions.length, provider_attempt_rows: providerAttempts.length, provider_telemetry_rows: providerTelemetry.length, evidence_rows: evidence.length, usage_rows: usage.length, handoff_rows: handoffs.length, security_rows: security.length },
  queue_states: countBy(queue, 'state'),
  execution_statuses: countBy(executions, 'status'),
  provider_attempt_statuses: countBy(providerAttempts, 'status'),
  provider_failure_classes: countBy(providerAttempts.filter((r) => r.status !== 'succeeded'), 'failure_class'),
  telemetry: { actual_token_events: actualTokenEvents, estimated_token_events: estimatedTokenEvents, unknown_token_events: providerTelemetry.length - actualTokenEvents - estimatedTokenEvents, roles: countBy(providerTelemetry, 'agent_role'), workflows: countBy(providerTelemetry, 'workflow_id') },
  limitations: ['Counts are ledger row counts, not unique work items unless explicitly labelled.', 'Historical rows are included; this baseline does not infer causality or product value.', 'No production readiness claim is made.'],
};
const output = path.join(reports, 'AI_COMPANY_HEALTH_H0.json');
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ output, audit_id: report.audit_id, runtime: report.runtime, ledgers: report.ledgers, queue_states: report.queue_states, telemetry: report.telemetry }, null, 2));
