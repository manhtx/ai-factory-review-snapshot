import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';

const root = process.cwd();
const canonicalPath = path.join(root, '.ai-company', 'product-intelligence', 'CANONICAL_PRODUCT_BACKLOG.json');
const currentSprintPath = path.join(root, 'AI Company', 'CURRENT_SPRINT.md');
const productBacklogMdPath = path.join(root, 'AI Company', 'PRODUCT_BACKLOG.md');

async function run() {
  const canonical = JSON.parse(await readFile(canonicalPath, 'utf8'));

  const newItem = {
    backlog_id: 'OPP-WATCHLIST-UI-ALERT-CONTROLS',
    title: 'Connect Watchlist Alert Thresholds, Trigger Evaluation, and Notification Drawer to UI',
    summary: 'Allow users to configure custom upper/lower thresholds and see live alert status badges directly on /watchlist.',
    problem_statement: 'The watchlist alert engine exists in code but users cannot set thresholds or see alert events in the UI, causing cognitive disconnect and rendering alert calculations invisible.',
    opportunity: 'Provide interactive alert rule configuration and live threshold status badges in WatchlistPage.tsx.',
    group: 'PRODUCT_UX',
    priority: 'P1',
    status: 'READY',
    source: 'FOUNDER',
    created_by: 'pm',
    created_at: new Date().toISOString(),
    evidence_ids: [
      'OBS-FOUNDER-UX-CONCERN',
      'REPORT:MACRO_OS_UX_PRODUCT_BASELINE_M2.md',
      'OBS-ROUTE-WATCHLIST'
    ],
    evidence_quality: 'SUFFICIENT',
    user_or_persona: 'Macro Research Platform Founder & Senior Researchers',
    user_need: 'Configure threshold alerts on watched indicators and view active breach statuses without manual calculation.',
    expected_product_value: 'Transforms static bookmark list into an institutional monitoring tool with active threshold evaluation.',
    hypothesis: 'Exposing interactive alert threshold controls in WatchlistPage bridges the gap between background data calculations and user research workflow.',
    expected_change: 'Import evaluateWatchlistAlerts and WatchlistAlertRule into WatchlistPage.tsx; add alert configuration drawer, threshold display, and triggered alert badges.',
    expected_outcome: 'Users can define alert rules on watched items, triggers evaluate against indicator values, and alert badges appear in the UI with 100% passing tests.',
    acceptance_criteria: [
      'WatchlistPage renders alert configuration controls for watched indicators',
      'Users can configure ABOVE_THRESHOLD or BELOW_THRESHOLD values',
      'Triggered alerts display explicit visual warning badges on indicator rows',
      'Alert rules persist to localStorage and evaluate fail-closed',
      'Targeted tests in src/app/pages/WatchlistPage.test.ts or src/app/pages/WatchlistPage.integration.test.tsx pass'
    ],
    risk_level: 'LOW',
    dependencies: ['src/app/data/watchlist.ts'],
    blocked_by: [],
    pm_review_status: 'APPROVED',
    pm_reviewed_by: 'pm',
    pm_reviewed_at: new Date().toISOString(),
    pm_decision_reason: 'Directly addresses Founder UX evidence and bridges orphaned data engine to user view.',
    implementation_task_ids: [],
    evaluation_ids: [],
    learning_ids: [],
    updated_at: new Date().toISOString(),
    allowed_paths: [
      'src/app/pages/WatchlistPage.tsx',
      'src/app/pages/WatchlistPage.test.ts',
      'src/app/pages/WatchlistPage.integration.test.tsx'
    ]
  };

  // Prepend or place ready item
  canonical.items = [newItem, ...canonical.items.filter(i => i.backlog_id !== newItem.backlog_id)];
  canonical.active_sprint_id = 'SPRINT:MARATHON-M2-S1';
  canonical.sprint_status = 'ACTIVE';
  canonical.updated_at = new Date().toISOString();

  await writeFile(canonicalPath, JSON.stringify(canonical, null, 2) + '\n', 'utf8');

  // Update CURRENT_SPRINT.md
  const currentSprintContent = `# CURRENT SPRINT: SPRINT:MARATHON-M2-S1
**Status**: \`ACTIVE\`  
**Goal**: Connect Watchlist Alert Thresholds & Notification Drawer to User Interface (Founder UX Debt Closure)  
**Epoch**: \`M2\`  

### Committed Product Items:
1. **\`OPP-WATCHLIST-UI-ALERT-CONTROLS\`** (P1, Product UX)
   - **User Need**: Configure threshold alerts on watched indicators and view active breach statuses directly on \`/watchlist\`.
   - **Allowed Paths**: \`src/app/pages/WatchlistPage.tsx\`, \`src/app/pages/WatchlistPage.test.tsx\`
   - **Acceptance Criteria**: Alert configuration controls rendered; upper/lower threshold rules evaluated against live data; visual alert badges displayed; localStorage persistence; targeted unit tests green.
`;
  await writeFile(currentSprintPath, currentSprintContent, 'utf8');

  console.log('Successfully groomed OPP-WATCHLIST-UI-ALERT-CONTROLS and activated SPRINT:MARATHON-M2-S1.');
}

run();
