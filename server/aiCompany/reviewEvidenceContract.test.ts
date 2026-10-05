import { describe, expect, it } from 'vitest';
import {
  assertReviewEvidenceRecord,
  validateReviewEvidenceRecord,
  type ReviewEvidenceRecord,
} from './reviewEvidenceContract';

describe('ReviewEvidenceRecord Contract', () => {
  it('validates a valid PASS review with execution evidence', () => {
    const validPass: ReviewEvidenceRecord = {
      review_id: 'REV-001',
      work_id: 'WORK-001',
      role: 'functional-qa',
      cycle_round: 1,
      verdict: 'PASS',
      commands_run: [
        {
          command: 'npx vitest run server/freshness.test.ts',
          exit_code: 0,
          duration_ms: 250,
        },
      ],
      test_results: [
        {
          test_framework: 'vitest',
          test_file: 'server/freshness.test.ts',
          test_name: 'freshnessStatus detects stale dates',
          status: 'PASS',
        },
      ],
      changed_files_verified: ['server/freshness.ts'],
      evidence_ids: ['EVID-QA-001'],
      created_at: new Date().toISOString(),
    };

    expect(validateReviewEvidenceRecord(validPass)).toEqual([]);
    expect(assertReviewEvidenceRecord(validPass)).toBe(validPass);
  });

  it('rejects PASS verdict without command execution evidence or with non-zero exit code', () => {
    const passNoCmd: ReviewEvidenceRecord = {
      review_id: 'REV-002',
      work_id: 'WORK-002',
      role: 'functional-qa',
      cycle_round: 1,
      verdict: 'PASS',
      commands_run: [],
      test_results: [],
      changed_files_verified: [],
      evidence_ids: ['EVID-QA-002'],
      created_at: new Date().toISOString(),
    };
    expect(validateReviewEvidenceRecord(passNoCmd)).toContain(
      'PASS verdict requires at least one command execution evidence'
    );

    const passFailingCmd: ReviewEvidenceRecord = {
      ...passNoCmd,
      commands_run: [{ command: 'npm test', exit_code: 1 }],
    };
    expect(validateReviewEvidenceRecord(passFailingCmd)).toContain(
      'PASS verdict cannot contain commands with non-zero exit codes'
    );
  });

  it('rejects REJECT verdict missing failure class or retest condition', () => {
    const rejectNoDetails: ReviewEvidenceRecord = {
      review_id: 'REV-003',
      work_id: 'WORK-003',
      role: 'quality-control',
      cycle_round: 1,
      verdict: 'REJECT',
      commands_run: [],
      test_results: [],
      changed_files_verified: [],
      evidence_ids: [],
      created_at: new Date().toISOString(),
    };
    expect(validateReviewEvidenceRecord(rejectNoDetails)).toContain(
      'REJECT verdict requires rejection_details'
    );
  });

  it('enforces terminal_state on round 3 failures', () => {
    const round4RejectNoTerminal: ReviewEvidenceRecord = {
      review_id: 'REV-004',
      work_id: 'WORK-004',
      role: 'functional-qa',
      cycle_round: 4,
      verdict: 'REJECT',
      commands_run: [{ command: 'npm test', exit_code: 1 }],
      test_results: [],
      changed_files_verified: [],
      evidence_ids: [],
      rejection_details: {
        failure_class: 'TEST_FAILURE',
        file: 'server/test.ts',
        retest_condition: 'All tests pass',
      },
      created_at: new Date().toISOString(),
    };

    expect(validateReviewEvidenceRecord(round4RejectNoTerminal)).toContain(
      'Round 3 failure must specify terminal_state: NEEDS_HUMAN or TERMINAL_HOLD'
    );

    const round4WithTerminal: ReviewEvidenceRecord = {
      ...round4RejectNoTerminal,
      terminal_state: 'TERMINAL_HOLD',
    };
    expect(validateReviewEvidenceRecord(round4WithTerminal)).toEqual([]);
  });
});
