import type { CompanyRoleId } from './roleContracts';
export type { RiskLevel, WorkflowTier, TaskType, RiskAssessmentContext } from './domainTypes';
export { ALLOWED_TASK_TYPES, isAllowedTaskType, calculateEffectiveRisk } from './domainTypes';
import { type RiskLevel, type TaskType, isAllowedTaskType, calculateEffectiveRisk } from './domainTypes';

export type TestPolicy = 'none' | 'targeted' | 'affected' | 'full_suite';
export type MutationPolicy = 'read_only' | 'assigned_artifacts' | 'worktree';
export type Verdict = 'PASS' | 'REVISE' | 'QUALITY_FAIL' | 'HOLD' | 'BLOCKED';

export interface AssignmentEnvelope {
  assignment_id: string; run_id: string; cycle_id?: string; epoch_id?: string; namespace: string; product_id: string; objective_id: string; work_id: string;
  role: CompanyRoleId; task_type: TaskType | string; objective: string; product_goal_alignment: string[]; scope: string[];
  allowed_paths: string[]; forbidden_paths: string[]; allowed_tools: string[]; forbidden_tools: string[];
  inputs: string[]; evidence_manifest: string[]; dependencies: string[]; acceptance_criteria: string[];
  output_schema: string; allowed_verdicts: Verdict[]; risk_level: RiskLevel;
  mutation_policy: MutationPolicy; test_policy: TestPolicy; context_budget: { max_tokens: number; target_tokens: number };
  token_budget: number; timeout: number; retry_budget: number; escalation_policy: string;
}

export const ASSIGNMENT_PRECEDENCE = ['SYSTEM_SAFETY_POLICY', 'ASSIGNMENT_ENVELOPE', 'WORKFLOW_CONTRACT', 'ROLE_CONTRACT', 'GENERIC_EPOCH_CONTEXT', 'OPTIONAL_HISTORICAL_CONTEXT'] as const;

export type AdmissionDecision =
  | 'ADMITTED'
  | 'REJECTED_POLICY'
  | 'REJECTED_SCOPE'
  | 'REJECTED_EVIDENCE'
  | 'REJECTED_DEPENDENCY'
  | 'REJECTED_STALE_CONTEXT';

export interface AdmissionResult {
  decision: AdmissionDecision;
  reasons: string[];
}

export interface AdmissionContext {
  activeRunId?: string;
  projectId?: string;
  namespace?: string;
  completedWorkIds?: string[];
  satisfiedDependencyIds?: string[];
  resolvedEvidenceIds?: string[];
  hasHumanApproval?: boolean;
  isStaleContext?: boolean;
  rejectedMemories?: Array<{ id: string; title: string; keywords?: string[]; rejection_reason?: string }>;
}

const FORBIDDEN_SCOPE_PATTERNS = [
  /\.env(\.|$)/i,
  /credentials/i,
  /secrets/i,
  /\.vercel/i,
  /id_rsa/i,
  /\.ssh/i,
  /api[_-]?key/i,
];

const MANDATORY_FORBIDDEN_PATHS = [
  '.env',
  '.ai-company/runtime',
  '.ai-company/company-state.json',
];

const READ_ONLY_ROLES = new Set<CompanyRoleId>([
  'pm',
  'critic',
  'user-persona',
  'domain-expert',
  'ux-research',
  'stakeholder-panel',
]);

const DANGEROUS_WRITE_TOOLS = [
  'deploy',
  'git_push',
  'db_push',
  'execute_shell',
  'write_production',
  'write_to_file',
  'replace_file_content',
  'multi_replace_file_content',
  'write',
  'edit',
];

const VAGUE_ACCEPTANCE_PATTERNS = [
  /^improve\s+quality$/i,
  /^make\s+better$/i,
  /^enhance\s+ux$/i,
  /^update\s+code$/i,
  /^fix\s+stuff$/i,
];

export function validateAssignmentEnvelope(input: AssignmentEnvelope): string[] {
  const errors: string[] = [];
  for (const key of ['assignment_id', 'run_id', 'namespace', 'product_id', 'objective_id', 'work_id', 'task_type', 'objective', 'output_schema', 'escalation_policy'] as const) {
    if (!input[key]?.trim()) errors.push(`${key} is required`);
  }
  for (const key of ['product_goal_alignment', 'scope', 'allowed_paths', 'forbidden_paths', 'allowed_tools', 'forbidden_tools', 'inputs', 'evidence_manifest', 'acceptance_criteria'] as const) {
    if (!Array.isArray(input[key]) || !input[key].length) errors.push(`${key} must be non-empty`);
  }
  if (!Array.isArray(input.dependencies)) errors.push('dependencies must be an array');
  if (!input.allowed_verdicts?.length) errors.push('allowed_verdicts must be non-empty');
  if (!Number.isFinite(input.context_budget?.max_tokens) || input.context_budget.max_tokens < input.context_budget.target_tokens) errors.push('context budget is invalid');
  if (!Number.isFinite(input.token_budget) || input.token_budget <= 0) errors.push('token budget is invalid');
  if (!Number.isFinite(input.timeout) || input.timeout <= 0) errors.push('timeout is invalid');
  if (!Number.isInteger(input.retry_budget) || input.retry_budget < 0) errors.push('retry budget is invalid');
  if (input.mutation_policy === 'read_only' && input.test_policy === 'full_suite') errors.push('read-only assignments cannot require full suite');
  return errors;
}

export function assertAssignmentEnvelope(input: AssignmentEnvelope): AssignmentEnvelope {
  const errors = validateAssignmentEnvelope(input);
  if (errors.length) throw new Error(`invalid assignment envelope: ${errors.join('; ')}`);
  return input;
}

/**
 * Multi-layer semantic admission evaluation for assignment execution:
 * Schema validation -> Identity -> Scope -> Policy -> Evidence -> Dependency -> Stale Context
 */
export function evaluateAssignmentAdmission(
  input: AssignmentEnvelope,
  context?: AdmissionContext
): AdmissionResult {
  // 1. Check Scope & Paths first to prioritize REJECTED_SCOPE
  if (!Array.isArray(input.forbidden_paths) || !input.forbidden_paths.length) {
    return {
      decision: 'REJECTED_SCOPE',
      reasons: ["forbidden_paths must be non-empty and include '.env', '.ai-company/runtime', '.ai-company/company-state.json'"],
    };
  }
  for (const mandatory of MANDATORY_FORBIDDEN_PATHS) {
    const isCovered = input.forbidden_paths.some(
      (fp) => fp === mandatory || fp.startsWith(mandatory) || mandatory.startsWith(fp)
    );
    if (!isCovered) {
      return {
        decision: 'REJECTED_SCOPE',
        reasons: [`forbidden_paths must include '${mandatory}'`],
      };
    }
  }

  for (const allowed of input.allowed_paths ?? []) {
    if (allowed.includes('..') || allowed.startsWith('/')) {
      return {
        decision: 'REJECTED_SCOPE',
        reasons: [`allowed path '${allowed}' attempts workspace escape`],
      };
    }
    for (const pattern of FORBIDDEN_SCOPE_PATTERNS) {
      if (pattern.test(allowed)) {
        return {
          decision: 'REJECTED_SCOPE',
          reasons: [`allowed path '${allowed}' exposes secret or deployment configuration`],
        };
      }
    }
  }

  // 2. Schema / Structural Validation
  const schemaErrors = validateAssignmentEnvelope(input);
  if (schemaErrors.length > 0) {
    return { decision: 'REJECTED_POLICY', reasons: schemaErrors };
  }

  // 2. Identity & Stale Run Context Validation
  if (context?.activeRunId && input.run_id !== context.activeRunId) {
    return {
      decision: 'REJECTED_STALE_CONTEXT',
      reasons: [`assignment belongs to run ${input.run_id} but active run is ${context.activeRunId}`],
    };
  }
  if (context?.namespace && input.namespace !== context.namespace) {
    return {
      decision: 'REJECTED_STALE_CONTEXT',
      reasons: [`assignment namespace ${input.namespace} does not match active namespace ${context.namespace}`],
    };
  }
  if (context?.projectId && input.product_id !== context.projectId) {
    return {
      decision: 'REJECTED_STALE_CONTEXT',
      reasons: [`assignment product_id ${input.product_id} does not match active project ${context.projectId}`],
    };
  }
  if (context?.isStaleContext) {
    return {
      decision: 'REJECTED_STALE_CONTEXT',
      reasons: ['underlying context or Product Goal version is flagged as stale'],
    };
  }

  // Product Goal mapping requirement
  const mapsToProductGoal = input.product_goal_alignment.some(
    (alignment) => alignment.toLowerCase().includes('product goal') || alignment.toLowerCase().includes('truth') || alignment.includes('docs/PRODUCT_GOAL.md')
  );
  if (!mapsToProductGoal) {
    return {
      decision: 'REJECTED_POLICY',
      reasons: ['objective does not map to docs/PRODUCT_GOAL.md alignment in product_goal_alignment'],
    };
  }


  // 4. Policy & Tool Validation
  if (READ_ONLY_ROLES.has(input.role as CompanyRoleId)) {
    if (input.mutation_policy !== 'read_only') {
      return {
        decision: 'REJECTED_POLICY',
        reasons: [`read-only role '${input.role}' cannot have mutation_policy '${input.mutation_policy}'`],
      };
    }
    for (const tool of input.allowed_tools) {
      if (DANGEROUS_WRITE_TOOLS.includes(tool.toLowerCase())) {
        return {
          decision: 'REJECTED_POLICY',
          reasons: [`read-only role '${input.role}' cannot be granted write/deploy tool '${tool}'`],
        };
      }
    }
  }

  // Production operation authorization
  const isProdOp = input.task_type === 'production_operation' || input.allowed_tools.some((t) => t.includes('deploy') || t.includes('db_push'));
  if (isProdOp && !context?.hasHumanApproval) {
    return {
      decision: 'REJECTED_POLICY',
      reasons: ['production operation requires explicit human approval'],
    };
  }

  // Acceptance criteria quality check (prevent non-measurable criteria)
  for (const criterion of input.acceptance_criteria) {
    for (const pattern of VAGUE_ACCEPTANCE_PATTERNS) {
      if (pattern.test(criterion.trim())) {
        return {
          decision: 'REJECTED_POLICY',
          reasons: [`acceptance criterion '${criterion}' is vague and lacks measurable condition or metric`],
        };
      }
    }
  }

  // Risk & task type compatibility check
  if (isAllowedTaskType(input.task_type)) {
    const minRisk = calculateEffectiveRisk({
      taskType: input.task_type,
      fileScope: input.scope,
      mutationPolicy: input.mutation_policy,
    });
    const riskRank: Record<RiskLevel, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
    if (riskRank[input.risk_level] > riskRank[minRisk]) {
      return {
        decision: 'REJECTED_POLICY',
        reasons: [`risk_level '${input.risk_level}' is incompatible with task_type '${input.task_type}' (minimum required: '${minRisk}')`],
      };
    }
  }

  // Anti-regression check against rejected memory/decisions
  if (context?.rejectedMemories && context.rejectedMemories.length > 0) {
    const targetText = `${input.objective} ${input.scope.join(' ')}`.toLowerCase();
    for (const rej of context.rejectedMemories) {
      const rejTitle = rej.title.toLowerCase();
      const hasTitleMatch = rejTitle.length > 5 && targetText.includes(rejTitle);
      const hasKeywordMatch = (rej.keywords ?? []).some(
        (kw) => kw.length > 3 && targetText.includes(kw.toLowerCase())
      );
      if (hasTitleMatch || hasKeywordMatch) {
        return {
          decision: 'REJECTED_POLICY',
          reasons: [`assignment attempts previously rejected direction (${rej.id}): ${rej.rejection_reason || rej.title}`],
        };
      }
    }
  }

  // 5. Evidence Validation
  for (const evidence of input.evidence_manifest) {
    if (evidence.includes('..') || evidence.startsWith('/etc') || evidence.startsWith('/var')) {
      return {
        decision: 'REJECTED_EVIDENCE',
        reasons: [`evidence '${evidence}' points outside workspace`],
      };
    }
    // Self-generation check: cannot self-attest without independent verification
    if (evidence.toLowerCase().includes(`self-certified:${input.role.toLowerCase()}`)) {
      return {
        decision: 'REJECTED_EVIDENCE',
        reasons: [`evidence '${evidence}' is self-generated by role '${input.role}' without independent verification`],
      };
    }
  }

  if (context?.resolvedEvidenceIds && context.resolvedEvidenceIds.length > 0) {
    for (const reqEvidence of input.evidence_manifest) {
      if (!context.resolvedEvidenceIds.includes(reqEvidence)) {
        return {
          decision: 'REJECTED_EVIDENCE',
          reasons: [`required evidence '${reqEvidence}' cannot be resolved in runtime ledger`],
        };
      }
    }
  }

  // 6. Dependency Validation
  if (context?.satisfiedDependencyIds !== undefined && !Array.isArray(context.satisfiedDependencyIds)) {
    return { decision: 'REJECTED_DEPENDENCY', reasons: ['satisfied dependency projection must be an array'] };
  }
  const dependencyIds = context?.satisfiedDependencyIds !== undefined ? context.satisfiedDependencyIds : context?.completedWorkIds;
  if (dependencyIds && input.dependencies.length > 0) {
    const uncompleted = input.dependencies.filter((dep) => !dependencyIds.includes(dep));
    if (uncompleted.length > 0) {
      return {
        decision: 'REJECTED_DEPENDENCY',
        reasons: [`dependencies not completed: ${uncompleted.join(', ')}`],
      };
    }
  }

  return { decision: 'ADMITTED', reasons: [] };
}

export function assertAssignmentAdmission(input: AssignmentEnvelope, context?: AdmissionContext): AssignmentEnvelope {
  const result = evaluateAssignmentAdmission(input, context);
  if (result.decision !== 'ADMITTED') {
    throw new Error(`ASSIGNMENT_${result.decision}: ${result.reasons.join('; ')}`);
  }
  return input;
}
