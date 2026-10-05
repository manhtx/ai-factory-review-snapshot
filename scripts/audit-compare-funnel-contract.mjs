#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const inputPath = process.env.AI_COMPANY_TELEMETRY_INPUT ?? path.join(root, '.ai-company', 'runtime', 'user-telemetry.jsonl');
const outputPath = process.env.AI_COMPANY_FUNNEL_OUTPUT ?? path.join(root, '.ai-company', 'reports', 'compare-funnel-contract-latest.json');
const lines = await readFile(inputPath, 'utf8').catch(() => '');
const events = lines.split('\n').filter(Boolean).flatMap((line) => {
  try { return [JSON.parse(line)]; } catch { return []; }
});
const relevant = events.filter((event) => ['indicator_compare', 'compare_explanation_opened', 'compare_follow_up_started'].includes(event.eventType));
const malformed = relevant.filter((event) => !event.sessionId || !event.timestamp || !event.metadata || typeof event.metadata !== 'object');
const compare = relevant.filter((event) => event.eventType === 'indicator_compare');
const explanation = relevant.filter((event) => event.eventType === 'compare_explanation_opened');
const followUp = relevant.filter((event) => event.eventType === 'compare_follow_up_started');
const eligibleCompare = compare.filter((event) => event.metadata?.comparison_id && event.metadata?.user_initiated === true && event.metadata?.compare_state === 'success');
const eligibleExplanation = explanation.filter((event) => event.metadata?.comparison_id && event.metadata?.user_initiated === true && event.metadata?.explanation_state === 'opened');
const eligibleKeys = new Set(eligibleCompare.map((event) => `${event.sessionId}\u0000${event.metadata.comparison_id}`));
const convertedKeys = new Set(eligibleExplanation.map((event) => `${event.sessionId}\u0000${event.metadata.comparison_id}`));
const eligibleFollowUp = followUp.filter((event) => event.metadata?.comparison_id && event.metadata?.user_initiated === true && event.metadata?.follow_up_state === 'provenance_open_requested');
const followUpKeys = new Set(eligibleFollowUp.map((event) => `${event.sessionId}\u0000${event.metadata.comparison_id}`));
const eligibilityDiagnostics = {
  compare_missing_id: compare.filter((event) => !event.metadata?.comparison_id).length,
  compare_not_user_initiated: compare.filter((event) => event.metadata?.comparison_id && event.metadata?.user_initiated !== true).length,
  compare_not_success: compare.filter((event) => event.metadata?.comparison_id && event.metadata?.user_initiated === true && event.metadata?.compare_state !== 'success').length,
  explanation_missing_id: explanation.filter((event) => !event.metadata?.comparison_id).length,
  explanation_not_opened: explanation.filter((event) => event.metadata?.comparison_id && event.metadata?.explanation_state !== 'opened').length,
  follow_up_missing_id: followUp.filter((event) => !event.metadata?.comparison_id).length,
  follow_up_not_requested: followUp.filter((event) => event.metadata?.comparison_id && event.metadata?.follow_up_state !== 'provenance_open_requested').length,
};
const numerator = [...convertedKeys].filter((key) => eligibleKeys.has(key)).length;
const denominator = eligibleKeys.size;
const report = {
  generated_at: new Date().toISOString(),
  source: inputPath,
  source_provenance: 'LOCAL_RUNTIME_UNATTESTED',
  metric_name: 'compare_to_explanation_open_rate',
  status: denominator > 0 ? 'LOCAL_DESCRIPTIVE_ONLY' : 'INSUFFICIENT_EVIDENCE',
  numerator,
  denominator,
  rate: denominator > 0 ? numerator / denominator : null,
  eligible_unique_sessions: new Set(eligibleCompare.map((event) => event.sessionId)).size,
  raw_relevant_events: relevant.length,
  raw_compare_events: compare.length,
  raw_explanation_events: explanation.length,
  raw_follow_up_events: followUp.length,
  eligible_follow_up_keys: followUpKeys.size,
  follow_up_after_explanation: [...followUpKeys].filter((key) => convertedKeys.has(key)).length,
  eligibility_diagnostics: eligibilityDiagnostics,
  missing_comparison_id: relevant.filter((event) => !event.metadata?.comparison_id).length,
  malformed_events: malformed.length,
  limitations: [
    'Local runtime telemetry is not production-attested and is not real-user evidence.',
    'Events without comparison_id are excluded rather than backfilled.',
    'No target or minimum sample gate is inferred from this report.',
  ],
};
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ outputPath: path.relative(root, outputPath), status: report.status, numerator, denominator, missing_comparison_id: report.missing_comparison_id }));
