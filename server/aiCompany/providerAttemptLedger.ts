import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

export interface ProviderAttempt { attempt_id: string; project_id: string; work_id: string; provider_id: string; model: string; attempt: number; latency_ms: number; outcome: "SUCCESS" | "FAILURE"; retryable: boolean; error?: string; input_tokens: number; output_tokens: number; estimated_cost_usd: number; created_at: string; }
export class ProviderAttemptLedger {
  private readonly file: string;
  constructor(private readonly rootDir: string) { this.file = path.join(rootDir, "provider-attempts.jsonl"); }
  async record(input: Omit<ProviderAttempt, "attempt_id" | "created_at">): Promise<ProviderAttempt> {
    const row = { ...input, attempt_id: `PAT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, created_at: new Date().toISOString() };
    await mkdir(this.rootDir, { recursive: true }); await appendFile(this.file, `${JSON.stringify(row)}\n`, "utf8"); return row;
  }
  async records(projectId?: string): Promise<ProviderAttempt[]> { try { const rows = (await readFile(this.file, "utf8")).split("\n").filter(Boolean).map((line) => JSON.parse(line) as ProviderAttempt); return projectId ? rows.filter((row) => row.project_id === projectId) : rows; } catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; } }
  async circuitState(input: { projectId: string; providerId: string; threshold: number; cooldownMs: number; now?: number }) { const now = input.now ?? Date.now(); const rows = (await this.records(input.projectId)).filter((row) => row.provider_id === input.providerId).sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)); let failures = 0; let openedAt = 0; for (const row of rows.reverse()) { if (row.outcome === 'SUCCESS') break; failures += 1; if (failures >= input.threshold) { openedAt = Date.parse(row.created_at); break; } } const open = failures >= input.threshold && now - openedAt < input.cooldownMs; return { state: open ? 'OPEN' as const : failures >= input.threshold ? 'HALF_OPEN' as const : 'CLOSED' as const, consecutive_failures: failures, opened_at: openedAt ? new Date(openedAt).toISOString() : null }; }
}
