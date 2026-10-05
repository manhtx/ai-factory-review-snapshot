import type { ProjectPrincipal, ProjectRegistry } from './projectRegistry';
import type { BoundedOrchestrator, CompanyTask, OrchestratorResult, Worker, WorkerResult } from './orchestrator';

export class ProjectOrchestrator {
  constructor(private readonly orchestratorFactory: (workers: Worker[], projectId: string, evaluate?: (result: WorkerResult) => Promise<void>, allowed?: (workerId: string) => Promise<boolean>, releaseGate?: () => Promise<{ ready: boolean; blockers: string[] }>) => BoundedOrchestrator, private readonly registry: ProjectRegistry, private readonly principal: ProjectPrincipal, private readonly projectId: string, private readonly workers: Worker[], private readonly evaluate?: (result: WorkerResult) => Promise<void>, private readonly allowed?: (workerId: string) => Promise<boolean>, private readonly releaseGate?: () => Promise<{ ready: boolean; blockers: string[] }>) {
    this.registry.authorize(principal, projectId);
  }
  run(task: Omit<CompanyTask, 'project_id'>): Promise<OrchestratorResult> {
    this.registry.authorize(this.principal, this.projectId);
    return this.orchestratorFactory(this.workers, this.projectId, this.evaluate, this.allowed, this.releaseGate).run({ ...task, project_id: this.projectId, task_id: `${this.projectId}:${task.task_id}` });
  }
}
