/**
 * Minimal Execution Planner (Causal Repair V3)
 *
 * Derives execution machinery strictly from what the work actually needs to accomplish:
 * COMPANY INTENT -> REQUIRED DECISION/ARTIFACT -> ALLOWED SIDE EFFECT -> COGNITION NEED ->
 * REQUIRED CAPABILITY -> REQUIRED VERIFICATION -> EXECUTION PLAN.
 *
 * Non-negotiable:
 * 1. No static action->role table as the core architecture.
 * 2. Conservative code-safety rule: unknown/ambiguous mutation -> safe code-mutation path.
 * 3. Verification must match the artifact (no code test for non-code actions).
 * 4. Cognition admission: deterministic tasks require zero AI cognition.
 */

export type MutationScope =
  | 'READ_ONLY'
  | 'COMPANY_STATE_MUTATION'
  | 'PRODUCT_CODE_MUTATION'
  | 'UNKNOWN';

export type VerificationMethod =
  | 'DETERMINISTIC_ASSERTION'
  | 'PROVENANCE_AND_FINDING_RECORDED'
  | 'SCHEMA_AND_EVIDENCE_VALIDATION'
  | 'CODE_REGRESSION_TEST'
  | 'CONSUMER_INTEGRATION_CHECK';

export interface ExecutionContract {
  contract_id: string;
  objective_id: string;
  intent: string;
  expected_artifact_or_decision: string;
  mutation_scope: MutationScope;
  cognition_required: boolean;
  cognition_rationale: string;
  selected_capabilities: string[];
  worktree_required: boolean;
  verification_methods: VerificationMethod[];
  authority: string;
  is_conservative_fallback: boolean;
}

export interface CandidateWorkDescriptor {
  // Descriptive routing metadata; this does not grant queue/attempt authority.
  status?: string;
  priority?: string;
  backlog_id?: string;
  id?: string;
  title?: string;
  summary?: string;
  expected_change?: string;
  task_type?: string;
  allowed_paths?: string[];
  acceptance_criteria?: string[];
  mutation_policy?: string;
  pm_review_status?: string;
  source?: string;
}

export class ExecutionPlanner {
  /**
   * Derives a truthful ExecutionContract from the work descriptor's actual requirements.
   */
  plan(candidate: CandidateWorkDescriptor): ExecutionContract {
    const objectiveId = candidate.backlog_id || candidate.id || 'OBJECTIVE_UNKNOWN';
    const title = candidate.title || objectiveId;
    const allowedPaths = Array.isArray(candidate.allowed_paths) ? candidate.allowed_paths : [];
    const acceptanceCriteria = Array.isArray(candidate.acceptance_criteria) ? candidate.acceptance_criteria : [];
    const criteriaText = acceptanceCriteria.join(' ').toLowerCase();
    const expectedChange = (candidate.expected_change || candidate.summary || '').toLowerCase();

    // 1. Determine Intent
    const intent = candidate.expected_change || candidate.summary || title;

    // 2. Determine Mutation Scope
    let mutationScope: MutationScope;
    let isConservativeFallback = false;

    const isDeterministic = candidate.task_type === 'deterministic' || title.toLowerCase().includes('zero-cognition');

    const touchesSourceCode = allowedPaths.some((p) =>
      (p.startsWith('src/') || p.startsWith('server/')) &&
      !p.includes('.test.') &&
      !p.includes('.spec.')
    );
    const touchesOnlyStateOrReports = allowedPaths.length > 0 && allowedPaths.every((p) =>
      p.startsWith('.ai-company/') ||
      p.startsWith('docs/') ||
      p.includes('.test.') ||
      p.endsWith('.json') ||
      p.endsWith('.md')
    );

    const isExplicitReadOnly =
      candidate.mutation_policy === 'read_only' ||
      candidate.task_type === 'research' ||
      candidate.task_type === 'evidence_action' ||
      objectiveId.startsWith('BACKLOG-RESEARCH-') ||
      objectiveId.startsWith('BACKLOG-REQUALIFY-') ||
      objectiveId.startsWith('BACKLOG-EVIDENCE-') ||
      (criteriaText.includes('documented finding') && !criteriaText.includes('modify') && !criteriaText.includes('implement')) ||
      (expectedChange.includes('investigate and resolve') && criteriaText.includes('fail-closed'));

    const hasExplicitCodeDirectives =
      criteriaText.includes('add validate') ||
      criteriaText.includes('add a bounded') ||
      criteriaText.includes('the runtime series payload') ||
      expectedChange.includes('modify only') ||
      expectedChange.includes('add explicit') ||
      expectedChange.includes('add a bounded');

    if (isDeterministic) {
      mutationScope = 'READ_ONLY';
    } else if (hasExplicitCodeDirectives && touchesSourceCode) {
      mutationScope = 'PRODUCT_CODE_MUTATION';
    } else if (touchesSourceCode && !isExplicitReadOnly) {
      // Touches source code but lacks clear directives -> Ambiguous! Fail conservative to safe code path
      mutationScope = 'PRODUCT_CODE_MUTATION';
      isConservativeFallback = true;
    } else if (touchesOnlyStateOrReports || (isExplicitReadOnly && allowedPaths.some((p) => p.startsWith('.ai-company/')))) {
      mutationScope = 'COMPANY_STATE_MUTATION';
    } else if (isExplicitReadOnly && (allowedPaths.length === 0 || touchesSourceCode)) {
      mutationScope = touchesSourceCode ? 'COMPANY_STATE_MUTATION' : 'READ_ONLY';
    } else {
      // Ambiguous: apply Conservative Code-Safety Rule (Section 13)
      mutationScope = 'PRODUCT_CODE_MUTATION';
      isConservativeFallback = true;
    }

    // 3. Expected Artifact or Decision
    let expectedArtifact = 'Documented evidence finding in research portfolio';
    if (mutationScope === 'PRODUCT_CODE_MUTATION') {
      expectedArtifact = `Code patch and regression test in ${allowedPaths.join(', ') || 'allowed paths'}`;
    } else if (mutationScope === 'COMPANY_STATE_MUTATION') {
      expectedArtifact = `Evidence evaluation and finding recorded in .ai-company/product-intelligence/`;
    } else if (mutationScope === 'READ_ONLY') {
      expectedArtifact = `Inspected evidence status without file mutation`;
    }

    // 4. Cognition Admission
    let cognitionRequired = true;
    let cognitionRationale = 'AI judgment required to evaluate evidence and formulate product finding';

    if (isDeterministic) {
      cognitionRequired = false;
      cognitionRationale = 'Task is deterministically executable without LLM cognition';
    } else if (mutationScope === 'PRODUCT_CODE_MUTATION') {
      cognitionRationale = 'AI engineering and QA judgment required to implement and verify code patch';
    }

    // 5. Capability Admission (Existing capabilities only)
    let capabilities: string[];
    if (!cognitionRequired) {
      capabilities = []; // Zero AI roles needed
    } else if (mutationScope === 'PRODUCT_CODE_MUTATION') {
      // For code mutation, engineering and QA capabilities are strictly required
      capabilities = ['backend-engineer', 'functional-qa'];
      // Include PM if grooming/spec definition was not already approved
      if (candidate.pm_review_status !== 'APPROVED') {
        capabilities = ['pm', 'backend-engineer', 'functional-qa'];
      }
    } else if (candidate.task_type === 'research' || objectiveId.startsWith('BACKLOG-RESEARCH-')) {
      capabilities = ['pm', 'domain-expert'];
    } else {
      // Non-code inquiry or audit: single PM capability is minimally sufficient
      capabilities = ['pm'];
    }

    // 6. Worktree Requirement
    const worktreeRequired = mutationScope === 'PRODUCT_CODE_MUTATION';

    // 7. Verification Methods (Must match the artifact)
    const verificationMethods: VerificationMethod[] = [];
    if (isDeterministic) {
      verificationMethods.push('DETERMINISTIC_ASSERTION');
    } else if (mutationScope === 'PRODUCT_CODE_MUTATION') {
      verificationMethods.push('CODE_REGRESSION_TEST');
      verificationMethods.push('CONSUMER_INTEGRATION_CHECK');
    } else if (mutationScope === 'COMPANY_STATE_MUTATION') {
      verificationMethods.push('SCHEMA_AND_EVIDENCE_VALIDATION');
      verificationMethods.push('PROVENANCE_AND_FINDING_RECORDED');
    } else if (mutationScope === 'READ_ONLY') {
      verificationMethods.push('PROVENANCE_AND_FINDING_RECORDED');
    }

    // 8. Authority
    const authority = mutationScope === 'PRODUCT_CODE_MUTATION'
      ? 'Independent Quality & Functional QA Gate'
      : 'PM Gate & Execution Lease Authority';

    return {
      contract_id: `CONTRACT:${objectiveId}:${Date.now()}`,
      objective_id: objectiveId,
      intent,
      expected_artifact_or_decision: expectedArtifact,
      mutation_scope: mutationScope,
      cognition_required: cognitionRequired,
      cognition_rationale: cognitionRationale,
      selected_capabilities: capabilities,
      worktree_required: worktreeRequired,
      verification_methods: verificationMethods,
      authority,
      is_conservative_fallback: isConservativeFallback,
    };
  }
}
