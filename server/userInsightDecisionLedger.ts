import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

export interface UserInsightDecision { decision_id: string; insight_id: string; project_id: string; action: "ACCEPT" | "REJECT"; actor_role: "pm"; rationale: string; evidence_ids: string[]; created_at: string; }

export class UserInsightDecisionLedger {
  private readonly file: string;
  private writeChain: Promise<void> = Promise.resolve();
  constructor(rootDir: string) { this.file = path.join(rootDir, "user-insight-decisions.jsonl"); }
  async record(input: Omit<UserInsightDecision, "decision_id" | "created_at">): Promise<UserInsightDecision> {
    if (!input.insight_id || !input.project_id || !input.rationale.trim() || !input.evidence_ids.length) throw new Error("insight decision requires rationale and evidence");
    let result!: UserInsightDecision;
    this.writeChain = this.writeChain.then(async () => {
      const existing = (await this.records(input.project_id)).find((item) => item.insight_id === input.insight_id);
      if (existing) { result = existing; return; }
      result = { ...input, decision_id: `UID-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, created_at: new Date().toISOString() };
      await mkdir(path.dirname(this.file), { recursive: true });
      await appendFile(this.file, `${JSON.stringify(result)}\n`, "utf8");
    });
    await this.writeChain;
    return result;
  }
  async records(projectId?: string): Promise<UserInsightDecision[]> {
    try { const rows = (await readFile(this.file, "utf8")).split("\n").filter(Boolean).map((line) => JSON.parse(line) as UserInsightDecision); return projectId ? rows.filter((row) => row.project_id === projectId) : rows; }
    catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  }
}
