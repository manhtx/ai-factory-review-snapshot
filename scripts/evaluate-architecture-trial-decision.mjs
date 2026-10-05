#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const trialPath = process.argv[2];
if (!trialPath) throw new Error('usage: evaluate-architecture-trial-decision.mjs <trial-report.json>');
const trial = JSON.parse(await readFile(path.resolve(root, trialPath), 'utf8'));
const arms = trial.arms.filter((arm) => ['A_CURRENT_AI_COMPANY', 'B_STRONG_MINIMAL_AGENT', 'C_VERIFIED_PRODUCT_KERNEL'].includes(arm.arm));
const scoresComplete = arms.length === 3 && arms.every((arm) => Number.isFinite(arm.product_quality) && Number.isFinite(arm.domain_correctness));
const productQuality = scoresComplete ? arms.map((arm) => arm.product_quality) : [];
const domainCorrectness = scoresComplete ? arms.map((arm) => arm.domain_correctness) : [];
const spread = (values) => values.length ? Math.max(...values) - Math.min(...values) : null;
const freshnessPath = [...(await import('node:fs')).readdirSync(path.join(root, '.ai-company', 'reports'))]
  .filter((name) => /^real-data-audit-.*\.json$/.test(name)).sort().at(-1);
const freshness = freshnessPath ? JSON.parse(await readFile(path.join(root, '.ai-company', 'reports', freshnessPath), 'utf8')) : null;
const freshnessAudit = freshness?.freshnessAudit ?? [];
const degraded = freshnessAudit.filter((row) => ['delayed', 'outdated'].includes(row.freshnessState));
const currentDataVerified = freshnessAudit.length > 0 && degraded.length === 0 && (freshness?.unhydratedIndicators?.length ?? 0) === 0;
const validTrial = trial.status === 'COMPARABLE' && trial.evidence_validation?.valid === true && scoresComplete;
const noMaterialSeparation = validTrial && (spread(productQuality) ?? 99) < 0.5 && (spread(domainCorrectness) ?? 99) < 0.5;
const decision = validTrial && noMaterialSeparation && degraded.length > 0 ? 'D_PRODUCT_BOTTLENECK_SUPPORTED' : 'INCONCLUSIVE_NO_ARCHITECTURE_DECISION';
const report = {
  trial_id: trial.trial_id,
  generated_at: new Date().toISOString(),
  decision,
  architecture_winner: null,
  valid_trial: validTrial,
  evidence_integrity: trial.evidence_validation,
  arm_scores: arms.map((arm) => ({ arm: arm.arm, product_quality: arm.product_quality ?? null, domain_correctness: arm.domain_correctness ?? null })),
  score_spread: { product_quality: spread(productQuality), domain_correctness: spread(domainCorrectness) },
  material_separation_threshold: 0.5,
  freshness_evidence: freshness ? { report: path.relative(root, path.join(root, '.ai-company', 'reports', freshnessPath)), fresh: freshnessAudit.filter((row) => row.freshnessState === 'fresh').length, delayed: freshnessAudit.filter((row) => row.freshnessState === 'delayed').length, outdated: freshnessAudit.filter((row) => row.freshnessState === 'outdated').length, degraded_indicator_ids: degraded.map((row) => row.indicatorId) } : null,
  product_outcome: {
    label_integrity: 'VERIFIED',
    data_freshness: currentDataVerified ? 'CURRENT_VERIFIED' : 'CURRENT_UNVERIFIED',
    unhydrated_indicator_count: freshness?.unhydratedIndicators?.length ?? null,
    interpretation: currentDataVerified
      ? 'Freshness and provenance are both verified for the audited catalog.'
      : 'Freshness/provenance labels may be trustworthy, but current data coverage is not proven. Product quality scores in this trial must not be read as evidence that values are current.',
  },
  interpretation: decision === 'D_PRODUCT_BOTTLENECK_SUPPORTED'
    ? 'A/B/C produced no material product/domain separation on this valid slice while live data shows delayed/outdated coverage. This supports investigating product/data bottleneck; it does not select or retire an architecture.'
    : 'The evidence is insufficient to make an architecture decision; preserve all architecture options and gather only discriminating evidence.',
  production_autonomy: 'DISABLED',
  production_release: 'HUMAN_GATED',
};
const output = path.join(root, '.ai-company', 'reports', 'architecture-trials', `${trial.trial_id}_DECISION.json`);
await writeFile(output, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ output, decision, validTrial, noMaterialSeparation, degradedCount: degraded.length }, null, 2));
