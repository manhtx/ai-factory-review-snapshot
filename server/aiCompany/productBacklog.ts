export type ProductPriority = 'P0' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
export type BacklogStatus = 'CANDIDATE' | 'PM_REVIEW' | 'BACKLOG' | 'READY' | 'SPRINT_SELECTED' | 'IN_PROGRESS' | 'IN_REVIEW' | 'ACCEPTED' | 'MEASURED' | 'LEARNED' | 'BLOCKED' | 'DEFERRED' | 'REJECTED' | 'INVALIDATED' | 'CANCELLED';
export type PmReviewStatus = 'PENDING' | 'APPROVED' | 'DEFERRED' | 'REJECTED' | 'NEEDS_MORE_EVIDENCE';
export type SprintStatus = 'PLANNING' | 'ACTIVE' | 'REVIEW' | 'CLOSED' | 'CANCELLED';

export type ProductBacklogItem = {
  backlog_id: string;
  title: string;
  summary: string;
  problem_statement: string;
  opportunity: string;
  group: 'PRODUCT' | 'UX_UI' | 'DATA' | 'AI_INTELLIGENCE' | 'TRUST_EVIDENCE' | 'RESEARCH_WORKFLOW' | 'PERFORMANCE' | 'BUG' | 'SECURITY' | 'TECH_DEBT' | 'AI_COMPANY_SYSTEM';
  priority: ProductPriority;
  status: BacklogStatus;
  source: 'FOUNDER' | 'PRODUCT_DISCOVERY' | 'USER_EVIDENCE' | 'SYNTHETIC_USER_EVAL' | 'SYNTHETIC_EXPERT_EVAL' | 'QA' | 'ENGINEERING' | 'DATA' | 'SECURITY' | 'TELEMETRY' | 'OUTCOME' | 'LEARNING' | 'INCIDENT';
  created_by: string;
  created_at: string;
  evidence_ids: string[];
  evidence_quality: 'STRUCTURAL' | 'RUNTIME' | 'SYNTHETIC' | 'MIXED' | 'UNKNOWN';
  user_or_persona: string;
  user_need: string;
  expected_product_value: string;
  hypothesis: string;
  expected_change: string;
  expected_outcome: string;
  acceptance_criteria: string[];
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  dependencies: string[];
  blocked_by: string[];
  pm_review_status: PmReviewStatus;
  pm_reviewed_by?: string;
  pm_reviewed_at?: string;
  pm_decision_reason?: string;
  target_sprint?: string;
  sprint_id?: string;
  implementation_task_ids: string[];
  evaluation_ids: string[];
  outcome_id?: string;
  learning_ids: string[];
  updated_at: string;
};

export type SprintAmendment = { amended_at: string; reason: string; added_backlog_ids: string[] };
export type Sprint = { sprint_id: string; name: string; goal: string; status: SprintStatus; created_at: string; started_at?: string; closed_at?: string; selected_backlog_ids: string[]; capacity_policy: { max_active_product_items: number; token_budget: number; concurrency: number }; expected_outcomes: string[]; actual_outcomes: string[]; learning_ids: string[]; amendment_history?: SprintAmendment[] };

const transitions: Record<BacklogStatus, BacklogStatus[]> = {
  CANDIDATE: ['PM_REVIEW', 'INVALIDATED'], PM_REVIEW: ['BACKLOG', 'READY', 'DEFERRED', 'REJECTED', 'INVALIDATED'], BACKLOG: ['READY', 'DEFERRED', 'REJECTED', 'INVALIDATED'], READY: ['SPRINT_SELECTED', 'DEFERRED', 'INVALIDATED'], SPRINT_SELECTED: ['IN_PROGRESS', 'BLOCKED', 'CANCELLED'], IN_PROGRESS: ['IN_REVIEW', 'BLOCKED', 'CANCELLED'], IN_REVIEW: ['ACCEPTED', 'READY', 'BLOCKED', 'CANCELLED'], ACCEPTED: ['MEASURED', 'LEARNED'], MEASURED: ['LEARNED'], LEARNED: ['BACKLOG', 'INVALIDATED'], BLOCKED: ['READY', 'SPRINT_SELECTED', 'CANCELLED'], DEFERRED: ['PM_REVIEW', 'BACKLOG', 'INVALIDATED'], REJECTED: [], INVALIDATED: [], CANCELLED: [],
};

export function canTransitionBacklog(from: BacklogStatus, to: BacklogStatus) { return from === to || transitions[from].includes(to); }

export function definitionOfReady(item: Partial<ProductBacklogItem>): { status: 'READY' | 'NOT_READY'; reasons: string[] } {
  const reasons: string[] = [];
  if (!item.problem_statement?.trim()) reasons.push('NEEDS_PROBLEM');
  if (!item.evidence_ids?.length && item.priority !== 'P0') reasons.push('NEEDS_EVIDENCE');
  if (!item.expected_product_value?.trim()) reasons.push('NEEDS_VALUE');
  if (!item.expected_change?.trim()) reasons.push('NEEDS_SCOPE');
  if (!item.acceptance_criteria?.length) reasons.push('NEEDS_ACCEPTANCE_CRITERIA');
  if (item.dependencies?.some((dependency) => item.blocked_by?.includes(dependency))) reasons.push('BLOCKED');
  if (!item.pm_review_status || !['APPROVED'].includes(item.pm_review_status)) reasons.push('PM_APPROVAL_REQUIRED');
  return { status: reasons.length ? 'NOT_READY' : 'READY', reasons };
}

export function assertProductAuthority(input: { intent: string; backlog_id?: string; pm_review_status?: PmReviewStatus; backlog_status?: BacklogStatus; sprint_id?: string; activeSprintId?: string }): void {
  const bypass = input.intent === 'TEST_ONLY' || input.intent === 'VALIDATION_ONLY';
  if (bypass) return;
  if (!input.backlog_id) throw new Error('MISSING_BACKLOG_AUTHORITY');
  if (input.intent === 'RECOVERY') return;
  if (input.pm_review_status !== 'APPROVED') throw new Error('PM_APPROVAL_REQUIRED');
  if (input.backlog_status !== 'READY' && input.backlog_status !== 'SPRINT_SELECTED') throw new Error('BACKLOG_ITEM_NOT_READY');
  if (!input.sprint_id || input.sprint_id !== input.activeSprintId) throw new Error('NOT_IN_ACTIVE_SPRINT');
}

export function founderInboxCandidate(input: { title: string; created_at?: string; created_by?: string }): Partial<ProductBacklogItem> { return { backlog_id: `FOUNDER:${Date.now()}`, title: input.title.trim(), summary: input.title.trim(), problem_statement: '', opportunity: input.title.trim(), source: 'FOUNDER', created_by: input.created_by ?? 'founder', created_at: input.created_at ?? new Date().toISOString(), status: 'CANDIDATE', pm_review_status: 'PENDING', evidence_ids: [], implementation_task_ids: [], evaluation_ids: [], learning_ids: [] }; }
