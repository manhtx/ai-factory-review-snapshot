import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { CompanyHealth } from './healthMetrics';

export interface AgentPrincipleVersion { version: number; agent_id: string; principles: string[]; trigger: string; created_at: string; }

export class AgentPrinciplesLedger {
  private readonly file: string;
  constructor(private readonly rootDir: string) { this.file = path.join(rootDir, 'agent-principles.jsonl'); }
  async record(agentId: string, principles: string[], trigger: string): Promise<AgentPrincipleVersion> { await mkdir(this.rootDir, { recursive: true }); const versions = await this.records(agentId); const record = { version: (versions.at(-1)?.version ?? 0) + 1, agent_id: agentId, principles, trigger, created_at: new Date().toISOString() }; await appendFile(this.file, `${JSON.stringify(record)}\n`, 'utf8'); return record; }
  async records(agentId?: string): Promise<AgentPrincipleVersion[]> { try { const all = (await readFile(this.file, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line) as AgentPrincipleVersion); return agentId ? all.filter((item) => item.agent_id === agentId) : all; } catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; } }
}

export async function updatePrinciplesFromHealth(ledger: AgentPrinciplesLedger, health: CompanyHealth): Promise<AgentPrincipleVersion[]> {
  const updates: AgentPrincipleVersion[] = [];
  if (health.agent_failure_rate > .1) updates.push(await ledger.record('functional-qa', ['always emit evidence IDs', 'fail closed when acceptance criteria are ambiguous', 'report reproducible failure steps'], `agent_failure_rate=${health.agent_failure_rate.toFixed(3)}`));
  if (health.evidence_coverage < .95) updates.push(await ledger.record('all-agents', ['every conclusion must link provenance evidence', 'never claim completion without an artifact'], `evidence_coverage=${health.evidence_coverage.toFixed(3)}`));
  return updates;
}
