import { appendFile, mkdir, readFile, open, unlink, stat } from 'node:fs/promises';
import path from 'node:path';
import { authorize } from './policyEngine';

export type WorkflowState =
  | 'INTAKE' | 'DISCOVERY' | 'COUNCIL_REVIEW' | 'PM_BACKLOGGED'
  | 'CEO_PRIORITIZED' | 'READY' | 'EXECUTING'
  | 'INDEPENDENT_VERIFICATION' | 'USER_AND_DOMAIN_REVIEW' | 'RELEASE_GATE'
  | 'RELEASED' | 'OUTCOME_EVALUATION' | 'LEARNED' | 'BLOCKED' | 'HOLD'
  | 'REVISE' | 'ROLLBACK' | 'KILLED' | 'ESCALATED' | 'CIRCUIT_OPEN';

export interface WorkflowEvent {
  event_id: string;
  event_type: 'STATE_TRANSITION' | 'CHECKPOINT' | 'COMMAND';
  aggregate_id: string;
  from_state?: WorkflowState;
  to_state?: WorkflowState;
  actor: string;
  reason: string;
  idempotency_key: string;
  created_at: string;
  payload?: Record<string, unknown>;
}

export interface TransitionResult {
  applied: boolean;
  event: WorkflowEvent;
  current_state: WorkflowState;
}

export interface Checkpoint {
  checkpoint_id: string;
  aggregate_id: string;
  actor: string;
  cursor: string;
  created_at: string;
  payload: Record<string, unknown>;
}

export interface StateIntegrityReport { valid: boolean; errors: string[]; event_count: number; checkpoint_count: number }

const transitions: Record<WorkflowState, WorkflowState[]> = {
  INTAKE: ['DISCOVERY'], DISCOVERY: ['COUNCIL_REVIEW'],
  COUNCIL_REVIEW: ['PM_BACKLOGGED'], PM_BACKLOGGED: ['CEO_PRIORITIZED'],
  CEO_PRIORITIZED: ['READY'], READY: ['EXECUTING'],
  EXECUTING: ['INDEPENDENT_VERIFICATION', 'REVISE', 'BLOCKED', 'HOLD', 'ESCALATED', 'CIRCUIT_OPEN'],
  INDEPENDENT_VERIFICATION: ['USER_AND_DOMAIN_REVIEW', 'REVISE', 'ROLLBACK', 'HOLD'],
  USER_AND_DOMAIN_REVIEW: ['RELEASE_GATE', 'REVISE', 'HOLD'],
  RELEASE_GATE: ['RELEASED', 'REVISE', 'ROLLBACK', 'KILLED'],
  RELEASED: ['OUTCOME_EVALUATION', 'ROLLBACK'], OUTCOME_EVALUATION: ['LEARNED', 'ESCALATED'],
  LEARNED: ['INTAKE'], BLOCKED: ['READY', 'ESCALATED', 'KILLED'],
  HOLD: ['READY', 'ESCALATED', 'KILLED'], REVISE: ['READY', 'DISCOVERY'],
  ROLLBACK: ['READY', 'INTAKE', 'KILLED'], ESCALATED: ['HOLD', 'READY', 'KILLED'],
  KILLED: [], CIRCUIT_OPEN: ['HOLD', 'ESCALATED'],
};

export class CompanyStateStore {
  private readonly eventsFile: string;

  constructor(private readonly rootDir: string, private readonly lockStaleMs = 30_000) {
    this.eventsFile = path.join(rootDir, 'events.jsonl');
  }

  async init(): Promise<void> {
    await mkdir(this.rootDir, { recursive: true });
  }

  async events(): Promise<WorkflowEvent[]> {
    try {
      const raw = await readFile(this.eventsFile, 'utf8');
      return raw.split('\n').filter(Boolean).map((line) => JSON.parse(line) as WorkflowEvent);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }

  async validateIntegrity(): Promise<StateIntegrityReport> {
    await this.init();
    let raw: string;
    try { raw = await readFile(this.eventsFile, 'utf8'); }
    catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { valid: true, errors: [], event_count: 0, checkpoint_count: 0 }; throw error; }
    const errors: string[] = [];
    let eventCount = 0;
    let checkpointCount = 0;
    for (const [index, line] of raw.split('\n').entries()) {
      if (!line.trim()) continue;
      let event: Partial<WorkflowEvent>;
      try { event = JSON.parse(line) as Partial<WorkflowEvent>; }
      catch { errors.push(`line ${index + 1}: invalid JSON`); continue; }
      eventCount += 1;
      if (!event.event_id || !event.event_type || !event.aggregate_id || !event.actor || !event.idempotency_key || !event.created_at) errors.push(`line ${index + 1}: missing event identity fields`);
      if (event.event_type === 'CHECKPOINT') {
        checkpointCount += 1;
        const checkpoint = event.payload?.checkpoint as Partial<Checkpoint> | undefined;
        if (!checkpoint?.checkpoint_id || checkpoint.aggregate_id !== event.aggregate_id || !checkpoint.cursor) errors.push(`line ${index + 1}: invalid checkpoint payload`);
        const payload = event.payload as { checkpoint?: { payload?: { completed_worker_ids?: unknown; completed_results?: unknown } } } | undefined;
        const ids = payload?.checkpoint?.payload?.completed_worker_ids;
        const results = payload?.checkpoint?.payload?.completed_results;
        if (ids !== undefined || results !== undefined) {
          if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string') || !Array.isArray(results)) errors.push(`line ${index + 1}: checkpoint completion data is malformed`);
          else {
            const resultIds = results.filter((item): item is { worker_id: string } => Boolean(item && typeof item === 'object' && typeof (item as { worker_id?: unknown }).worker_id === 'string')).map((item) => item.worker_id);
            if (JSON.stringify(ids) !== JSON.stringify(resultIds)) errors.push(`line ${index + 1}: checkpoint worker/result mismatch`);
          }
        }
      }
    }
    return { valid: errors.length === 0, errors, event_count: eventCount, checkpoint_count: checkpointCount };
  }

  async assertIntegrity(): Promise<void> {
    const report = await this.validateIntegrity();
    if (!report.valid) throw new Error(`state store integrity failure: ${report.errors.join('; ')}`);
  }

  async recordCommand(input: { aggregateId: string; actor: string; reason: string; idempotencyKey: string; payload?: Record<string, unknown> }): Promise<WorkflowEvent> {
    await this.init();
    authorize({ actor: input.actor, action: 'TRANSITION' });
    return this.withLock(async () => {
      const all = await this.events();
      const existing = all.find((event) => event.idempotency_key === input.idempotencyKey);
      if (existing) return existing;
      const event: WorkflowEvent = { event_id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`, event_type: 'COMMAND', aggregate_id: input.aggregateId, actor: input.actor, reason: input.reason, idempotency_key: input.idempotencyKey, created_at: new Date().toISOString(), payload: input.payload };
      await appendFile(this.eventsFile, `${JSON.stringify(event)}\n`, 'utf8');
      return event;
    });
  }

  async acquireWorkerLease(input: { aggregateId: string; workerId: string; owner: string; leaseMs?: number }): Promise<boolean> {
    await this.init();
    const leaseFile = path.join(this.rootDir, `lease-${encodeURIComponent(input.aggregateId)}-${encodeURIComponent(input.workerId)}.json`);
    try {
      const handle = await open(leaseFile, 'wx');
      await handle.writeFile(JSON.stringify({ owner: input.owner, expires_at: new Date(Date.now() + (input.leaseMs ?? 60_000)).toISOString() }));
      await handle.close();
      return true;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      try {
        const lease = JSON.parse(await readFile(leaseFile, 'utf8')) as { expires_at?: string };
        if (lease.expires_at && Date.parse(lease.expires_at) <= Date.now()) { await unlink(leaseFile); return this.acquireWorkerLease(input); }
      } catch (readError: unknown) { if ((readError as NodeJS.ErrnoException).code === 'ENOENT') return this.acquireWorkerLease(input); throw readError; }
      return false;
    }
  }

  async releaseWorkerLease(input: { aggregateId: string; workerId: string; owner: string }): Promise<void> {
    const leaseFile = path.join(this.rootDir, `lease-${encodeURIComponent(input.aggregateId)}-${encodeURIComponent(input.workerId)}.json`);
    try {
      const lease = JSON.parse(await readFile(leaseFile, 'utf8')) as { owner?: string };
      if (lease.owner === input.owner) await unlink(leaseFile);
    } catch (error: unknown) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }

  async stateOf(aggregateId: string): Promise<WorkflowState | null> {
    const events = await this.events();
    const mine = events.filter((event) => event.aggregate_id === aggregateId && event.to_state);
    return mine.length ? mine[mine.length - 1].to_state! : null;
  }

  async transition(input: {
    aggregateId: string;
    fromState: WorkflowState;
    toState: WorkflowState;
    actor: string;
    reason: string;
    idempotencyKey: string;
    payload?: Record<string, unknown>;
  }): Promise<TransitionResult> {
    await this.init();
    if (!transitions[input.fromState].includes(input.toState)) throw new Error(`invalid transition: ${input.fromState} -> ${input.toState}`);
    authorize({ actor: input.actor, action: 'TRANSITION', toState: input.toState, riskLevel: input.toState === 'HOLD' ? 'P0' : 'P2' });
    return this.withLock(async () => {
      const all = await this.events();
      const existing = all.find((candidate) => candidate.idempotency_key === input.idempotencyKey);
      if (existing) {
        const current = all.filter((event) => event.aggregate_id === input.aggregateId && event.to_state).at(-1)?.to_state;
        return { applied: false, event: existing, current_state: current ?? input.fromState };
      }
      const current = all.filter((event) => event.aggregate_id === input.aggregateId && event.to_state).at(-1)?.to_state;
      if (current !== undefined && current !== input.fromState) throw new Error(`stale transition: expected ${input.fromState}, current ${current}`);
      const event: WorkflowEvent = {
      event_id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      event_type: 'STATE_TRANSITION', aggregate_id: input.aggregateId,
      from_state: input.fromState, to_state: input.toState, actor: input.actor,
      reason: input.reason, idempotency_key: input.idempotencyKey,
      created_at: new Date().toISOString(), payload: input.payload,
      };
      await appendFile(this.eventsFile, `${JSON.stringify(event)}\n`, 'utf8');
      return { applied: true, event, current_state: input.toState };
    });
  }

  async checkpoint(input: { aggregateId: string; actor: string; cursor: string; payload: Record<string, unknown>; idempotencyKey: string }): Promise<Checkpoint> {
    await this.init();
    authorize({ actor: input.actor, action: 'TRANSITION' });
    return this.withLock(async () => {
      const existing = (await this.events()).find((event) => event.idempotency_key === input.idempotencyKey);
      if (existing && existing.payload?.checkpoint) return existing.payload.checkpoint as Checkpoint;
      const checkpoint: Checkpoint = {
      checkpoint_id: `chk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      aggregate_id: input.aggregateId, actor: input.actor, cursor: input.cursor,
      created_at: new Date().toISOString(), payload: input.payload,
      };
      const event: WorkflowEvent = {
      event_id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      event_type: 'CHECKPOINT', aggregate_id: input.aggregateId, actor: input.actor,
      reason: 'durable checkpoint', idempotency_key: input.idempotencyKey,
      created_at: checkpoint.created_at, payload: { checkpoint },
      };
      await appendFile(this.eventsFile, `${JSON.stringify(event)}\n`, 'utf8');
      return checkpoint;
    });
  }

  async latestCheckpoint(aggregateId: string): Promise<Checkpoint | null> {
    const events = await this.events();
    const checkpoints = events.filter((event) => event.aggregate_id === aggregateId && event.event_type === 'CHECKPOINT' && event.payload?.checkpoint);
    return checkpoints.length ? checkpoints[checkpoints.length - 1].payload!.checkpoint as Checkpoint : null;
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const lockFile = `${this.eventsFile}.lock`;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      try {
        const handle = await open(lockFile, 'wx');
        try { return await fn(); } finally { await handle.close(); await unlink(lockFile).catch(() => undefined); }
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        try {
          const lock = await stat(lockFile);
          if (Date.now() - lock.mtimeMs > this.lockStaleMs) await unlink(lockFile);
        } catch (staleError: unknown) {
          if ((staleError as NodeJS.ErrnoException).code !== 'ENOENT') throw staleError;
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    }
    throw new Error('state store lock timeout');
  }
}

export const allowedTransitions = transitions;
