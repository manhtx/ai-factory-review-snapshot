import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ProductIdea } from './ideaLedger';
import type { CurrentRoleAuthority } from './roleWorkQueue';
import type { ResearchSignal } from './researchSignalLedger';
import { evaluateResearchQuorum } from './researchSynthesis';

export interface CeoReview { review_id: string; project_id: string; period: string; created_at: string; idea_count: number; scored_count: number; at_risk_ideas: string[]; ready_for_rescore_ideas: string[]; score_changes: Array<{ idea_id: string; previous?: number; current?: number; action: 'REDECIDE' | 'MONITOR' }>; }
export class CeoReviewLedger {
  private readonly file: string;
  constructor(private readonly rootDir: string) { this.file = path.join(rootDir, 'ceo-reviews.jsonl'); }
  async records(projectId?: string): Promise<CeoReview[]> { try { const rows = (await readFile(this.file, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line) as CeoReview); return projectId ? rows.filter((row) => row.project_id === projectId) : rows; } catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; } }
  async review(input: { projectId: string; period: string; ideas: ProductIdea[]; researchSignals?: ResearchSignal[]; authority?: CurrentRoleAuthority }): Promise<CeoReview> {
    const previous = (await this.records(input.projectId)).at(-1);
    const previousScores = new Map((previous?.score_changes ?? []).map((change) => [change.idea_id, change.current]));
    const score_changes = input.ideas.filter((idea) => idea.opportunity_score !== undefined).map((idea) => { const prior = previousScores.get(idea.idea_id); return { idea_id: idea.idea_id, previous: prior, current: idea.opportunity_score, action: prior !== undefined && Math.abs(prior - idea.opportunity_score!) >= 1 ? 'REDECIDE' as const : 'MONITOR' as const }; });
    const ready_for_rescore_ideas = input.ideas.filter((idea) => input.researchSignals && evaluateResearchQuorum(input.researchSignals, idea.idea_id, .6, input.projectId, input.authority).status === 'READY_FOR_RE_SCORE').map((idea) => idea.idea_id);
    const report: CeoReview = { review_id: `CEO-REVIEW-${Date.now()}`, project_id: input.projectId, period: input.period, created_at: new Date().toISOString(), idea_count: input.ideas.length, scored_count: input.ideas.filter((idea) => idea.opportunity_score !== undefined).length, at_risk_ideas: input.ideas.filter((idea) => idea.opportunity_decision === 'HOLD' || idea.opportunity_decision === 'DISCOVER').map((idea) => idea.idea_id), ready_for_rescore_ideas, score_changes };
    await mkdir(this.rootDir, { recursive: true }); await appendFile(this.file, `${JSON.stringify(report)}\n`, 'utf8'); return report;
  }
}
