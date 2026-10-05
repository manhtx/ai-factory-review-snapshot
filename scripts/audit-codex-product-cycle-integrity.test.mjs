import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('Codex product cycle integrity audit', () => {
  it('fails a cycle containing an embedded cross-role payload', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'cycle-integrity-'));
    const runtime = path.join(root, '.ai-company', 'runtime', 'projects', 'macro-os'); mkdirSync(runtime, { recursive: true });
    const run = 'RUN-1'; const item = { work_id: 'W-1', role: 'backend-engineer', state: 'DONE', run_id: run, evidence_ids: ['E-1'], structured_output: { role: 'backend-engineer', implementation_summary: '{"role":"pm"}' }, review_verdict: undefined };
    writeFileSync(path.join(runtime, 'role-work-queue.jsonl'), JSON.stringify(item) + '\n');
    writeFileSync(path.join(runtime, 'role-dispatch-evidence.jsonl'), JSON.stringify({ evidence_id: 'E-1', run_id: run }) + '\n');
    expect(() => execFileSync(process.execPath, [path.join(process.cwd(), 'scripts/audit-codex-product-cycle-integrity.mjs'), '--run-id', run, '--runtime-dir', runtime], { cwd: process.cwd(), stdio: 'pipe' })).toThrow();
  });

  it('accepts intentional downstream blocks from a terminal PM gate', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'cycle-integrity-pm-gate-'));
    const runtime = path.join(root, '.ai-company', 'runtime', 'projects', 'macro-os'); mkdirSync(runtime, { recursive: true });
    const run = 'RUN-PM-HOLD';
    const items = ['domain-expert', 'ux-research'].map((role) => ({
      work_id: `W-${role}`, role, state: 'BLOCKED', run_id: run,
      blocked_reason: 'UPSTREAM_PM_GATE: PM recommendation=HOLD; downstream role dispatch suppressed',
      evidence_ids: [],
    }));
    writeFileSync(path.join(runtime, 'role-work-queue.jsonl'), items.map((item) => JSON.stringify(item)).join('\n') + '\n');
    writeFileSync(path.join(runtime, 'role-dispatch-evidence.jsonl'), '');
    const output = execFileSync(process.execPath, [path.join(process.cwd(), 'scripts/audit-codex-product-cycle-integrity.mjs'), '--run-id', run, '--runtime-dir', runtime], { cwd: process.cwd(), encoding: 'utf8' });
    expect(JSON.parse(output).status).toBe('PASS');
  });
});
