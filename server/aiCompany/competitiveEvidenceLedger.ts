import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export interface CompetitiveEvidence { evidence_id: string; project_id: string; subject: string; source_url: string; retrieved_at: string; observed_claim: string; product_implication: string; limitation: string; }
export class CompetitiveEvidenceLedger {
  private readonly file: string;
  constructor(private readonly rootDir: string) { this.file = path.join(rootDir, 'competitive-evidence.jsonl'); }
  async record(input: Omit<CompetitiveEvidence, 'retrieved_at'>): Promise<CompetitiveEvidence> {
    if (!/^https:\/\//.test(input.source_url)) throw new Error('competitive evidence requires an https source');
    if (!input.observed_claim.trim() || !input.limitation.trim()) throw new Error('competitive evidence claim and limitation are required');
    const existing = (await this.records(input.project_id)).find((item) => item.evidence_id === input.evidence_id);
    if (existing) return existing;
    await mkdir(this.rootDir, { recursive: true });
    const record = { ...input, retrieved_at: new Date().toISOString() };
    await appendFile(this.file, `${JSON.stringify(record)}\n`, 'utf8');
    return record;
  }
  async records(projectId?: string): Promise<CompetitiveEvidence[]> { try { const rows = (await readFile(this.file, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line) as CompetitiveEvidence); return projectId ? rows.filter((row) => row.project_id === projectId) : rows; } catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; } }
}
