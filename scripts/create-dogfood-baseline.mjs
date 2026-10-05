#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(process.env.AI_COMPANY_PROJECT_ROOT ?? process.cwd());
const reportDir = join(root, '.ai-company', 'reports', 'dogfood');
const healthUrl = process.env.MACRO_HEALTH_URL ?? 'http://127.0.0.1:8787/api/health';
const command = (name, args) => { try { return execFileSync(name, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); } catch { return null; } };
const json = (value) => { try { return JSON.parse(value); } catch { return null; } };
const health = json(command('curl', ['-fsS', '--max-time', '5', healthUrl]));
const status = command('git', ['status', '--short']);
const revision = command('git', ['rev-parse', 'HEAD']);
const queuePath = join(root, '.ai-company', 'runtime', 'projects', 'macro-os', 'role-work-queue.jsonl');
let queueBytes = 0;
try { queueBytes = (await stat(queuePath)).size; } catch { /* queue may not exist in a fresh checkout */ }
let runtimeFiles = 0;
try { runtimeFiles = (await readdir(join(root, '.ai-company', 'runtime'), { recursive: true })).length; } catch { /* runtime is optional before first boot */ }
const baseline = {
  baseline_id: 'DOGFOOD_B0', generated_at: new Date().toISOString(), git_revision: revision,
  working_tree_dirty: Boolean(status), working_tree_status: status,
  product: { id: 'macro-os', name: 'Macro Research Platform', environment: 'LOCAL_PRE_USER' },
  provider_policy: process.env.AI_COMPANY_LOCAL_PROVIDER_POLICY ?? 'DISABLED_BY_EXECUTION_POLICY',
  runner: process.env.RUNNER ?? 'codex', production_autonomy: process.env.PRODUCTION_AUTONOMY ?? 'DISABLED', production_release: 'HUMAN_GATED',
  runtime_health: health ?? { status: 'UNAVAILABLE', source: healthUrl },
  queue: { path: queuePath, bytes: queueBytes }, runtime_artifacts: { runtime_file_count: runtimeFiles },
  founder_interventions: { count: 0, provenance: 'BASELINE_NO_ROUTINE_INTERVENTION_RECORDED' }, evidence_boundary: 'LOCAL_RUNTIME_UNATTESTED'
};
await mkdir(reportDir, { recursive: true });
const out = join(reportDir, 'DOGFOOD_B0.json');
await writeFile(out, `${JSON.stringify(baseline, null, 2)}\n`);
console.log(JSON.stringify({ status: 'PASS', baseline_id: baseline.baseline_id, report: out, health: baseline.runtime_health.status, runtime_files: runtimeFiles }, null, 2));
