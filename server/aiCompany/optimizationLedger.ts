import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { OptimizationProposal } from './optimizationPlanner';

export interface OptimizationRecord extends OptimizationProposal {
  recorded_at: string;
  status: 'OPEN' | 'ACCEPTED' | 'REJECTED' | 'VERIFIED';
}

export class OptimizationLedger {
  private readonly file: string;
  constructor(private readonly rootDir: string) { this.file = path.join(rootDir, 'optimization.jsonl'); }
  async record(proposal: OptimizationProposal): Promise<OptimizationRecord> {
    await mkdir(this.rootDir, { recursive: true });
    const record: OptimizationRecord = { ...proposal, recorded_at: new Date().toISOString(), status: 'OPEN' };
    await appendFile(this.file, `${JSON.stringify(record)}\n`, 'utf8');
    return record;
  }
  async records(): Promise<OptimizationRecord[]> {
    try { return (await readFile(this.file, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line) as OptimizationRecord); }
    catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  }
}
