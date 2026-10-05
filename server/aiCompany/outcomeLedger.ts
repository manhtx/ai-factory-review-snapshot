import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export type OutcomeActor = 'user-persona' | 'ux-research' | 'stakeholder-panel' | 'domain-expert' | 'pm';
export type OutcomeVerdict = 'SUCCESS' | 'PARTIAL' | 'FAILURE' | 'BLOCKED';

export interface ProductOutcome {
  outcome_id: string;
  project_id: string;
  task_id: string;
  actor: OutcomeActor;
  persona: string;
  workflow: string;
  verdict: OutcomeVerdict;
  metric: { name: string; value: number; target?: number; unit?: string };
  evidence_ids: string[];
  findings: string[];
  created_at: string;
}

export class OutcomeLedger {
  private readonly file: string;
  constructor(private readonly rootDir: string) { this.file = path.join(rootDir, 'outcomes.jsonl'); }

  async record(input: Omit<ProductOutcome, 'outcome_id' | 'created_at'>): Promise<ProductOutcome> {
    if (!input.project_id || !input.task_id || !input.persona || !input.workflow) throw new Error('outcome scope is required');
    if (!input.evidence_ids.length) throw new Error('outcome evidence is required');
    if (!Number.isFinite(input.metric.value)) throw new Error('outcome metric must be finite');
    await mkdir(this.rootDir, { recursive: true });
    const outcome: ProductOutcome = { ...input, outcome_id: `OUT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, created_at: new Date().toISOString() };
    await appendFile(this.file, `${JSON.stringify(outcome)}\n`, 'utf8');
    return outcome;
  }

  async records(projectId?: string): Promise<ProductOutcome[]> {
    try {
      const raw = await readFile(this.file, 'utf8');
      const records = raw.split('\n').filter(Boolean).map((line) => JSON.parse(line) as ProductOutcome);
      return projectId ? records.filter((record) => record.project_id === projectId) : records;
    } catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  }
}

export function summarizeProductOutcomes(outcomes: ProductOutcome[]) {
  const success = outcomes.filter((outcome) => outcome.verdict === 'SUCCESS').length;
  const measured = outcomes.filter((outcome) => outcome.metric.target !== undefined);
  const targetHits = measured.filter((outcome) => outcome.metric.value >= (outcome.metric.target ?? Infinity)).length;
  return { total: outcomes.length, success, success_rate: outcomes.length ? success / outcomes.length : 0, target_hits: targetHits, target_rate: measured.length ? targetHits / measured.length : 0, blocked: outcomes.filter((outcome) => outcome.verdict === 'BLOCKED').length };
}

/** A cycle earns product credit only from evidence-backed improvement or learning. */
export function evaluateVerifiedCycleValue(outcomes: ProductOutcome[]): { verified: boolean; basis: 'IMPROVEMENT' | 'LEARNING' | 'NONE'; evidence_ids: string[] } {
  const eligible = outcomes.filter((outcome) => outcome.evidence_ids.length > 0 && outcome.verdict !== 'BLOCKED');
  const improvement = eligible.find((outcome) => outcome.verdict === 'SUCCESS' && (outcome.metric.target === undefined || outcome.metric.value >= outcome.metric.target));
  if (improvement) return { verified: true, basis: 'IMPROVEMENT', evidence_ids: improvement.evidence_ids };
  const learning = eligible.find((outcome) => outcome.findings.some((finding) => /learn|invalidat|discover|prevent|simplif|risk/i.test(finding)));
  if (learning) return { verified: true, basis: 'LEARNING', evidence_ids: learning.evidence_ids };
  return { verified: false, basis: 'NONE', evidence_ids: [] };
}
