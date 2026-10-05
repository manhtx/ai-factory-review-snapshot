import { recordNativeFixture } from './nativeReceiptTestFixture';
import { appendFile, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { RoleWorkQueue, type RoleWorkItem } from './roleWorkQueue';
import { RoleEvidenceLedger } from './roleEvidenceLedger';
import type { AnyStructuredRoleOutput } from './structuredRoleOutput';

// Deterministic temporary contracts; no actual review, release or product outcome.
export async function readinessAuthorityFixture(roles: readonly RoleWorkItem['role'][], prefix = 'B-1') {
  const root = await mkdtemp(path.join(os.tmpdir(), 'readiness-authority-'));
  const ledger = new RoleEvidenceLedger(root), queue = new RoleWorkQueue(root, ledger);
  const source = await queue.create({ project_id: 'unit', backlog_id: 'SOURCE', title: 'Unit advisory source', role: 'domain-expert', namespace: 'N', run_id: 'R' });
  const claim = await queue.claim(source.work_id, 'fixture');
  const receipt = await recordNativeFixture(queue, ledger, { project_id: 'unit', work_id: source.work_id, attempt_id: claim.attempt_id!, role: source.role, namespace: 'N', run_id: 'R', provider_id: 'stub', model: 'stub', output: 'Unit source', limitation: 'No product or human evidence', usage: { input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0 } }, claim.attempt_authority);
  await queue.submitForReview(source.work_id, claim.attempt_authority);
  await queue.complete(source.work_id, [receipt.evidence_id], { research_question: 'Unit', source_reference: receipt.evidence_id, finding: 'Advisory only', confidence: .2 }, undefined, undefined, undefined, undefined, claim.attempt_authority);
  for (const role of roles) {
    const work = await queue.create({ project_id: 'unit', backlog_id: `${prefix}:${role}`, title: 'Unit contract only', role, namespace: 'N', run_id: 'R', depends_on: [source.work_id] });
    const handle = await queue.claim(work.work_id, 'fixture');
    const review = ['functional-qa', 'quality-control'].includes(role);
    const own = review ? receipt : await recordNativeFixture(queue, ledger, { project_id: 'unit', work_id: work.work_id, attempt_id: handle.attempt_id!, role, namespace: 'N', run_id: 'R', provider_id: 'stub', model: 'stub', output: 'Unit output', limitation: 'No product or human evidence', usage: { input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0 } }, handle.attempt_authority);
    let structured: AnyStructuredRoleOutput | undefined;
    if (role === 'ceo' || role === 'ceo-guild') structured = { role, decision: 'VALIDATE', reason: 'Unit only', evidence_ids: [own.evidence_id], dissent: [], next_workflow: 'Unit', owner: 'fixture', retest_condition: 'Unit assertion only' };
    if (role === 'pm') structured = { role, problem: 'Unit', target_user: 'Unit', product_goal_objective: 'Evidence trust', evidence_ids: [own.evidence_id], facts: [], assumptions: [], scope: [], non_goals: [], recommendation: 'PROCEED', confidence: .2, unknowns: [] };
    if (role === 'data-engineer') structured = { role, files_changed: [], files_not_changed: [], implementation_summary: 'Unit only', tests_run: ['Unit'], tests_failed: [], known_limitations: ['No actual data change'], rollback_instruction: 'Unit', evidence_ids: [own.evidence_id] };
    await queue.submitForReview(work.work_id, handle.attempt_authority);
    await queue.complete(work.work_id, [own.evidence_id], review || structured ? undefined : { research_question: 'Unit', source_reference: own.evidence_id, finding: 'Advisory only', confidence: .2 }, review ? { verdict: 'PASS', gate: 'Unit', summary: 'Unit only', evidence: [own.evidence_id], failure_class: 'NONE', root_cause: 'Unit', recovery_required: false, recovery_actions: [], unblock_evidence: [], retry_budget: 0, next_review_trigger: 'Unit', confidence: .2 } : undefined, structured, undefined, undefined, handle.attempt_authority);
  }
  return { root, queue, ledger, source, authority: await queue.currentAuthority('unit'), rows: await queue.records('unit') };
}

// Fault injection retains history and advances revision; never touches live stores.
export async function faultReadinessWork(f: Awaited<ReturnType<typeof readinessAuthorityFixture>>, role: RoleWorkItem['role'], change: Partial<RoleWorkItem>) {
  const row = (await f.queue.records('unit')).find(item => item.role === role && item.backlog_id !== 'SOURCE')!;
  await appendFile(path.join(f.root, 'role-work-queue.jsonl'), JSON.stringify({ ...row, ...change, queue_revision: row.queue_revision! + 1 }) + '\n');
  return f.queue.currentAuthority('unit');
}
