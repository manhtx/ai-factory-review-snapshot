import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('local multi-role coordinator contract', () => {
  it('dispatches only eligible work in bounded dependency waves', async () => {
    const source = await readFile(new URL('./ai-company-run-ready.mjs', import.meta.url), 'utf8');
    expect(source).toContain("item.state === 'READY'");
    expect(source).toContain('item.depends_on');
    expect(source).toContain('handoff.to_role === item.role');
    expect(source).toContain('Promise.all');
    expect(source).toContain('maxConcurrent');
    expect(source).toContain('canRunTestPolicy');
    expect(source).toContain('AI_COMPANY_HARNESS_HEALTH');
    expect(source).toContain('role-output-${dependencyId}.md');
    expect(source).toContain('AI_COMPANY_VITEST_CACHE_DIR');
    expect(source).toContain('dependency artifact unavailable');
    expect(source).toContain("if (!artifact.trim())");
    expect(source).toContain("const workerRuntime = path.join(workspace, '.ai-company', 'runtime')");
    expect(source).toContain('prevented: true');
    expect(source).toContain('upstreamPmDecision');
    expect(source).toContain('UPSTREAM_PM_GATE');
    expect(source).toContain("pmDecision !== 'PROCEED'");
    expect(source).toContain('downstream role dispatch suppressed');
  });

  it('bounds coordinator phases and records coordination failures', async () => {
    const source = await readFile(new URL('./ai-company-run-ready.mjs', import.meta.url), 'utf8');
    expect(source).toContain('AI_COMPANY_COORDINATOR_PHASE_TIMEOUT_MS');
    expect(source).toContain('COORDINATION_FAILURE');
    expect(source).toContain('child.kill');
    expect(source).toContain('child.exitCode === null && child.signalCode === null');
    expect(source).toContain('role coordination ${item.work_id}');
    expect(source).toContain('dispatch produced no queue state transition');
    expect(source).toContain('stuckReady');
  });

  it('runs the authoritative cycle integrity audit before successful completion', async () => {
    const source = await readFile(new URL('./ai-company-run-ready.mjs', import.meta.url), 'utf8');
    expect(source).toContain('audit-codex-product-cycle-integrity.mjs');
    expect(source).toContain('cycle integrity audit failed');
  });
});
