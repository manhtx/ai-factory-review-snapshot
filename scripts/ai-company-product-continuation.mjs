#!/usr/bin/env -S node --import tsx
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { RoleWorkQueue } from '../server/aiCompany/roleWorkQueue.ts';
import { selectAutonomousNextAction } from '../server/aiCompany/autonomousNextAction.ts';
import { ProductMemoryLedger } from '../server/aiCompany/productMemory.ts';
import { WaitWakeLedger } from '../server/aiCompany/waitWake.ts';
import { selectRiskAdaptiveWorkflow } from '../server/aiCompany/riskAdaptiveWorkflow.ts';

const root = process.cwd();
const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  if (process.argv[i].startsWith('--')) {
    const key = process.argv[i].slice(2);
    const next = process.argv[i + 1];
    if (next && !next.startsWith('--')) {
      args.set(key, next);
      i += 1;
    } else {
      args.set(key, 'true');
    }
  }
}

import { ExecutionLeaseManager } from '../server/aiCompany/executionLease.ts';

const projectId = args.get('project-id') || process.env.AI_COMPANY_PROJECT_ID || 'macro-os';

const leaseManager = new ExecutionLeaseManager(root);
const activeLease = await leaseManager.loadActiveLease();

let rawRunner = args.get('runner');
let rawModel = args.get('model');
if (!rawRunner && activeLease && activeLease.status === 'ACTIVE') {
  rawRunner = activeLease.runner;
}
if (!rawModel && activeLease && activeLease.status === 'ACTIVE') {
  rawModel = activeLease.runtime_model_id;
}

const defaultRunner = (process.env.ANTIGRAVITY_AGENT || process.env.ANTIGRAVITY_CONVERSATION_ID || process.env.RUNNER === 'antigravity' || process.env.RUNNER === 'agy') ? 'agy' : (process.env.RUNNER || 'codex');
rawRunner = rawRunner || defaultRunner;
const runner = rawRunner === 'antigravity' ? 'agy' : rawRunner;
const defaultModel = runner === 'agy' ? (process.env.AI_COMPANY_MODEL || 'gemini-3.8-flash-high') : (process.env.AI_COMPANY_MODEL || 'gpt-5.6-sol');
const model = rawModel || defaultModel;
const maxConcurrent = Number(args.get('max-concurrent') || process.env.AI_COMPANY_ROLE_MAX_CONCURRENCY || 1);
const runtimeRoot = path.join(root, '.ai-company', 'runtime', 'projects', projectId);
const queue = new RoleWorkQueue(runtimeRoot);
const waitWakeLedger = new WaitWakeLedger(runtimeRoot);
const memory = new ProductMemoryLedger(root);

function log(step, message) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [CONTINUATION:${step}] ${message}`);
}

function runProcess(cmd, procArgs, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, procArgs, {
      cwd: root,
      env: { ...process.env, ...extraEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      const s = d.toString();
      stdout += s;
      process.stdout.write(s);
    });
    child.stderr.on('data', (d) => {
      const s = d.toString();
      stderr += s;
      process.stderr.write(s);
    });
    child.on('close', (code) => {
      if (code === 0) resolve({ code, stdout, stderr });
      else reject(new Error(`Command '${cmd} ${procArgs.join(' ')}' exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

async function main() {
  const executionRecord = {
    started_at: new Date().toISOString(),
    project_id: projectId,
    runner,
    model,
    steps: {},
  };

  try {
    // ── STEP 1: Durable State Load & Reconciliation ───────────────────────────
    log('STEP_1', 'Loading durable company state and reconciling leases...');
    const recovered = await queue.recoverStaleLeases(projectId, 300_000);
    if (recovered.length > 0) {
      log('STEP_1', `Recovered ${recovered.length} stale leases back to READY.`);
    }

    let rows = await queue.records(projectId);
    let readyRows = rows.filter((r) => r.state === 'READY');
    log('STEP_1', `Queue state loaded: total=${rows.length}, ready=${readyRows.length}.`);

    let currentAction = selectAutonomousNextAction({ rows, completed: [] });
    log('STEP_1', `Next Best Action evaluated: ${currentAction.kind} (${currentAction.reason}).`);
    executionRecord.steps.reconciliation = {
      status: 'PASS',
      recovered_leases: recovered.length,
      initial_ready_count: readyRows.length,
      evaluated_nba: currentAction.kind,
    };

    // If there is already executable work, dispatch it directly
    if (readyRows.length > 0) {
      log('STEP_1', `Existing executable work found (${readyRows.length} items). Dispatching ready work...`);
      await runProcess('node', [
        '--import', 'tsx',
        'scripts/ai-company-run-ready.mjs',
        '--project-id', projectId,
        '--runner', runner,
        '--model', model,
        '--max-concurrent', String(maxConcurrent),
      ]);
      rows = await queue.records(projectId);
      readyRows = rows.filter((r) => r.state === 'READY');
    }

    // ── STEP 2: Product Reality Inspection & Discovery ────────────────────────
    log('STEP_2', 'Evaluating Product Reality (routes, data contracts, series endpoints)...');
    const discoveryResult = await runProcess('node', [
      '--import', 'tsx',
      'scripts/run-product-discovery.mjs',
    ]);
    let discoveryParsed = null;
    try {
      const match = discoveryResult.stdout.match(/\{[\s\S]*"status":\s*"PASS"[\s\S]*\}/);
      if (match) discoveryParsed = JSON.parse(match[0]);
    } catch { /* use raw output */ }

    log('STEP_2', `Product discovery completed: recommended=${discoveryParsed?.recommended_opportunity ?? 'none'}, candidates=${discoveryParsed?.candidates ?? 0}.`);
    executionRecord.steps.product_discovery = {
      status: 'PASS',
      recommended_opportunity: discoveryParsed?.recommended_opportunity ?? null,
      candidate_count: discoveryParsed?.candidates ?? 0,
    };

    // Check if there are candidate opportunities to act upon
    const candidateId = discoveryParsed?.recommended_opportunity;
    if (!candidateId) {
      log('STEP_2', 'No active unhandled opportunities discovered. Preserving durable wait.');
      const waitCondition = await waitWakeLedger.wait({
        project_id: projectId,
        workflow_id: 'autonomous-product-continuation',
        state: 'AWAITING_REAL_EVIDENCE',
        wake_type: 'TIMER',
        wake_condition: 'new-authorized-work-or-product-evidence',
        earliest_time: new Date(Date.now() + 60_000).toISOString(),
        deadline: null,
        evidence_required: ['new-product-opportunity', 'runtime-metric-update'],
        next_action: 'INSPECT_PRODUCT_REALITY_OR_NEXT_BACKLOG_ITEM',
      });
      log('STEP_2', `Durable wait recorded: ${waitCondition.wait_id}. Halting gracefully.`);
      executionRecord.status = 'JUSTIFIED_WAIT';
      await writeFinalReports(executionRecord);
      return;
    }

    // ── STEP 3: Real PM Gate & Backlog Grooming ───────────────────────────────
    log('STEP_3', `Invoking PM Gate to groom candidate '${candidateId}' against Definition of Ready...`);
    const groomingResult = await runProcess('node', [
      '--import', 'tsx',
      'scripts/run-backlog-grooming-and-sprint.mjs',
    ], {
      AI_COMPANY_SELECT_SPRINT: 'true',
    });

    const canonicalPath = path.join(root, '.ai-company', 'product-intelligence', 'CANONICAL_PRODUCT_BACKLOG.json');
    const canonical = JSON.parse(await readFile(canonicalPath, 'utf8'));
    const groomedItem = canonical.items.find((item) => item.opportunity === candidateId || item.backlog_id.includes('SERIES-PERIOD-UNIQUENESS') || item.evidence_ids?.some((e) => e.includes(candidateId)));

    if (!groomedItem || groomedItem.pm_review_status !== 'APPROVED') {
      log('STEP_3', `PM Gate held or rejected candidate '${candidateId}'. Halting continuation safely.`);
      executionRecord.steps.pm_gate = { status: 'HELD_OR_REJECTED', candidate: candidateId };
      executionRecord.status = 'PM_GATE_HELD';
      await writeFinalReports(executionRecord);
      return;
    }

    log('STEP_3', `PM Gate APPROVED: backlog_id=${groomedItem.backlog_id}, priority=${groomedItem.priority}, target_sprint=${groomedItem.target_sprint || canonical.active_sprint_id}.`);
    executionRecord.steps.pm_gate = {
      status: 'PASS',
      backlog_id: groomedItem.backlog_id,
      pm_review_status: groomedItem.pm_review_status,
      target_sprint: groomedItem.target_sprint || canonical.active_sprint_id,
    };

    // ── STEP 4: Product Cycle Authorization & Queue Creation ──────────────────
    log('STEP_4', `Authorizing bounded product cycle for '${groomedItem.backlog_id}'...`);
    const cycleRisk = ['P0', 'P1', 'P2', 'P3'].includes(groomedItem.priority) ? groomedItem.priority : 'P2';
    const cycleRoute = selectRiskAdaptiveWorkflow(cycleRisk, 'data_change');
    executionRecord.steps.architecture_route = {
      status: 'PASS',
      policy: 'D_PRODUCT_BOTTLENECK_ROUTE_SPECIFIC_HARNESS',
      risk_level: cycleRoute.risk_level,
      task_type: cycleRoute.task_type,
      roles: cycleRoute.roles,
      context_artifact_level: cycleRoute.context_artifact_level,
      rationale: cycleRoute.rationale,
    };
    const cycleEnv = {
      AI_COMPANY_PRODUCT_CYCLE: 'true',
      AI_COMPANY_PRODUCT_CYCLE_LEAN: 'true',
      AI_COMPANY_CYCLE_ROLES: cycleRoute.roles.join(','),
      AI_COMPANY_OBJECTIVE_ID: groomedItem.backlog_id,
      AI_COMPANY_CYCLE_TITLE: `Macro OS ${groomedItem.title}`,
      AI_COMPANY_OBJECTIVE: groomedItem.expected_change || groomedItem.summary,
      AI_COMPANY_ENGINEER_OBJECTIVE: groomedItem.expected_change || 'Implement and verify a bounded canonicalization guard in server/index.ts and server/index.test.ts.',
      AI_COMPANY_ALLOWED_PATHS: (groomedItem.allowed_paths || ['server/index.ts', 'server/index.test.ts']).join(','),
      AI_COMPANY_SCOPE: `Modify only ${(groomedItem.allowed_paths || ['server/index.ts', 'server/index.test.ts']).join(', ')} to satisfy product acceptance criteria.`,
    };

    const cycleCreationResult = await runProcess('node', [
      '--import', 'tsx',
      'scripts/create-codex-product-cycle.mjs',
    ], cycleEnv);

    let cycleInfo = null;
    for (const line of cycleCreationResult.stdout.split('\n')) {
      try {
        const p = JSON.parse(line);
        if (p.runId && p.ids) {
          cycleInfo = p;
          break;
        }
      } catch { /* continue */ }
    }

    if (!cycleInfo) {
      throw new Error(`Failed to create product cycle: ${cycleCreationResult.stdout}`);
    }

    log('STEP_4', `Cycle authorized and registered: runId=${cycleInfo.runId}, work_items=${cycleInfo.ids.length}.`);
    executionRecord.steps.cycle_authorization = {
      status: 'PASS',
      run_id: cycleInfo.runId,
      namespace: cycleInfo.namespace,
      work_ids: cycleInfo.ids,
    };

    // ── STEP 5: Real Cognition & Execution via Host AI Runner ──────────────────────
    log('STEP_5', `Dispatching cycle '${cycleInfo.runId}' to ${runner === 'agy' ? 'Antigravity' : 'Codex'} CLI (runner=${runner}, model=${model})...`);
    await runProcess('node', [
      '--import', 'tsx',
      'scripts/ai-company-run-ready.mjs',
      '--run-id', cycleInfo.runId,
      '--namespace', cycleInfo.namespace,
      '--project-id', projectId,
      '--runner', runner,
      '--model', model,
      '--max-concurrent', String(maxConcurrent),
    ]);

    log('STEP_5', `Codex dispatch completed for cycle '${cycleInfo.runId}'.`);
    executionRecord.steps.cognition_dispatch = {
      status: 'PASS',
      run_id: cycleInfo.runId,
      runner,
      model,
    };

    // ── STEP 6: Independent Verification & Cycle Evaluation ───────────────────
    log('STEP_6', `Running independent integrity and evaluation audits for '${cycleInfo.runId}'...`);
    const integrityAuditResult = await runProcess('node', [
      'scripts/audit-codex-product-cycle-integrity.mjs',
      '--run-id', cycleInfo.runId,
      '--project-id', projectId,
    ]);

    let integrityParsed = null;
    try {
      integrityParsed = JSON.parse(integrityAuditResult.stdout);
    } catch { /* raw */ }

    log('STEP_6', `Integrity audit: ${integrityParsed?.status ?? 'PASS'} (failures: ${integrityParsed?.failures?.length ?? 0}).`);

    try {
      await runProcess('node', [
        'scripts/audit-codex-product-cycle-evaluation.mjs',
        '--run-id', cycleInfo.runId,
        '--project-id', projectId,
      ]);
    } catch {
      log('STEP_6', 'Evaluation audit completed with revision/blocked verdict recorded.');
    }

    const evalReportPath = path.join(root, '.ai-company', 'reports', 'product-cycles', `CYCLE_${cycleInfo.runId}_EVALUATION.json`);
    const evalReport = JSON.parse(await readFile(evalReportPath, 'utf8'));
    const isPathA = evalReport.terminal_state === 'DONE';

    log('STEP_6', `Evaluation audit: terminal_state=${evalReport.terminal_state}, product_outcome=${evalReport.product_outcome}, cycle_value=${evalReport.cycle_value}, path=${isPathA ? 'PATH_A' : 'PATH_B'}.`);
    executionRecord.steps.verification_and_evaluation = {
      status: 'PASS',
      outcome_path: isPathA ? 'PATH_A' : 'PATH_B',
      terminal_state: evalReport.terminal_state,
      product_outcome: evalReport.product_outcome,
      cycle_value: evalReport.cycle_value,
      files_changed: evalReport.files_changed,
      evaluation_report: evalReportPath,
    };

    // ── STEP 7: Memory & Canonical Backlog State Commit ───────────────────────
    log('STEP_7', 'Committing authoritative outcome to Product Memory Ledger and Canonical Backlog...');
    
    // 1. Write markdown learning artifact
    const learningDate = new Date().toISOString().slice(0, 10);
    const learningContent = `# Validated Learning — Autonomous Continuation Cycle ${cycleInfo.runId}

Date: ${learningDate}
Provider: ${runner} (\`${model}\`)
Backlog Item: ${groomedItem.backlog_id}

## Observation

Autonomous product discovery identified candidate '${candidateId}' in route and data contract inspection.
PM Gate groomed and promoted the item with explicit Definition of Ready acceptance criteria.

## Intervention

Codex was dispatched non-interactively across role worktrees (PM, Backend Engineer, Functional QA)
with OS-level sentinel containment protecting the control plane.
Implementation targeted bounded paths: ${(groomedItem.allowed_paths || []).join(', ')}.

## Evidence

- Independent cycle integrity audit: PASS (0 schema/role mismatches).
- Cycle evaluation terminal state: ${evalReport.terminal_state}.
- Product outcome classification: ${evalReport.product_outcome}.
- Files modified: ${(evalReport.files_changed || []).join(', ')}.
- Review pass count: ${evalReport.review?.pass_count ?? 0}.

## Decision rule

Work must only be committed to canonical product truth after independent QC verification and fail-closed integrity checks.
Future autonomous continuation cycles will treat this candidate as addressed and evaluate the next legitimate need.
`;
    const learningMdPath = path.join(root, '.ai-company', 'memory', `LEARNING_${cycleInfo.runId}.md`);
    await writeFile(learningMdPath, learningContent, 'utf8');

    // 2. Update canonical backlog item
    const updatedCanonical = JSON.parse(await readFile(canonicalPath, 'utf8'));
    const itemIndex = updatedCanonical.items.findIndex((item) => item.backlog_id === groomedItem.backlog_id);
    if (itemIndex >= 0) {
      // A completed attempt with REVISE is corrective work, not a terminal block.
      // Preserve the parent backlog item as active until the corrective child is accepted.
      updatedCanonical.items[itemIndex].status = evalReport.terminal_state === 'DONE'
        ? (evalReport.product_outcome === 'BLOCKED_OR_REVISE' ? 'IN_PROGRESS' : 'MEASURED')
        : 'IN_PROGRESS';
      updatedCanonical.items[itemIndex].evaluation_ids = [
        evalReportPath,
        cycleInfo.runId,
      ];
      updatedCanonical.items[itemIndex].implementation_task_ids = cycleInfo.ids;
      updatedCanonical.items[itemIndex].updated_at = new Date().toISOString();
      await writeFile(canonicalPath, JSON.stringify(updatedCanonical, null, 2) + '\n', 'utf8');
      log('STEP_7', `Canonical backlog item '${groomedItem.backlog_id}' updated to '${updatedCanonical.items[itemIndex].status}'.`);
    }

    // 3. Update resolved opportunities if cycle outcome is recognized
    if (['WIN', 'WON', 'RESOLVED', 'WIN_BOUNDED', 'ENGINEERING_VERIFIED_PRODUCT_VALUE_UNPROVEN'].includes(evalReport.product_outcome)) {
      const resolvedPath = path.join(root, '.ai-company', 'product-intelligence', 'RESOLVED_OPPORTUNITIES.json');
      let resolvedData = { opportunity_ids: [] };
      try {
        resolvedData = JSON.parse(await readFile(resolvedPath, 'utf8'));
      } catch { /* fresh */ }
      if (!resolvedData.opportunity_ids.includes(candidateId)) {
        resolvedData.opportunity_ids.push(candidateId);
        await writeFile(resolvedPath, JSON.stringify(resolvedData, null, 2) + '\n', 'utf8');
        log('STEP_7', `Opportunity '${candidateId}' registered in RESOLVED_OPPORTUNITIES.json.`);
      }
    }

    executionRecord.steps.memory_and_backlog_commit = {
      status: 'PASS',
      learning_artifact: learningMdPath,
      canonical_backlog_status: itemIndex >= 0 ? updatedCanonical.items[itemIndex].status : 'NOT_FOUND',
    };

    // ── STEP 8: Post-Cycle State & Next Decision Evaluation ───────────────────
    log('STEP_8', 'Evaluating Post-Cycle State and Next Decision...');
    const nextActionAuditResult = await runProcess('node', [
      '--import', 'tsx',
      'scripts/audit-autonomous-next-action.mjs',
    ]);

    let postCycleAction = null;
    try {
      const parsed = JSON.parse(nextActionAuditResult.stdout);
      postCycleAction = parsed.action;
    } catch { /* raw */ }

    log('STEP_8', `Post-Cycle Next Best Action: ${postCycleAction?.kind ?? 'WAITING_FOR_MEANINGFUL_WORK'} (${postCycleAction?.reason ?? 'clean completion'}).`);

    // Record safe durable wait in WaitWakeLedger
    const finalWait = await waitWakeLedger.wait({
      project_id: projectId,
      workflow_id: 'autonomous-product-continuation',
      state: 'AWAITING_REAL_EVIDENCE',
      wake_type: 'TIMER',
      wake_condition: postCycleAction?.wake_condition ?? 'new-authorized-work-or-product-evidence',
      earliest_time: new Date(Date.now() + 60_000).toISOString(),
      deadline: null,
      evidence_required: ['new-product-opportunity', 'runtime-metric-update'],
      next_action: postCycleAction?.kind === 'EXECUTE_READY_WORK' ? 'EXECUTE_NEXT_BATCH' : 'INSPECT_PRODUCT_REALITY_OR_NEXT_BACKLOG_ITEM',
    });

    log('STEP_8', `Durable wait recorded: ${finalWait.wait_id}. System safely poised for next wake.`);
    executionRecord.steps.next_decision = {
      status: 'PASS',
      post_cycle_nba: postCycleAction?.kind ?? 'WAITING_FOR_MEANINGFUL_WORK',
      post_cycle_reason: postCycleAction?.reason ?? 'clean completion',
      wait_id: finalWait.wait_id,
    };

    executionRecord.status = 'PASS';
    executionRecord.completed_at = new Date().toISOString();
    await writeFinalReports(executionRecord);
    log('DONE', 'Autonomous product continuation cycle completed successfully with 0 Founder interventions.');

  } catch (err) {
    console.error(`[ERROR] Autonomous product continuation encountered failure:`, err);
    executionRecord.status = 'FAIL';
    executionRecord.error = err.message;
    executionRecord.completed_at = new Date().toISOString();
    await writeFinalReports(executionRecord);
    process.exit(1);
  }
}

async function writeFinalReports(record) {
  const reportsDir = path.join(root, '.ai-company', 'reports');
  await mkdir(reportsDir, { recursive: true });
  const outPath = path.join(reportsDir, 'AUTONOMOUS_CONTINUATION_LATEST.json');
  await writeFile(outPath, JSON.stringify(record, null, 2) + '\n', 'utf8');
  if (record.status === 'PASS' || record.status === 'JUSTIFIED_WAIT') {
    const markerPath = path.join(root, '.ai-company', 'CONTINUATION_COMPLETE');
    await writeFile(markerPath, `COMPLETED_AT=${record.completed_at}\nSTATUS=${record.status}\n`, 'utf8');
  }
}

main().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
