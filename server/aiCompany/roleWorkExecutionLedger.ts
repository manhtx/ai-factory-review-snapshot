import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { RoleWorkItem } from './roleWorkQueue';

export interface RoleWorkExecution { execution_id: string; work_id: string; project_id: string; role: RoleWorkItem['role']; owner?: string; status: 'DONE' | 'BLOCKED'; evidence_ids: string[]; error?: string; created_at: string; }

export class RoleWorkExecutionLedger {
  private readonly file: string;
  constructor(private readonly rootDir: string) { this.file = path.join(rootDir, 'role-work-executions.jsonl'); }
  async record(input: Omit<RoleWorkExecution, 'execution_id' | 'created_at'>): Promise<RoleWorkExecution> {
    const row = { ...input, execution_id: `EXEC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, created_at: new Date().toISOString() };
    await mkdir(this.rootDir, { recursive: true });
    await appendFile(this.file, `${JSON.stringify(row)}\n`, 'utf8');
    return row;
  }
  async records(projectId?: string): Promise<RoleWorkExecution[]> {
    try { const rows = (await readFile(this.file, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line) as RoleWorkExecution); return projectId ? rows.filter((row) => row.project_id === projectId) : rows; }
    catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  }
}
