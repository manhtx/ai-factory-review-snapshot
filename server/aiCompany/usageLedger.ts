import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export interface UsageRecord {
  usage_id: string;
  run_id: string;
  worker_id: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  outcome: 'PASS' | 'FAIL' | 'TIMEOUT' | 'BLOCKED';
  created_at: string;
}

export class UsageLedger {
  private readonly file: string;
  constructor(private readonly rootDir: string) { this.file = path.join(rootDir, 'usage.jsonl'); }
  async record(record: Omit<UsageRecord, 'usage_id' | 'created_at'>): Promise<UsageRecord> {
    await mkdir(this.rootDir, { recursive: true });
    const result: UsageRecord = { ...record, usage_id: `use_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, created_at: new Date().toISOString() };
    await appendFile(this.file, `${JSON.stringify(result)}\n`, 'utf8');
    return result;
  }
  async records(): Promise<UsageRecord[]> {
    try { return (await readFile(this.file, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line) as UsageRecord); }
    catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  }
}
