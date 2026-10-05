import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ProductBacklogItem, Sprint } from './productBacklog';
import { definitionOfReady } from './productBacklog';

export class SprintLedger {
  private chain: Promise<void> = Promise.resolve();
  private readonly file: string;
  constructor(private readonly rootDir: string) { this.file = path.join(rootDir, 'sprints.jsonl'); }
  async list(): Promise<Sprint[]> { try { return (await readFile(this.file, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line) as Sprint); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; } }
  async create(input: Omit<Sprint, 'created_at'>): Promise<Sprint> { if (!input.sprint_id || !input.goal.trim()) throw new Error('SPRINT_ID_AND_GOAL_REQUIRED'); if (input.status !== 'PLANNING') throw new Error('SPRINT_MUST_START_IN_PLANNING'); const existing = (await this.list()).find((sprint) => sprint.sprint_id === input.sprint_id); if (existing) return existing; const sprint = { ...input, created_at: new Date().toISOString() }; await mkdir(this.rootDir, { recursive: true }); this.chain = this.chain.then(() => appendFile(this.file, `${JSON.stringify(sprint)}\n`, 'utf8')); await this.chain; return sprint; }
  async select(sprintId: string, items: ProductBacklogItem[]): Promise<Sprint> { const sprint = (await this.list()).find((candidate) => candidate.sprint_id === sprintId); if (!sprint) throw new Error('SPRINT_NOT_FOUND'); if (sprint.status !== 'PLANNING') throw new Error('SPRINT_NOT_IN_PLANNING'); if (items.length > sprint.capacity_policy.max_active_product_items) throw new Error('SPRINT_CAPACITY_EXCEEDED'); for (const item of items) { const ready = definitionOfReady(item); if (ready.status !== 'READY') throw new Error(`BACKLOG_ITEM_NOT_READY:${item.backlog_id}:${ready.reasons.join(',')}`); } const selected = { ...sprint, selected_backlog_ids: items.map((item) => item.backlog_id), status: 'ACTIVE' as const, started_at: new Date().toISOString() }; this.chain = this.chain.then(async () => { const all = await this.list(); const output = all.map((candidate) => candidate.sprint_id === sprintId ? selected : candidate); await mkdir(this.rootDir, { recursive: true }); const tmp = `${this.file}.tmp`; const { writeFile, rename } = await import('node:fs/promises'); await writeFile(tmp, `${output.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8'); await rename(tmp, this.file); }); await this.chain; return selected; }
  async amend(sprintId: string, items: ProductBacklogItem[], reason: string): Promise<Sprint> {
    if (!reason.trim()) throw new Error('SPRINT_AMENDMENT_REASON_REQUIRED');
    const sprint = (await this.list()).find((candidate) => candidate.sprint_id === sprintId);
    if (!sprint) throw new Error('SPRINT_NOT_FOUND');
    if (sprint.status !== 'ACTIVE') throw new Error('SPRINT_NOT_ACTIVE');
    const existing = new Set(sprint.selected_backlog_ids);
    const additions = items.filter((item) => !existing.has(item.backlog_id));
    if (sprint.selected_backlog_ids.length + additions.length > sprint.capacity_policy.max_active_product_items) throw new Error('SPRINT_CAPACITY_EXCEEDED');
    for (const item of additions) {
      const ready = definitionOfReady(item);
      if (ready.status !== 'READY') throw new Error(`BACKLOG_ITEM_NOT_READY:${item.backlog_id}:${ready.reasons.join(',')}`);
    }
    const amended: Sprint = { ...sprint, selected_backlog_ids: [...sprint.selected_backlog_ids, ...additions.map((item) => item.backlog_id)], amendment_history: [...(sprint.amendment_history ?? []), { amended_at: new Date().toISOString(), reason: reason.trim(), added_backlog_ids: additions.map((item) => item.backlog_id) }] };
    this.chain = this.chain.then(async () => {
      const all = await this.list();
      const output = all.map((candidate) => candidate.sprint_id === sprintId ? amended : candidate);
      await mkdir(this.rootDir, { recursive: true });
      const tmp = `${this.file}.tmp`;
      const { writeFile, rename } = await import('node:fs/promises');
      await writeFile(tmp, `${output.map((row) => JSON.stringify(row)).join('\n')}\n`);
      await rename(tmp, this.file);
    });
    await this.chain;
    return amended;
  }
}
