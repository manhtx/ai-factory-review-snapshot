#!/usr/bin/env node
/** Close a completed bounded audit backlog item without claiming a product win. */
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) if (process.argv[i].startsWith('--')) args.set(process.argv[i].slice(2), process.argv[i + 1] ?? '');
const runId = args.get('run-id');
if (!runId) { console.error('usage: node scripts/close-measured-product-cycle.mjs --run-id <run-id>'); process.exit(2); }
const projectId = args.get('project-id') || 'macro-os';
const evalPath = path.join(root, '.ai-company', 'reports', 'product-cycles', `CYCLE_${runId}_EVALUATION.json`);
const backlogPath = path.join(root, '.ai-company', 'product-intelligence', 'CANONICAL_PRODUCT_BACKLOG.json');
const evaluation = JSON.parse(await readFile(evalPath, 'utf8'));
if (evaluation.terminal_state !== 'DONE') throw new Error(`cycle is not DONE: ${evaluation.terminal_state}`);
const isWin = ['ENGINEERING_VERIFIED_PRODUCT_VALUE_WON', 'DELIVERY_PROGRESS', 'WIN'].some(s => String(evaluation.product_outcome).toUpperCase().includes(s));
const allowedOutcomes = ['ZERO_MUTATION_UNVERIFIED', 'ENGINEERING_VERIFIED_PRODUCT_VALUE_UNPROVEN', 'ENGINEERING_VERIFIED_PRODUCT_VALUE_WON', 'DELIVERY_PROGRESS'];
if (!allowedOutcomes.some(s => String(evaluation.product_outcome).toUpperCase().includes(s))) throw new Error(`refusing to close product outcome: ${evaluation.product_outcome}`);
const backlogId = evaluation.opportunity_id;
if (!backlogId) throw new Error('cycle has no backlog opportunity');
const canonical = JSON.parse(await readFile(backlogPath, 'utf8'));
const item = canonical.items?.find((candidate) => candidate.backlog_id === backlogId);
if (!item) throw new Error(`backlog item not found: ${backlogId}`);
if (!['READY', 'IN_REVIEW', 'ACCEPTED', 'MEASURED', 'DELIVERED', 'SPRINT_SELECTED'].includes(item.status)) throw new Error(`refusing to close from status ${item.status}`);
const now = new Date().toISOString();
const targetStatus = isWin ? 'DELIVERED' : 'MEASURED';
const next = {
  ...item,
  status: targetStatus,
  evaluation_ids: [...new Set([...(item.evaluation_ids ?? []), evalPath.replace(`${root}/`, ''), runId])],
  implementation_task_ids: [...new Set([...(item.implementation_task_ids ?? []), ...evaluation.roles_invoked.map((role) => `${runId}:${role}`)])],
  pm_decision_reason: isWin ? `${item.pm_decision_reason ?? 'PM approved'}; bounded cycle verified and delivered product value (${evaluation.product_outcome})` : `${item.pm_decision_reason ?? 'PM approved'}; bounded cycle measured ${evaluation.product_outcome}; no product win claimed`,
  updated_at: now,
};
const output = { ...canonical, updated_at: now, items: canonical.items.map((candidate) => candidate.backlog_id === backlogId ? next : candidate) };
const tmp = `${backlogPath}.tmp-${process.pid}`;
await writeFile(tmp, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
await rename(tmp, backlogPath);
console.log(JSON.stringify({ status: targetStatus, project_id: projectId, backlog_id: backlogId, run_id: runId, product_outcome: evaluation.product_outcome, note: isWin ? 'closed as delivered product outcome' : 'closed as measured audit; not a product win' }, null, 2));
