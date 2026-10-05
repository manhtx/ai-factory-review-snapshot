import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { isCurrentAdvisorySignal } from './researchSynthesis';
import type { ResearchSignal } from './researchSignalLedger';
import type { CurrentRoleAuthority } from './roleWorkQueue';
import type { BacklogLedger } from './backlogLedger';
import { scoreOpportunity, scoreOpportunityWithResearch, type OpportunityScoreInput, type OpportunityScore } from './opportunityScoring';

export interface ProductIdea { idea_id: string; project_id: string; title: string; problem: string; target_persona: string; product_goal_reference: string; differentiation_hypothesis: string; validation_metric: string; status: 'DISCOVERED' | 'VALIDATING' | 'ACCEPTED' | 'REJECTED'; opportunity_score?: number; opportunity_decision?: OpportunityScore['decision']; created_at: string; }

export class IdeaLedger {
  private readonly file: string;
  constructor(private readonly rootDir: string) { this.file = path.join(rootDir, 'ideas.jsonl'); }
  async add(idea: Omit<ProductIdea, 'created_at'>): Promise<ProductIdea> { const existing = (await this.records(idea.project_id)).find((item) => item.idea_id === idea.idea_id); if (existing) return existing; await mkdir(this.rootDir, { recursive: true }); const record = { ...idea, created_at: new Date().toISOString() }; await appendFile(this.file, `${JSON.stringify(record)}\n`, 'utf8'); return record; }
  async decide(ideaId: string, status: Exclude<ProductIdea['status'], 'DISCOVERED'>): Promise<ProductIdea> { const item = (await this.records()).find((row) => row.idea_id === ideaId); if (!item) throw new Error(`idea not found: ${ideaId}`); if (item.status === 'REJECTED' || item.status === 'ACCEPTED') throw new Error(`idea is already decided: ${item.status}`); const record = { ...item, status, created_at: new Date().toISOString() }; await this.append(record); return record; }
  async score(ideaId: string, dimensions: Omit<OpportunityScoreInput, 'idea_id'>): Promise<ProductIdea> { const item = (await this.records()).find((row) => row.idea_id === ideaId); if (!item) throw new Error(`idea not found: ${ideaId}`); const scored = scoreOpportunity({ idea_id: ideaId, ...dimensions }); const record = { ...item, opportunity_score: scored.score, opportunity_decision: scored.decision, created_at: new Date().toISOString() }; await this.append(record); return record; }
  async scoreWithResearch(ideaId: string, dimensions: Omit<OpportunityScoreInput, 'idea_id'>, signals: ResearchSignal[], authority?: CurrentRoleAuthority): Promise<ProductIdea> { const item = (await this.records()).find((row) => row.idea_id === ideaId); if (!item) throw new Error(`idea not found: ${ideaId}`); const scored = scoreOpportunityWithResearch({ idea_id: ideaId, ...dimensions }, signals.filter(signal => signal.project_id === item.project_id && signal.signal_id.startsWith(`RS-${ideaId}:research:`) && isCurrentAdvisorySignal(signal, authority))); const record = { ...item, opportunity_score: scored.score, opportunity_decision: scored.decision, created_at: new Date().toISOString() }; await this.append(record); return record; }
  async records(projectId?: string): Promise<ProductIdea[]> { try { const rows = (await readFile(this.file, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line) as ProductIdea); const latest = new Map(rows.map((row) => [row.idea_id, row])); const result = [...latest.values()]; return projectId ? result.filter((row) => row.project_id === projectId) : result; } catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; } }
  private async append(record: ProductIdea) { await mkdir(this.rootDir, { recursive: true }); await appendFile(this.file, `${JSON.stringify(record)}\n`, 'utf8'); }
}

export async function promoteAcceptedIdea(ledger: IdeaLedger, backlog: BacklogLedger, ideaId: string) {
  const idea = (await ledger.records()).find((row) => row.idea_id === ideaId);
  if (!idea || idea.status !== 'ACCEPTED') throw new Error('only accepted ideas can be promoted');
  const backlogId = `IDEA-${idea.idea_id}`;
  const existing = (await backlog.items(idea.project_id)).find((item) => item.backlog_id === backlogId);
  if (existing) return existing;
  const item = { backlog_id: backlogId, project_id: idea.project_id, task_id: idea.idea_id, title: idea.title, priority: 'P1' as const, rationale: `${idea.problem} Differentiation: ${idea.differentiation_hypothesis}`, source_feedback_ids: [], acceptance_criteria: [idea.validation_metric], status: 'PROPOSED' as const };
  await backlog.add([item]);
  return item;
}

export const baselineMacroOsIdeas: readonly Omit<ProductIdea, 'created_at'>[] = [
  { idea_id: 'IDEA-EVIDENCE-GRAPH', project_id: 'macro-os', title: 'Evidence Graph: why did this move?', problem: 'Users see a change but must manually connect releases, market moves and competing explanations.', target_persona: 'macro analyst', product_goal_reference: 'Global daily intelligence baseline; objectives 6 and 9', differentiation_hypothesis: 'An inspectable causal-evidence graph can make Macro OS faster and more trustworthy than headline feeds.', validation_metric: 'At least 70% of test users identify one supported explanation within 30 seconds', status: 'DISCOVERED' },
  { idea_id: 'IDEA-RELEASE-CALENDAR', project_id: 'macro-os', title: 'Personal release radar', problem: 'Investors miss upcoming releases that can change a country or asset regime.', target_persona: 'portfolio manager', product_goal_reference: 'Product objectives 2, 6 and 9', differentiation_hypothesis: 'A freshness-aware calendar tied to user workspaces creates proactive daily value without prediction.', validation_metric: 'Users save five relevant releases and return before the next publication', status: 'DISCOVERED' },
  { idea_id: 'IDEA-RESEARCH-REPLAY', project_id: 'macro-os', title: 'Research replay and decision journal', problem: 'Users cannot reproduce what data and assumptions supported an earlier view.', target_persona: 'long-horizon investor', product_goal_reference: 'Product philosophy and objective 7', differentiation_hypothesis: 'Replayable evidence snapshots and outcome scoring compound trust and learning over years.', validation_metric: 'A user can reproduce a prior research answer and inspect every changed input', status: 'DISCOVERED' },
];

export async function ensureBaselineIdeas(ledger: IdeaLedger): Promise<ProductIdea[]> { const created: ProductIdea[] = []; for (const idea of baselineMacroOsIdeas) { const before = await ledger.records(idea.project_id); if (!before.some((item) => item.idea_id === idea.idea_id)) created.push(await ledger.add(idea)); } return created; }
