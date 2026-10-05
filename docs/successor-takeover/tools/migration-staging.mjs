import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function parse(bytes) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const rows = text.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
  if (rows.some(row => !row || typeof row.work_id !== 'string' || !row.work_id.trim())) throw new Error('MISSING_WORK_ID');
  return rows;
}
const latest = rows => [...new Map(rows.map(row => [row.work_id, row])).values()];
const optional = value => typeof value === 'string' && value.trim() ? value : null;

export function stageQueue(bytes) {
  const rows = parse(bytes);
  const current = latest(rows);
  const ids = new Set(current.map(row => row.work_id));
  return {
    schema: 'successor-takeover.unverified-staging.v1', authoritative: false,
    sourceSha256: hash(bytes), sourceBytesBase64: Buffer.from(bytes).toString('base64'), historyRows: rows.length,
    items: current.map(row => ({ workId: row.work_id, stagingClassification: 'MIGRATED_AS_UNVERIFIED',
      objectiveId: optional(row.assignment?.objective_id), backlogId: optional(row.backlog_id),
      runId: optional(row.assignment?.run_id), namespace: optional(row.assignment?.namespace),
      unresolvedDependencies: Array.isArray(row.depends_on) ? row.depends_on.filter(id => !ids.has(id)) : [],
      original: row })),
    claimLimit: 'Staging copy only; no trust, execution permission or canonical migration.',
  };
}

export function verifyStage(stage, expectedSourceSha256) {
  if (typeof expectedSourceSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(expectedSourceSha256)) throw new Error('EXPECTED_SOURCE_ANCHOR_REQUIRED');
  if (stage.sourceSha256 !== expectedSourceSha256) throw new Error('SOURCE_ANCHOR_MISMATCH');
  if (stage.schema !== 'successor-takeover.unverified-staging.v1' || stage.authoritative !== false) throw new Error('INVALID_STAGING_BOUNDARY');
  const bytes = Buffer.from(stage.sourceBytesBase64, 'base64');
  if (hash(bytes) !== stage.sourceSha256) throw new Error('SOURCE_HASH_MISMATCH');
  const expected = stageQueue(bytes);
  if (stage.historyRows !== expected.historyRows || JSON.stringify(stage.items) !== JSON.stringify(expected.items)) throw new Error('STAGING_CONSERVATION_FAILURE');
  return { sourceSha256: stage.sourceSha256, historyRows: stage.historyRows, latestRows: stage.items.length, byteRoundtrip: true, allUnverified: true };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, input, output] = process.argv.slice(2);
  if (mode === 'export' && input && output) {
    const stage = stageQueue(readFileSync(resolve(input)));
    const proof = verifyStage(stage, stage.sourceSha256);
    writeFileSync(resolve(output), JSON.stringify(stage, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ output: resolve(output), ...proof }));
  } else if (mode === 'verify' && input && output) {
    console.log(JSON.stringify(verifyStage(JSON.parse(readFileSync(resolve(input), 'utf8')), output)));
  } else throw new Error('Usage: migration-staging.mjs export <frozen-input> <new-output> | verify <staging> <expected-source-sha256>');
}
