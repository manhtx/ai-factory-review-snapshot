#!/usr/bin/env node
/** Preserve historical blocked queue evidence without letting it masquerade as
 * current recoverable work. Default is a read-only report; pass --apply to
 * append QUARANTINED transitions through the queue's normal guard. */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { RoleWorkQueue } from '../server/aiCompany/roleWorkQueue.ts';
import { JsonlEvidenceResolver } from '../server/aiCompany/evidenceResolver.ts';

const root = process.cwd();
const projectId = process.env.AI_COMPANY_PROJECT_ID || 'macro-os';
const runtime = path.join(root, '.ai-company', 'runtime', 'projects', projectId);
const apply = process.argv.includes('--apply');
const cutoff = process.env.AI_COMPANY_BLOCKED_CUTOFF || new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
const queue = new RoleWorkQueue(runtime, new JsonlEvidenceResolver(path.join(runtime, 'role-dispatch-evidence.jsonl')));
const records = await queue.records(projectId);
const candidates = records.filter((item) => item.state === 'BLOCKED'
  && !String(item.blocked_reason || '').startsWith('UPSTREAM_PM_GATE:')
  && String(item.updated_at || '') < cutoff);
const results = [];
if (apply) {
  for (const item of candidates) {
    const updated = await queue.quarantine(item.work_id, `HISTORICAL_BLOCKED_BACKLOG: preserved for forensic triage; blocked before cutoff ${cutoff}`);
    results.push({ work_id: updated.work_id, state: updated.state });
  }
}
console.log(JSON.stringify({ mode: apply ? 'APPLY' : 'DRY_RUN', project_id: projectId, cutoff, candidate_count: candidates.length, candidates: candidates.map((item) => ({ work_id: item.work_id, role: item.role, run_id: item.run_id, blocked_reason: item.blocked_reason, updated_at: item.updated_at })), quarantined: results }, null, 2));
