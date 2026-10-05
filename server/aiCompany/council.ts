import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export interface CouncilBrief { task_id: string; project_id: string; artifact_ids: string[]; question: string; }
export interface CouncilFeedback { feedback_id: string; council_id: string; task_id: string; project_id: string; verdict: 'ACCEPT' | 'REVISE' | 'REJECT'; findings: string[]; confidence: number; evidence_ids: string[]; created_at: string; }
export interface CouncilMember { council_id: string; review: (brief: CouncilBrief) => Promise<Omit<CouncilFeedback, 'feedback_id' | 'created_at' | 'council_id'>>; }

export class FeedbackLedger {
  private readonly file: string;
  constructor(private readonly rootDir: string) { this.file = path.join(rootDir, 'feedback.jsonl'); }
  async record(feedback: Omit<CouncilFeedback, 'feedback_id' | 'created_at'>): Promise<CouncilFeedback> {
    await mkdir(this.rootDir, { recursive: true });
    const saved = { ...feedback, feedback_id: `FDB-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, created_at: new Date().toISOString() };
    await appendFile(this.file, `${JSON.stringify(saved)}\n`, 'utf8');
    return saved;
  }
  async records(taskId?: string): Promise<CouncilFeedback[]> {
    try { const all = (await readFile(this.file, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line) as CouncilFeedback); return taskId ? all.filter((item) => item.task_id === taskId) : all; }
    catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  }
}

export async function runIndependentCouncil(brief: CouncilBrief, members: CouncilMember[], ledger: FeedbackLedger): Promise<CouncilFeedback[]> {
  if (!members.length) throw new Error('at least one independent council member is required');
  const outputs: CouncilFeedback[] = [];
  for (const member of members) {
    const result = await member.review(brief);
    if (result.project_id !== brief.project_id || result.task_id !== brief.task_id) throw new Error(`council ${member.council_id} returned invalid scope`);
    outputs.push(await ledger.record({ ...result, council_id: member.council_id }));
  }
  return outputs;
}
