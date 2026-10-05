#!/usr/bin/env node
import { readFile, appendFile, mkdir } from 'node:fs/promises';
import { rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { RoleWorkQueue } from '../server/aiCompany/roleWorkQueue.ts';
import { RoleHandoffLedger } from '../server/aiCompany/roleHandoffLedger.ts';
import { eligibilityForObjective } from '../server/aiCompany/objectiveEligibility.ts';

const root = process.cwd();
const runtime = `${root}/.ai-company/runtime/projects/macro-os`;
const stamp = Date.now();
const runId = `codex-product-cycle-${stamp}`;
const namespace = runId;
let epochId = process.env.AI_COMPANY_EPOCH_ID || 'EPOCH_UNKNOWN';
try {
  const state = JSON.parse(await readFile(`${root}/.ai-company/optimization/CONTINUOUS_OPTIMIZATION_STATE.json`, 'utf8'));
  if (state.current_epoch) epochId = state.current_epoch;
} catch { /* use unknown when no optimization state is available */ }
const prefix = `CYCLE:${stamp}`;
const productMode = process.env.AI_COMPANY_PRODUCT_CYCLE === 'true';
const leanMode = productMode && process.env.AI_COMPANY_PRODUCT_CYCLE_LEAN === 'true';
const configuredRoles = process.env.AI_COMPANY_CYCLE_ROLES ? process.env.AI_COMPANY_CYCLE_ROLES.split(',').map((r) => r.trim()).filter(Boolean) : null;
const roles = configuredRoles || (leanMode
  ? ['pm', 'backend-engineer', 'functional-qa']
  : ['pm', 'backend-engineer', 'functional-qa', 'quality-control', 'ceo-guild']);
const ids = roles.map((role) => `CYCLE-${stamp}-${role}`);
const queue = new RoleWorkQueue(runtime);
const handoffs = new RoleHandoffLedger(runtime);
const title = process.env.AI_COMPANY_CYCLE_TITLE || (productMode
  ? 'Macro OS freshness display contract regression guard'
  : 'Macro OS freshness/data-state evidence cycle');
const objectiveId = process.env.AI_COMPANY_OBJECTIVE_ID || 'BACKLOG-038';
const objectiveLock = `${runtime}/objective-${createHash('sha256').update(objectiveId).digest('hex').slice(0, 24)}.lock`;
await mkdir(runtime, { recursive: true });
try { await mkdir(objectiveLock); }
catch {
  let stale = false;
  try { const owner = JSON.parse(await readFile(`${objectiveLock}/owner.json`, 'utf8')); process.kill(Number(owner.pid), 0); }
  catch { stale = true; }
  if (stale) { for (const file of [ `${objectiveLock}/owner.json` ]) { try { const { unlink } = await import('node:fs/promises'); await unlink(file); } catch {} } try { const { rmdir } = await import('node:fs/promises'); await rmdir(objectiveLock); } catch {} try { await mkdir(objectiveLock); } catch {} }
  else { console.error(`CYCLE_CREATION_REJECTED: objective creation lock is held for ${objectiveId}`); process.exit(1); }
}
await appendFile(`${objectiveLock}/owner.json`, `${JSON.stringify({ pid: process.pid, objective_id: objectiveId, acquired_at: new Date().toISOString() })}\n`, 'utf8');
process.on('exit', () => { try { rmSync(objectiveLock, { recursive: true, force: true }); } catch {} });

const existingItems = await queue.records('macro-os');
// BLOCKED is fail-closed here: only an explicit QUARANTINED/SUPERSEDED/RESOLVED
// state can remove a work item from the active blocker set. Historical blocked
// rows are migrated to QUARANTINED by the forensic triage command, so silently
// relabelling every BLOCKED row as stale would reopen the original bypass.
const objectiveRecords = existingItems.filter((item) => item.assignment?.objective_id === objectiveId || item.backlog_id === objectiveId).map((item) => ({ ...item, objective_id: item.assignment?.objective_id ?? item.backlog_id, effective_state: item.state === 'BLOCKED' ? 'ACTIVE_BLOCKED' : undefined }));
const eligibility = eligibilityForObjective(objectiveId, objectiveRecords, process.env.AI_COMPANY_RELEVANT_REVISION || 'backlog-v1');
if (eligibility.result !== 'ELIGIBLE' && process.env.AI_COMPANY_ALLOW_DUPLICATE !== 'true') {
  await appendFile(`${runtime}/scheduler-decisions.jsonl`, `${JSON.stringify({ ...eligibility, decision: 'SUPPRESS_CREATION', next_action: eligibility.result === 'REQUIRES_RECONCILIATION' ? 'RECONCILE' : 'SELECT_ALTERNATIVE_OR_WAIT', recorded_at: new Date().toISOString() })}\n`, 'utf8');
  console.error(`CYCLE_CREATION_REJECTED: ${eligibility.result} for objective ${objectiveId}; attempt_key=${eligibility.attempt_key}; blockers=${eligibility.blocker_ids.join(',')}`);
  process.exit(1);
}
const objectiveText = process.env.AI_COMPANY_OBJECTIVE || 'Implement and verify one small reversible regression guard for the Macro OS freshness/data-state display contract. Preserve production no-go and do not change production data.';
const allowedPaths = process.env.AI_COMPANY_ALLOWED_PATHS ? process.env.AI_COMPANY_ALLOWED_PATHS.split(',').map((s) => s.trim()).filter(Boolean) : ['server/freshness.ts', 'server/freshness.test.ts', 'src/app/data/index.ts', 'src/app/data/userTelemetry.test.ts'];
const scopeText = process.env.AI_COMPANY_SCOPE ? [process.env.AI_COMPANY_SCOPE] : ['Inspect and, if justified, modify only server/freshness.ts, server/freshness.test.ts, src/app/data/index.ts, or src/app/data/userTelemetry.test.ts; record the exact changed files.'];
const assignment = productMode ? {
  assignment_id: `ASSIGNMENT:${runId}`,
  run_id: runId,
  cycle_id: runId,
  epoch_id: epochId,
  namespace,
  product_id: 'macro-os',
  objective_id: objectiveId,
  work_id: 'PLACEHOLDER',
  role: 'pm',
  task_type: process.env.AI_COMPANY_TASK_TYPE || 'role-work',
  objective: objectiveText,
  product_goal_alignment: ['Product Goal: preserve truth, latest-available observations, explicit freshness, provenance, and fact/inference separation.'],
  scope: scopeText,
  allowed_paths: allowedPaths,
  forbidden_paths: ['.env', '.ai-company/runtime', '.ai-company/company-state.json', 'dist', 'node_modules'],
  allowed_tools: ['repository inspection', 'targeted tests', 'worktree file edits'],
  forbidden_tools: ['deployment', 'production writes', 'secret access', 'git push'],
  inputs: ['Product Goal', 'existing freshness implementation and tests', 'dependency role artifacts'],
  evidence_manifest: ['changed-file diff', 'targeted test output', 'bounded role artifact'],
  dependencies: [],
  acceptance_criteria: ['No production/runtime state is modified', 'Any code change is within allowed paths', 'A targeted regression test or justified no-change finding is recorded', 'Freshness/provenance semantics remain fail-closed'],
  output_schema: 'none',
  allowed_verdicts: ['PASS', 'REVISE', 'QUALITY_FAIL', 'HOLD', 'BLOCKED'],
  risk_level: 'P2',
  mutation_policy: 'read_only',
  test_policy: 'targeted',
  context_budget: { target_tokens: 5000, max_tokens: 10000 },
  token_budget: 18000,
  timeout: 600,
  retry_budget: 1,
  escalation_policy: 'bounded escalation'
} : null;
const worktreeRequired = process.env.AI_COMPANY_DISABLE_EXECUTION_PLANNER !== 'true'
  ? process.env.AI_COMPANY_WORKTREE_REQUIRED !== 'false'
  : true;
const items = await queue.createBatch(roles.map((role, index) => ({
  work_id: ids[index], project_id: 'macro-os', backlog_id: prefix,
  title: `${title}: ${role}`, role, run_id: runId, namespace,
  workflow_id: productMode ? (leanMode ? 'codex-product-cycle-product-p2' : 'codex-product-cycle-product') : 'codex-product-cycle', depends_on: index ? [ids[index - 1]] : [],
  assignment: productMode ? { ...assignment, work_id: ids[index], role, assignment_id: `ASSIGNMENT:${ids[index]}`,
    worktree_required: worktreeRequired,
    mutation_scope: process.env.AI_COMPANY_MUTATION_SCOPE || (worktreeRequired ? 'PRODUCT_CODE_MUTATION' : 'READ_ONLY'),
    mutation_policy: ['backend-engineer'].includes(role) && worktreeRequired ? 'worktree' : 'read_only',
    objective: role === 'backend-engineer'
      ? (process.env.AI_COMPANY_ENGINEER_OBJECTIVE || (process.env.AI_COMPANY_OBJECTIVE ? `${process.env.AI_COMPANY_OBJECTIVE}, only within the allowed paths.` : 'Implement and verify one small reversible regression guard for the Macro OS freshness/data-state display contract, only within the allowed paths.'))
      : assignment.objective }
    : undefined,
})));
for (let index = 0; index < items.length; index += 1) {
  await handoffs.record({
    project_id: 'macro-os', work_id: items[index].work_id,
    from_role: index ? roles[index - 1] : 'ceo', to_role: roles[index],
    actor: 'codex-cycle-coordinator', objective: items[index].title,
    context: ['Product Goal', 'bounded cycle assignment'],
    evidence_ids: ['codex-cycle-assignment'],
    acceptance_criteria: ['bounded artifact', 'typed completion contract'],
  });
}
console.log(JSON.stringify({ runId, namespace, backlogPrefix: prefix, ids }));
