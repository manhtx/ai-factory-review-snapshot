import { mkdir, readFile, appendFile } from 'node:fs/promises';
import path from 'node:path';

export interface ProjectFeatureFlag { project_id: string; flag: string; enabled: boolean; actor: string; reason: string; created_at: string; }

/** Append-only, project-scoped flags. No global toggle is permitted. */
export class ProjectFeatureFlagStore {
  private readonly file: string;
  constructor(private readonly rootDir: string) { this.file = path.join(rootDir, 'feature-flags.jsonl'); }
  async set(input: Omit<ProjectFeatureFlag, 'created_at'>): Promise<ProjectFeatureFlag> {
    if (!input.project_id || !input.flag || !input.actor || !input.reason) throw new Error('project-scoped flag fields required');
    await mkdir(this.rootDir, { recursive: true });
    const record = { ...input, created_at: new Date().toISOString() };
    await appendFile(this.file, `${JSON.stringify(record)}\n`, 'utf8');
    return record;
  }
  async isEnabled(projectId: string, flag: string): Promise<boolean> {
    if (!projectId || !flag) return false;
    try {
      const raw = await readFile(this.file, 'utf8');
      const records = raw.split('\n').filter(Boolean).map((line) => JSON.parse(line) as ProjectFeatureFlag).filter((item) => item.project_id === projectId && item.flag === flag);
      return records.at(-1)?.enabled ?? false;
    } catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
  }
}
