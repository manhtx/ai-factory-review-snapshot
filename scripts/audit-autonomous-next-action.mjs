import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RoleWorkQueue } from '../server/aiCompany/roleWorkQueue.ts';
import { selectAutonomousNextAction } from '../server/aiCompany/autonomousNextAction.ts';

const root = process.cwd();
const runtimeRoot = path.join(root, '.ai-company', 'runtime', 'projects', process.env.AI_COMPANY_PROJECT_ID || 'macro-os');
const queue = new RoleWorkQueue(runtimeRoot);
const rows = (await queue.records()).filter((row) => row.project_id === (process.env.AI_COMPANY_PROJECT_ID || 'macro-os'));
  // Historical DONE rows are evidence, not pending post-cycle work. Only a
 // coordinator-owned current-cycle completion set may populate this field.
 const action = selectAutonomousNextAction({ rows, completed: [] });
const counts = Object.fromEntries(['READY', 'CLAIMED', 'IN_REVIEW', 'DONE', 'BLOCKED', 'QUARANTINED'].map((state) => [state, rows.filter((row) => row.state === state).length]));
const boundedAction = { ...action, work_ids: action.work_ids?.slice(0, 20), omitted_work_count: Math.max(0, (action.work_ids?.length ?? 0) - 20) };
 const report = { generated_at: new Date().toISOString(), project_id: process.env.AI_COMPANY_PROJECT_ID || 'macro-os', source: path.join(runtimeRoot, 'role-work-queue.jsonl'), row_count: rows.length, counts, pending_completed_cycle: false, action: boundedAction, historical_backlog_warning: counts.BLOCKED > 20 ? 'BLOCKED_BACKLOG_REQUIRES_TRIAGE' : null, activity_theater_guard: action.kind === 'WAITING_FOR_MEANINGFUL_WORK' ? 'PASS' : 'NOT_APPLICABLE' };
const output = path.join(root, '.ai-company', 'reports', 'autonomous-next-action-authoritative-latest.json');
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
