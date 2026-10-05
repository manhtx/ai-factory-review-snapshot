import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { AgentEvaluation } from './agentEvaluator';

export interface EvaluationRecord extends AgentEvaluation { evaluation_id: string; project_id: string; created_at: string }

export class EvaluationLedger {
  private readonly file: string;
  constructor(private readonly rootDir: string) { this.file = path.join(rootDir, 'evaluations.jsonl'); }
  async record(projectId: string, evaluation: AgentEvaluation): Promise<EvaluationRecord> {
    await mkdir(this.rootDir, { recursive: true });
    const record = { ...evaluation, project_id: projectId, evaluation_id: `eval_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, created_at: new Date().toISOString() };
    await appendFile(this.file, `${JSON.stringify(record)}\n`, 'utf8');
    return record;
  }
  async records(projectId?: string): Promise<EvaluationRecord[]> {
    try {
      const records = (await readFile(this.file, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line) as EvaluationRecord);
      return projectId ? records.filter((record) => record.project_id === projectId) : records;
    } catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  }
}
