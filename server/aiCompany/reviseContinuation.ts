import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { RoleWorkQueue, type RoleWorkItem } from './roleWorkQueue';

export type ParentContinuationState = 'ACTIVE' | 'WAITING_DEPENDENCY' | 'WAITING' | 'COMPLETE';

export interface ReviseContinuationRecord {
  continuation_id: string;
  parent_goal_id: string;
  parent_objective_id: string;
  parent_checkpoint: string;
  parent_remaining_acceptance_criteria: string[];
  originating_child_task_id: string;
  originating_review_id: string;
  originating_revise_evidence: string[];
  corrective_task_id: string;
  state: ParentContinuationState;
  next_parent_action: string;
  created_at: string;
}

const fileName = (root: string) => path.join(root, 'revise-continuations.jsonl');

export async function materializeCorrectiveChild(input: {
  queue: RoleWorkQueue;
  rootDir: string;
  parent_goal_id: string;
  parent_objective_id: string;
  parent_checkpoint: string;
  parent_remaining_acceptance_criteria: string[];
  originating_child_task_id: string;
  originating_review_id: string;
  originating_revise_evidence: string[];
  title: string;
  role: RoleWorkItem['role'];
  run_id: string;
  namespace: string;
  workflow_id: string;
}): Promise<{ record: ReviseContinuationRecord; task: RoleWorkItem }> {
  await mkdir(input.rootDir, { recursive: true });
  const existing = await readContinuations(input.rootDir);
  const prior = existing.find((row) => row.originating_child_task_id === input.originating_child_task_id && row.state !== 'COMPLETE');
  if (prior) {
    const task = (await input.queue.records()).find((row) => row.work_id === prior.corrective_task_id);
    if (task) return { record: prior, task };
  }
  const task = await input.queue.create({
    project_id: 'macro-os', backlog_id: input.parent_objective_id, title: input.title,
    role: input.role, run_id: input.run_id, namespace: input.namespace, workflow_id: input.workflow_id,
  });
  const record: ReviseContinuationRecord = {
    continuation_id: `CONT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    parent_goal_id: input.parent_goal_id, parent_objective_id: input.parent_objective_id,
    parent_checkpoint: input.parent_checkpoint,
    parent_remaining_acceptance_criteria: [...input.parent_remaining_acceptance_criteria],
    originating_child_task_id: input.originating_child_task_id,
    originating_review_id: input.originating_review_id,
    originating_revise_evidence: [...new Set(input.originating_revise_evidence)],
    corrective_task_id: task.work_id, state: 'WAITING_DEPENDENCY',
    next_parent_action: `execute corrective task ${task.work_id}`,
    created_at: new Date().toISOString(),
  };
  await appendFile(fileName(input.rootDir), `${JSON.stringify(record)}\n`, 'utf8');
  return { record, task };
}

export async function readContinuations(rootDir: string): Promise<ReviseContinuationRecord[]> {
  try { return (await readFile(fileName(rootDir), 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line)); }
  catch (error: any) { if (error?.code === 'ENOENT') return []; throw error; }
}

export function parentStateAfterReview(verdict: 'REVISE' | 'ACCEPT', correctiveState?: RoleWorkItem['state']): ParentContinuationState {
  if (verdict === 'REVISE') return 'WAITING_DEPENDENCY';
  return correctiveState === 'DONE' ? 'ACTIVE' : 'WAITING';
}
