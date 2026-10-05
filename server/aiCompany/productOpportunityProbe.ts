import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { BacklogLedger } from './backlogLedger';
import type { BacklogItem } from './backlogSynthesis';

export interface ProductOpportunity { opportunity_id: string; project_id: string; problem: string; evidence_ids: string[]; observed_metrics: Record<string, number>; confidence: number; state: 'CANDIDATE_LOCAL' | 'REQUIRES_PRODUCTION_VALIDATION'; created_at: string; }

export async function discoverTelemetryOpportunity(rootDir: string, projectId = 'macro-os'): Promise<ProductOpportunity | null> {
  const source = join(rootDir, 'user-telemetry.jsonl'); let events: Array<{ eventType?: string; sessionId?: string }> = [];
  try { events = (await readFile(source, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line)); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const sessions = new Set(events.map((event) => event.sessionId).filter(Boolean)); const compares = events.filter((event) => event.eventType === 'indicator_compare').length; const values = events.filter((event) => event.eventType === 'value_moment_achieved' || event.eventType === 'forecast_export').length;
  if (!sessions.size || compares < 10 || values / sessions.size >= 0.5) return null;
  return { opportunity_id: `OPP-TELEMETRY-${Date.now()}`, project_id: projectId, problem: 'Local telemetry suggests a drop-off between comparison activity and value completion; investigate whether the compare-to-explanation path is unclear.', evidence_ids: [`telemetry:${source}`, `metric:compare=${compares}`, `metric:value=${values}`, `metric:sessions=${sessions.size}`], observed_metrics: { sessions: sessions.size, compare_events: compares, value_events: values, value_per_session: values / sessions.size }, confidence: Math.min(0.85, 0.5 + Math.min(0.35, compares / 1000)), state: 'CANDIDATE_LOCAL', created_at: new Date().toISOString() };
}

export async function persistTelemetryOpportunity(rootDir: string, opportunity: ProductOpportunity) { const file = join(rootDir, 'product-opportunities.jsonl'); await mkdir(rootDir, { recursive: true }); await appendFile(file, `${JSON.stringify(opportunity)}\n`, 'utf8'); return opportunity; }

export async function materializeTelemetryOpportunityBacklog(ledger: BacklogLedger, opportunity: ProductOpportunity): Promise<BacklogItem> {
  const item: BacklogItem = { backlog_id: 'BL-TELEMETRY-COMPARE-EXPLANATION', project_id: opportunity.project_id, task_id: opportunity.opportunity_id, title: 'Validate compare-to-explanation path against observed value drop-off', priority: 'P1', rationale: `${opportunity.problem} Evidence: ${opportunity.evidence_ids.join(', ')}`, source_feedback_ids: opportunity.evidence_ids, acceptance_criteria: ['measure fresh compare and explanation events', 'preserve correlation-versus-causation caveat', 'record outcome as WIN, LOSS, INCONCLUSIVE or AWAITING_REAL_EVIDENCE'], status: 'PROPOSED' };
  await ledger.add([item]);
  return item;
}
