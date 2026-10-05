import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { RoleWorkQueue } from './roleWorkQueue';
import { materializeCorrectiveChild, parentStateAfterReview, readContinuations } from './reviseContinuation';

describe('REVISE continuation', () => {
  it('keeps parent non-terminal and materializes one corrective child idempotently', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'revise-continuation-'));
    const queue = new RoleWorkQueue(root);
    const source = await queue.create({ project_id: 'macro-os', backlog_id: 'B1', title: 'source', role: 'backend-engineer', run_id: 'r1', namespace: 'n1' });
    const input = { queue, rootDir: root, parent_goal_id: 'PARENT-1', parent_objective_id: 'B1', parent_checkpoint: 'checkpoint-7', parent_remaining_acceptance_criteria: ['period parity'], originating_child_task_id: source.work_id, originating_review_id: 'REVIEW-1', originating_revise_evidence: ['E1'], title: 'Fix the reviewed data contract defect', role: 'backend-engineer' as const, run_id: 'r1', namespace: 'n1', workflow_id: 'corrective' };
    const first = await materializeCorrectiveChild(input);
    const second = await materializeCorrectiveChild(input);
    expect(first.task.work_id).toBe(second.task.work_id);
    expect(parentStateAfterReview('REVISE')).toBe('WAITING_DEPENDENCY');
    expect((await readContinuations(root))).toHaveLength(1);
  });
  it('resumes parent only after corrective child is accepted and supports legitimate wait', () => {
    expect(parentStateAfterReview('ACCEPT', 'DONE')).toBe('ACTIVE');
    expect(parentStateAfterReview('ACCEPT', 'READY')).toBe('WAITING');
  });
});
