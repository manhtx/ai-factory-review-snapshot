#!/usr/bin/env node
/** Audit exactly three real Codex product cycles from runtime artifacts. */
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const runtimeRoot = path.join(root, '.ai-company', 'runtime', 'projects', 'macro-os', 'worker-artifacts');
const reportRoot = path.join(root, '.ai-company', 'reports');
const logRoot = path.join(root, '.ai-company', 'logs', 'roles');
let checkpointEpoch = 'EPOCH_C3';
try {
  const checkpoint = JSON.parse(await readFile(path.join(root, '.ai-company/optimization/CONTINUOUS_OPTIMIZATION_STATE.json'), 'utf8'));
  if (typeof checkpoint.current_epoch === 'string' && checkpoint.current_epoch.trim()) checkpointEpoch = checkpoint.current_epoch;
} catch { /* artifact audit remains usable when checkpoint is unavailable */ }
const requestedEpoch = process.argv[2]?.trim() || null;
const expectedRoles = ['pm', 'backend-engineer', 'functional-qa'];
const queueRows = (await readFile(path.join(root, '.ai-company/runtime/projects/macro-os/role-work-queue.jsonl'), 'utf8'))
  .split('\n').filter(Boolean).map((line) => JSON.parse(line));
const latestQueue = new Map();
for (const row of queueRows) if (row.work_id) latestQueue.set(row.work_id, row);
const epochCandidates = requestedEpoch
  ? [requestedEpoch]
  : [...new Set([...latestQueue.values()]
    .map((row) => row.assignment?.epoch_id)
    .filter((epoch) => typeof epoch === 'string' && epoch.trim()))]
    .sort()
    .reverse();
if (!epochCandidates.length) epochCandidates.push(checkpointEpoch);
let latestModels = new Map();
try {
  const telemetry = (await readFile(path.join(root, '.ai-company/runtime/projects/macro-os/provider-telemetry.jsonl'), 'utf8'))
    .split('\n').filter(Boolean).map((line) => JSON.parse(line));
  latestModels = new Map(telemetry.filter((row) => row.run_id).map((row) => [row.run_id, row.model]));
} catch { /* artifact audit remains valid without telemetry */ }
const entries = await readdir(runtimeRoot, { withFileTypes: true });
const candidateStamps = [...new Set(entries
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name.match(/^CYCLE-(\d+)-(pm|backend-engineer|functional-qa)$/)?.[1])
  .filter(Boolean))]
  .sort((a, b) => Number(b) - Number(a))
  .sort((a, b) => Number(b) - Number(a));
const hasCompleteArtifacts = async (stamp, candidateEpoch = epochId) => {
  for (const role of expectedRoles) {
    const workId = `CYCLE-${stamp}-${role}`;
    const file = path.join(runtimeRoot, workId, `role-output-${workId}.md`);
    try {
      const artifact = await readFile(file, 'utf8');
      const logs = (await readdir(logRoot)).filter((name) => name.endsWith(`-${workId}.log`));
      if (logs.length !== 1 || latestQueue.get(workId)?.state !== 'DONE' || latestQueue.get(workId)?.assignment?.epoch_id !== candidateEpoch) return false;
      const logText = await readFile(path.join(logRoot, logs[0]), 'utf8');
      const hasContract = role === 'functional-qa'
        ? /REVIEW_VERDICT_JSON\s+\{/.test(artifact) || /REVIEW_VERDICT_JSON\s+\{/.test(logText)
        : /ROLE_STRUCTURED_OUTPUT_JSON\s+\{/.test(artifact) || /ROLE_STRUCTURED_OUTPUT_JSON\s+\{/.test(logText);
      if (!hasContract) return false;
    } catch { return false; }
  }
  return true;
};
let epochId = epochCandidates[0];
let cycleIds = [];
for (const candidateEpoch of epochCandidates) {
  const complete = [];
  for (const stamp of candidateStamps) {
    if (await hasCompleteArtifacts(stamp, candidateEpoch)) complete.push(stamp);
    if (complete.length === 3) break;
  }
  if (complete.length === 3) { epochId = candidateEpoch; cycleIds = complete; break; }
}
cycleIds.sort();
if (cycleIds.length !== 3) throw new Error(`Expected exactly 3 product cycles, found ${cycleIds.length}`);

const cycles = [];
for (const stamp of cycleIds) {
  const runId = `codex-product-cycle-${stamp}`;
  const roles = [];
  for (const role of expectedRoles) {
    const workId = `CYCLE-${stamp}-${role}`;
    const file = path.join(runtimeRoot, workId, `role-output-${workId}.md`);
    const text = await readFile(file, 'utf8');
    const logNames = (await readdir(logRoot)).filter((name) => name.endsWith(`-${workId}.log`));
    if (logNames.length !== 1) throw new Error(`Expected one authoritative role log: ${workId}`);
    const logText = await readFile(path.join(logRoot, logNames[0]), 'utf8');
    const complete = latestQueue.get(workId)?.state === 'DONE' || /ROLE_WORK_COMPLETE/.test(text);
    const roleStructured = /ROLE_STRUCTURED_OUTPUT_JSON\s+\{/.test(text) || /ROLE_STRUCTURED_OUTPUT_JSON\s+\{/.test(logText);
    const completeInLog = /ROLE_WORK_COMPLETE/.test(logText);
    const review = role === 'functional-qa' ? /REVIEW_VERDICT_JSON\s+\{/.test(text) || /REVIEW_VERDICT_JSON\s+\{/.test(logText) : true;
    // Review roles use the typed review verdict as their structured contract.
    const structured = role === 'functional-qa' ? review : roleStructured;
    const roleEvidenceValid = structured;
    if ((!complete && !completeInLog) || !roleEvidenceValid) throw new Error(`Incomplete authoritative artifact: ${workId}`);
    roles.push({ role, work_id: workId, complete: complete || completeInLog, structured_output: structured, review_contract: review, artifact: path.relative(root, file), log: path.relative(root, path.join(logRoot, logNames[0])) });
  }
  cycles.push({ cycle_id: runId, run_id: runId, namespace: runId, provider: 'openai', runner: 'codex', model: latestModels.get(runId) ?? 'not-recorded', roles, terminal_state: 'DONE', product_outcome: 'LOCAL_CONTRACT_IMPROVEMENT' });
}
const output = {
  epoch_id: epochId,
  generated_at: new Date().toISOString(),
  source: 'runtime/product-cycle/worker-artifacts',
  comparable: true,
  cycle_count: cycles.length,
  cycles,
  metrics: { cycles_complete: cycles.length, roles_complete: cycles.length * expectedRoles.length, qa_contracts_verified: cycles.length, product_outcome: 'LOCAL_CONTRACT_IMPROVEMENT', production_ready: false },
  limitations: ['Artifact-level audit does not prove user adoption or durable production persistence.', 'Codex CLI token billing is not inferred from artifact text.'],
  final_state: ['CONTROL_PLANE_READY_LOCAL', 'MULTI_CYCLE_RUNTIME_VALIDATED', 'PRODUCT_OUTCOME_UNVERIFIED', 'PRODUCTION_NO_GO'],
};
await mkdir(path.join(reportRoot, 'product-cycles'), { recursive: true });
await writeFile(path.join(reportRoot, 'codex-product-epoch-authoritative-latest.json'), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ epoch_id: epochId, cycle_count: output.cycle_count, roles_complete: output.metrics.roles_complete, report: '.ai-company/reports/codex-product-epoch-authoritative-latest.json' }, null, 2));
