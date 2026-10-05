import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface ProjectDefinition { project_id: string; name: string; product_goal: string; target_users: string[]; state_dir: string; monthly_budget_usd: number; active: boolean }
export interface ProjectPrincipal { actor_id: string; project_ids: string[]; role: string }

export class ProjectRegistry {
  private readonly projects = new Map<string, ProjectDefinition>();
  constructor(private readonly rootDir: string) {}
  private get snapshotFile(): string { return path.join(this.rootDir, 'projects.json'); }
  async register(input: Omit<ProjectDefinition, 'state_dir'> & { state_dir?: string }): Promise<ProjectDefinition> {
    if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(input.project_id)) throw new Error('invalid project_id');
    if (!input.product_goal.trim() || !input.target_users.length) throw new Error('product goal and target users are required');
    if (input.monthly_budget_usd < 0) throw new Error('budget cannot be negative');
    if (this.projects.has(input.project_id)) throw new Error('project already exists');
    const definition = { ...input, state_dir: input.state_dir ?? path.join(this.rootDir, 'projects', input.project_id) };
    await mkdir(definition.state_dir, { recursive: true });
    this.projects.set(definition.project_id, definition);
    return definition;
  }
  get(projectId: string): ProjectDefinition { const project = this.projects.get(projectId); if (!project) throw new Error(`unknown project: ${projectId}`); return project; }
  authorize(principal: ProjectPrincipal, projectId: string): ProjectDefinition {
    const project = this.get(projectId);
    if (!principal.project_ids.includes(projectId)) throw new Error(`project access denied: ${principal.actor_id} -> ${projectId}`);
    return project;
  }
  list(): ProjectDefinition[] { return [...this.projects.values()]; }
  async save(): Promise<void> { await mkdir(this.rootDir, { recursive: true }); await writeFile(this.snapshotFile, JSON.stringify({ schema_version: '1.0.0', projects: this.list() }, null, 2) + '\n', 'utf8'); }
  async restore(): Promise<void> {
    try {
      const snapshot = JSON.parse(await readFile(this.snapshotFile, 'utf8')) as { schema_version?: string; projects?: ProjectDefinition[] };
      if (snapshot.schema_version !== '1.0.0' || !Array.isArray(snapshot.projects)) throw new Error('invalid project registry snapshot');
      this.projects.clear();
      for (const project of snapshot.projects) { if (this.projects.has(project.project_id)) throw new Error('duplicate project in snapshot'); this.projects.set(project.project_id, project); }
    } catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
  }
}
