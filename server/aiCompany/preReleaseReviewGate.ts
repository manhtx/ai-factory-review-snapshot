import { isIssuedCurrentRoleAuthority, type CurrentRoleAuthority } from './roleWorkQueue';

export const preReleaseReviewRoles = ['functional-qa', 'quality-control', 'stakeholder-panel', 'user-persona', 'ux-research', 'domain-expert'] as const;
export interface PreReleaseReviewGateResult { ready: boolean; blockers: string[]; approvedRoles: string[]; }

export function evaluatePreReleaseReviewGate(authority: CurrentRoleAuthority | undefined, backlogId: string): PreReleaseReviewGateResult {
  if (!isIssuedCurrentRoleAuthority(authority)) return { ready: false, approvedRoles: [], blockers: ['current evidence authority is missing or invalid'] };
  const relevant = authority.currentRows().filter((item) => item.backlog_id === backlogId || item.backlog_id.startsWith(`${backlogId}:`));
  const blockers: string[] = [];
  const approvedRoles: string[] = [];
  for (const role of preReleaseReviewRoles) {
    const item = relevant.find((candidate) => candidate.role === role);
    if (!item) blockers.push(`${role} review missing`);
    else if (item.state !== 'DONE') blockers.push(`${role} review is ${item.state}`);
    else if (!item.evidence_ids.length) blockers.push(`${role} review evidence missing`);
    else if (!authority.isSuccessful(item)) blockers.push(`${role} review current authority is invalid`);
    else approvedRoles.push(role);
  }
  return { ready: blockers.length === 0, blockers, approvedRoles };
}
