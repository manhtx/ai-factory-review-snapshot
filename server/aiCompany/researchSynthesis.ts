import { createHash } from 'node:crypto';
import type { ResearchSignalLedger } from './researchSignalLedger';
import { isSuccessfulRoleWork, isIssuedCurrentRoleAuthority, type CurrentRoleAuthority, type RoleWorkItem } from './roleWorkQueue';
import type { ResearchSignal, ResearchWorkOrigin } from './researchSignalLedger';

const researchRoles = ['user-persona', 'ux-research', 'stakeholder-panel', 'domain-expert'];
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function researchWorkOrigin(item: RoleWorkItem, rows: readonly RoleWorkItem[]): ResearchWorkOrigin | undefined {
  if (!isSuccessfulRoleWork(item, rows)) return undefined;
  const byId = new Map(rows.map(row => [row.work_id, row]));
  const current = byId.get(item.work_id)!;
  if (!current.attempt_id || !Number.isSafeInteger(current.queue_revision) || current.queue_revision! < 1 || !current.research_result) return undefined;
  const visited = new Set<string>(), inputs: Array<{work_id: string; row_sha256: string | null}> = [];
  const pending = [...(current.depends_on ?? [])];
  while (pending.length) { const id = pending.pop()!; if (visited.has(id)) continue; visited.add(id); const row = byId.get(id); inputs.push({work_id:id,row_sha256:row ? hash(row) : null}); if (row) pending.push(...(row.depends_on ?? [])); }
  inputs.sort((a,b) => a.work_id.localeCompare(b.work_id));
  return {work_id:current.work_id,attempt_id:current.attempt_id!,queue_revision:current.queue_revision!,work_sha256:hash(current),input_sha256:hash(inputs)};
}
export function hasMatchingResearchWorkOrigin(signal: ResearchSignal, rows: readonly RoleWorkItem[] | undefined): boolean {
  if (!Array.isArray(rows) || signal.source_type !== 'AI_ADVISORY' || !signal.work_origin || !Number.isFinite(signal.confidence) || signal.confidence < 0 || signal.confidence > 1) return false;
  const matches = rows.filter(row => row.work_id === signal.work_origin!.work_id);
  if (matches.length !== 1) return false; const item = matches[0], result = item.research_result;
  const origin = researchWorkOrigin(item, rows);
  return Boolean(origin && Object.entries(origin).every(([key,value]) => signal.work_origin![key as keyof ResearchWorkOrigin] === value)
    && item.project_id === signal.project_id && item.role === signal.persona && researchRoles.includes(item.role) && signal.signal_id === `RS-${item.backlog_id}`
    && result && item.evidence_ids.includes(result.source_reference) && signal.source_reference === result.source_reference && signal.research_question === result.research_question && signal.finding === result.finding && signal.confidence === result.confidence);
}
export function isCurrentAdvisorySignal(signal: ResearchSignal, authority?: CurrentRoleAuthority): boolean {
  if (!isIssuedCurrentRoleAuthority(authority)) return false;
  const rows=authority.currentRows(),item=rows.find(row=>row.work_id===signal.work_origin?.work_id);
  return Boolean(item && authority.isSuccessful(item) && hasMatchingResearchWorkOrigin(signal,rows));
}
export async function synthesizeCompletedResearch(input: { projectId: string; authority: CurrentRoleAuthority; ledger: ResearchSignalLedger }): Promise<number> {
  if (!isIssuedCurrentRoleAuthority(input.authority)) throw new Error('queue-issued current evidence authority is required for synthesis');
  const rows=input.authority.currentRows();
  let created = 0;
  for (const item of rows.filter((candidate) => candidate.project_id === input.projectId && input.authority.isSuccessful(candidate) && candidate.research_result && researchRoles.includes(candidate.role))) {
    const result = item.research_result!;
    const origin = researchWorkOrigin(item, rows);
    if (!origin || !item.evidence_ids.includes(result.source_reference)) continue;
    const before = await input.ledger.records(input.projectId);
    const signalId = `RS-${item.backlog_id}`;
    if (before.some((signal) => signal.signal_id === signalId)) continue;
    if (!input.authority.isSuccessful(item)) continue;
    await input.ledger.record({ signal_id: signalId, project_id: input.projectId, source_type: 'AI_ADVISORY', work_origin: origin, persona: item.role, research_question: result.research_question, source_reference: result.source_reference, finding: result.finding, confidence: result.confidence, observed_metric: undefined });
    created += 1;
  }
  return created;
}

export function evaluateResearchQuorum(signals: ResearchSignal[], ideaId: string, minimumConfidence = .6, projectId = 'macro-os', authority?: CurrentRoleAuthority): { status: 'READY_FOR_RE_SCORE' | 'RESEARCH_INCOMPLETE'; basis: 'AI_ADVISORY_ONLY'; missingRoles: string[]; weakRoles: string[] } {
  const relevant = signals.filter(signal => signal.project_id === projectId && researchRoles.includes(signal.persona) && signal.signal_id === `RS-${ideaId}:research:${signal.persona}` && isCurrentAdvisorySignal(signal, authority));
  const missingRoles = researchRoles.filter(role => relevant.filter(signal => signal.persona === role).length !== 1);
  const weakRoles = researchRoles.filter(role => relevant.some(signal => signal.persona === role && (!Number.isFinite(minimumConfidence) || minimumConfidence < 0 || minimumConfidence > 1 || signal.confidence < minimumConfidence)));
  return { basis: 'AI_ADVISORY_ONLY', status: !ideaId || missingRoles.length || weakRoles.length ? 'RESEARCH_INCOMPLETE' : 'READY_FOR_RE_SCORE', missingRoles, weakRoles };
}
