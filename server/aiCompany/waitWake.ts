import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export type WaitingState = 'AWAITING_REAL_EVIDENCE' | 'AWAITING_PROVIDER' | 'AWAITING_EXTERNAL_DEPENDENCY' | 'AWAITING_FOUNDER_APPROVAL' | 'AWAITING_SCHEDULE' | 'AWAITING_CREDENTIAL';
export type WakeType = 'TIMER' | 'EVENT' | 'PROVIDER_RECOVERY' | 'MANUAL_APPROVAL';
export interface WaitingCondition { wait_id: string; project_id: string; workflow_id: string; state: WaitingState; wake_type: WakeType; wake_condition: string; earliest_time: string | null; deadline: string | null; evidence_required: string[]; next_action: string; created_at: string; resumed_at?: string; }

export class WaitWakeLedger {
  private readonly file: string;
  constructor(private readonly rootDir: string) { this.file = join(rootDir, 'wait-wake.jsonl'); }
  async wait(input: Omit<WaitingCondition, 'wait_id' | 'created_at'>) {
    const row = { ...input, wait_id: `WAIT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, created_at: new Date().toISOString() };
    await mkdir(this.rootDir, { recursive: true }); await appendFile(this.file, `${JSON.stringify(row)}\n`, 'utf8'); return row;
  }
  async records(): Promise<WaitingCondition[]> {
    try {
      const latest = new Map<string, WaitingCondition>();
      for (const line of (await readFile(this.file, 'utf8')).split('\n').filter(Boolean)) {
        const row = JSON.parse(line) as WaitingCondition;
        latest.set(row.wait_id, row);
      }
      return [...latest.values()];
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  }
  async resume(waitId: string, resumedAt = new Date().toISOString()): Promise<WaitingCondition> {
    const row = (await this.records()).find((candidate) => candidate.wait_id === waitId);
    if (!row) throw new Error(`wait condition not found: ${waitId}`);
    if (row.resumed_at) return row;
    const resumed = { ...row, resumed_at: resumedAt };
    await mkdir(this.rootDir, { recursive: true }); await appendFile(this.file, `${JSON.stringify(resumed)}\n`, 'utf8'); return resumed;
  }
  async due(now = new Date(), event?: string) { return (await this.records()).filter((row) => !row.resumed_at && (row.wake_type === 'TIMER' ? (!row.earliest_time || new Date(row.earliest_time) <= now) : row.wake_type === 'EVENT' ? row.wake_condition === event : row.wake_type === 'PROVIDER_RECOVERY' ? event === 'provider-recovered' : event === 'founder-approved')); }
  async resumeDue(now = new Date(), event?: string): Promise<WaitingCondition[]> {
    const dueItems = await this.due(now, event);
    const resumed: WaitingCondition[] = [];
    for (const item of dueItems) {
      resumed.push(await this.resume(item.wait_id, now.toISOString()));
    }
    return resumed;
  }
}
