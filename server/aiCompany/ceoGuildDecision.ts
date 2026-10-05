import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export type CeoGuildAction = 'ACCEPT' | 'VALIDATE' | 'HOLD' | 'REJECT';
export interface CeoGuildDecision {
  decision_id: string;
  project_id: string;
  subject_id: string;
  action: CeoGuildAction;
  decision_owner: 'CEO';
  accountable_pm: string;
  evidence_ids: string[];
  dissent: string[];
  rationale: string;
  validation_metric: string;
  created_at: string;
}

export class CeoGuildDecisionLedger {
  private readonly file: string;
  constructor(private readonly rootDir: string) { this.file = path.join(rootDir, 'ceo-guild-decisions.jsonl'); }
  async decide(input: Omit<CeoGuildDecision, 'created_at'>): Promise<CeoGuildDecision> {
    if (!input.project_id || !input.subject_id || !input.accountable_pm || !input.rationale || !input.validation_metric) throw new Error('CEO guild decision requires identity, PM, rationale and validation metric');
    if (!input.evidence_ids.length) throw new Error('CEO guild decision requires evidence');
    if (input.action === 'ACCEPT' && !input.dissent.length) throw new Error('ACCEPT requires explicit dissent review, even when no dissent exists');
    const existing = (await this.records(input.project_id)).find((row) => row.decision_id === input.decision_id);
    if (existing) return existing;
    const record = { ...input, created_at: new Date().toISOString() };
    await mkdir(this.rootDir, { recursive: true });
    await appendFile(this.file, `${JSON.stringify(record)}\n`, 'utf8');
    return record;
  }
  async records(projectId?: string): Promise<CeoGuildDecision[]> {
    try {
      const rows = (await readFile(this.file, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line) as CeoGuildDecision);
      return projectId ? rows.filter((row) => row.project_id === projectId) : rows;
    } catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  }
}
