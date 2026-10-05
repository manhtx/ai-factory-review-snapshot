import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export interface DecisionRecord { decision_id: string; action: 'APPROVE' | 'REJECT' | 'REVISE' | 'DELEGATE'; value?: string; actor: 'CHAIRMAN' | 'CEO'; expires_at: string; created_at: string; }
export class DecisionLedger {
  private readonly file: string;
  constructor(private readonly rootDir: string) { this.file = path.join(rootDir, 'decisions.jsonl'); }
  async record(input: Omit<DecisionRecord, 'created_at'>): Promise<DecisionRecord> { await mkdir(this.rootDir, { recursive: true }); const existing = (await this.records()).find((record) => record.decision_id === input.decision_id); if (existing) return existing; const record = { ...input, created_at: new Date().toISOString() }; await appendFile(this.file, `${JSON.stringify(record)}\n`, 'utf8'); return record; }
  async records(): Promise<DecisionRecord[]> { try { return (await readFile(this.file, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line) as DecisionRecord); } catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; } }
  async active(decisionId: string, now = new Date()): Promise<DecisionRecord | null> { const matches = (await this.records()).filter((record) => record.decision_id === decisionId); const latest = matches.at(-1); return latest && new Date(latest.expires_at).getTime() > now.getTime() ? latest : null; }
}
