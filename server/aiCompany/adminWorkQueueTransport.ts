import path from 'node:path';
import { RoleWorkQueue, type AttemptAuthority } from './roleWorkQueue';

/** Transport preserves the caller's explicit claim handle; it never adopts a
 * handle from current state. Queue validators remain terminal authority. */
function requestAuthority(value: unknown): AttemptAuthority | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('attempt authority must be an object');
  const row = value as Record<string, unknown>;
  if (typeof row.attempt_id !== 'string' || typeof row.owner !== 'string' || typeof row.token !== 'string') throw new Error('attempt authority fields must be strings');
  return { attempt_id: row.attempt_id, owner: row.owner, token: row.token };
}

export function assertAdminQueueRuntimeRoot(queueRoot: string, stateRoot: string): void {
  if (path.resolve(queueRoot) !== path.resolve(stateRoot, 'projects/macro-os')) throw new Error('admin queue root differs from configured native runtime; mutation refused');
}

export async function mutateAdminRoleWorkQueue(queue: RoleWorkQueue, body: Record<string, unknown>) {
  const action = String(body.action ?? 'create');
  if (action === 'create') return { action: 'create' as const, status: 201, item: await queue.create({ project_id: String(body.project_id ?? 'macro-os'), backlog_id: String(body.backlog_id ?? ''), title: String(body.title ?? ''), role: body.role as never }) };
  const workId = String(body.work_id ?? '');
  if (action === 'claim') return { action: 'claim' as const, status: 200, item: await queue.claim(workId, String(body.owner ?? '')) };
  if (action === 'submit-review') return { action: 'submit-review' as const, status: 200, item: await queue.submitForReview(workId, requestAuthority(body.attempt_authority)) };
  if (action === 'complete') {
    if (!Array.isArray(body.evidence_ids) || body.evidence_ids.some(id => typeof id !== 'string')) throw new Error('evidence_ids must be an array of strings');
    type Completion = Parameters<RoleWorkQueue['complete']>;
    return { action: 'complete' as const, status: 200, item: await queue.complete(workId, body.evidence_ids as string[], body.research_result as Completion[2], body.review_verdict as Completion[3], body.structured_output as Completion[4], body.metric_contract as Completion[5], body.review_evidence_record as Completion[6], requestAuthority(body.attempt_authority)) };
  }
  if (action === 'block') return { action: 'block' as const, status: 200, item: await queue.block(workId, String(body.reason ?? '')) };
  throw new Error('unknown work queue action');
}
