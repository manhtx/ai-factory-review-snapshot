#!/usr/bin/env node
import fs from 'node:fs';

const [,, beforeEpochRaw, beforeScoreRaw, ledgerPath, statePath, scorecardPath, reportsDir = '.ai-company/reports'] = process.argv;
const beforeEpoch = Number(beforeEpochRaw);
const beforeScore = Number(beforeScoreRaw);
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const state = readJson(statePath);
const scorecard = readJson(scorecardPath);
const scopePolicy = readJson('.ai-company/scope-policy.json');
const lines = fs.readFileSync(ledgerPath, 'utf8').trim().split(/\n+/).filter(Boolean);
const ledger = lines.map((line) => JSON.parse(line));
const expectedEpoch = beforeEpoch + 1;
const record = ledger.find((item) => Number(item.epoch) === expectedEpoch);
const forbidden = new RegExp(scopePolicy.forbidden_terms.join('|'), 'i');
const problems = [];
if (!Number.isInteger(beforeEpoch) || !Number.isFinite(beforeScore)) problems.push('invalid pre-epoch snapshot');
if (process.env.ALLOW_HISTORICAL_REPLAY !== "true" && (Number(state.current_epoch) !== expectedEpoch || Number(state.last_completed_epoch) !== expectedEpoch)) problems.push(`state epoch must be ${expectedEpoch}`);
if (!record || record.status !== 'COMPANY_EPOCH_COMPLETE') problems.push(`ledger missing completed epoch ${expectedEpoch}`);
if (record && (scopePolicy.forbidden_initiative_ids.includes(record.id) || forbidden.test(record.charter ?? ''))) problems.push('charter is outside Macro OS Product Goal scope');
if (Number(scorecard.total_score_100) > beforeScore + 2) problems.push('score increased by more than 2 points without review gate');
if (expectedEpoch % 5 === 0) {
  const reviewPath = `${reportsDir}/process-review-epoch-${String(expectedEpoch).padStart(4, '0')}.md`;
  if (!fs.existsSync(reviewPath)) problems.push(`five-epoch process review missing: ${reviewPath}`);
}
if (expectedEpoch % 10 === 0) {
  const metaReviewPath = `${reportsDir}/meta-review-epoch-${String(expectedEpoch).padStart(4, '0')}.md`;
  if (!fs.existsSync(metaReviewPath)) problems.push(`ten-epoch controller meta-review missing: ${metaReviewPath}`);
}
if (problems.length) { console.error(`[EPOCH VALIDATION FAILED] ${problems.join('; ')}`); process.exit(1); }
console.log(`[EPOCH VALIDATED] epoch=${expectedEpoch} score=${scorecard.total_score_100}`);
