import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

describe('current-stage capability audit', () => {
  it('validates the current-stage report against authoritative state', () => {
    const output = execFileSync('node', ['scripts/audit-current-stage-capabilities.mjs'], { encoding: 'utf8' });
    expect(JSON.parse(output)).toMatchObject({ status: 'PASS', score: 78, production_autonomy: 'DISABLED', production_release: 'HUMAN_GATED' });
  });

  it('fails closed when the report telemetry count is stale', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'ai-company-current-stage-'));
    const scorecard = path.join(root, 'scorecard.json');
    const mission = path.join(root, 'mission.json');
    const report = path.join(root, 'report.md');
    const snapshot = path.join(root, 'snapshot.json');
    await writeFile(scorecard, JSON.stringify({ total_score_100: 78 }));
    await writeFile(mission, JSON.stringify({ current_revision: 'LOCAL_UNCOMMITTED', production_autonomy: 'DISABLED', production_release: 'HUMAN_GATED' }));
    await writeFile(snapshot, JSON.stringify({ event_count: 10, session_count: 2 }));
    await writeFile(report, '# report\n## Verdict\n## Current evidence\n## Capability matrix\n## Score deductions\n## Next safe action\n**78/100**\nRevision binding: `LOCAL_UNCOMMITTED`\nCONTROL_PLANE_READY_LOCAL PRODUCT_OUTCOME_UNVERIFIED PRODUCTION_NO_GO\n9 telemetry events across 2 sessions');
    expect(() => execFileSync('node', ['scripts/audit-current-stage-capabilities.mjs'], { encoding: 'utf8', env: { ...process.env, AI_COMPANY_SCORECARD: scorecard, AI_COMPANY_MISSION: mission, AI_COMPANY_CURRENT_STAGE_REPORT: report, AI_COMPANY_OBSERVABILITY_SNAPSHOT: snapshot } })).toThrow();
  });
});
