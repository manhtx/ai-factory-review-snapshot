import type { WorkflowState } from './stateStore';

export type CompanyRoleId =
  | 'ceo' | 'pm' | 'coder' | 'data-engineer' | 'backend-engineer' | 'frontend-engineer'
  | 'ai-engineer' | 'sre' | 'security' | 'functional-qa' | 'quality-control'
  | 'ux-research' | 'stakeholder-panel' | 'user-persona' | 'domain-expert' | 'ceo-guild' | 'tech-lead' | 'critic'
  | 'release-security-gate';

export type OperatingCadence = 'near_real_time' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
export type CompanyOperation = 'PROPOSE' | 'IMPLEMENT' | 'REVIEW' | 'PRIORITIZE' | 'MEASURE_OUTCOME' | 'RELEASE' | 'ROLLBACK' | 'READ_SECRET' | 'EXECUTE_SHELL';

export interface RoleContract {
  role_id: CompanyRoleId;
  title: string;
  accountable_for: string[];
  required_inputs: string[];
  required_outputs: string[];
  cadences: OperatingCadence[];
  allowed_states: WorkflowState[];
  independent_from: CompanyRoleId[];
  cannot_self_approve: boolean;
  allowed_operations?: CompanyOperation[];
}

const deliveryStates: WorkflowState[] = ['EXECUTING', 'BLOCKED', 'HOLD', 'REVISE'];
const reviewStates: WorkflowState[] = ['INDEPENDENT_VERIFICATION', 'USER_AND_DOMAIN_REVIEW', 'REVISE', 'HOLD'];

export const roleContracts: readonly RoleContract[] = [
  { role_id: 'ceo-guild', title: 'CEO Guild', accountable_for: ['cross-functional product direction', 'trade-offs', 'dissent resolution', 'capital and risk posture'], required_inputs: ['CEO brief', 'PM proposal', 'user evidence', 'data/domain evidence', 'stakeholder dissent', 'delivery and security risk'], required_outputs: ['guild decision', 'rationale', 'dissent disposition', 'validation mandate'], cadences: ['daily', 'weekly', 'monthly', 'quarterly', 'annual'], allowed_states: ['CEO_PRIORITIZED', 'HOLD', 'BLOCKED', 'ESCALATED'], independent_from: ['pm', 'release-security-gate'], cannot_self_approve: true, allowed_operations: ['PRIORITIZE', 'MEASURE_OUTCOME'] },
  { role_id: 'tech-lead', title: 'Principal Tech Lead', accountable_for: ['architecture', 'feasibility', 'performance', 'technical debt', 'engineering estimates'], required_inputs: ['PM proposal', 'data contract', 'security constraints', 'runtime evidence'], required_outputs: ['technical plan', 'cost/risk estimate', 'architecture decision', 'implementation decomposition'], cadences: ['weekly', 'monthly', 'quarterly'], allowed_states: deliveryStates, independent_from: ['pm', 'coder', 'release-security-gate'], cannot_self_approve: true, allowed_operations: ['PROPOSE', 'IMPLEMENT', 'REVIEW'] },
  { role_id: 'critic', title: 'Adversarial Product Critic', accountable_for: ['unsupported assumptions', 'hidden cost', 'user harm', 'copyability', 'opportunity cost'], required_inputs: ['proposal', 'evidence bundle', 'technical plan', 'alternatives'], required_outputs: ['critique', 'contradicting evidence', 'simpler alternative', 'kill/hold recommendation'], cadences: ['weekly', 'monthly', 'quarterly'], allowed_states: reviewStates, independent_from: ['pm', 'ceo', 'coder', 'tech-lead'], cannot_self_approve: true, allowed_operations: ['REVIEW'] },
  { role_id: 'ceo', title: 'Chief Executive Officer', accountable_for: ['Product Goal alignment', 'company health', 'strategy', 'risk and capital allocation'], required_inputs: ['company health', 'product metrics', 'customer evidence', 'open blockers', 'strategic options'], required_outputs: ['priority decision', 'hold/rollback/kill decision', 'strategy review'], cadences: ['daily', 'weekly', 'monthly', 'quarterly', 'annual'], allowed_states: ['CEO_PRIORITIZED', 'HOLD', 'BLOCKED', 'ESCALATED'], independent_from: ['pm', 'release-security-gate'], cannot_self_approve: true, allowed_operations: ['PRIORITIZE', 'MEASURE_OUTCOME', 'ROLLBACK'] },
  { role_id: 'pm', title: 'Product Manager', accountable_for: ['user jobs', 'requirements', 'roadmap', 'backlog', 'outcomes'], required_inputs: ['user feedback', 'usage evidence', 'Product Goal', 'domain constraints'], required_outputs: ['feature proposal', 'acceptance criteria', 'prioritized backlog', 'outcome review'], cadences: ['near_real_time', 'daily', 'weekly', 'monthly', 'quarterly'], allowed_states: ['DISCOVERY', 'PM_BACKLOGGED', 'REVISE', 'HOLD'], independent_from: ['ceo', 'coder', 'release-security-gate'], cannot_self_approve: true, allowed_operations: ['PROPOSE', 'PRIORITIZE', 'MEASURE_OUTCOME'] },
  { role_id: 'data-engineer', title: 'Data Engineer', accountable_for: ['provider contracts', 'ingestion', 'freshness', 'revisions', 'data quality'], required_inputs: ['source registry', 'provider response', 'freshness policy'], required_outputs: ['data-quality report', 'provenance evidence', 'quarantine decision'], cadences: ['near_real_time', 'daily', 'weekly'], allowed_states: deliveryStates, independent_from: ['functional-qa', 'quality-control'], cannot_self_approve: true, allowed_operations: ['IMPLEMENT', 'REVIEW'] },
  { role_id: 'backend-engineer', title: 'Backend Engineer', accountable_for: ['API', 'persistence', 'authorization', 'runtime contracts'], required_inputs: ['technical design', 'data contract', 'security constraints'], required_outputs: ['implementation', 'API test report', 'migration/rollback evidence'], cadences: ['daily', 'weekly'], allowed_states: deliveryStates, independent_from: ['functional-qa', 'quality-control', 'release-security-gate'], cannot_self_approve: true, allowed_operations: ['IMPLEMENT', 'REVIEW'] },
  { role_id: 'frontend-engineer', title: 'Frontend Engineer', accountable_for: ['research workflow UI', 'responsive behavior', 'accessibility'], required_inputs: ['product acceptance criteria', 'design system', 'evidence contract'], required_outputs: ['implementation', 'browser evidence', 'accessibility report'], cadences: ['daily', 'weekly'], allowed_states: deliveryStates, independent_from: ['ux-research', 'functional-qa'], cannot_self_approve: true, allowed_operations: ['IMPLEMENT', 'REVIEW'] },
  { role_id: 'ai-engineer', title: 'AI/ML Engineer', accountable_for: ['grounding', 'model adapters', 'evaluation', 'cost'], required_inputs: ['evidence bundle', 'golden corpus', 'model policy'], required_outputs: ['evaluation report', 'prompt/model change', 'cost report'], cadences: ['daily', 'weekly', 'monthly'], allowed_states: deliveryStates, independent_from: ['domain-expert', 'quality-control'], cannot_self_approve: true },
  { role_id: 'sre', title: 'Platform/SRE', accountable_for: ['availability', 'durability', 'recovery', 'observability'], required_inputs: ['runtime telemetry', 'SLO', 'backup policy'], required_outputs: ['health report', 'recovery drill', 'incident record'], cadences: ['near_real_time', 'daily', 'weekly', 'monthly'], allowed_states: deliveryStates, independent_from: ['backend-engineer', 'release-security-gate'], cannot_self_approve: true },
  { role_id: 'security', title: 'Security Engineer', accountable_for: ['secrets', 'permissions', 'threat model', 'security release evidence'], required_inputs: ['architecture', 'permission map', 'audit logs'], required_outputs: ['security review', 'risk acceptance or block', 'remediation plan'], cadences: ['weekly', 'monthly', 'quarterly'], allowed_states: reviewStates, independent_from: ['backend-engineer', 'ai-engineer', 'release-security-gate'], cannot_self_approve: true },
  { role_id: 'coder', title: 'Bounded Engineering Worker', accountable_for: ['scoped implementation'], required_inputs: ['approved task', 'technical design', 'acceptance criteria'], required_outputs: ['code change', 'implementation notes', 'local test evidence'], cadences: ['daily', 'weekly'], allowed_states: deliveryStates, independent_from: ['functional-qa', 'quality-control', 'release-security-gate'], cannot_self_approve: true },
  { role_id: 'functional-qa', title: 'Functional QA', accountable_for: ['functional and regression behavior'], required_inputs: ['acceptance criteria', 'changed artifact', 'test environment'], required_outputs: ['test report', 'reproduction evidence', 'pass/fail decision'], cadences: ['daily', 'weekly'], allowed_states: reviewStates, independent_from: ['coder', 'frontend-engineer', 'backend-engineer'], cannot_self_approve: true },
  { role_id: 'quality-control', title: 'Quality Control', accountable_for: ['evidence integrity', 'process compliance', 'release quality'], required_inputs: ['all review artifacts', 'ledger lineage', 'release checklist'], required_outputs: ['QC report', 'rejection or recommendation', 'audit trail'], cadences: ['weekly', 'monthly', 'quarterly'], allowed_states: reviewStates, independent_from: ['functional-qa', 'release-security-gate'], cannot_self_approve: true },
  { role_id: 'ux-research', title: 'UX Researcher', accountable_for: ['task success', 'usability', 'accessibility evidence'], required_inputs: ['personas', 'released workflow', 'task script'], required_outputs: ['task evaluation', 'friction log', 'UX recommendation'], cadences: ['weekly', 'monthly', 'quarterly'], allowed_states: reviewStates, independent_from: ['frontend-engineer', 'pm'], cannot_self_approve: true },
  { role_id: 'stakeholder-panel', title: 'Stakeholder Panel', accountable_for: ['risk, market, legal, commercial and operational perspectives'], required_inputs: ['strategy options', 'risk report', 'customer evidence'], required_outputs: ['stakeholder review', 'unresolved dissent', 'recommendation'], cadences: ['monthly', 'quarterly', 'annual'], allowed_states: reviewStates, independent_from: ['ceo', 'pm'], cannot_self_approve: true },
  { role_id: 'user-persona', title: 'User Persona Panel', accountable_for: ['persona task execution and user-value evidence'], required_inputs: ['task script', 'released or staged product', 'persona context'], required_outputs: ['task outcome', 'blocking friction', 'feature request'], cadences: ['weekly', 'monthly'], allowed_states: reviewStates, independent_from: ['pm', 'frontend-engineer'], cannot_self_approve: true },
  { role_id: 'domain-expert', title: 'Macro Domain Expert', accountable_for: ['economic validity', 'fact/inference separation', 'research limitations'], required_inputs: ['evidence bundle', 'analysis output', 'methodology'], required_outputs: ['domain review', 'assumption challenge', 'limitation record'], cadences: ['weekly', 'monthly', 'quarterly'], allowed_states: reviewStates, independent_from: ['ai-engineer', 'pm'], cannot_self_approve: true },
  { role_id: 'release-security-gate', title: 'Release and Security Gate', accountable_for: ['release authorization', 'rollback and kill enforcement'], required_inputs: ['QA/QC reports', 'security review', 'production preflight', 'rollback plan'], required_outputs: ['release decision', 'gate blockers', 'rollback record'], cadences: ['near_real_time', 'daily', 'weekly'], allowed_states: ['RELEASE_GATE', 'RELEASED', 'ROLLBACK', 'KILLED'], independent_from: ['ceo', 'pm', 'coder'], cannot_self_approve: true },
];

export function getRoleContract(roleId: string): RoleContract {
  const contract = roleContracts.find((item) => item.role_id === roleId);
  if (!contract) throw new Error(`unknown company role: ${roleId}`);
  return contract;
}

export function authorizeCompanyOperation(roleId: string, operation: CompanyOperation): void {
  const contract = getRoleContract(roleId);
  if (operation === 'READ_SECRET' || operation === 'EXECUTE_SHELL') throw new Error(`denied company operation: ${operation}`);
  const fallbackOperations: Partial<Record<CompanyRoleId, CompanyOperation[]>> = {
    'ai-engineer': ['IMPLEMENT', 'REVIEW'], sre: ['IMPLEMENT', 'REVIEW'], security: ['REVIEW'],
    'functional-qa': ['REVIEW'], 'quality-control': ['REVIEW'], 'ux-research': ['REVIEW'],
    'stakeholder-panel': ['REVIEW'], 'user-persona': ['REVIEW'], 'domain-expert': ['REVIEW'],
    'release-security-gate': ['RELEASE', 'ROLLBACK', 'REVIEW'], coder: ['IMPLEMENT'],
  };
  const allowedOperations = contract.allowed_operations ?? fallbackOperations[contract.role_id] ?? [];
  if (!allowedOperations.includes(operation)) throw new Error(`role ${roleId} cannot perform ${operation}`);
  if ((operation === 'RELEASE' || operation === 'ROLLBACK') && contract.cannot_self_approve && roleId !== 'release-security-gate' && roleId !== 'ceo') {
    throw new Error(`role ${roleId} cannot approve its own delivery`);
  }
}

export function validateRoleContracts(contracts: readonly RoleContract[] = roleContracts): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const contract of contracts) {
    if (ids.has(contract.role_id)) errors.push(`duplicate role: ${contract.role_id}`);
    ids.add(contract.role_id);
    if (!contract.accountable_for.length || !contract.required_outputs.length) errors.push(`role ${contract.role_id} lacks accountability or outputs`);
    if (!contract.cadences.length || !contract.allowed_states.length) errors.push(`role ${contract.role_id} lacks cadence or workflow scope`);
    if (!contract.independent_from.length) errors.push(`role ${contract.role_id} lacks independent review boundary`);
  }
  return errors;
}
