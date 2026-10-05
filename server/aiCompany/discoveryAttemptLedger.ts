import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export interface DiscoveryAttempt { attempt_id: string; project_id: string; provider: string; model: string; status: 'SUCCEEDED' | 'FAILED'; evidence_count: number; idea_id?: string; error?: string; created_at: string; }
export class DiscoveryAttemptLedger {
  private readonly file: string;
  constructor(private readonly rootDir: string) { this.file = path.join(rootDir, 'discovery-attempts.jsonl'); }
  async record(input: Omit<DiscoveryAttempt, 'attempt_id' | 'created_at'>): Promise<DiscoveryAttempt> { const row = { ...input, attempt_id: `DISCOVERY-ATTEMPT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, created_at: new Date().toISOString() }; await mkdir(this.rootDir, { recursive: true }); await appendFile(this.file, `${JSON.stringify(row)}\n`, 'utf8'); return row; }
  async records(projectId?: string): Promise<DiscoveryAttempt[]> { try { const rows = (await readFile(this.file, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line) as DiscoveryAttempt); return projectId ? rows.filter((row) => row.project_id === projectId) : rows; } catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; } }
}
