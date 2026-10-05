import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export interface DeliveryRecord { delivery_id: string; channel: 'telegram'; target: string; report_id: string; status: 'SENT' | 'FAILED' | 'DEAD_LETTER'; attempts: number; error?: string; created_at: string }

export class DeliveryLedger {
  private readonly file: string;
  constructor(private readonly rootDir: string) { this.file = path.join(rootDir, 'delivery.jsonl'); }
  async record(input: Omit<DeliveryRecord, 'delivery_id' | 'created_at'>): Promise<DeliveryRecord> {
    await mkdir(this.rootDir, { recursive: true });
    const record = { ...input, delivery_id: `del_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, created_at: new Date().toISOString() };
    await appendFile(this.file, `${JSON.stringify(record)}\n`, 'utf8');
    return record;
  }
  async records(): Promise<DeliveryRecord[]> {
    try { return (await readFile(this.file, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line) as DeliveryRecord); }
    catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  }
}
