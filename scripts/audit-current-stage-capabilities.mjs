import { readFile } from 'node:fs/promises';

const scorecardPath = process.env.AI_COMPANY_SCORECARD ?? '.ai-company/scorecard.json';
const missionPath = process.env.AI_COMPANY_MISSION ?? '.ai-company/mission/AUTONOMY_100_STATE.json';
const reportPath = process.env.AI_COMPANY_CURRENT_STAGE_REPORT ?? '.ai-company/reports/AI_COMPANY_CURRENT_STAGE_AUDIT_2026-09-14.md';
const observabilityPath = process.env.AI_COMPANY_OBSERVABILITY_SNAPSHOT ?? '.ai-company/product-intelligence/observability-snapshot.json';
const scorecard = JSON.parse(await readFile(scorecardPath, 'utf8'));
const mission = JSON.parse(await readFile(missionPath, 'utf8'));
const report = await readFile(reportPath, 'utf8');
const observability = JSON.parse(await readFile(observabilityPath, 'utf8'));
const errors = [];
const requiredTokens = ['## Verdict', '## Current evidence', '## Capability matrix', '## Score deductions', '## Next safe action', 'CONTROL_PLANE_READY_LOCAL', 'PRODUCT_OUTCOME_UNVERIFIED', 'PRODUCTION_NO_GO'];
for (const token of requiredTokens) if (!report.includes(token)) errors.push(`current-stage report missing '${token}'`);
if (!report.includes(`**${scorecard.total_score_100}/100**`)) errors.push('report score does not match authoritative scorecard');
if (!report.includes(`Revision binding: \`${mission.current_revision}\``)) errors.push('report revision binding does not match mission state');
const eventCount = Number(observability.event_count);
const sessionCount = Number(observability.session_count);
if (!Number.isInteger(eventCount) || eventCount < 0 || !Number.isInteger(sessionCount) || sessionCount < 0) errors.push('observability snapshot counts are invalid');
if (Number.isInteger(eventCount) && !new RegExp(`\\b${eventCount.toLocaleString('en-US').replace(',', ',?')} telemetry events`).test(report)) errors.push('report telemetry event count does not match observability snapshot');
if (Number.isInteger(sessionCount) && !report.includes(`${sessionCount} sessions`)) errors.push('report telemetry session count does not match observability snapshot');
if (mission.production_autonomy !== 'DISABLED') errors.push('production autonomy must remain DISABLED');
if (mission.production_release !== 'HUMAN_GATED') errors.push('production release must remain HUMAN_GATED');
if (errors.length) { console.error(JSON.stringify({ status: 'FAIL', reportPath, errors }, null, 2)); process.exit(1); }
console.log(JSON.stringify({ status: 'PASS', reportPath, score: scorecard.total_score_100, revision: mission.current_revision, production_autonomy: mission.production_autonomy, production_release: mission.production_release }, null, 2));
