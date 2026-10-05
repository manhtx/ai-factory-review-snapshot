import path from 'node:path';
import { appendFile, mkdir, readFile } from 'node:fs/promises';

const root = process.cwd();
const runtime = path.join(root, '.ai-company', 'runtime', 'projects', 'macro-os');
const file = path.join(runtime, 'backlog-candidates.jsonl');

async function run() {
  await mkdir(runtime, { recursive: true });
  let existing = [];
  try {
    existing = (await readFile(file, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  const candidateId = 'CANDIDATE:macro-os:FOUNDER:ux-quality-debt';
  const duplicate = existing.find((row) => row.candidate_id === candidateId || (row.source_type === 'FOUNDER' && row.source_id === 'ux-quality-debt'));
  if (duplicate) {
    console.log('Candidate already exists:', duplicate.candidate_id);
    return;
  }

  const now = new Date().toISOString();
  const candidate = {
    candidate_id: candidateId,
    project_id: 'macro-os',
    source_type: 'FOUNDER',
    source_id: 'ux-quality-debt',
    created_by: 'founder',
    created_at: now,
    observation: 'Founder feedback: The platform runs repetitive cycles without delivering visible, cohesive UI/UX and workflow improvements.',
    problem_signal: 'Product feels empty and disconnected; backend data models and route acceptance tests do not surface in cohesive user research workflows.',
    affected_product_area: '/watchlist',
    evidence_ids: ['OBS-FOUNDER-UX-CONCERN', 'REPORT:MACRO_OS_UX_PRODUCT_BASELINE_M2.md'],
    evidence_quality: 'SUFFICIENT',
    severity_signal: 'HIGH',
    confidence_signal: 0.95,
    user_or_persona: 'Macro Research Platform Founder & Senior Researchers',
    suggested_opportunity: 'Connect Watchlist alert rules and notification drawer into the live Watchlist UI.',
    suggested_solution: 'Implement interactive alert threshold rule manager in WatchlistPage.tsx using evaluateWatchlistAlerts.',
    related_backlog_ids: ['OPP-WATCHLIST-THRESHOLD-ALERT'],
    provenance: {
      source_type: 'FOUNDER',
      source_id: 'ux-quality-debt',
      created_by: 'founder',
      captured_at: now
    },
    status: 'PM_INBOX'
  };

  await appendFile(file, `${JSON.stringify(candidate)}\n`, 'utf8');
  console.log('Successfully submitted founder candidate to PM inbox:', candidate.candidate_id);
}

run();
