import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export type HeartbeatTriggerReason =
  | 'scheduled_cadence'
  | 'manual_trigger'
  | 'queue_event'
  | 'recovery_escalation'
  | 'worktree_sync';

export type HeartbeatNextAction =
  | 'IDLE_WAIT_TASK'
  | 'DISPATCH_PENDING_QUEUE'
  | 'ESCALATE_CEO_RECOVERY'
  | 'AWAIT_HUMAN_GATE'
  | 'HALT_BUDGET_EXHAUSTED';

export interface BoundedHeartbeatRun {
  heartbeat_id: string;
  run_id: string;
  trigger_reason: HeartbeatTriggerReason;
  start_time: string;
  end_time: string;
  duration_ms: number;
  budget_before_tokens: number;
  budget_after_tokens: number;
  tokens_consumed: number;
  active_tasks_count: number;
  completed_tasks_count: number;
  next_action: HeartbeatNextAction;
  status: 'COMPLETED' | 'IDLE_NO_WORK' | 'BUDGET_HALTED' | 'FAILED';
}

export class BoundedHeartbeatLedger {
  private readonly file: string;

  constructor(private readonly rootDir: string) {
    this.file = path.join(rootDir, '.ai-company', 'heartbeat-runs.jsonl');
  }

  async recordRun(run: BoundedHeartbeatRun): Promise<BoundedHeartbeatRun> {
    await mkdir(path.dirname(this.file), { recursive: true });
    await appendFile(this.file, `${JSON.stringify(run)}\n`, 'utf8');
    return run;
  }

  async getRuns(): Promise<BoundedHeartbeatRun[]> {
    try {
      const content = await readFile(this.file, 'utf8');
      return content
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as BoundedHeartbeatRun);
    } catch (err: any) {
      if (err?.code === 'ENOENT') return [];
      throw err;
    }
  }

  async getLatestRun(): Promise<BoundedHeartbeatRun | null> {
    const runs = await this.getRuns();
    return runs.length > 0 ? runs[runs.length - 1] : null;
  }
}
