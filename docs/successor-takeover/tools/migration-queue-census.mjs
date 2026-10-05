import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

// Supply a frozen snapshot, never modify or silently repair its records.
const root = resolve(process.argv[2]);
const files = ['role-work-queue.jsonl', 'role-dispatch-evidence.jsonl'];
const hashes = {};
const parsed = {};
for (const file of files) {
  const bytes = readFileSync(resolve(root, file));
  hashes[file] = createHash('sha256').update(bytes).digest('hex');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  parsed[file] = text.split('\n').filter(line => line.trim()).map((line, index) => {
    try { return JSON.parse(line); } catch { throw new Error(`MALFORMED_SNAPSHOT:${file}:${index + 1}`); }
  });
}
const history = parsed['role-work-queue.jsonl'];
if (history.some(row => !row || typeof row.work_id !== 'string' || !row.work_id.trim())) throw new Error('MISSING_WORK_IDENTITY');
const rows = [...new Map(history.map(row => [row.work_id, row])).values()];
const evidence = new Map(parsed['role-dispatch-evidence.jsonl'].map(row => [row.evidence_id, row]));
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const count = predicate => rows.filter(predicate).length;
const known = new Set(['READY', 'CLAIMED', 'IN_REVIEW', 'DONE', 'BLOCKED', 'QUARANTINED']);
const done = rows.filter(row => row.state === 'DONE');
const refs = done.flatMap(row => Array.isArray(row.evidence_ids) ? row.evidence_ids : []);
console.log(JSON.stringify({ schema: 'successor-takeover.migration-queue-census.v1', snapshotRoot: root, sourceHashes: hashes,
  historyRows: history.length, latestWorkRows: rows.length,
  unknownHistoricalStates: history.filter(row => !known.has(row.state)).length,
  counts: Object.fromEntries([...known].map(state => [state, count(row => row.state === state)])),
  missingObjective: count(row => !nonempty(row.assignment?.objective_id)),
  missingRun: count(row => !nonempty(row.assignment?.run_id)),
  missingNamespace: count(row => !nonempty(row.assignment?.namespace)),
  objectiveBacklogDisagreement: count(row => nonempty(row.assignment?.objective_id) && row.assignment.objective_id !== row.backlog_id),
  missingDependencyReferences: rows.reduce((n, row) => n + (Array.isArray(row.depends_on) ? row.depends_on.filter(id => !rows.some(other => other.work_id === id)).length : 0), 0),
  completed: { rows: done.length, missingEvidenceIds: done.filter(row => !Array.isArray(row.evidence_ids) || !row.evidence_ids.length).length,
    evidenceReferences: refs.length, unresolvedInProjectDispatchLedger: refs.filter(id => !evidence.has(id)).length },
  claimLimit: 'Structural counts only; DONE and resolvable IDs are not validated outcomes. Other evidence stores are not searched. No row is classified trusted or migrated.',
}, null, 2));
