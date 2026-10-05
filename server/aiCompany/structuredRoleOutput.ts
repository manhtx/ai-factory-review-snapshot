import type { CompanyRoleId } from './roleContracts';

export type EpistemicType =
  | 'FACT'
  | 'INFERENCE'
  | 'ASSUMPTION'
  | 'RECOMMENDATION'
  | 'DISSENT'
  | 'LIMITATION'
  | 'EVIDENCE_REFERENCE';

export interface EpistemicStatement {
  type: EpistemicType;
  claim: string;
  evidence_ids?: string[];
  confidence?: number;
}

export interface StructuredPmOutput {
  role: 'pm';
  problem: string;
  target_user: string;
  product_goal_objective: string;
  evidence_ids: string[];
  facts: string[];
  assumptions: string[];
  scope: string[];
  non_goals: string[];
  recommendation: string;
  confidence: number;
  unknowns: string[];
}

export interface StructuredTechLeadOutput {
  role: 'tech-lead';
  architecture_impact: string;
  affected_modules: string[];
  risk: string;
  rollback: string;
  migration_requirement: string;
  test_strategy: string;
  security_boundary: string;
  evidence_ids: string[];
  recommendation: 'BUILD' | 'REVISE' | 'HOLD' | 'REJECT';
}

export interface StructuredCoderOutput {
  role: 'coder' | 'backend-engineer' | 'frontend-engineer' | 'data-engineer';
  files_changed: string[];
  files_not_changed: string[];
  implementation_summary: string;
  tests_run: string[];
  tests_failed: string[];
  known_limitations: string[];
  rollback_instruction: string;
  evidence_ids: string[];
  summary?: string;
}

export interface StructuredQaOutput {
  role: 'functional-qa';
  test_matrix: Array<{ test_name: string; expected: string; actual: string; status: 'PASS' | 'FAIL' }>;
  expected_result: string;
  actual_result: string;
  environment: string;
  browser_or_device?: string;
  unresolved_issues: string[];
  evidence_ids: string[];
  verdict: 'PASS' | 'FAIL' | 'HOLD';
}

export interface StructuredQcOutput {
  role: 'quality-control';
  evidence_independently_checked: string[];
  contradictory_evidence: string[];
  unsupported_claims: string[];
  scope_drift: string[];
  reproducibility: 'REPRODUCIBLE' | 'PARTIAL' | 'NOT_REPRODUCIBLE';
  evidence_ids: string[];
  verdict: 'PASS' | 'QUALITY_FAIL' | 'HOLD';
}

export interface StructuredCeoOutput {
  role: 'ceo-guild' | 'ceo';
  decision: 'ACCEPT' | 'VALIDATE' | 'HOLD' | 'REJECT';
  reason: string;
  evidence_ids: string[];
  dissent: string[];
  coordination_problem?: string;
  root_cause?: string;
  recovery_plan?: {
    failure_class: string;
    root_cause: string;
    corrective_assignment: string;
    role_owner: CompanyRoleId;
    max_retry: number;
    retest_condition: string;
  };
  next_workflow: string;
  owner: string;
  retest_condition: string;
}

export type AnyStructuredRoleOutput =
  | StructuredPmOutput
  | StructuredTechLeadOutput
  | StructuredCoderOutput
  | StructuredQaOutput
  | StructuredQcOutput
  | StructuredCeoOutput;

export interface ValidationOutputResult {
  valid: boolean;
  verdict: 'PASS' | 'QUALITY_FAIL';
  errors: string[];
  unsupported_claims: string[];
  structured?: AnyStructuredRoleOutput;
}

/** Parse and validate one provider marker without allowing callers to bypass
 * the role-specific schema. This is the single typed boundary for dispatcher,
 * queue, and future provider adapters. */
export function parseStructuredRoleOutput(role: CompanyRoleId, encoded: string): ValidationOutputResult {
  if (typeof encoded !== 'string' || !encoded.trim()) {
    return { valid: false, verdict: 'QUALITY_FAIL', errors: ['structured output JSON is required'], unsupported_claims: [] };
  }
  try {
    const parsed = JSON.parse(encoded) as Record<string, unknown>;
    // Some providers qualify confidence in prose. Normalize only the
    // constrained PM vocabulary; arbitrary labels remain invalid.
    if (role === 'pm' && typeof parsed.confidence === 'string') {
      const value = parsed.confidence.trim().toLowerCase();
      if (value === 'high') parsed.confidence = 0.9;
      else if (value === 'medium' || value === 'moderate') parsed.confidence = 0.6;
      else if (value === 'low') parsed.confidence = 0.3;
      else if (/^high\s+for\b/.test(value)) parsed.confidence = 0.75;
    }
    return validateStructuredRoleOutput(role, parsed);
  } catch (error) {
    return {
      valid: false,
      verdict: 'QUALITY_FAIL',
      errors: [`structured output JSON is malformed: ${error instanceof Error ? error.message : String(error)}`],
      unsupported_claims: ['provider emitted malformed structured JSON'],
    };
  }
}

export function validateStructuredRoleOutput(role: CompanyRoleId, raw: unknown): ValidationOutputResult {
  const errors: string[] = [];
  const unsupported_claims: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return {
      valid: false,
      verdict: 'QUALITY_FAIL',
      errors: ['output must be a non-empty object conforming to role schema (pure narrative rejected)'],
      unsupported_claims: ['entire output is unstructured narrative'],
    };
  }

  const obj = raw as Record<string, any>;

  // Common check: role field must match
  if (role === 'ceo' || role === 'ceo-guild') {
    if (obj.role !== 'ceo' && obj.role !== 'ceo-guild') {
      errors.push(`expected role 'ceo' or 'ceo-guild', got '${obj.role}'`);
    }
  } else if (obj.role !== role) {
    errors.push(`expected role '${role}', got '${obj.role}'`);
  }

  // Common check: evidence_ids must be non-empty array
  if (!Array.isArray(obj.evidence_ids) || obj.evidence_ids.length === 0) {
    errors.push('evidence_ids is mandatory and must contain at least one evidence identifier');
    unsupported_claims.push('output lacks evidence mapping (evidence_ids is empty)');
  }

  switch (role) {
    case 'pm': {
      for (const field of ['problem', 'target_user', 'product_goal_objective', 'recommendation'] as const) {
        if (!obj[field] || typeof obj[field] !== 'string' || !obj[field].trim()) {
          errors.push(`PM field '${field}' is required and must be non-empty`);
        }
      }
      if (!['PROCEED', 'REVISE', 'HOLD', 'REJECT'].includes(obj.recommendation)) {
        errors.push(`PM recommendation must be PROCEED|REVISE|HOLD|REJECT, got '${obj.recommendation}'`);
      }
      for (const listField of ['facts', 'assumptions', 'scope', 'non_goals', 'unknowns'] as const) {
        if (!Array.isArray(obj[listField])) {
          errors.push(`PM field '${listField}' must be an array`);
        }
      }
      if (typeof obj.confidence !== 'number' || obj.confidence < 0 || obj.confidence > 1) {
        errors.push("PM confidence must be a number between 0.0 and 1.0");
      }
      break;
    }

    case 'tech-lead': {
      for (const field of ['architecture_impact', 'risk', 'rollback', 'migration_requirement', 'test_strategy', 'security_boundary'] as const) {
        if (!obj[field] || typeof obj[field] !== 'string' || !obj[field].trim()) {
          errors.push(`Tech Lead field '${field}' is required and must be non-empty`);
        }
      }
      if (!Array.isArray(obj.affected_modules) || obj.affected_modules.length === 0) {
        errors.push('Tech Lead affected_modules must be a non-empty array');
      }
      if (!['BUILD', 'REVISE', 'HOLD', 'REJECT'].includes(obj.recommendation)) {
        errors.push(`Tech Lead recommendation must be BUILD|REVISE|HOLD|REJECT, got '${obj.recommendation}'`);
      }
      break;
    }

    case 'coder': {
      for (const field of ['implementation_summary', 'rollback_instruction'] as const) {
        if (!obj[field] || typeof obj[field] !== 'string' || !obj[field].trim()) {
          errors.push(`Coder field '${field}' is required and must be non-empty`);
        }
      }
      for (const listField of ['files_changed', 'files_not_changed', 'tests_run', 'tests_failed', 'known_limitations'] as const) {
        if (!Array.isArray(obj[listField])) {
          errors.push(`Coder field '${listField}' must be an array`);
        }
      }
      if (Array.isArray(obj.tests_failed) && obj.tests_failed.length > 0) {
        unsupported_claims.push(`Coder reported failing tests: ${obj.tests_failed.join(', ')}`);
      }
      break;
    }

    case 'backend-engineer':
    case 'frontend-engineer':
    case 'data-engineer': {
      const summary = obj.implementation_summary ?? obj.summary;
      if (!summary || typeof summary !== 'string' || !summary.trim()) {
        errors.push(`Role '${role}' output requires summary`);
      }
      for (const listField of ['files_changed', 'files_not_changed', 'tests_run', 'tests_failed', 'known_limitations'] as const) {
        if (obj[listField] !== undefined && !Array.isArray(obj[listField])) {
          errors.push(`Engineer field '${listField}' must be an array`);
        }
      }
      break;
    }

    case 'functional-qa': {
      for (const field of ['expected_result', 'actual_result', 'environment'] as const) {
        if (!obj[field] || typeof obj[field] !== 'string' || !obj[field].trim()) {
          errors.push(`QA field '${field}' is required and must be non-empty`);
        }
      }
      if (!Array.isArray(obj.test_matrix) || obj.test_matrix.length === 0) {
        errors.push('QA test_matrix must be a non-empty array of test results');
      }
      if (!['PASS', 'FAIL', 'HOLD'].includes(obj.verdict)) {
        errors.push(`QA verdict must be PASS|FAIL|HOLD, got '${obj.verdict}'`);
      }
      if (!Array.isArray(obj.unresolved_issues)) {
        errors.push('QA unresolved_issues must be an array');
      }
      break;
    }

    case 'quality-control': {
      if (!Array.isArray(obj.evidence_independently_checked) || obj.evidence_independently_checked.length === 0) {
        errors.push('QC evidence_independently_checked must be a non-empty array');
      }
      for (const listField of ['contradictory_evidence', 'unsupported_claims', 'scope_drift'] as const) {
        if (!Array.isArray(obj[listField])) {
          errors.push(`QC field '${listField}' must be an array`);
        }
      }
      if (!['REPRODUCIBLE', 'PARTIAL', 'NOT_REPRODUCIBLE'].includes(obj.reproducibility)) {
        errors.push(`QC reproducibility must be REPRODUCIBLE|PARTIAL|NOT_REPRODUCIBLE, got '${obj.reproducibility}'`);
      }
      if (!['PASS', 'QUALITY_FAIL', 'HOLD'].includes(obj.verdict)) {
        errors.push(`QC verdict must be PASS|QUALITY_FAIL|HOLD, got '${obj.verdict}'`);
      }
      break;
    }

    case 'ceo-guild':
    case 'ceo': {
      if (!['ACCEPT', 'VALIDATE', 'HOLD', 'REJECT'].includes(obj.decision)) {
        errors.push(`CEO decision must be ACCEPT|VALIDATE|HOLD|REJECT, got '${obj.decision}'`);
      }
      for (const field of ['reason', 'next_workflow', 'owner', 'retest_condition'] as const) {
        if (!obj[field] || typeof obj[field] !== 'string' || !obj[field].trim()) {
          errors.push(`CEO field '${field}' is required and must be non-empty`);
        }
      }
      if (!Array.isArray(obj.dissent)) {
        errors.push('CEO dissent must be an array');
      }
      if (obj.decision === 'HOLD') {
        if (!obj.recovery_plan || typeof obj.recovery_plan !== 'object') {
          errors.push('CEO decision HOLD requires a concrete recovery_plan');
        } else {
          const rp = obj.recovery_plan;
          for (const rpField of ['failure_class', 'root_cause', 'corrective_assignment', 'role_owner', 'retest_condition'] as const) {
            if (!rp[rpField] || typeof rp[rpField] !== 'string' || !rp[rpField].trim()) {
              errors.push(`CEO recovery_plan.${rpField} is required`);
            }
          }
        }
      }
      break;
    }

    default:
      // Other roles check basic evidence presence
      if (!obj.summary || typeof obj.summary !== 'string') {
        errors.push(`Role '${role}' output requires summary`);
      }
  }

  const isValid = errors.length === 0;
  const isQualityFail = !isValid || unsupported_claims.length > 0;

  return {
    valid: isValid,
    verdict: isQualityFail ? 'QUALITY_FAIL' : 'PASS',
    errors,
    unsupported_claims,
    structured: isValid ? (raw as AnyStructuredRoleOutput) : undefined,
  };
}
