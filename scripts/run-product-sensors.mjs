#!/usr/bin/env node
/**
 * Real Product Sensor Suite
 * Scans actual Macro OS surfaces and submits typed candidates to BacklogIntakeGateway.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { BacklogIntakeGateway, candidateFromObservation } from '../server/aiCompany/backlogIntake.ts';

const root = process.cwd();
const runtimeRoot = path.join(root, '.ai-company', 'runtime', 'projects', 'macro-os');
const gateway = new BacklogIntakeGateway(runtimeRoot);

console.log('=== RUNNING REAL PRODUCT SENSORS ===');

const observations = [];

// Sensor 1: Qualitative Evidence & Fed Statement Diff Grounding
try {
  const qualSource = await readFile(path.join(root, 'server', 'qualitativeEvidence.ts'), 'utf8');
  const hasStrictQuoteValidation = qualSource.includes('validateDiffQuotes') || qualSource.includes('exactQuoteRequired');
  if (!hasStrictQuoteValidation) {
    observations.push({
      project_id: 'macro-os',
      source_type: 'PRODUCT_DISCOVERY',
      source_id: 'sensor:qualitative-evidence-diff-quotes',
      created_by: 'sensor:evidence-integrity',
      observation: 'Fed intelligence and central bank statement comparisons allow qualitative sentiment scoring without verifying exact transcript quotes in statement diffs.',
      problem_signal: 'Central bank sentiment scoring can hallucinate hawkish or dovish shifts without verifiable statement diff citations.',
      affected_product_area: '/fed-intelligence',
      evidence_ids: ['OBS-ROUTE-FED', 'CODE:server/qualitativeEvidence.ts', 'PRODUCT_GOAL-CENTRAL-BANK'],
      evidence_quality: 'STRUCTURAL',
      severity_signal: 'HIGH',
      confidence_signal: 0.88,
      user_or_persona: 'Central Bank Watcher / Macro Strategist',
      suggested_opportunity: 'Enforce exact statement diff quotes and grounding confidence in qualitative evidence scoring.',
      suggested_solution: 'Implement strict quote validation and side-by-side statement diff checking in server/qualitativeEvidence.ts.'
    });
  }
} catch (err) {
  console.warn(`[SENSOR:QUALITATIVE] Warning: ${err.message}`);
}

// Sensor 2: Indicator Freshness Contract Coverage
try {
  const freshnessSource = await readFile(path.join(root, 'server', 'freshness.ts'), 'utf8');
  const dataSources = await readFile(path.join(root, 'src', 'app', 'config', 'dataSources.ts'), 'utf8');
  const registeredIndicators = [...dataSources.matchAll(/"([a-z0-9-]+)":\s*\{/g)].map((m) => m[1]);
  const missingFreshness = registeredIndicators.filter((id) => !freshnessSource.includes(`"${id}"`));
  if (missingFreshness.length > 0) {
    observations.push({
      project_id: 'macro-os',
      source_type: 'DATA',
      source_id: 'sensor:freshness-contract-gap',
      created_by: 'sensor:freshness-auditor',
      observation: `${missingFreshness.length} registered indicators lack explicit freshness policies in server/freshness.ts (${missingFreshness.slice(0, 3).join(', ')}...).`,
      problem_signal: 'Indicators without explicit freshness policies default to fallback staleness windows and risk misrepresenting stale observations as current.',
      affected_product_area: '/indicators',
      evidence_ids: ['CODE:server/freshness.ts', 'CODE:src/app/config/dataSources.ts', 'PRODUCT_GOAL-TRUST'],
      evidence_quality: 'STRUCTURAL',
      severity_signal: 'MEDIUM',
      confidence_signal: 0.82,
      user_or_persona: 'Professional Analyst',
      suggested_opportunity: 'Add explicit publication lags and cadence contracts for all registered data sources.',
      suggested_solution: 'Define expected intervals and provider grace periods for all registered indicators in server/freshness.ts.'
    });
  }
} catch (err) {
  console.warn(`[SENSOR:FRESHNESS] Warning: ${err.message}`);
}

// Sensor 3: Route Acceptance & Test Contract Completeness
try {
  const routeAcceptance = await readFile(path.join(root, 'src', 'app', 'config', 'routeAcceptance.ts'), 'utf8');
  const declaredRoutes = [...routeAcceptance.matchAll(/\["(\/[^"]*)",\s*"([^"]+)"/g)].map((m) => m[1]);
  if (declaredRoutes.length < 35) {
    observations.push({
      project_id: 'macro-os',
      source_type: 'QA',
      source_id: 'sensor:route-matrix-coverage',
      created_by: 'sensor:route-auditor',
      observation: `Route acceptance contract covers only ${declaredRoutes.length} routes; comprehensive macro research journey requires >= 25 verified routes.`,
      problem_signal: 'Unchecked routes risk runtime navigation crashes and unverified layout states in mobile viewports.',
      affected_product_area: 'routing-matrix',
      evidence_ids: ['CODE:src/app/config/routeAcceptance.ts', 'PRODUCT_GOAL-RESEARCH-USEFULNESS'],
      evidence_quality: 'STRUCTURAL',
      severity_signal: 'LOW',
      confidence_signal: 0.75,
      user_or_persona: 'All Users',
      suggested_opportunity: 'Expand automated route matrix acceptance coverage.',
      suggested_solution: 'Audit missing page routes and incorporate them into routeAcceptance.ts.'
    });
  }
} catch (err) {
  console.warn(`[SENSOR:ROUTES] Warning: ${err.message}`);
}

console.log(`[SENSORS] Captured ${observations.length} candidate observations from real surfaces.`);

let submittedCount = 0;
let duplicateCount = 0;
for (const obs of observations) {
  const candidateInput = candidateFromObservation(obs);
  const result = await gateway.submit(candidateInput);
  if (result.created) {
    console.log(`[INTAKE:NEW] Submitted candidate ${result.candidate.candidate_id} from ${obs.source_id}`);
    submittedCount += 1;
  } else {
    console.log(`[INTAKE:EXISTS] Candidate exists: ${result.candidate.candidate_id}`);
    duplicateCount += 1;
  }
}

const allCandidates = await gateway.candidates('macro-os');
console.log(`[INTAKE:SUMMARY] Total candidates in PM inbox: ${allCandidates.length} (New: ${submittedCount}, Existing: ${duplicateCount})`);
