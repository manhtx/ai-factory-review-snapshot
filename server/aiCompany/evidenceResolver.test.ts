import { describe, it, expect } from 'vitest';
import { InMemoryEvidenceResolver } from './evidenceResolver';
import { validateReviewEvidenceRecord, type ReviewEvidenceRecord } from './reviewEvidenceContract';

describe('Evidence Resolver (Phase 2)', () => {
  function makeValidRecord(evidence_ids: string[] = ['EV-VALID']): ReviewEvidenceRecord {
    return {
      review_id: 'REV-1',
      work_id: 'WORK-1',
      role: 'functional-qa',
      cycle_round: 1,
      verdict: 'PASS',
      commands_run: [{ command: 'npm test', exit_code: 0 }],
      test_results: [{ test_framework: 'vitest', test_file: 'a.test.ts', test_name: 't1', status: 'PASS' }],
      changed_files_verified: [],
      evidence_ids,
      created_at: new Date().toISOString(),
    };
  }

  it('rejects fake / unresolvable evidence ID', () => {
    const resolver = new InMemoryEvidenceResolver();
    const record = makeValidRecord(['FAKE-EVID-999']);
    const errors = validateReviewEvidenceRecord(record, {
      expected_namespace: 'test-ns',
      expected_run_id: 'run-1',
      evidence_resolver: resolver,
    });
    expect(errors.some((e) => e.includes("cannot be resolved or does not exist"))).toBe(true);
  });

  it('rejects evidence from a different namespace', () => {
    const resolver = new InMemoryEvidenceResolver();
    resolver.createEvidence({
      evidence_id: 'EV-OTHER-NS',
      namespace: 'foreign-ns',
      run_id: 'run-1',
      produced_by_role: 'coder',
      content: 'output data',
    });

    const record = makeValidRecord(['EV-OTHER-NS']);
    const errors = validateReviewEvidenceRecord(record, {
      expected_namespace: 'our-ns',
      expected_run_id: 'run-1',
      evidence_resolver: resolver,
    });
    expect(errors.some((e) => e.includes("namespace mismatch"))).toBe(true);
  });

  it('rejects evidence with content hash mismatch', () => {
    const resolver = new InMemoryEvidenceResolver();
    const stored = resolver.createEvidence({
      evidence_id: 'EV-TAMPERED',
      namespace: 'test-ns',
      run_id: 'run-1',
      produced_by_role: 'coder',
      content: 'original clean content',
    });

    // Tamper with the content
    stored.content = 'tampered malicious content';

    const record = makeValidRecord(['EV-TAMPERED']);
    const errors = validateReviewEvidenceRecord(record, {
      expected_namespace: 'test-ns',
      expected_run_id: 'run-1',
      evidence_resolver: resolver,
    });
    expect(errors.some((e) => e.includes("hash mismatch"))).toBe(true);
  });

  it('rejects self-produced evidence (reviewer cannot self-certify)', () => {
    const resolver = new InMemoryEvidenceResolver();
    resolver.createEvidence({
      evidence_id: 'EV-SELF-MADE',
      namespace: 'test-ns',
      run_id: 'run-1',
      produced_by_role: 'functional-qa', // same as reviewer role
      content: 'QA self report',
    });

    const record = makeValidRecord(['EV-SELF-MADE']);
    const errors = validateReviewEvidenceRecord(record, {
      expected_namespace: 'test-ns',
      expected_run_id: 'run-1',
      evidence_resolver: resolver,
    });
    expect(errors.some((e) => e.includes("self-produced by reviewer role"))).toBe(true);
  });

  it('rejects stale evidence exceeding max age policy', () => {
    const resolver = new InMemoryEvidenceResolver();
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    resolver.createEvidence({
      evidence_id: 'EV-STALE',
      namespace: 'test-ns',
      run_id: 'run-1',
      produced_by_role: 'coder',
      content: 'old data',
      created_at: tenDaysAgo,
    });

    const record = makeValidRecord(['EV-STALE']);
    const errors = validateReviewEvidenceRecord(record, {
      expected_namespace: 'test-ns',
      expected_run_id: 'run-1',
      evidence_resolver: resolver,
      max_evidence_age_ms: 7 * 24 * 60 * 60 * 1000, // 7 days max
    });
    expect(errors.some((e) => e.includes("is stale"))).toBe(true);
  });

  it('accepts valid, non-stale, non-self-produced evidence with matching hash and namespace', () => {
    const resolver = new InMemoryEvidenceResolver();
    resolver.createEvidence({
      evidence_id: 'EV-VALID',
      namespace: 'test-ns',
      run_id: 'run-1',
      produced_by_role: 'coder',
      content: 'verified implementation evidence',
    });

    const record = makeValidRecord(['EV-VALID']);
    const errors = validateReviewEvidenceRecord(record, {
      expected_namespace: 'test-ns',
      expected_run_id: 'run-1',
      evidence_resolver: resolver,
    });
    expect(errors).toHaveLength(0);
  });
});
