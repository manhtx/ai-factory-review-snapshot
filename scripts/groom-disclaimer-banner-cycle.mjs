import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';

const root = process.cwd();
const canonicalPath = path.join(root, '.ai-company', 'product-intelligence', 'CANONICAL_PRODUCT_BACKLOG.json');
const currentSprintPath = path.join(root, 'AI Company', 'CURRENT_SPRINT.md');

async function run() {
  const canonical = JSON.parse(await readFile(canonicalPath, 'utf8'));
  const now = new Date().toISOString();

  const newItem = {
    backlog_id: 'OPP-DISCLAIMER-BANNER-PRIMITIVE',
    title: 'Consolidate Macro Methodological Disclaimers and Evidence Boundaries into Canonical DisclaimerBanner Primitive',
    summary: 'Standardize disparate warning callouts and causal boundary notices across pages into an accessible, tokenized DisclaimerBanner primitive.',
    problem_statement: 'Pages across the platform render ad-hoc amber containers and inconsistent warning styles, lacking standardized ARIA roles and violating the Design System token rules identified in MACRO_OS_UX_PRODUCT_BASELINE_M2.',
    opportunity: 'Provide a reusable DisclaimerBanner primitive with semantic tones, title, and icons, adopting it on RegimeDetectionPage and RelationshipsPage.',
    group: 'DESIGN_SYSTEM',
    priority: 'P1',
    status: 'APPROVED',
    source: 'FOUNDER_UX_BASELINE',
    created_by: 'pm',
    created_at: now,
    evidence_ids: [
      'REPORT:MACRO_OS_UX_PRODUCT_BASELINE_M2.md',
      'OBS-ROUTE-REGIMES',
      'OBS-ROUTE-RELATIONSHIPS'
    ],
    evidence_quality: 'SUFFICIENT',
    user_or_persona: 'Skeptical Macro Economist & Senior Product Designer personas',
    user_need: 'Clearly distinguish methodological boundaries, descriptive configurations, and data gaps with consistent, accessible visual hierarchy.',
    expected_product_value: 'Eliminates visual inconsistency and strengthens trust by providing a standardized, accessible banner for causal and data boundaries.',
    hypothesis: 'A unified DisclaimerBanner reduces cognitive debt, standardizes visual language across research surfaces, and prevents misinterpretation of descriptive models as forecasts.',
    expected_change: 'Add DisclaimerBanner to Primitives.tsx; adopt it in RegimeDetectionPage.tsx and RelationshipsPage.tsx; update DesignSystemPage.tsx; add unit test coverage.',
    expected_outcome: '100% test pass, verified accessibility attributes (role=status/alert), and consistent theme tokens.',
    acceptance_criteria: [
      'DisclaimerBanner primitive supports tone variants: warning, info, neutral, caution',
      'DisclaimerBanner includes semantic accessibility role attribute (status or alert)',
      'RegimeDetectionPage adopts PageHeader, Panel, and DisclaimerBanner',
      'RelationshipsPage adopts DisclaimerBanner for data synchronization warnings',
      'Targeted tests in Primitives.test.ts and RegimeDetectionPage.test.ts pass'
    ],
    risk_level: 'LOW',
    dependencies: [
      'src/app/components/design-system/Primitives.tsx'
    ],
    blocked_by: [],
    pm_review_status: 'APPROVED',
    pm_reviewed_by: 'pm',
    pm_reviewed_at: now,
    pm_decision_reason: 'Addresses P2 opportunity from UX baseline audit; unifies causal and data-state communication.',
    implementation_task_ids: [],
    evaluation_ids: [],
    learning_ids: [],
    updated_at: now,
    allowed_paths: [
      'src/app/components/design-system/Primitives.tsx',
      'src/app/components/design-system/Primitives.test.ts',
      'src/app/pages/RegimeDetectionPage.tsx',
      'src/app/pages/RegimeDetectionPage.test.ts',
      'src/app/pages/RelationshipsPage.tsx',
      'src/app/pages/DesignSystemPage.tsx'
    ]
  };

  // Add item to canonical backlog
  canonical.items = [newItem, ...canonical.items.filter(i => i.backlog_id !== newItem.backlog_id)];
  canonical.updated_at = now;
  await writeFile(canonicalPath, JSON.stringify(canonical, null, 2) + '\n', 'utf8');

  // Update CURRENT_SPRINT.md
  const currentSprintContent = `# CURRENT SPRINT: SPRINT:MARATHON-M2-S1
**Status**: \`ACTIVE\`  
**Goal**: Elevate Research Usability, Close UX Debt, and Standardize Macro Trust Primaries (Epoch M2 Target)  
**Epoch**: \`M2\`  

### Committed Product Items:
1. **\`OPP-WATCHLIST-UI-ALERT-CONTROLS\`** (P1, Product UX) — \`DELIVERED\`
   - Connected threshold alert controls and live breach badges directly into \`WatchlistPage.tsx\`.
2. **\`OPP-DISCLAIMER-BANNER-PRIMITIVE\`** (P1, Design System & Trust Boundaries) — \`IN_PROGRESS\`
   - **User Need**: Standardize warning and methodological disclaimers across pages into a unified \`DisclaimerBanner\` primitive.
   - **Allowed Paths**: \`src/app/components/design-system/Primitives.tsx\`, \`src/app/components/design-system/Primitives.test.ts\`, \`src/app/pages/RegimeDetectionPage.tsx\`, \`src/app/pages/RegimeDetectionPage.test.ts\`, \`src/app/pages/RelationshipsPage.tsx\`, \`src/app/pages/DesignSystemPage.tsx\`
   - **Acceptance Criteria**: Accessible ARIA roles, canonical token styles, adoption across \`RegimeDetectionPage\` and \`RelationshipsPage\`, targeted unit test verification.
`;
  await writeFile(currentSprintPath, currentSprintContent, 'utf8');

  console.log('Successfully groomed OPP-DISCLAIMER-BANNER-PRIMITIVE and updated SPRINT:MARATHON-M2-S1.');
}

run();
