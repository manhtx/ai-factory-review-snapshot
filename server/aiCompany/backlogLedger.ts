import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { BacklogItem } from './backlogSynthesis';

export interface BacklogDecision { decision_id: string; backlog_id: string; project_id: string; priority: BacklogItem['priority']; rationale: string; decided_by: 'CEO' | 'CHAIRMAN'; created_at: string; }

export class BacklogLedger {
  private readonly itemsFile: string;
  private readonly decisionsFile: string;
  private itemWriteChain: Promise<void> = Promise.resolve();
  private decisionWriteChain: Promise<void> = Promise.resolve();
  constructor(private readonly rootDir: string) { this.itemsFile = path.join(rootDir, 'backlog.jsonl'); this.decisionsFile = path.join(rootDir, 'backlog-decisions.jsonl'); }
  async add(items: BacklogItem[]): Promise<void> {
    this.itemWriteChain = this.itemWriteChain.then(async () => {
      const existing = new Set((await this.items()).map((item) => this.itemKey(item)));
      await mkdir(this.rootDir, { recursive: true });
      for (const item of items) {
        const key = this.itemKey(item);
        if (existing.has(key)) continue;
        await appendFile(this.itemsFile, `${JSON.stringify(item)}\n`, 'utf8');
        existing.add(key);
      }
    });
    await this.itemWriteChain;
  }
  async items(projectId?: string): Promise<BacklogItem[]> {
    const rows = await this.read<BacklogItem>(this.itemsFile, projectId ? (item) => item.project_id === projectId : undefined);
    const unique = new Map<string, BacklogItem>();
    for (const item of rows) { const key = this.itemKey(item); if (!unique.has(key)) unique.set(key, item); }
    return [...unique.values()];
  }
  private itemKey(item: BacklogItem): string {
    const legacy = item as BacklogItem & { id?: string };
    return `${item.project_id ?? 'legacy'}:${item.backlog_id ?? legacy.id ?? JSON.stringify(item)}`;
  }
  async decide(input: Omit<BacklogDecision, 'decision_id' | 'created_at'>): Promise<BacklogDecision> {
    let result!: BacklogDecision;
    this.decisionWriteChain = this.decisionWriteChain.then(async () => {
      const existing = (await this.decisions(input.project_id)).find((item) => item.backlog_id === input.backlog_id && item.priority === input.priority && item.rationale === input.rationale && item.decided_by === input.decided_by);
      if (existing) { result = existing; return; }
      result = { ...input, decision_id: `BD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, created_at: new Date().toISOString() };
      await mkdir(this.rootDir, { recursive: true });
      await appendFile(this.decisionsFile, `${JSON.stringify(result)}\n`, 'utf8');
    });
    await this.decisionWriteChain;
    return result;
  }
  async decisions(projectId?: string): Promise<BacklogDecision[]> { return this.read<BacklogDecision>(this.decisionsFile, projectId ? (item) => item.project_id === projectId : undefined); }
  private async read<T>(file: string, filter?: (item: T) => boolean): Promise<T[]> { try { const all = (await readFile(file, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line) as T); return filter ? all.filter(filter) : all; } catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; } }
}

export async function ceoPrioritize(items: BacklogItem[], ledger: BacklogLedger): Promise<BacklogDecision[]> {
  const ordered = [...items].sort((a, b) => a.priority.localeCompare(b.priority));
  const decisions: BacklogDecision[] = [];
  for (const item of ordered) decisions.push(await ledger.decide({ backlog_id: item.backlog_id, project_id: item.project_id, priority: item.priority, rationale: `CEO priority based on PM synthesis: ${item.rationale}`, decided_by: 'CEO' }));
  return decisions;
}
