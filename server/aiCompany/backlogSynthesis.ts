import type { CouncilFeedback } from './council';
import type { RiskLevel } from './domainTypes';

export interface BacklogItem { backlog_id: string; project_id: string; task_id: string; title: string; priority: RiskLevel; rationale: string; source_feedback_ids: string[]; source_outcome_ids?: string[]; acceptance_criteria: string[]; status: 'PROPOSED'; }

export function synthesizeBacklog(projectId: string, taskId: string, feedback: CouncilFeedback[]): BacklogItem[] {
  if (feedback.some((item) => item.project_id !== projectId || item.task_id !== taskId)) throw new Error('feedback scope mismatch');
  const grouped = new Map<string, CouncilFeedback[]>();
  for (const item of feedback) for (const finding of item.findings) { const key = finding.trim(); if (key) grouped.set(key, [...(grouped.get(key) ?? []), item]); }
  return [...grouped].map(([title, items], index) => {
    const rejected = items.some((item) => item.verdict === 'REJECT');
    const revise = items.some((item) => item.verdict === 'REVISE');
    const priority = rejected ? 'P0' : revise ? 'P1' : 'P2';
    return { backlog_id: `BL-${Date.now()}-${index}`, project_id: projectId, task_id: taskId, title, priority, rationale: `${items.length} independent council finding(s); confidence=${(items.reduce((sum, item) => sum + item.confidence, 0) / items.length).toFixed(2)}`, source_feedback_ids: items.map((item) => item.feedback_id), acceptance_criteria: [`resolve finding: ${title}`], status: 'PROPOSED' };
  });
}
