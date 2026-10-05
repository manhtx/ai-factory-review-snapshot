#!/usr/bin/env -S node --import tsx
/**
 * PM Backlog Grooming and Sprint Alignment Script
 * Grooms candidates from BacklogIntakeGateway into canonical ProductBacklogItems,
 * verifies Definition of Ready. Sprint selection is a separate explicit
 * planning action and must not silently commit every promoted item.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { BacklogIntakeGateway } from '../server/aiCompany/backlogIntake.ts';
import { applyGroomingDecision } from '../server/aiCompany/backlogGrooming.ts';
import { SprintLedger } from '../server/aiCompany/sprintLedger.ts';
import { definitionOfReady } from '../server/aiCompany/productBacklog.ts';

const root = process.cwd();
const runtimeRoot = path.join(root, '.ai-company', 'runtime', 'projects', 'macro-os');
const gateway = new BacklogIntakeGateway(runtimeRoot);
const sprintLedger = new SprintLedger(runtimeRoot);
const backlogDir = path.join(root, '.ai-company', 'product-intelligence');
const canonicalBacklogPath = path.join(backlogDir, 'CANONICAL_PRODUCT_BACKLOG.json');
let priorCanonical = { items: [], active_sprint_id: null, sprint_status: 'NOT_SELECTED' };
try { priorCanonical = JSON.parse(await readFile(canonicalBacklogPath, 'utf8')); } catch { /* first grooming pass */ }

console.log('=== RUNNING PM BACKLOG GROOMING & SPRINT PLANNING ===');

const candidates = await gateway.candidates('macro-os');
const inbox = candidates.filter((c) => c.status === 'PM_INBOX');
console.log(`[PM GROOMING] Discovered ${inbox.length} candidates in PM inbox.`);

const groomedItems = [];
const promotedBacklogItems = [];

for (const candidate of inbox) {
  console.log(`[PM GROOMING] Grooming candidate: ${candidate.candidate_id}`);
  
  let backlogId = '';
  let group = 'PRODUCT';
  let allowedPaths = [];
  let acceptanceCriteria = [];
  let expectedValue = '';
  let expectedChange = '';
  let priority = 'P1';

  if (candidate.source_id.includes('qualitative-evidence')) {
    backlogId = 'BACKLOG-QUALITATIVE-DIFF-GROUNDING';
    group = 'TRUST_EVIDENCE';
    priority = 'P1';
    allowedPaths = ['server/qualitativeEvidence.ts', 'server/qualitativeEvidence.test.ts'];
    acceptanceCriteria = [
      'Central bank statement diff validation requires exact quote citations',
      'Sentiment scores are bounded and grounded in observable statement diffs',
      'Targeted tests verify quote mismatch and valid diff evaluation'
    ];
    expectedValue = 'Guarantees that qualitative Fed and central bank intelligence cannot hallucinate sentiment without statement citations.';
    expectedChange = 'Add validateDiffQuotes and grounding checks in server/qualitativeEvidence.ts.';
  } else if (candidate.source_id.includes('freshness-contract')) {
    backlogId = 'BACKLOG-INDICATOR-FRESHNESS-COVERAGE';
    group = 'DATA';
    priority = 'P2';
    allowedPaths = ['server/freshness.ts', 'server/freshness.test.ts'];
    acceptanceCriteria = [
      'Missing registered indicators have explicit publication lag and cadence definitions',
      'Fail-closed freshness status evaluates correctly for monthly/quarterly series',
      'Targeted tests in server/freshness.test.ts pass'
    ];
    expectedValue = 'Prevents stale data from appearing current by declaring explicit provider freshness cadence.';
    expectedChange = 'Add explicit indicator freshness rules in server/freshness.ts.';
  } else if (candidate.source_id.includes('OPP-PROVENANCE-REGRESSION-AUDIT')) {
    backlogId = 'BACKLOG-PROVENANCE-REGRESSION-AUDIT';
    group = 'TRUST_EVIDENCE';
    priority = 'P1';
    allowedPaths = ['src/app/pages/IndicatorDetailPage.tsx', 'server/freshness.ts', 'server/freshness.test.ts'];
    acceptanceCriteria = [
      'Indicator detail retains inspectable source and observation metadata',
      'Freshness and unavailable states remain fail-closed',
      'Targeted provenance and freshness regression tests pass'
    ];
    expectedValue = 'Prevents cross-epoch changes from silently weakening the Macro OS provenance and freshness trust boundary.';
    expectedChange = 'Run bounded indicator-detail provenance regression checks and modify only the declared paths if a defect is reproduced.';
  } else if (candidate.source_id.includes('OPP-SERIES-PERIOD-UNIQUENESS')) {
    backlogId = 'BACKLOG-SERIES-PERIOD-UNIQUENESS';
    group = 'TRUST_EVIDENCE';
    priority = 'P1';
    allowedPaths = ['server/index.ts', 'server/index.test.ts', 'server/observationReadContract.ts'];
    acceptanceCriteria = [
      'The runtime series payload contains at most one displayed observation per period',
      'Canonicalization preserves the provider-vintage ordering contract',
      'Trend and turning-point calculations consume the canonical series',
      'Regression coverage proves duplicate periods cannot reach the product payload',
    ];
    expectedValue = 'Prevents duplicate periods from distorting comparisons, volatility and turning-point summaries.';
    expectedChange = 'Add a bounded, non-destructive canonicalization boundary in the runtime series projection and regression coverage.';
  } else if (candidate.source_id.includes('OPP-INGESTION-CADENCE')) {
    backlogId = 'BACKLOG-PROVIDER-INGESTION-CADENCE';
    group = 'DATA';
    priority = 'P1';
    allowedPaths = ['server/scheduler.ts', 'server/scheduler.test.ts', 'server/adaptiveIngestionPoller.ts', 'server/adaptiveIngestionPoller.test.ts'];
    acceptanceCriteria = [
      'Cadence is derived from provider release frequency rather than one global polling assumption',
      'Daily sources are not delayed by slow-moving series',
      'Slow-moving sources do not incur unnecessary repeated calls',
      'Backoff, circuit-breaker and ingestion-job claims remain intact',
      'Tests cover cadence selection and bounded API-call behavior',
    ];
    expectedValue = 'Improves latest-available data delivery while reducing needless provider calls and quota pressure.';
    expectedChange = 'Define provider-specific cadence policy and verify it against scheduler and poller contracts before implementation.';
  } else if (candidate.source_type === 'PRODUCT_DISCOVERY' || String(candidate.source_id || '').startsWith('opportunity:OPP-')) {
    const rawId = String(candidate.source_id || '').replace(/^opportunity:OPP-/, '').replace(/^opportunity:/, '');
    backlogId = `BACKLOG-${rawId}`;
    group = candidate.affected_product_area?.includes('indicator') || candidate.affected_product_area?.includes('data')
      ? 'DATA'
      : (candidate.affected_product_area?.includes('analytics') ? 'ANALYTICS' : 'TRUST_EVIDENCE');
    priority = candidate.severity_signal === 'HIGH' ? 'P1' : 'P2';

    const sol = candidate.suggested_solution || '';
    if (sol.includes('Acceptance:') && sol.includes('Non-goals:')) {
      const match = sol.match(/Acceptance:\s*(.*?)\.\s*Non-goals:\s*(.*)/);
      if (match) {
        acceptanceCriteria = match[1].split(';').map((s) => s.trim()).filter(Boolean);
      }
    }
    if (!acceptanceCriteria.length) {
      acceptanceCriteria = [
        `Execute bounded evidence evaluation for ${rawId} fail-closed`,
        `Resolve PM uncertainty '${candidate.problem_signal}' with documented finding`,
      ];
    }

    expectedValue = candidate.problem_signal || 'Resolves uncertainty against Product Goal to enable evidence-grounded decision.';
    expectedChange = candidate.suggested_solution || `Investigate and resolve ${rawId} within bounded paths.`;

    if (Array.isArray(candidate.allowed_paths) && candidate.allowed_paths.length > 0) {
      allowedPaths = candidate.allowed_paths;
    } else if (candidate.affected_product_area?.includes('indicator') || candidate.affected_product_area?.includes('data')) {
      allowedPaths = ['server/ingestion.ts', '.ai-company/product-intelligence/RESEARCH_PORTFOLIO.json'];
    } else if (candidate.affected_product_area?.includes('analytics')) {
      allowedPaths = ['server/routes/analyticsRouter.ts', '.ai-company/product-intelligence/RESEARCH_PORTFOLIO.json'];
    } else {
      allowedPaths = ['.ai-company/product-intelligence/RESEARCH_PORTFOLIO.json'];
    }
  } else {
    console.warn(`[PM HOLD] Candidate ${candidate.candidate_id} has no explicit PM grooming rule; it remains in PM inbox.`);
    await gateway.update({ ...candidate, status: 'HOLD_FOR_EVIDENCE' });
    continue;
  }

  const backlogItem = {
    backlog_id: backlogId,
    title: candidate.observation,
    summary: candidate.problem_signal,
    problem_statement: candidate.problem_signal,
    opportunity: candidate.suggested_opportunity || candidate.observation,
    group: group,
    priority: priority,
    status: 'READY',
    source: candidate.source_type,
    created_by: 'pm-agent',
    created_at: new Date().toISOString(),
    evidence_ids: candidate.evidence_ids,
    evidence_quality: candidate.evidence_quality === 'STRUCTURAL' ? 'STRUCTURAL' : 'RUNTIME',
    user_or_persona: candidate.user_or_persona || 'Professional Analyst',
    user_need: 'Verifiable, evidence-backed macro data and intelligence without hallucinations or silent staleness.',
    expected_product_value: expectedValue,
    hypothesis: 'Strict grounding and explicit contracts prevent AI hallucinations and misleading freshness states.',
    expected_change: expectedChange,
    expected_outcome: 'Deterministic verification proves the defect is permanently prevented.',
    acceptance_criteria: acceptanceCriteria,
    risk_level: 'MEDIUM',
    dependencies: [],
    blocked_by: [],
    pm_review_status: 'APPROVED',
    pm_reviewed_by: 'pm',
    pm_reviewed_at: new Date().toISOString(),
    pm_decision_reason: 'Evidence is sufficient, aligned with Product Goal, and scope is bounded.',
    implementation_task_ids: [],
    evaluation_ids: [],
    learning_ids: [],
    updated_at: new Date().toISOString(),
    allowed_paths: allowedPaths
  };

  const readyResult = definitionOfReady(backlogItem);
  if (readyResult.status !== 'READY') {
    console.warn(`[DoR FAILED] Candidate ${candidate.candidate_id} not ready: ${readyResult.reasons.join(', ')}`);
    await gateway.update({ ...candidate, status: 'HOLD_FOR_EVIDENCE' });
    continue;
  }

  const { candidate: promotedCandidate, backlog_item: item } = applyGroomingDecision(
    candidate,
    {
      action: 'PROMOTE',
      candidate_id: candidate.candidate_id,
      decided_by: 'pm',
      reason: 'Definition of Ready satisfied; promoted to canonical product backlog.',
      product_backlog_item: backlogItem
    }
  );

  await gateway.update(promotedCandidate);

  groomedItems.push(promotedCandidate);
  if (item) promotedBacklogItems.push(item);
  console.log(`[PM PROMOTED] ${candidate.candidate_id} -> ${backlogId} (DoR: READY)`);
}

// Sprint Planning is deliberately opt-in. Grooming and commitment are two
// separate product decisions.
const sprintId = 'SPRINT:MARATHON-M0-S1';
let sprint = (await sprintLedger.list()).find((s) => s.sprint_id === sprintId);
const selectSprint = process.env.AI_COMPANY_SELECT_SPRINT === 'true';
if (selectSprint && !sprint) {
  sprint = await sprintLedger.create({
    sprint_id: sprintId,
    name: 'Marathon Epoch M0 Sprint 1',
    goal: 'Ground Qualitative Evidence Diff Quotes & Freshness Contracts',
    status: 'PLANNING',
    selected_backlog_ids: [],
    capacity_policy: {
      max_active_product_items: 5,
      token_budget: 100000,
      concurrency: 1
    },
    expected_outcomes: [
      'Eliminate hallucinated central bank sentiment without exact quote diff citations',
      'Verify bounded unit tests for qualitative evidence'
    ],
    actual_outcomes: [],
    learning_ids: []
  });
  console.log(`[SPRINT CREATED] ${sprintId} in PLANNING state.`);
}

if (selectSprint && sprint?.status === 'PLANNING') {
  const existingReady = (Array.isArray(priorCanonical.items) ? priorCanonical.items : [])
    .filter((item) => item.status === 'READY' && !promotedBacklogItems.some((promoted) => promoted.backlog_id === item.backlog_id));
  const planningItems = [...existingReady, ...promotedBacklogItems];
  if (planningItems.length > 0) {
    sprint = await sprintLedger.select(sprintId, planningItems);
    console.log(`[SPRINT COMMITTED] Committed ${planningItems.length} items to ACTIVE sprint ${sprintId}.`);
  }
}

await mkdir(backlogDir, { recursive: true });
const canonicalItems = [...(Array.isArray(priorCanonical.items) ? priorCanonical.items : [])];
for (const item of promotedBacklogItems) {
  const existingIndex = canonicalItems.findIndex((candidate) => candidate.backlog_id === item.backlog_id);
  if (existingIndex >= 0) canonicalItems[existingIndex] = item;
  else canonicalItems.push(item);
}
await writeFile(canonicalBacklogPath, JSON.stringify({
  updated_at: new Date().toISOString(),
  active_sprint_id: selectSprint ? sprint?.sprint_id ?? null : priorCanonical.active_sprint_id ?? null,
  sprint_status: selectSprint ? sprint?.status ?? 'NOT_SELECTED' : priorCanonical.sprint_status ?? 'NOT_SELECTED',
  items: canonicalItems
}, null, 2), 'utf8');

console.log(`[CANONICAL BACKLOG] Saved ${canonicalItems.length} canonical backlog items to ${canonicalBacklogPath}`);
if (!selectSprint) console.log('[SPRINT] No Sprint selection performed; use AI_COMPANY_SELECT_SPRINT=true only after a separate PM planning decision.');
