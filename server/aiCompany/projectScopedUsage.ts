import type { UsageLedger, UsageRecord } from './usageLedger';
import type { ProjectPrincipal, ProjectRegistry } from './projectRegistry';

export class ProjectScopedUsageLedger {
  constructor(private readonly ledger: UsageLedger, private readonly registry: ProjectRegistry, private readonly principal: ProjectPrincipal, private readonly projectId: string) { this.registry.authorize(principal, projectId); }
  async record(input: Omit<UsageRecord, 'usage_id' | 'created_at' | 'run_id'> & { run_id: string }): Promise<UsageRecord> {
    this.registry.authorize(this.principal, this.projectId);
    return this.ledger.record({ ...input, run_id: `${this.projectId}:${input.run_id}` });
  }
  async records(): Promise<UsageRecord[]> { this.registry.authorize(this.principal, this.projectId); return (await this.ledger.records()).filter((record) => record.run_id.startsWith(`${this.projectId}:`)); }
}
