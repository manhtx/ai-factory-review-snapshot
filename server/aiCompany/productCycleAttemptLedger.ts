import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export interface ProductCycleAttempt {
  attempt_id: string;
  project_id: string;
  period: string;
  started_at: string;
  completed_at: string;
  status: 'DONE' | 'BLOCKED' | 'FAILED';
  error?: string;
  blockers?: string[];
  cadence_policy?: { cadence: string; accountable_roles: string[]; required_evidence: string[] };
}

export class ProductCycleAttemptLedger {
  private readonly file: string;
  constructor(private readonly rootDir: string) { this.file = path.join(rootDir, 'product-cycle-attempts.jsonl'); }

  async record(input: Omit<ProductCycleAttempt, 'attempt_id'>): Promise<ProductCycleAttempt> {
    if (!input.project_id || !input.period) throw new Error('cycle attempt scope is required');
    const row: ProductCycleAttempt = { ...input, attempt_id: `CYCLE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
    await mkdir(this.rootDir, { recursive: true });
    await appendFile(this.file, `${JSON.stringify(row)}\n`, 'utf8');
    return row;
  }

  async records(projectId?: string): Promise<ProductCycleAttempt[]> {
    try {
      const rows = (await readFile(this.file, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line) as ProductCycleAttempt);
      return projectId ? rows.filter((row) => row.project_id === projectId) : rows;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }
}
