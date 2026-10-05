import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { RoleWorkQueue } from './roleWorkQueue';
import { RoleHandoffLedger } from './roleHandoffLedger';
import { coordinateRecovery } from './recoveryCoordinator';
import { classifyChangedFiles } from './executionBoundary';
import { detectReviewConflict, validateReviewVerdict, type ReviewVerdict } from './verdict';

describe('runtime proof adversarial scenarios', () => {
  it('rejects invalid DAG with zero queue delta', async () => {
    const q = new RoleWorkQueue(await mkdtemp(path.join(os.tmpdir(), 'proof-')));
    await expect(q.createBatch([{ work_id: 'a', project_id: 'macro-os', backlog_id: 'B', title: 'a', role: 'pm', depends_on: ['missing'] }])).rejects.toThrow();
    expect(await q.records()).toEqual([]);
  });
  it('keeps unrelated namespace work out of a run', async () => {
    const q = new RoleWorkQueue(await mkdtemp(path.join(os.tmpdir(), 'proof-')));
    await q.create({ project_id: 'macro-os', backlog_id: 'other', title: 'other', role: 'pm', run_id: 'other', namespace: 'other' });
    expect((await q.records()).filter((x) => x.assignment?.run_id === 'target')).toHaveLength(0);
  });
  it('contains control-plane write and preserves typed disagreement', () => {
    expect(classifyChangedFiles('/repo', ['work/a', '.ai-company/runtime/q'], ['work']).unauthorized).toEqual(['.ai-company/runtime/q']);
    const base = { gate: 'quality', summary: 'review', evidence: ['E'], root_cause: 'conflict', recovery_required: true, recovery_actions: ['remediate'], accountable_role: 'coder', unblock_evidence: ['E2'], retry_budget: 1, next_review_trigger: 'E2', confidence: .8 };
    const qa: ReviewVerdict = { ...base, verdict: 'PASS', failure_class: 'NONE', recovery_required: false, root_cause: 'none', recovery_actions: [] };
    const qc: ReviewVerdict = { ...base, verdict: 'QUALITY_FAIL', failure_class: 'QUALITY_DEFECT' };
    expect(validateReviewVerdict(qa)).toEqual([]); expect(validateReviewVerdict(qc)).toEqual([]); expect(qa.verdict).not.toBe(qc.verdict);
  });
  it('records a real forbidden-write attempt inside the disposable worktree without touching control-plane', async () => {
    const controlPlane = await mkdtemp(path.join(os.tmpdir(), 'control-plane-'));
    const worker = await mkdtemp(path.join(os.tmpdir(), 'worker-plane-'));
    const forbidden = '.ai-company/runtime/ADVERSARIAL_FORBIDDEN_WRITE.md';
    await mkdir(path.dirname(path.join(worker, forbidden)), { recursive: true });
    await writeFile(path.join(worker, forbidden), 'contained attack fixture\n');
    const result = classifyChangedFiles(worker, [forbidden], ['.ai-company/reports']);
    expect(result.unauthorized).toEqual([forbidden]);
    await expect(readFile(path.join(controlPlane, forbidden), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('routes QA/QC disagreement through a real recovery DAG', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'conflict-')); const queue = new RoleWorkQueue(root); const handoffs = new RoleHandoffLedger(root);
    const source = await queue.create({ project_id: 'macro-os', backlog_id: 'B', title: 'conflict subject', role: 'quality-control', run_id: 'run-c', namespace: 'ns-c' });
    const qa = { verdict: 'PASS' as const, gate: 'qa', summary: 'pass', evidence: ['QA-E'], failure_class: 'NONE' as const, root_cause: 'none', recovery_required: false, recovery_actions: [], unblock_evidence: [], retry_budget: 0, next_review_trigger: 'none', confidence: 1 };
    const qc = { verdict: 'QUALITY_FAIL' as const, gate: 'qc', summary: 'fail', evidence: ['QC-E'], failure_class: 'QUALITY_DEFECT' as const, root_cause: 'defect', recovery_required: true, recovery_actions: ['verify'], accountable_role: 'quality-control', unblock_evidence: ['QC-FIX'], retry_budget: 1, next_review_trigger: 'QC-FIX', confidence: .9 };
    expect(detectReviewConflict([qa, qc]).recovery_required).toBe(true);
    const result = await coordinateRecovery({ queue, handoffs, projectId: 'macro-os', runId: 'run-c', namespace: 'ns-c', sourceWorkId: source.work_id, attempts: 0, plan: { recovery_id: 'CONFLICT-1', source_decision_id: source.work_id, failure_class: 'QUALITY_DEFECT', root_cause: 'QA/QC disagreement', actions: ['independent verification'], accountable_role: 'quality-control', re_review_role: 'ceo-guild', dependency_updates: [source.work_id], required_evidence: ['QC-FIX'], acceptance_criteria: ['conflict resolved'], retry_budget: 1, priority: 'P1', re_review_trigger: 'QC-FIX', terminal_if_failed: 'TERMINAL_HOLD' } });
    expect(result.status).toBe('CREATED'); expect((await queue.records('macro-os')).filter((x) => x.assignment?.run_id === 'run-c')).toHaveLength(3); expect((await handoffs.records('macro-os'))).toHaveLength(2);
  });
});
