import type { ProjectPrincipal, ProjectRegistry } from './projectRegistry';
import type { CompanyStateStore, Checkpoint, TransitionResult, WorkflowState } from './stateStore';

export class ProjectScopedStateStore {
  constructor(private readonly store: CompanyStateStore, private readonly registry: ProjectRegistry, private readonly principal: ProjectPrincipal, private readonly projectId: string) {
    this.registry.authorize(principal, projectId);
  }
  private aggregate(taskId: string): string { return `${this.projectId}:${taskId}`; }
  async stateOf(taskId: string): Promise<WorkflowState | null> { this.registry.authorize(this.principal, this.projectId); return this.store.stateOf(this.aggregate(taskId)); }
  async transition(input: Omit<Parameters<CompanyStateStore['transition']>[0], 'aggregateId'> & { taskId: string }): Promise<TransitionResult> {
    this.registry.authorize(this.principal, this.projectId);
    return this.store.transition({ ...input, aggregateId: this.aggregate(input.taskId) });
  }
  async checkpoint(input: Omit<Parameters<CompanyStateStore['checkpoint']>[0], 'aggregateId'> & { taskId: string }): Promise<Checkpoint> {
    this.registry.authorize(this.principal, this.projectId);
    return this.store.checkpoint({ ...input, aggregateId: this.aggregate(input.taskId) });
  }
}
