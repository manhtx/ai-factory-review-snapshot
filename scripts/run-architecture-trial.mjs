#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ArchitectureTrialLedger } from '../server/aiCompany/architectureTrial.ts';
import { JsonlEvidenceResolver } from '../server/aiCompany/evidenceResolver.ts';
import { calibrateFreshnessEvaluator, evaluateFreshnessOutput } from '../server/aiCompany/architectureEvaluator.ts';

const root = process.cwd();
const scenario = process.env.ARCH_TRIAL_SCENARIO || 'watchlist';
const trialId = `${scenario}-architecture-${Date.now()}`;
const reportDir = path.join(root, '.ai-company', 'reports', 'architecture-trials');
const logDir = path.join(reportDir, trialId);
const sourceFiles = scenario === 'freshness'
  ? ['server/freshness.ts', 'server/freshness.test.ts', 'server/ingestion.ts', 'server/ingestion.test.ts']
  : ['src/app/pages/WatchlistPage.tsx', 'src/app/pages/WatchlistPage.test.ts', 'src/app/pages/WatchlistPage.integration.test.tsx', 'src/app/data/watchlist.ts'];
const task = scenario === 'freshness'
  ? 'Macro OS freshness and ingestion contract rejects stale/unverifiable data while preserving valid current observations'
  : 'Watchlist threshold alerts fail closed for stale/unavailable/unverified/malformed data and preserve valid ABOVE/BELOW alerts';
const hash = (value) => createHash('sha256').update(value).digest('hex');
async function fingerprint() { return hash((await Promise.all(sourceFiles.map(async (f) => `${f}\0${await readFile(path.join(root, f), 'utf8')}`))).join('\0')); }
function run(command, args, timeout = 120000) {
  const start = Date.now();
  try { return { exit_code: 0, stdout: execFileSync(command, args, { cwd: root, encoding: 'utf8', timeout, env: { ...process.env, CI: 'true', FORCE_COLOR: '0' } }), stderr: '', duration_ms: Date.now() - start, failure: null }; }
  catch (e) { return { exit_code: typeof e.status === 'number' ? e.status : 1, stdout: e.stdout?.toString() ?? '', stderr: e.stderr?.toString() ?? e.message, duration_ms: Date.now() - start, failure: 'VERIFICATION' }; }
}
await mkdir(logDir, { recursive: true });
const revisionResult = run('git', ['rev-parse', 'HEAD']);
const tree = run('git', ['status', '--porcelain', '--', ...sourceFiles]).stdout;
const sourceHash = await fingerprint();
const common = { trial_id: trialId, project_id: 'macro-os', product_task: task, product_goal_reference: 'docs/PRODUCT_GOAL.md#research-workflow-and-trust-model', base_product_revision: `git:${revisionResult.stdout.trim() || 'uncommitted'}:tree:${hash(tree + sourceHash)}`, data_snapshot: `watchlist-source:${sourceHash}`, model_generation: 'deterministic-local-runner', reasoning_effort: 'none', available_tools: ['vitest', 'git'], authority: 'local-worktree-no-production-write', evaluator_version: 'vitest-watchlist-contract-v1' };
const testArgs = scenario === 'freshness'
  ? ['vitest', 'run', 'server/freshness.test.ts', 'server/ingestion.test.ts', '--config', 'vitest.config.ts', '--configLoader', 'runner']
  : ['vitest', 'run', 'src/app/pages/WatchlistPage.test.ts', 'src/app/pages/WatchlistPage.integration.test.tsx', '--config', 'vitest.config.ts', '--configLoader', 'runner'];
let productProbe = null;
if (scenario === 'freshness') {
  const baseUrl = process.env.ARCH_TRIAL_BASE_URL || 'http://127.0.0.1:8787';
  try {
    const productIndicatorIds = ['cpi-vn', 'core-pce-us', 'vnindex'];
    const observations = await Promise.all(productIndicatorIds.map(async (indicatorId) => {
      const response = await fetch(`${baseUrl}/api/evidence/indicator/${indicatorId}`);
      if (!response.ok) throw new Error(`${indicatorId}: HTTP ${response.status}`);
      return { indicatorId, payload: await response.json() };
    }));
    const evaluations = observations.map(({ indicatorId, payload }) => {
      const availability = payload.availability ?? {};
      return { indicatorId, ...evaluateFreshnessOutput({ freshness: availability.freshness, displayedLabel: availability.status, sourceVerified: payload.latest?.quality === 'verified' }) };
    });
    productProbe = { base_url: baseUrl, evaluations, evaluator: 'freshness-evaluator-v1' };
  } catch (error) {
    productProbe = { error: error instanceof Error ? error.message : String(error) };
  }
}
// Each arm has a different orchestration protocol; the product task and
// evaluator remain identical. Protocol overhead is a measured outcome, not a
// confounder, provided it does not change the acceptance contract.
const arms = [
  ['A_CURRENT_AI_COMPANY', [['npm', ['run', 'ai-company:gate']]], 'full company governance and execution gate'],
  ['B_STRONG_MINIMAL_AGENT', [['npx', testArgs]], 'single bounded evaluator'],
  ['C_VERIFIED_PRODUCT_KERNEL', [['npx', testArgs], ['node', ['--import', 'tsx', 'scripts/run-verified-product-kernel-check.mjs']]], 'bounded evaluator plus state-aware accept-delay-quarantine kernel'],
];
const ledger = new ArchitectureTrialLedger(path.join(root, '.ai-company', 'runtime'));
const evidencePath = path.join(root, '.ai-company', 'runtime', 'role-dispatch-evidence.jsonl');
const records = [];
for (let i = 0; i < arms.length; i += 1) {
  const [arm, protocol, protocol_name] = arms[i];
  const started = Date.now();
  const results = protocol.map(([command, args]) => ({ command, args, result: run(command, args) }));
  const failed = results.find((entry) => entry.result.exit_code !== 0);
  const result = { exit_code: failed ? failed.result.exit_code : 0, stdout: results.map((entry) => entry.result.stdout).join('\n'), stderr: results.map((entry) => entry.result.stderr).filter(Boolean).join('\n'), duration_ms: Date.now() - started, failure: failed?.result.failure ?? null };
  const log = path.join(logDir, `${arm}.json`);
  await writeFile(log, JSON.stringify(result, null, 2));
  const evidenceIds = [`ARCH-TRIAL:${trialId}:${arm}:stdout`, `ARCH-TRIAL:${trialId}:${arm}:exit`];
  const evidenceRows = [
    { evidence_id: evidenceIds[0], content: result.stdout, source_artifact: log },
    { evidence_id: evidenceIds[1], content: JSON.stringify({ exit_code: result.exit_code, duration_ms: result.duration_ms, failure: result.failure }), source_artifact: log },
  ].map((entry) => ({ ...entry, namespace: 'architecture-trial', run_id: trialId, produced_by_role: 'deterministic-architecture-runner', content_hash: hash(entry.content), created_at: new Date().toISOString() }));
  await appendFile(evidencePath, evidenceRows.map((entry) => `${JSON.stringify(entry)}\n`).join(''), 'utf8');
  const passed = result.exit_code === 0;
  let product_quality;
  let domain_correctness;
  let product_quality_evidence_ids = [];
  let domain_correctness_evidence_ids = [];
  if (productProbe?.evaluations?.length) {
    product_quality = productProbe.evaluations.reduce((sum, item) => sum + item.product_quality, 0) / productProbe.evaluations.length;
    domain_correctness = productProbe.evaluations.reduce((sum, item) => sum + item.domain_correctness, 0) / productProbe.evaluations.length;
    product_quality_evidence_ids = [`ARCH-TRIAL:${trialId}:${arm}:product-quality`];
    domain_correctness_evidence_ids = [`ARCH-TRIAL:${trialId}:${arm}:domain-correctness`];
    const productContent = JSON.stringify({ productProbe, arm, source: 'live-product-api' });
    const productRows = [
      { evidence_id: product_quality_evidence_ids[0], produced_by_role: 'independent-product-evaluator' },
      { evidence_id: domain_correctness_evidence_ids[0], produced_by_role: 'independent-domain-evaluator' },
    ].map((entry) => ({ ...entry, namespace: 'architecture-trial', run_id: trialId, content: productContent, content_hash: hash(productContent), source_artifact: log, created_at: new Date().toISOString() }));
    await appendFile(evidencePath, productRows.map((entry) => `${JSON.stringify(entry)}\n`).join(''), 'utf8');
  }
  // A passing deterministic test proves process/contract integrity only. It
  // cannot be promoted to product quality or domain correctness without a
  // product-outcome evidence record, so leave those fields absent and let the
  // comparator fail closed.
  records.push(await ledger.recordMeasured({ ...common, arm, cognition_protocol: protocol_name, action_protocol: `${protocol_name}:deterministic-verification`, execution_order: i + 1, confounders: [], state: 'MEASURED', process_integrity: passed ? 3 : 0, safety: passed ? 3 : 0, rework_count: 0, founder_interventions: 0, token_actual: 0, token_estimated: 0, token_unknown: 1, first_critical_failure: result.failure, product_quality, domain_correctness, product_quality_evidence_ids, domain_correctness_evidence_ids, evidence_ids: [...evidenceIds, ...product_quality_evidence_ids, ...domain_correctness_evidence_ids] }));
  records[records.length - 1].command = protocol.map(([command, args]) => `${command} ${args.join(' ')}`).join(' && '); records[records.length - 1].protocol_name = protocol_name; records[records.length - 1].result = { exit_code: result.exit_code, duration_ms: result.duration_ms, log };
}
// D is not a cognition implementation. It is a pre-registered bottleneck
// observation and must remain eligible to explain a failure without receiving
// architecture credit from the same deterministic tests.
const bottleneckLog = path.join(logDir, 'D_PRODUCT_BOTTLENECK.json');
const bottleneckContent = JSON.stringify({ observation: 'architecture comparison cannot yet establish independent product/domain outcome evidence', product_data_risk: 'freshness/provenance coverage may dominate architecture', status: 'HYPOTHESIS_ONLY' });
await writeFile(bottleneckLog, bottleneckContent + '\n');
const bottleneckEvidenceId = `ARCH-TRIAL:${trialId}:D_PRODUCT_BOTTLENECK:observation`;
await appendFile(evidencePath, `${JSON.stringify({ evidence_id: bottleneckEvidenceId, namespace: 'architecture-trial', run_id: trialId, produced_by_role: 'deterministic-architecture-runner', content: bottleneckContent, content_hash: hash(bottleneckContent), source_artifact: bottleneckLog, created_at: new Date().toISOString() })}\n`, 'utf8');
records.push(await ledger.recordMeasured({ ...common, arm: 'D_PRODUCT_BOTTLENECK', cognition_protocol: 'no-architecture-change; inspect product/data/evaluator bottleneck', action_protocol: 'observe-and-report-without-architecture-credit', execution_order: 4, confounders: [], state: 'MEASURED', process_integrity: 3, safety: 3, rework_count: 0, founder_interventions: 0, token_actual: 0, token_estimated: 0, token_unknown: 1, first_critical_failure: 'PRODUCT_ENVIRONMENT', product_quality_evidence_ids: [], domain_correctness_evidence_ids: [], evidence_ids: [bottleneckEvidenceId] }));
records[records.length - 1].protocol_name = 'product/data bottleneck observation';
records[records.length - 1].result = { exit_code: 0, duration_ms: 0, log: bottleneckLog };
const comparison = ledger.compare(records);
const evidenceValidation = await ledger.validateEvidence(records, new JsonlEvidenceResolver(evidencePath), { expectedNamespace: 'architecture-trial' });
const evaluatorCalibration = calibrateFreshnessEvaluator();
const report = { trial_id: trialId, generated_at: new Date().toISOString(), status: comparison.state, comparison, evidence_validation: evidenceValidation, product_probe: productProbe, task, shared_conditions: common, evaluator_calibration: { version: common.evaluator_version, discriminates_known_anchors: evaluatorCalibration.discriminates, anchors: evaluatorCalibration.anchors }, trial_type: productProbe?.evaluations?.length ? 'PROSPECTIVE_SINGLE_TASK_PRODUCT_RUNTIME_OBSERVATION' : 'PROSPECTIVE_SINGLE_TASK_PROCESS_OBSERVATION', arms: records, production_autonomy: 'DISABLED', production_release: 'HUMAN_GATED', interpretation: comparison.state === 'COMPARABLE' && evidenceValidation.valid ? 'Comparable process and bounded product-runtime observation; it still does not select an architecture without material arm separation and independent outcome design.' : 'Invalid/non-decisional comparison because evidence is unresolved, product probe failed, or product/domain outcome evidence is absent; no architecture selection.' };
const reportPath = path.join(reportDir, `${trialId}.json`);
await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ trial_id: trialId, status: comparison.state, report: reportPath, arms: records.map((r) => ({ arm: r.arm, exit_code: r.result.exit_code, duration_ms: r.result.duration_ms })) }, null, 2));
if (comparison.state === 'INVALID') process.exitCode = 2;
