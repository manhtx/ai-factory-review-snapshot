import type { FailureClass } from './verdict';
import type { IEvidenceResolver } from './evidenceResolver';
import { validateEvidenceResolution } from './evidenceResolver';
import { verifyChangedFiles, type ChangedFileDiffRecord } from './fileChangeVerifier';

export interface CommandExecutionEvidence {
  command: string;
  exit_code: number;
  stdout_tail?: string;
  stderr_tail?: string;
  duration_ms?: number;
}

export interface TestExecutionEvidence {
  test_framework: 'vitest' | 'playwright' | 'custom';
  test_file: string;
  test_name: string;
  status: 'PASS' | 'FAIL';
  duration_ms?: number;
  error_message?: string;
}

export type ReviewTestPolicy = 'none' | 'targeted' | 'affected' | 'full_suite' | 'full';

export interface ReviewTaskContext {
  test_policy?: ReviewTestPolicy;
  task_type?: string;
  allowed_paths?: string[];
  require_typecheck?: boolean;
  mutation_policy?: 'read_only' | 'isolated_workspace' | 'in_place';
  workspace_root?: string;
  expected_namespace?: string;
  expected_run_id?: string;
  evidence_resolver?: IEvidenceResolver;
  max_evidence_age_ms?: number;
  now?: () => number;
  before_contents?: Record<string, string>;
}

export interface ReviewEvidenceRecord {
  review_id: string;
  work_id: string;
  role: 'functional-qa' | 'quality-control' | 'critic';
  cycle_round: number; // 1, 2, or 3
  verdict: 'PASS' | 'REJECT';
  commands_run: CommandExecutionEvidence[];
  test_results: TestExecutionEvidence[];
  changed_files_verified: string[];
  evidence_ids: string[];
  diff_records?: ChangedFileDiffRecord[];
  rejection_details?: {
    failure_class: FailureClass;
    file?: string;
    line?: number;
    artifact_pointer?: string;
    retest_condition: string;
  };
  terminal_state?: 'NEEDS_HUMAN' | 'TERMINAL_HOLD';
  created_at: string;
}

export function validateReviewEvidenceRecord(
  record: ReviewEvidenceRecord,
  context?: ReviewTaskContext
): string[] {
  const errors: string[] = [];

  if (!record.review_id?.trim()) errors.push('review_id is required');
  if (!record.work_id?.trim()) errors.push('work_id is required');
  if (!['functional-qa', 'quality-control', 'critic'].includes(record.role)) {
    errors.push(`invalid reviewer role: ${record.role}`);
  }

  if (!Number.isInteger(record.cycle_round) || record.cycle_round < 1) {
    errors.push('cycle_round must be a positive integer');
  }

  // Max 3 rounds rule: round 3 failure MUST declare terminal state
  if (record.cycle_round >= 3 && record.verdict === 'REJECT') {
    if (!record.terminal_state || !['NEEDS_HUMAN', 'TERMINAL_HOLD'].includes(record.terminal_state)) {
      errors.push('Round 3 failure must specify terminal_state: NEEDS_HUMAN or TERMINAL_HOLD');
    }
  }

  if (!['PASS', 'REJECT'].includes(record.verdict)) {
    errors.push("verdict must be strictly 'PASS' or 'REJECT'");
  }

  // PASS requires execution evidence
  if (record.verdict === 'PASS') {
    if (!Array.isArray(record.commands_run) || record.commands_run.length === 0) {
      errors.push('PASS verdict requires at least one command execution evidence');
    } else {
      const anyFailingCmd = record.commands_run.some((c) => c.exit_code !== 0);
      if (anyFailingCmd) {
        errors.push('PASS verdict cannot contain commands with non-zero exit codes');
      }
    }

    if (!Array.isArray(record.evidence_ids) || record.evidence_ids.length === 0) {
      errors.push('PASS verdict requires at least one evidence ID');
    } else {
      const invalidEvid = record.evidence_ids.some((id) => typeof id !== 'string' || !id.trim() || !/^[A-Za-z0-9_:-]+$/.test(id));
      if (invalidEvid) {
        errors.push('evidence_ids contains invalid or empty evidence identifiers');
      }
    }

    // Evidence resolution verification
    if (context?.evidence_resolver && Array.isArray(record.evidence_ids)) {
      for (const id of record.evidence_ids) {
        const resolved = context.evidence_resolver.resolve(id);
        // Synchronous resolver check
        if (resolved && typeof (resolved as any).then === 'function') {
          throw new Error('Asynchronous evidence resolution requires validateReviewEvidenceRecordAsync');
        }
        const resolutionErrors = validateEvidenceResolution(resolved as any, id, {
          expected_namespace: context.expected_namespace ?? '',
          expected_run_id: context.expected_run_id ?? '',
          reviewer_role: record.role,
          max_age_ms: context.max_evidence_age_ms,
          now: context.now,
        });
        errors.push(...resolutionErrors);
      }
    }

    // Read-only task mutation check
    if (context?.mutation_policy === 'read_only') {
      if (Array.isArray(record.changed_files_verified) && record.changed_files_verified.length > 0) {
        errors.push(
          `read-only task cannot have verified changed files (found ${record.changed_files_verified.length}: ${record.changed_files_verified.join(', ')})`
        );
      }
    }

    // Changed file verification (existence, path traversal, allowed paths, diff hashes)
    if (context?.workspace_root && Array.isArray(record.changed_files_verified)) {
      const verification = verifyChangedFiles(record.changed_files_verified, {
        workspace_root: context.workspace_root,
        allowed_paths: context.allowed_paths,
        mutation_policy: context.mutation_policy,
        before_contents: context.before_contents,
      });
      errors.push(...verification.errors);
      record.diff_records = verification.diff_records;
    } else if (context?.allowed_paths && context.allowed_paths.length > 0 && Array.isArray(record.changed_files_verified)) {
      // Fallback allowed_paths check if workspace_root is not provided
      const isDefault = context.allowed_paths.includes('assigned workspace');
      if (!isDefault) {
        for (const file of record.changed_files_verified) {
          const isAllowed = context.allowed_paths.some((allowed) => file === allowed || file.startsWith(`${allowed}/`) || file.includes(allowed));
          if (!isAllowed) {
            errors.push(`scope drift detected: ${file} is not within allowed_paths (${context.allowed_paths.join(', ')})`);
          }
        }
      }
    }

    // Context-dependent: test policy
    if (context?.test_policy === 'targeted' || context?.test_policy === 'full') {
      if (!Array.isArray(record.test_results) || record.test_results.length === 0) {
        errors.push(`PASS verdict under test_policy '${context.test_policy}' requires test_results`);
      } else {
        const anyFailingTest = record.test_results.some((t) => t.status !== 'PASS');
        if (anyFailingTest) {
          errors.push('PASS verdict cannot contain failing test results');
        }
      }
    }

    // Context-dependent: typecheck / lint
    if (context?.require_typecheck) {
      const hasTypecheck = record.commands_run?.some((c) => c.command.includes('typecheck') || c.command.includes('tsc'));
      if (!hasTypecheck) {
        errors.push('PASS verdict requires typecheck command evidence');
      }
    }
  }

  // REJECT requires failure details, pointer, and retest condition
  if (record.verdict === 'REJECT') {
    if (!record.rejection_details) {
      errors.push('REJECT verdict requires rejection_details');
    } else {
      if (!record.rejection_details.failure_class) {
        errors.push('rejection_details.failure_class is required');
      }
      if (!record.rejection_details.retest_condition?.trim()) {
        errors.push('rejection_details.retest_condition is required');
      }
      const hasPointer = Boolean(
        record.rejection_details.file?.trim() ||
        record.rejection_details.line !== undefined ||
        record.rejection_details.artifact_pointer?.trim()
      );
      if (!hasPointer) {
        errors.push('rejection_details requires at least one pointer: file, line, or artifact_pointer');
      }
    }
  }

  return errors;
}

export function assertReviewEvidenceRecord(
  record: ReviewEvidenceRecord,
  context?: ReviewTaskContext
): ReviewEvidenceRecord {
  const errors = validateReviewEvidenceRecord(record, context);
  if (errors.length > 0) {
    throw new Error(`invalid review evidence record: ${errors.join('; ')}`);
  }
  return record;
}
