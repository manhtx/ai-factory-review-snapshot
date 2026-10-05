import type { AssignmentEnvelope } from './assignmentEnvelope';
import { CompanyStateStore } from './stateStore';
import { UsageLedger } from './usageLedger';
import { validateWorkerResults } from './stabilityGuard';
import { authorizeCompanyOperation, getRoleContract } from './roleContracts';

export interface CompanyTask {
  task_id: string;
  project_id: string;
  risk_level: 'P0' | 'P1' | 'P2' | 'P3';
  acceptance_criteria: string[];
  budget: { max_attempts: number; timeout_seconds: number; max_cost_usd?: number };
  role_execution?: { assignment: AssignmentEnvelope; attempt_id: string; receipt_evidence_id?: string };
  agent_principles?: Record<string, string[]>;
}

export interface WorkerResult {
  worker_id: string;
  ok: boolean;
  evidence_ids: string[];
  notes?: string;
  estimated_cost_usd?: number;
  input_tokens?: number;
  output_tokens?: number;
}

export interface Worker {
  id: string;
  run(task: CompanyTask): Promise<WorkerResult>;
}

export interface OrchestratorResult {
  task_id: string;
  status: 'RELEASED' | 'REVISE' | 'HOLD' | 'BLOCKED';
  workers: WorkerResult[];
}

export class BoundedOrchestrator {
  constructor(private readonly store: CompanyStateStore, private readonly workers: Worker[], private readonly usage?: UsageLedger, private readonly evaluate?: (result: WorkerResult) => Promise<void>, private readonly isWorkerAllowed?: (workerId: string) => Promise<boolean>, private readonly releaseGate?: () => Promise<{ ready: boolean; blockers: string[] }>) {}

  async run(task: CompanyTask): Promise<OrchestratorResult> {
    await this.store.assertIntegrity();
    if (process.env.NODE_ENV === 'production' && !this.releaseGate) throw new Error('production orchestrator requires release gate');
    if (!task.acceptance_criteria.length) throw new Error('task requires acceptance criteria');
    if (!this.workers.length) throw new Error('task requires at least one worker');
    if (task.budget.max_attempts < 1) throw new Error('task budget must allow one attempt');
    const checkpoint = await this.store.latestCheckpoint(task.task_id);
    const existingState = await this.store.stateOf(task.task_id);
    const checkpointResults = checkpoint?.payload.completed_results;
    const results: WorkerResult[] = Array.isArray(checkpointResults)
      ? checkpointResults.filter((item): item is WorkerResult => Boolean(item && typeof item === 'object' && typeof (item as WorkerResult).worker_id === 'string' && typeof (item as WorkerResult).ok === 'boolean' && Array.isArray((item as WorkerResult).evidence_ids)))
      : [];
    const completedWorkerIds = new Set(results.map((result) => result.worker_id));
    const isResume = existingState === 'EXECUTING' && Boolean(checkpoint);
    if (existingState && existingState !== 'INTAKE' && !isResume) throw new Error(`task is not resumable from state ${existingState}`);
    let cost = results.reduce((sum, result) => sum + (result.estimated_cost_usd ?? 0), 0);
    if (isResume && checkpoint) await this.store.recordCommand({ aggregateId: task.task_id, actor: 'ceo', reason: 'resumed from durable checkpoint', idempotencyKey: `${task.task_id}:resume:${checkpoint.checkpoint_id}`, payload: { cursor: checkpoint.cursor, completed_worker_ids: [...completedWorkerIds] } });
    if (!isResume) {
      await this.store.transition({ aggregateId: task.task_id, fromState: 'INTAKE', toState: 'DISCOVERY', actor: 'pm', reason: 'bounded orchestrator intake', idempotencyKey: `${task.task_id}:discovery` });
      await this.store.transition({ aggregateId: task.task_id, fromState: 'DISCOVERY', toState: 'COUNCIL_REVIEW', actor: 'domain-expert', reason: 'independent domain review requested', idempotencyKey: `${task.task_id}:council` });
      await this.store.transition({ aggregateId: task.task_id, fromState: 'COUNCIL_REVIEW', toState: 'PM_BACKLOGGED', actor: 'pm', reason: 'task contract accepted', idempotencyKey: `${task.task_id}:backlog` });
      await this.store.transition({ aggregateId: task.task_id, fromState: 'PM_BACKLOGGED', toState: 'CEO_PRIORITIZED', actor: 'ceo', reason: 'within delegated policy', idempotencyKey: `${task.task_id}:priority` });
      await this.store.transition({ aggregateId: task.task_id, fromState: 'CEO_PRIORITIZED', toState: 'READY', actor: 'ceo', reason: 'dependencies and budget checked', idempotencyKey: `${task.task_id}:ready` });
      await this.store.transition({ aggregateId: task.task_id, fromState: 'READY', toState: 'EXECUTING', actor: 'coder', reason: 'bounded implementation', idempotencyKey: `${task.task_id}:execute` });
    }
    for (const worker of this.workers) {
      if (completedWorkerIds.has(worker.id)) continue;
      const leaseOwner = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
      if (!(await this.store.acquireWorkerLease({ aggregateId: task.task_id, workerId: worker.id, owner: leaseOwner }))) {
        await this.store.transition({ aggregateId: task.task_id, fromState: 'EXECUTING', toState: 'BLOCKED', actor: 'ceo', reason: `worker lease unavailable: ${worker.id}`, idempotencyKey: `${task.task_id}:lease-blocked:${worker.id}` });
        return { task_id: task.task_id, status: 'BLOCKED', workers: results };
      }
      await this.store.recordCommand({ aggregateId: task.task_id, actor: 'ceo', reason: 'worker lease claimed', idempotencyKey: `${task.task_id}:lease-claimed:${worker.id}:${leaseOwner}`, payload: { worker_id: worker.id, owner: leaseOwner } });
      if (this.isWorkerAllowed && !(await this.isWorkerAllowed(worker.id))) {
        await this.store.releaseWorkerLease({ aggregateId: task.task_id, workerId: worker.id, owner: leaseOwner });
        await this.store.recordCommand({ aggregateId: task.task_id, actor: 'ceo', reason: 'worker lease released after quarantine', idempotencyKey: `${task.task_id}:lease-released:${worker.id}:${leaseOwner}`, payload: { worker_id: worker.id, owner: leaseOwner } });
        await this.store.transition({ aggregateId: task.task_id, fromState: 'EXECUTING', toState: 'BLOCKED', actor: 'ceo', reason: `worker ${worker.id} is quarantined`, idempotencyKey: `${task.task_id}:quarantine:${worker.id}` });
        return { task_id: task.task_id, status: 'BLOCKED', workers: results };
      }
      try {
        getRoleContract(worker.id);
        authorizeCompanyOperation(worker.id, worker.id === 'coder' ? 'IMPLEMENT' : 'REVIEW');
      } catch (error: unknown) {
        const reason = error instanceof Error ? error.message : String(error);
        await this.store.releaseWorkerLease({ aggregateId: task.task_id, workerId: worker.id, owner: leaseOwner });
        await this.store.recordCommand({ aggregateId: task.task_id, actor: 'ceo', reason: 'worker lease released after policy denial', idempotencyKey: `${task.task_id}:lease-released:${worker.id}:${leaseOwner}`, payload: { worker_id: worker.id, owner: leaseOwner } });
        await this.store.transition({ aggregateId: task.task_id, fromState: 'EXECUTING', toState: 'BLOCKED', actor: 'ceo', reason: `role operation denied: ${reason}`, idempotencyKey: `${task.task_id}:role-denied:${worker.id}` });
        return { task_id: task.task_id, status: 'BLOCKED', workers: results };
      }
      let result: WorkerResult = { worker_id: worker.id, ok: false, evidence_ids: [], notes: 'worker did not run' };
      for (let attempt = 1; attempt <= task.budget.max_attempts; attempt += 1) {
        result = await this.runWithTimeout(worker, task, task.budget.timeout_seconds);
        if (result.ok) break;
        result = { ...result, notes: `${result.notes ?? 'failed'} (attempt ${attempt}/${task.budget.max_attempts})` };
      }
      results.push(result);
      await this.store.checkpoint({
        aggregateId: task.task_id,
        actor: worker.id,
        cursor: `worker-${results.length}`,
        payload: { completed_worker_ids: results.map((item) => item.worker_id), completed_results: results, last_result_ok: result.ok },
        idempotencyKey: `${task.task_id}:checkpoint:${worker.id}:${results.length}`,
      });
      await this.store.releaseWorkerLease({ aggregateId: task.task_id, workerId: worker.id, owner: leaseOwner });
      await this.store.recordCommand({ aggregateId: task.task_id, actor: 'ceo', reason: 'worker lease released after result', idempotencyKey: `${task.task_id}:lease-released:${worker.id}:${leaseOwner}`, payload: { worker_id: worker.id, owner: leaseOwner, ok: result.ok } });
      cost += result.estimated_cost_usd ?? 0;
      await this.usage?.record({ run_id: task.task_id, worker_id: result.worker_id, input_tokens: result.input_tokens ?? 0, output_tokens: result.output_tokens ?? 0, estimated_cost_usd: result.estimated_cost_usd ?? 0, outcome: result.ok ? 'PASS' : (result.notes?.includes('timeout') ? 'TIMEOUT' : 'FAIL') });
      await this.evaluate?.(result);
      if (task.budget.max_cost_usd !== undefined && cost > task.budget.max_cost_usd) {
        await this.store.transition({ aggregateId: task.task_id, fromState: 'EXECUTING', toState: 'BLOCKED', actor: 'ceo', reason: 'cost budget exhausted', idempotencyKey: `${task.task_id}:cost-budget` });
        return { task_id: task.task_id, status: 'BLOCKED', workers: results };
      }
      if (!result.ok) {
        await this.store.transition({ aggregateId: task.task_id, fromState: 'EXECUTING', toState: 'REVISE', actor: 'ceo', reason: `${worker.id} failed`, idempotencyKey: `${task.task_id}:revise:${worker.id}` });
        return { task_id: task.task_id, status: 'REVISE', workers: results };
      }
    }
    const stabilityErrors = validateWorkerResults(task, results);
    if (stabilityErrors.length) {
      await this.store.transition({ aggregateId: task.task_id, fromState: 'EXECUTING', toState: 'REVISE', actor: 'ceo', reason: `stability guard: ${stabilityErrors.join('; ')}`, idempotencyKey: `${task.task_id}:stability-revise` });
      return { task_id: task.task_id, status: 'REVISE', workers: results };
    }
    await this.store.transition({ aggregateId: task.task_id, fromState: 'EXECUTING', toState: 'INDEPENDENT_VERIFICATION', actor: 'functional-qa', reason: 'implementation complete', idempotencyKey: `${task.task_id}:verify` });
    await this.store.transition({ aggregateId: task.task_id, fromState: 'INDEPENDENT_VERIFICATION', toState: 'USER_AND_DOMAIN_REVIEW', actor: 'ux-research', reason: 'verification passed', idempotencyKey: `${task.task_id}:user-review` });
    await this.store.transition({ aggregateId: task.task_id, fromState: 'USER_AND_DOMAIN_REVIEW', toState: 'RELEASE_GATE', actor: 'domain-expert', reason: 'user and domain review passed', idempotencyKey: `${task.task_id}:release-gate` });
    if (this.releaseGate) {
      const gate = await this.releaseGate();
      if (!gate.ready) {
        await this.store.transition({ aggregateId: task.task_id, fromState: 'RELEASE_GATE', toState: 'REVISE', actor: 'ceo', reason: `production gate blocked: ${gate.blockers.join('; ')}`, idempotencyKey: `${task.task_id}:release-blocked` });
        return { task_id: task.task_id, status: 'REVISE', workers: results };
      }
    }
    await this.store.transition({ aggregateId: task.task_id, fromState: 'RELEASE_GATE', toState: 'RELEASED', actor: 'release-security-gate', reason: 'all bounded workers passed', idempotencyKey: `${task.task_id}:released` });
    return { task_id: task.task_id, status: 'RELEASED', workers: results };
  }

  private async runWithTimeout(worker: Worker, task: CompanyTask, timeoutSeconds: number): Promise<WorkerResult> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<WorkerResult>((resolve) => {
      timer = setTimeout(() => resolve({ worker_id: worker.id, ok: false, evidence_ids: [], notes: `timeout after ${timeoutSeconds}s` }), timeoutSeconds * 1000);
    });
    try { return await Promise.race([worker.run(task), timeout]); }
    finally { if (timer) clearTimeout(timer); }
  }
}
