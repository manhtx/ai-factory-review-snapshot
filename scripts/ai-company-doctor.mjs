#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const checks = [];
const check = (name, ok, detail) => checks.push({ name, status: ok ? 'PASS' : 'BLOCKED', detail });
for (const file of ['AGENTS.md', 'docs/PRODUCT_GOAL.md', '.ai-company/PRODUCT_GOAL_MASTER.md', '.ai-company/MASTER_BUILD_PLAN.md', '.ai-company/company-state.json']) {
  try { await access(path.join(root, file)); check(file, true, 'present'); } catch { check(file, false, 'missing required truth source'); }
}
try { execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, stdio: 'pipe' }); check('git', true, 'repository detected'); } catch { check('git', false, 'git repository unavailable'); }
const rawRunner = process.env.RUNNER || (process.env.ANTIGRAVITY_AGENT ? 'agy' : 'codex');
const runner = rawRunner === 'antigravity' ? 'agy' : rawRunner;
if (runner !== 'codex' && runner !== 'agy') check(`runner:${runner}`, false, 'runner disabled; this installation permits RUNNER=codex or RUNNER=agy only');
else { try { execFileSync('which', [runner], { cwd: root, stdio: 'pipe' }); check(`runner:${runner}`, true, 'CLI detected'); } catch { check(`runner:${runner}`, false, `${runner} CLI not found; install it before running the company loop`); } }
try {
  const state = JSON.parse(await readFile(path.join(root, '.ai-company/company-state.json'), 'utf8'));
  check('company-state', Number.isInteger(state.current_epoch) && state.stop_requested === false, `epoch=${state.current_epoch}, stop_requested=${state.stop_requested}`);
} catch { check('company-state', false, 'invalid JSON or unreadable state'); }
const queuePath = path.join(root, '.ai-company/runtime/projects/macro-os/role-work-queue.jsonl');
try {
  const rows = (await readFile(queuePath, 'utf8')).split('\n').filter(Boolean).map(JSON.parse); const latest = new Map(rows.map((row) => [row.work_id, row]));
  const active = [...latest.values()].filter((row) => ['READY', 'CLAIMED', 'IN_REVIEW'].includes(row.state));
  check('role-queue', true, `tracked=${latest.size}, active=${active.length}`);
} catch (error) { check('role-queue', error?.code === 'ENOENT', error?.code === 'ENOENT' ? 'not created yet' : 'invalid queue'); }
const blocked = checks.filter((item) => item.status === 'BLOCKED');
console.log(JSON.stringify({ doctor: 'ai-company', generated_at: new Date().toISOString(), status: blocked.length ? 'BLOCKED' : 'HEALTHY', checks }, null, 2));
process.exitCode = blocked.length ? 1 : 0;
