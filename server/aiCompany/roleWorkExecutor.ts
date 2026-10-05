import { assertAssignmentEnvelope } from './assignmentEnvelope';
import { assertResearchResult } from './researchResult';
import type { CompanyTask } from './orchestrator';
import { RoleWorkQueue, roleDependencySatisfied, type RoleWorkItem, type AttemptAuthority } from './roleWorkQueue';
import type { ModelAdapter } from './modelAdapter';
import { RoleEvidenceLedger, nativeProviderReceiptId } from './roleEvidenceLedger';
import type { RoleHandoffLedger } from './roleHandoffLedger';
import { evaluateRoleOutput } from './roleQuality';
import { assertReviewVerdict, type ReviewVerdict } from './verdict';
import { parseStructuredRoleOutput, type AnyStructuredRoleOutput } from './structuredRoleOutput';

export interface RoleWorkExecutionResult {
  evidence_ids: string[];
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  research_result?: RoleWorkItem['research_result'];
  review_verdict?: ReviewVerdict;
  structured_output?: AnyStructuredRoleOutput;
}

export type RoleWorkExecutor = (item: RoleWorkItem, authority?: AttemptAuthority) => Promise<RoleWorkExecutionResult>;

function nativeRoleTask(item: RoleWorkItem, receiptId?: string): CompanyTask {
  if (item.state !== 'CLAIMED' || !item.attempt_id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.attempt_id)) throw new Error('native provider dispatch requires actual claimed attempt');
  if (!item.assignment) throw new Error('native provider dispatch requires actual assignment');
  const assignment = assertAssignmentEnvelope(item.assignment);
  if (assignment.work_id !== item.work_id || assignment.product_id !== item.project_id || assignment.role !== item.role || (item.run_id !== undefined && assignment.run_id !== item.run_id) || (item.namespace !== undefined && assignment.namespace !== item.namespace)) throw new Error('native assignment identity does not match claimed work');
  return { task_id: item.work_id, project_id: item.project_id, risk_level: assignment.risk_level, acceptance_criteria: [...assignment.acceptance_criteria], budget: { max_attempts: 1, timeout_seconds: assignment.timeout }, role_execution: { assignment: structuredClone(assignment), attempt_id: item.attempt_id, ...(receiptId ? { receipt_evidence_id: receiptId } : {}) } };
}

export function modelRoleWorkExecutor(adapter: ModelAdapter, queue: RoleWorkQueue): RoleWorkExecutor {
  return async (item, authority) => {
    nativeRoleTask(item);
    const admitted = await queue.reserveProviderDispatch(item.work_id, adapter.id, authority, item);
    item = admitted;
    const response = await adapter.complete({ worker_id: admitted.role, task: nativeRoleTask(admitted) });
    if (!response.ok) throw new Error(response.notes ?? 'model worker failed');
    if (!response.evidence_ids.length) throw new Error('model worker returned no server-owned evidence');
    const parsed = parseStructuredRoleOutput(item.role, response.text ?? '');
    if (!parsed.valid) throw new Error(`invalid structured role output: ${parsed.errors.join('; ')}`);
    return {
      evidence_ids: response.evidence_ids,
      usage: { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens },
      structured_output: parsed.structured,
    };
  };
}

export function evidenceProducingRoleWorkExecutor(adapter: ModelAdapter, ledger: RoleEvidenceLedger, queue: RoleWorkQueue): RoleWorkExecutor {
  return async (item, authority) => {
    await ledger.assertQueueRoot(queue);
    let task = nativeRoleTask(item);
    const receiptId = nativeProviderReceiptId(item.work_id, task.role_execution!.attempt_id);
    if ((await ledger.inspectIdentity(receiptId)).exists) throw new Error('native attempt already has a provider receipt; repeated dispatch refused');
    const admitted = await queue.reserveProviderDispatch(item.work_id, adapter.id, authority, item);
    item = admitted;
    task = nativeRoleTask(admitted, receiptId);
    const response = await adapter.complete({ worker_id: item.role, task });
    if (!response.ok || !response.text?.trim()) throw new Error(response.notes ?? 'provider returned no bounded role output');
    if (!Number.isFinite(response.usage.input_tokens) || !Number.isFinite(response.usage.output_tokens) || !Number.isFinite(response.usage.estimated_cost_usd)) throw new Error('provider usage metadata is invalid');
    const quality = evaluateRoleOutput({ role: item.role, output: response.text, suppliedEvidence: item.evidence_ids, acceptanceCriteria: task.acceptance_criteria, productGoal: process.env.AI_COMPANY_PRODUCT_GOAL_CONTEXT ?? 'Verified product improvement per autonomous operating cycle for Macro OS.' });
    const artifact = await ledger.record({ receipt_id: receiptId, project_id: item.project_id, work_id: item.work_id, attempt_id: task.role_execution!.attempt_id, role: item.role, provider_id: adapter.id, model: adapter.id, output: response.text, limitation: 'Provider output is advisory; independent QA/QC and product release gates remain authoritative.', namespace: item.assignment?.namespace ?? '', run_id: item.assignment?.run_id ?? '', protocol_status: 'RECEIVED', content_quality: quality.content_quality, quality_warnings: quality.warnings, context_fingerprint: quality.context_fingerprint, usage: response.usage }, authority);
    const researchRoles = ['user-persona', 'ux-research', 'stakeholder-panel', 'domain-expert'];
    const isReviewTask = ['functional-qa', 'quality-control', 'critic', 'security', 'adversarial-reviewer', 'release-security-gate'].includes(item.role) || item.work_id.endsWith('-REVIEW') || item.assignment?.task_type === 'code_review';
    let research_result: RoleWorkItem['research_result'];
    let review_verdict: ReviewVerdict | undefined;
    let structured_output: AnyStructuredRoleOutput | undefined;
    if (isReviewTask) {
      try { review_verdict = assertReviewVerdict(JSON.parse(response.text)); }
      catch (error: unknown) { throw new Error(`invalid review verdict: ${error instanceof Error ? error.message : String(error)}`); }
    } else if (researchRoles.includes(item.role)) {
      try { research_result = assertResearchResult(JSON.parse(response.text)); }
      catch (error: unknown) { throw new Error(`invalid research result: ${error instanceof Error ? error.message : String(error)}`); }
    } else {
      const parsed = parseStructuredRoleOutput(item.role, response.text);
      if (!parsed.valid) throw new Error(`invalid structured role output: ${parsed.errors.join('; ')}`);
      structured_output = { ...parsed.structured!, evidence_ids: [...new Set([...parsed.structured!.evidence_ids, artifact.evidence_id])] };
    }
    return {
      evidence_ids: [...new Set([...response.evidence_ids, ...(review_verdict ? review_verdict.evidence : [artifact.evidence_id])])],
      usage: { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens },
      review_verdict,
      structured_output,
      ...(research_result ? { research_result } : {}),
    };
  };
}

export async function executeReadyRoleWork(input: { projectId: string; queue: RoleWorkQueue; handoffs?: RoleHandoffLedger; ownerPrefix?: string; execute: RoleWorkExecutor; maxConcurrent?: number; maxDurationMs?: number }): Promise<{ completed: RoleWorkItem[]; blocked: RoleWorkItem[] }> {
  input.queue.assertEvidenceResolutionConfigured();
  const completed: RoleWorkItem[] = [];
  const blocked: RoleWorkItem[] = [];
  await input.queue.recoverStaleLeases(input.projectId, 5 * 60_000);
  const ready = (await input.queue.records(input.projectId)).filter((candidate) => candidate.state === 'READY');
  const maxConcurrent = Math.max(1, Math.min(8, Math.floor(input.maxConcurrent ?? 1)));
  const deadline = Date.now() + Math.max(1_000, Math.min(15 * 60_000, Math.floor(input.maxDurationMs ?? 15 * 60_000)));
  let pending = ready;
  while (pending.length) {
    const current = await input.queue.records(input.projectId);
    const wave = pending.filter((item) => (item.depends_on ?? []).every((dependency) => roleDependencySatisfied(item, current.find((candidate) => candidate.work_id === dependency), current)));
    if (!wave.length) {
      for (const item of pending) blocked.push(await input.queue.block(item.work_id, `dependency wave cannot progress: ${(item.depends_on ?? []).join(', ') || 'unknown dependency'}`, item));
      break;
    }
    let cursor = 0;
    const worker = async () => {
      while (cursor < wave.length) {
        const item = wave[cursor++];
        let authority: AttemptAuthority | undefined;
        let committed: RoleWorkItem | undefined;
        try {
          if (Date.now() >= deadline) {
            blocked.push(await input.queue.block(item.work_id, 'role execution wall-clock budget exceeded; retry on next cycle', item));
            continue;
          }
          if (!item.assignment) throw new Error('assignment envelope is missing');
          if (input.handoffs && !(await input.handoffs.records(input.projectId, item.work_id)).some((handoff) => handoff.to_role === item.role)) {
            throw new Error(`role handoff is missing for ${item.work_id} -> ${item.role}`);
          }
          const { attempt_authority, ...claimed } = await input.queue.claim(item.work_id, `${input.ownerPrefix ?? 'agent'}:${item.role}`);
          authority = attempt_authority;
          const result = await input.execute(claimed, authority);
          await input.queue.submitForReview(item.work_id, authority);
          const reviewVerdict = result.review_verdict;
          const isReviewTask =
            ['functional-qa', 'quality-control', 'critic', 'security', 'adversarial-reviewer', 'release-security-gate'].includes(item.role) ||
            item.work_id.endsWith('-REVIEW') ||
            item.assignment?.task_type === 'code_review';
          if (!reviewVerdict && isReviewTask) throw new Error(`Review contract missing for ${item.role}; refusing implicit PASS`);
          const structuredOutput = result.structured_output;
          if (!structuredOutput && ['pm', 'tech-lead', 'coder', 'backend-engineer', 'frontend-engineer', 'data-engineer', 'ceo', 'ceo-guild'].includes(item.role)) throw new Error(`Structured output missing for ${item.role}; refusing implicit completion`);
          if (!structuredOutput && !result.research_result && !reviewVerdict) throw new Error(`Role completion contract missing for ${item.role}`);
          const admitted = await input.queue.complete(
              item.work_id,
              result.evidence_ids,
              result.research_result,
              reviewVerdict,
              structuredOutput, undefined, undefined, authority
            );
          committed = admitted;
          if (await input.queue.currentSuccess(admitted)) completed.push(admitted);
          else if (admitted.state === 'DONE') throw new Error('TERMINAL_REVALIDATION_REQUIRED: committed work has no current evidence authority');
          else blocked.push(admitted);
        } catch (error: unknown) {
          const detail = error instanceof Error ? error.message : String(error);
          if (committed) throw new Error(`TERMINAL_REVALIDATION_REQUIRED: committed work preserved: ${detail}`, { cause: error });
          if (authority) {
            try { blocked.push(await input.queue.blockAttempt(item.work_id, detail, authority)); }
            catch { throw new Error(`attempt lost authority; newer work state preserved: ${detail}`); }
          } else {
            // A failed claim grants no permission to stop another actor.
            const current = (await input.queue.records(input.projectId)).find(row => row.work_id === item.work_id);
            if (current?.state !== 'READY' || current.queue_revision !== item.queue_revision) throw new Error(`claim failed; newer work state preserved: ${detail}`);
            blocked.push(await input.queue.block(item.work_id, detail, item));
          }
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(maxConcurrent, wave.length) }, () => worker()));
    const finished = new Set(wave.map((item) => item.work_id));
    pending = pending.filter((item) => !finished.has(item.work_id));
  }
  return { completed, blocked };
}
