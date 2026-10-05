import type { OperatingReviewCadence } from './operatingCadence';
import { cadencePolicyFor } from './operatingCadence';
import { isIssuedCurrentRoleAuthority, type CurrentRoleAuthority } from './roleWorkQueue';

export interface CadenceQuorumResult { ok: boolean; cadence: OperatingReviewCadence; required_roles: string[]; completed_roles: string[]; blockers: string[]; }

export function evaluateCadenceQuorum(input: { cadence: OperatingReviewCadence; authority: CurrentRoleAuthority | undefined }): CadenceQuorumResult {
  const policy = cadencePolicyFor(input.cadence);
  if (!isIssuedCurrentRoleAuthority(input.authority)) return { ok: false, cadence: input.cadence, required_roles: policy.accountable_roles, completed_roles: [], blockers: ['current evidence authority is missing or invalid'] };
  const authority = input.authority;
  const governance = authority.currentRows().filter((item) => item.backlog_id.startsWith(`CADENCE:${input.cadence}:`));
  const completed = governance.filter((item) => authority.isSuccessful(item) && item.evidence_ids.length > 0).map((item) => item.role);
  const blockers = policy.accountable_roles.flatMap((role) => {
    const item = governance.find((candidate) => candidate.role === role);
    if (!item) return [`missing governance work: ${role}`];
    if (item.state !== 'DONE') return [`governance work ${role} is ${item.state}`];
    if (!item.evidence_ids.length) return [`governance work ${role} has no evidence`];
    if (!authority.isSuccessful(item)) return [`governance work ${role} current authority is invalid`];
    return [];
  });
  return { ok: blockers.length === 0, cadence: input.cadence, required_roles: policy.accountable_roles, completed_roles: completed, blockers };
}
