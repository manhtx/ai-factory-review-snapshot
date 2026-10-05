import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { getRoleContract, type CompanyRoleId } from './roleContracts';

export type RoleHandoff = {
  handoff_id: string;
  project_id: string;
  work_id: string;
  from_role: CompanyRoleId;
  to_role: CompanyRoleId;
  actor: string;
  objective: string;
  context: string[];
  evidence_ids: string[];
  acceptance_criteria: string[];
  created_at: string;
};

export class RoleHandoffLedger {
  private readonly file: string;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly rootDir: string) { this.file = path.join(rootDir, 'role-handoffs.jsonl'); }

  async record(input: Omit<RoleHandoff, 'handoff_id' | 'created_at'> & { handoff_id?: string }): Promise<RoleHandoff> {
    getRoleContract(input.from_role);
    getRoleContract(input.to_role);
    if (!input.project_id || !input.work_id || !input.actor.trim() || !input.objective.trim()) throw new Error('handoff identity and objective are required');
    if (input.from_role === input.to_role) throw new Error('handoff requires distinct roles');
    if (!input.context.length || !input.evidence_ids.length || !input.acceptance_criteria.length) throw new Error('handoff requires context, evidence and acceptance criteria');
    const handoff: RoleHandoff = { ...input, handoff_id: input.handoff_id ?? `HANDOFF-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, created_at: new Date().toISOString() };
    await this.enqueue(async () => {
      const existing = await this.records();
      const duplicate = existing.find((item) => item.handoff_id === handoff.handoff_id);
      if (!duplicate) await this.append(handoff);
    });
    return (await this.records()).find((item) => item.handoff_id === handoff.handoff_id) ?? handoff;
  }

  async records(projectId?: string, workId?: string): Promise<RoleHandoff[]> {
    try {
      const rows = (await readFile(this.file, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line) as RoleHandoff);
      return rows.filter((item) => (!projectId || item.project_id === projectId) && (!workId || item.work_id === workId));
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }

  private async enqueue(operation: () => Promise<void>) { const previous = this.writeChain; let release!: () => void; this.writeChain = new Promise<void>((resolve) => { release = resolve; }); await previous; try { await operation(); } finally { release(); } }
  private async append(item: RoleHandoff) { await mkdir(this.rootDir, { recursive: true }); await appendFile(this.file, `${JSON.stringify(item)}\n`, 'utf8'); }
}
