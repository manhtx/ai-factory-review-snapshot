#!/usr/bin/env -S node --import tsx
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import {
  createProductObservation,
  discoverFrontierGapOpportunity,
  discoverOpportunities,
  selectOpportunity,
  parseProductGoal,
  evaluateSearchLenses,
  computeSemanticDiscoveryFingerprint,
  productQuestionFromUncertainty,
  opportunityCandidateFromUncertainty,
} from '../server/aiCompany/productIntelligence.ts';
import { ProductMemoryLedger } from '../server/aiCompany/productMemory.ts';
import { BacklogIntakeGateway, candidateFromProductOpportunity } from '../server/aiCompany/backlogIntake.ts';

const root = process.cwd();
const routesText = await readFile(`${root}/src/app/config/routeAcceptance.ts`, 'utf8');
const routes = [...routesText.matchAll(/\["([^\"]+)", "([^\"]+)"/g)].map((m) => [m[1], m[2]]);
const revision = (await import('node:child_process')).execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();
const evidence = ['src/app/config/routeAcceptance.ts', 'docs/PRODUCT_GOAL.md'];
if (routes.some(([route]) => route.startsWith('/indicators'))) evidence.push('OBS-ROUTE-INDICATOR-DETAIL', 'PRODUCT_GOAL-TRUST', 'FRESHNESS-CONTRACT');
if (routes.some(([route]) => route === '/')) evidence.push('OBS-DASHBOARD', 'PRODUCT_GOAL-RESEARCH-USEFULNESS');
if (routes.some(([route]) => route === '/relationships')) evidence.push('OBS-ROUTE-RELATIONSHIPS', 'PRODUCT_GOAL-COMOVEMENT');
if (routes.some(([route]) => route === '/countries')) evidence.push('OBS-ROUTE-COUNTRIES', 'PRODUCT_GOAL-CROSS-COUNTRY');
if (routes.some(([route]) => route === '/data-sources')) evidence.push('OBS-ROUTE-DATA-SOURCES', 'PRODUCT_GOAL-DATA-HEALTH');
if (routes.some(([route]) => route === '/regimes')) evidence.push('OBS-ROUTE-REGIMES', 'PRODUCT_GOAL-MACRO-REGIME');
if (routes.some(([route]) => route === '/scenarios')) evidence.push('OBS-ROUTE-SCENARIOS', 'PRODUCT_GOAL-STRESS-TEST');
if (routes.some(([route]) => route === '/similarity')) evidence.push('OBS-ROUTE-SIMILARITY', 'PRODUCT_GOAL-HISTORICAL-SIMILARITY');
if (routes.some(([route]) => route === '/cycles')) evidence.push('OBS-ROUTE-CYCLES', 'PRODUCT_GOAL-CYCLE-DETECTION');
if (routes.some(([route]) => route === '/scorecards')) evidence.push('OBS-ROUTE-SCORECARDS', 'PRODUCT_GOAL-FACTOR-ATTRIBUTION');
if (routes.some(([route]) => route === '/forecasts')) evidence.push('OBS-ROUTE-FORECASTS', 'PRODUCT_GOAL-FORECAST-TRUST');
if (routes.some(([route]) => route === '/monitoring')) evidence.push('OBS-ROUTE-MONITORING', 'PRODUCT_GOAL-LIQUIDITY-CASCADE');
if (routes.some(([route]) => route === '/briefing')) evidence.push('OBS-ROUTE-BRIEFING', 'PRODUCT_GOAL-DAILY-BRIEFING');
if (routes.some(([route]) => route === '/fed-intelligence')) evidence.push('OBS-ROUTE-FED', 'PRODUCT_GOAL-CENTRAL-BANK');
if (routes.some(([route]) => route === '/watchlist')) evidence.push('OBS-ROUTE-WATCHLIST', 'PRODUCT_GOAL-WATCHLIST');
if (routes.some(([route]) => route === '/workspaces')) evidence.push('OBS-ROUTE-WORKSPACES', 'PRODUCT_GOAL-WORKSPACES');
if (routes.some(([route]) => route === '/copilot')) evidence.push('OBS-ROUTE-COPILOT', 'PRODUCT_GOAL-COPILOT');
if (routes.some(([route]) => route === '/mvp-readiness')) evidence.push('OBS-ROUTE-MVP', 'PRODUCT_GOAL-MVP');
if (routes.some(([route]) => route === '/openbb-reviews')) evidence.push('OBS-ROUTE-OPENBB', 'PRODUCT_GOAL-OPENBB');

const failures = [];
let runtimeHealth = null;
try {
  const response = await fetch('http://localhost:5173/api/series/core-pce-us?limit=2000');
  if (response.ok) {
    const payload = await response.json();
    const dates = (payload.series ?? []).map((point) => point.date);
    if (new Set(dates).size !== dates.length) {
      failures.push('core-pce-us contains duplicate observation periods in the runtime payload');
      evidence.push('RUNTIME-SERIES-DUPLICATES');
    }
  }
} catch { /* runtime observation is optional */ }
try {
  const response = await fetch('http://127.0.0.1:8787/api/health');
  if (response.ok) {
    runtimeHealth = await response.json();
    if (Number(runtimeHealth.scheduler?.intervalMinutes) >= 360) evidence.push('RUNTIME-SCHEDULER-6H');
  }
} catch { /* backend health remains optional */ }

const memory = new ProductMemoryLedger(root);
const priorLearnings = (await memory.retrieveLearnings('macro product')).map((learning) => learning.id);
const observation = createProductObservation({ revision, routes, evidence, failures, priorLearnings });

const completedOpportunityIds = [];
try {
  const canonicalPath = `${root}/.ai-company/product-intelligence/CANONICAL_PRODUCT_BACKLOG.json`;
  const canonical = JSON.parse(await readFile(canonicalPath, 'utf8'));
  for (const item of (canonical.items || [])) {
    if (item.status === 'DELIVERED') {
      const oppId = item.backlog_id.replace(/^BACKLOG-/, 'OPP-').replace(/^BACKLOG-PROVIDER-/, 'OPP-');
      completedOpportunityIds.push(oppId);
    }
  }
} catch { /* canonical backlog unreadable */ }

// Load authoritative Product Goal
let goalText = '';
try {
  goalText = await readFile(`${root}/docs/PRODUCT_GOAL.md`, 'utf8');
} catch {
  goalText = '';
}
const parsedGoal = parseProductGoal(goalText);

// Load Product Reality
let auditData = { auditStatus: 'normal', unhydratedIndicators: [], quarantinedProviders: [] };
try {
  const reportsDir = `${root}/.ai-company/reports`;
  const auditFiles = (await readdir(reportsDir)).filter((f) => f.startsWith('real-data-audit-') && f.endsWith('.json')).sort().reverse();
  if (auditFiles.length > 0) {
    const rawAudit = JSON.parse(await readFile(`${reportsDir}/${auditFiles[0]}`, 'utf8'));
    auditData = {
      auditStatus: rawAudit.auditStatus || 'normal',
      unhydratedIndicators: Array.isArray(rawAudit.unhydratedIndicators) ? rawAudit.unhydratedIndicators : [],
      quarantinedProviders: Array.isArray(rawAudit.quarantinedProviders) ? rawAudit.quarantinedProviders : [],
    };
  }
} catch { /* optional audit file */ }

// Check unconsumed analytics modules in HEAD
const analyticsFiles = [
  'server/analytics/breakevenAdjuster.ts',
  'server/analytics/fxFixingBuffer.ts',
  'server/analytics/vietnamCreditRegime.ts',
];
const unconsumedModules = [];
try {
  const serverIndex = await readFile(`${root}/server/index.ts`, 'utf8');
  for (const file of analyticsFiles) {
    const modName = file.split('/').pop()?.replace('.ts', '') || '';
    if (!serverIndex.includes(modName)) {
      unconsumedModules.push(file);
    }
  }
} catch { /* ignore */ }

// Load existing hold contracts & golden journeys
let activeHoldContracts = [];
try {
  const inventory = JSON.parse(await readFile(`${root}/.ai-company/product-intelligence/QUALIFIED_WORK_INVENTORY.json`, 'utf8'));
  activeHoldContracts = (inventory.items || [])
    .filter((i) => i.hold_contract)
    .map((i) => ({
      id: i.id,
      hold_reason: i.hold_contract.hold_reason,
      permitted_next_action: i.hold_contract.permitted_next_action,
      evidence_gap: i.hold_contract.evidence_gap,
    }));
} catch { /* optional */ }

let goldenJourneys = [];
try {
  const frontier = JSON.parse(await readFile(`${root}/docs/product/PRODUCT_FRONTIER.json`, 'utf8'));
  goldenJourneys = Array.isArray(frontier.golden_journeys) ? frontier.golden_journeys : [];
} catch { /* optional */ }

const intake = new BacklogIntakeGateway(`${root}/.ai-company/runtime/projects/macro-os`);
const existingCandidates = await intake.candidates('macro-os');
const existingOpportunityIds = existingCandidates.map((candidate) => String(candidate.source_id || '').replace(/^opportunity:/, ''));

const portfolioPath = `${root}/.ai-company/product-intelligence/RESEARCH_PORTFOLIO.json`;
let portfolio = { questions: [] };
try {
  portfolio = JSON.parse(await readFile(portfolioPath, 'utf8'));
} catch { /* fallback */ }

let runway = { qualified_depth: 0, runway_state: 'STARVATION_RISK', replenishment_recommended: true };
try {
  runway = JSON.parse(await readFile(`${root}/.ai-company/product-intelligence/QUALIFIED_WORK_RUNWAY.json`, 'utf8'));
} catch { /* fallback */ }

let canonical = { items: [] };
try {
  canonical = JSON.parse(await readFile(`${root}/.ai-company/product-intelligence/CANONICAL_PRODUCT_BACKLOG.json`, 'utf8'));
} catch { /* fallback */ }

const deliveredBacklogIds = (canonical.items || []).filter((i) => i.status === 'DELIVERED').map((i) => i.backlog_id);

// Compute Semantic Discovery Fingerprint
const realitySummary = {
  unhydratedCount: auditData.unhydratedIndicators.length,
  unhydratedIds: auditData.unhydratedIndicators.sort(),
  quarantinedCount: auditData.quarantinedProviders.length,
  unconsumedCount: unconsumedModules.length,
  unconsumedModules: unconsumedModules.sort(),
  activeHoldCount: activeHoldContracts.length,
  routeCount: routes.length,
  auditStatus: auditData.auditStatus,
};
const realityHash = createHash('sha256').update(JSON.stringify(realitySummary)).digest('hex');

const currentFingerprint = computeSemanticDiscoveryFingerprint({
  goalText,
  realityHash,
  questionIds: (portfolio.questions || []).map((q) => `${q.id}:${q.status}`),
  candidateIds: existingOpportunityIds,
  runwayState: runway.runway_state,
  deliveredIds: deliveredBacklogIds,
});

const fingerprintPath = `${root}/.ai-company/product-intelligence/discovery-fingerprint.json`;
let persistedFingerprint = '';
try {
  const fpObj = JSON.parse(await readFile(fingerprintPath, 'utf8'));
  persistedFingerprint = fpObj.fingerprint || '';
} catch { /* first pass */ }

// Section 15: Unchanged semantic fingerprint -> 0 discovery model calls
if (
  persistedFingerprint === currentFingerprint &&
  !runway.replenishment_recommended &&
  process.env.FORCE_DISCOVERY !== 'true'
) {
  const frontierInbox = existingCandidates
    .filter((candidate) => String(candidate.source_id || '').startsWith('opportunity:OPP-'))
    .map((candidate) => ({ source_id: candidate.source_id, status: candidate.status, evidence_quality: candidate.evidence_quality }));
  console.log(JSON.stringify({
    status: 'PASS',
    action: 'UNCHANGED_FINGERPRINT_ZERO_COGNITION',
    fingerprint: currentFingerprint,
    routes: routes.length,
    candidates: 0,
    frontier_inbox: frontierInbox.length,
    recommended_opportunity: null,
    selected_opportunity: null,
    model_calls: 0,
    reason: 'Unchanged semantic fingerprint and healthy runway; zero discovery model calls made.',
  }, null, 2));
  process.exit(0);
}

// Perform Discovery
let candidates = discoverOpportunities(observation, [...new Set(completedOpportunityIds)]);
for (const candidate of candidates) await intake.submit(candidateFromProductOpportunity(candidate));

// Regenerative Discovery Search Lenses (Section 8)
const allExistingIds = new Set([
  ...existingOpportunityIds,
  ...completedOpportunityIds,
  ...(portfolio.questions || []).map((q) => q.id),
  ...(portfolio.questions || []).map((q) => `OPP-${q.id.replace(/^RQ-/, '')}`),
]);

const realitySpec = {
  revision,
  catalogIndicatorCount: 133,
  hydratedIndicatorCount: 133 - auditData.unhydratedIndicators.length,
  unhydratedIndicatorIds: auditData.unhydratedIndicators,
  quarantinedSourceCount: auditData.quarantinedProviders.length,
  quarantinedSourceIds: auditData.quarantinedProviders.map((p) => p.id || String(p)),
  unconsumedModules,
  activeHoldContracts,
  goldenJourneys,
  routeCount: routes.length,
  auditStatus: auditData.auditStatus,
  telemetryRowCount: 521,
};

const uncertainties = evaluateSearchLenses({
  goal: parsedGoal,
  reality: realitySpec,
  existingIds: allExistingIds,
  existingQuestions: portfolio.questions || [],
});

let newQuestionCount = 0;
if (uncertainties.length > 0) {
  // Select top decision-relevant uncertainty
  const topUncertainty = uncertainties[0];
  const newQuestion = productQuestionFromUncertainty(topUncertainty, revision);
  const newCandidate = opportunityCandidateFromUncertainty(topUncertainty, revision);

  // Update research portfolio
  const updatedQuestions = [...(portfolio.questions || []), newQuestion];
  portfolio.questions = updatedQuestions;
  portfolio.updated_at = new Date().toISOString();
  await writeFile(portfolioPath, JSON.stringify(portfolio, null, 2) + '\n', 'utf8');

  // Submit to backlog intake
  await intake.submit(candidateFromProductOpportunity(newCandidate));
  candidates.push(newCandidate);
  newQuestionCount += 1;
}

// Also check legacy Product Frontier identified gaps
try {
  const frontier = JSON.parse(await readFile(`${root}/docs/product/PRODUCT_FRONTIER.json`, 'utf8'));
  const rank = { P0: 0, P1: 1, P2: 2, P3: 3 };
  const gaps = Array.isArray(frontier.identified_gaps) ? [...frontier.identified_gaps].sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9) || String(a.gap_id).localeCompare(String(b.gap_id))) : [];
  const frontierCandidate = gaps.map((gap) => discoverFrontierGapOpportunity({ gap: { ...gap, candidate_opportunity: gap.candidate_opportunity }, observation, existingIds: [...allExistingIds] })).find(Boolean);
  if (frontierCandidate) {
    await intake.submit(candidateFromProductOpportunity(frontierCandidate));
    candidates = [...candidates, frontierCandidate];
  }
} catch { /* ignore */ }

// Save updated fingerprint
await writeFile(
  fingerprintPath,
  JSON.stringify({
    fingerprint: currentFingerprint,
    updated_at: new Date().toISOString(),
    runway_state: runway.runway_state,
    new_questions: newQuestionCount,
  }, null, 2) + '\n',
  'utf8'
);

const recommended = selectOpportunity(candidates);
const currentInbox = await intake.candidates('macro-os');
const frontierInbox = currentInbox
  .filter((candidate) => String(candidate.source_id || '').startsWith('opportunity:OPP-'))
  .map((candidate) => ({ source_id: candidate.source_id, status: candidate.status, evidence_quality: candidate.evidence_quality }));

const selected = null;
await writeFile(`${root}/.ai-company/product-intelligence/CURRENT_PRODUCT_OBSERVATION.json`, JSON.stringify(observation, null, 2));
const objective = selected ? { objective_id: `OBJECTIVE:${selected.opportunity_id}`, opportunity_id: selected.opportunity_id, intent: selected.suggested_work_intent, routing_class: selected.suggested_work_intent === 'BUG_FIX' ? 'R1' : 'R2', idea: selected.idea, user_problem: selected.user_problem, objective: selected.problem_statement, product_goal_alignment: selected.product_goal_objectives, priority: selected.priority, severity: selected.severity, expected_value: selected.expected_value, risk: selected.risk, uncertainty: selected.uncertainty, scope: selected.estimated_scope, allowed_paths: selected.allowed_paths, non_goals: selected.non_goals, dependencies: selected.dependencies, acceptance_criteria: selected.acceptance_criteria, pm_decision: selected.pm_decision } : null;
await writeFile(`${root}/.ai-company/product-intelligence/OPPORTUNITY_BACKLOG.json`, JSON.stringify({ generated_at: observation.timestamp, selection_origin: 'AI_COMPANY_PRODUCT_INTELLIGENCE', candidates, frontier_inbox: frontierInbox, recommended_opportunity: recommended, selected_opportunity: selected, generated_objective: objective, status: 'PM_INBOX_PENDING' }, null, 2));

console.log(JSON.stringify({
  status: 'PASS',
  routes: routes.length,
  candidates: candidates.length,
  frontier_inbox: frontierInbox.length,
  new_product_questions: newQuestionCount,
  recommended_opportunity: recommended?.opportunity_id ?? null,
  selected_opportunity: null,
  pm_gate: 'REQUIRED',
  selection_origin: 'AI_COMPANY_PRODUCT_INTELLIGENCE',
}, null, 2));
