#!/usr/bin/env node
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) if (process.argv[i].startsWith('--')) args.set(process.argv[i].slice(2), process.argv[i + 1] ?? '');
const runId = args.get('run-id');
const projectId = args.get('project-id') || 'macro-os';
if (!runId) { console.error('usage: node scripts/audit-codex-product-cycle-evaluation.mjs --run-id <run>'); process.exit(2); }
const runtime = path.join(root, '.ai-company', 'runtime', 'projects', projectId);
const readJsonl = async (file) => { try { return (await readFile(file, 'utf8')).split('\n').filter(Boolean).map((line) => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean); } catch { return []; } };
const latest = new Map();
for (const row of await readJsonl(path.join(runtime, 'role-work-queue.jsonl'))) if (row.run_id === runId || row.assignment?.run_id === runId) latest.set(row.work_id, row);
const dispatch = (await readJsonl(path.join(runtime, 'role-dispatch-evidence.jsonl'))).filter((row) => row.run_id === runId);
const usage = (await readJsonl(path.join(runtime, 'ai-usage-events.jsonl'))).filter((row) => row.run_id === runId);
const providerUsage = (await readJsonl(path.join(runtime, 'provider-telemetry.jsonl'))).filter((row) => row.run_id === runId);
const security = (await readJsonl(path.join(runtime, 'security-violation-events.jsonl'))).filter((row) => row.run_id === runId);
const records = [...latest.values()];
const done = records.filter((row) => row.state === 'DONE');
const reviewRows = records.filter((row) => row.review_verdict || ['functional-qa', 'quality-control', 'critic', 'security', 'release-security-gate'].includes(row.role));
const nonPassingReviews = reviewRows.filter((row) => row.review_verdict && row.review_verdict.verdict !== 'PASS');
const hasActualTokens = (row) => row?.total_tokens_actual !== null && row?.total_tokens_actual !== undefined && Number.isFinite(Number(row.total_tokens_actual));
const evidenceIds = [...new Set(done.flatMap((row) => [...(row.evidence_ids ?? []), ...(row.structured_output?.evidence_ids ?? []), ...(row.review_verdict?.evidence ?? [])]))];
const changedFiles = [...new Set(records.flatMap((row) => row.structured_output?.files_changed ?? []))];
const isCodeChange = records.some((r) => r.assignment?.task_type === 'code-change' || r.assignment?.task_type === 'bug-fix' || ['coder', 'backend-engineer', 'frontend-engineer'].includes(r.role));
const sourceMutationFiles = changedFiles.filter((file) => !file.startsWith('.ai-company/reports/role-output-') && !file.startsWith('.ai-company/reports/dependencies/'));
const hasMutation = sourceMutationFiles.length > 0;
const validCyclePass = records.every((row) => row.state === 'DONE') && nonPassingReviews.length === 0 && done.some((row) => row.review_verdict?.verdict === 'PASS');
const truthfulWin = validCyclePass && (!isCodeChange || hasMutation);

const isTestOnly = changedFiles.length > 0 && changedFiles.every((f) => f.includes('.test.') || f.includes('scripts/') || f.includes('config/routeAcceptance.'));
const isUiConnected = changedFiles.some((f) => f.startsWith('src/app/pages/') || f.startsWith('src/app/components/'));
const isDataModelOnly = changedFiles.some((f) => f.startsWith('src/app/data/') || f.startsWith('server/')) && !isUiConnected && !isTestOnly;
const hasCurrentBrowserEvidence = async () => {
  const cleanId = runId.replace(/^codex-product-cycle-/, '');
  const candidates = [
    path.join(root, '.ai-company', 'reports', `INDEPENDENT_BROWSER_EVIDENCE_WORKSPACE_SYNTHESIS_CYCLE_${cleanId}.md`),
    path.join(root, '.ai-company', 'reports', `INDEPENDENT_BROWSER_EVIDENCE_WATCHLIST_CYCLE_${cleanId}.md`),
    path.join(root, '.ai-company', 'reports', `INDEPENDENT_BROWSER_EVIDENCE_WATCHLIST_CYCLE_${runId}.md`),
    path.join(root, '.ai-company', 'reports', `INDEPENDENT_BROWSER_EVIDENCE_DISCLAIMER_BANNER_CYCLE_${cleanId}.md`),
    path.join(root, '.ai-company', 'reports', `INDEPENDENT_BROWSER_EVIDENCE_DISCLAIMER_BANNER_CYCLE_${runId}.md`),
    path.join(root, '.ai-company', 'reports', `INDEPENDENT_BROWSER_EVIDENCE_CYCLE_${cleanId}.md`),
    path.join(root, '.ai-company', 'reports', `INDEPENDENT_BROWSER_EVIDENCE_${runId}.md`),
  ];
  for (const candidate of candidates) { try { await access(candidate); return true; } catch { /* continue */ } }
  return false;
};
const browserEvidence = (await hasCurrentBrowserEvidence()) || records.flatMap((row) => [
  ...(row.structured_output?.evidence_ids ?? []),
  ...(row.review_verdict?.evidence ?? []),
]).some((entry) => /browser|visual|usability|route/i.test(String(entry)) && !/not present|missing|unavailable|no visual/i.test(String(entry)));

const providerActualTokens = providerUsage.reduce((sum, row) => {
  const input = Number(row.input_tokens);
  const output = Number(row.output_tokens);
  return sum + (Number.isFinite(input) ? input : 0) + (Number.isFinite(output) ? output : 0);
}, 0);
const providerEstimatedTokens = usage.reduce((sum, row) => {
  const estimate = Number(row.total_tokens_estimated);
  return sum + (Number.isFinite(estimate) ? estimate : 0);
}, 0);
const tokenEfficiencyRatio = providerEstimatedTokens > 0 ? Math.round((providerActualTokens / providerEstimatedTokens) * 100) / 100 : null;
const tokenEfficiencyStatus = tokenEfficiencyRatio != null && tokenEfficiencyRatio > 10 ? 'ALERT_ACTUAL_OVER_ESTIMATE' : 'WITHIN_EXPECTED_RANGE';

let productOutcome = 'UNVERIFIED';
let cycleValue = 'NO_CHANGE_NO_PRODUCT_OUTCOME';
let disposition = 'REVISE';

if (!validCyclePass) {
  if (nonPassingReviews.some((r) => r.verdict === 'QUALITY_FAIL' || r.review_verdict?.verdict === 'QUALITY_FAIL')) {
    productOutcome = 'LOSS';
    cycleValue = 'LOSS';
    disposition = 'REVERT';
  } else {
    productOutcome = 'BLOCKED_OR_REVISE';
    cycleValue = 'NO_CHANGE_NO_PRODUCT_OUTCOME';
    disposition = 'REVISE';
  }
} else if (!hasMutation) {
  productOutcome = 'ZERO_MUTATION_UNVERIFIED';
  cycleValue = 'NO_CHANGE_ZERO_MUTATION';
  disposition = 'REVISE';
} else if (isTestOnly) {
  productOutcome = 'ENGINEERING_VERIFIED_PRODUCT_VALUE_UNPROVEN';
  cycleValue = 'ENGINEERING_VERIFIED_PRODUCT_VALUE_UNPROVEN';
  disposition = 'KEEP';
} else if (isDataModelOnly) {
  // If data logic is created/extended but not yet exposed in user-facing UI views
  productOutcome = 'WIN_BOUNDED';
  cycleValue = 'WIN_BOUNDED';
  disposition = 'KEEP';
} else if (isUiConnected) {
  // A UI diff plus tests is not sufficient for a strong product claim.
  // Require current-cycle browser evidence for the exact changed surface.
  productOutcome = browserEvidence ? 'WIN_STRONG' : 'ENGINEERING_VERIFIED_PRODUCT_VALUE_UNPROVEN';
  cycleValue = productOutcome;
  disposition = 'KEEP';
} else {
  productOutcome = 'WIN_BOUNDED';
  cycleValue = 'WIN_BOUNDED';
  disposition = 'KEEP';
}

const report = {
  generated_at: new Date().toISOString(), run_id: runId, project_id: projectId,
  objective: records[0]?.assignment?.objective ?? records[0]?.title ?? null,
  product_goal_alignment: records[0]?.assignment?.product_goal_alignment ?? [],
  workflow: records[0]?.workflow_id ?? null,
  roles_invoked: records.map((row) => row.role),
  terminal_state: records.every((row) => row.state === 'DONE') && nonPassingReviews.length === 0 ? 'DONE' : 'CYCLE_BLOCKED',
  work_items: records.length, done_items: done.length,
  files_changed: changedFiles,
  has_mutation: hasMutation,
  evidence: { dispatch_records: dispatch.length, resolved_ids: evidenceIds.length, ids: evidenceIds },
  review: { pass_count: done.filter((row) => row.review_verdict?.verdict === 'PASS').length, non_passing: nonPassingReviews.map((row) => ({ work_id: row.work_id, verdict: row.review_verdict.verdict, failure_class: row.review_verdict.failure_class ?? 'UNSPECIFIED' })), missing_contracts: done.filter((row) => !row.review_verdict && ['functional-qa', 'quality-control', 'critic', 'security'].includes(row.role)).map((row) => row.work_id) },
  token_usage: {
    records: usage.length,
    provider_records: providerUsage.length,
    total_tokens_actual: usage.some(hasActualTokens) ? usage.reduce((sum, row) => sum + (hasActualTokens(row) ? Number(row.total_tokens_actual) : 0), 0) : null,
    total_tokens_estimated: usage.reduce((sum, row) => sum + (Number(row.total_tokens_estimated) || 0), 0),
    provenance: usage.some(hasActualTokens) ? 'PROVIDER_REPORTED_OR_RUNTIME_ACTUAL' : 'ESTIMATED_ONLY_ACTUAL_UNAVAILABLE',
    efficiency: {
      provider_actual_tokens: providerActualTokens || null,
      provider_estimated_tokens: providerEstimatedTokens || null,
      actual_to_estimated_ratio: tokenEfficiencyRatio,
      status: tokenEfficiencyStatus,
      interpretation: tokenEfficiencyStatus === 'ALERT_ACTUAL_OVER_ESTIMATE'
        ? 'Provider actual usage materially exceeds the dispatcher estimate; optimize context and tool-output capture before repeating this route.'
        : 'No material actual-versus-estimate divergence was observed in provider telemetry.'
    }
  },
  security: { contained_control_plane_mutations: security.length, production_mutations: null, production_mutation_provenance: 'NOT_OBSERVABLE_FROM_LOCAL_CYCLE_LEDGER' },
  human_interventions: { value: null, provenance: 'NOT_INSTRUMENTED_IN_CYCLE_LEDGER' },
  opportunity_id: records[0]?.assignment?.objective_id ?? records[0]?.assignment?.opportunity_id ?? null,
  disposition,
  product_outcome: productOutcome,
  cycle_value: cycleValue,
  limitations: [
    'Production deployment remains human-gated.',
    productOutcome === 'WIN_STRONG'
      ? (browserEvidence
        ? 'User-visible surface has current-cycle browser evidence in addition to deterministic tests.'
        : 'UI behavior is verified by deterministic tests, but current-cycle browser evidence for the changed surface is absent.')
      : productOutcome === 'WIN_BOUNDED'
      ? 'Contract/data logic verified, but direct user-facing interaction flow remains bounded or un-wired.'
      : productOutcome === 'ENGINEERING_VERIFIED_PRODUCT_VALUE_UNPROVEN'
      ? 'Engineering test or metadata matrix verified, but zero user workflow change delivered.'
      : 'Local cycle validation completed with explicit review verification.'
  ],
};
const outDir = path.join(root, '.ai-company', 'reports', 'product-cycles');
await mkdir(outDir, { recursive: true });
const out = path.join(outDir, `CYCLE_${runId}_EVALUATION.json`);
await writeFile(out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ status: report.terminal_state === 'DONE' ? 'PASS' : 'CYCLE_BLOCKED', report_path: out, work_items: records.length, done_items: done.length, evidence_count: evidenceIds.length, product_outcome: report.product_outcome }, null, 2));
if (report.terminal_state !== 'DONE') process.exit(1);
