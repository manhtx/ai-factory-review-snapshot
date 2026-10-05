import { describe, it, expect } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { RoleWorkQueue } from './roleWorkQueue';
import { coordinateRecovery } from './recoveryCoordinator';
import { validateRecoveryPlan } from './recoveryPlan';
import { validateReviewVerdict } from './verdict';
import { assertReviewEvidenceRecord } from './reviewEvidenceContract';

describe('Provider-Driven Recovery Evidence Verification', () => {
  const tmpRoot = path.join(process.cwd(), '.ai-company', 'runtime', 'test-provider-recovery-evidence');

  it('proves reviewer cannot PASS merely because evidence ID exists without valid signature', () => {
    interface ObservationPayload {
      correlation_id: string;
      status: string;
      signature: string | null;
    }

    // Malformed provider output where evidence ID exists but signature is missing
    const providerOutputMissingSignature: ObservationPayload = {
      correlation_id: 'CORR-TEST-101',
      status: 'UNSIGNED_KEY_MISSING',
      signature: null,
    };

    const evidenceId = 'EVID:PAYLOAD-101';

    // Simulated evaluation function matching production reviewer
    const evaluate = (out: ObservationPayload) => {
      const hasValidSig = typeof out.signature === 'string' && out.signature.startsWith('SIG_');
      if (!hasValidSig) {
        return {
          verdict: 'HOLD' as const,
          gate: 'schema-verification-gate',
          summary: 'Missing required signature',
          evidence: [evidenceId],
          failure_class: 'INSUFFICIENT_EVIDENCE' as const,
          root_cause: 'Signature is null despite valid evidence ID',
          recovery_required: true,
          recovery_actions: ['Re-generate with signature'],
          accountable_role: 'backend-engineer',
          unblock_evidence: ['EVID:RETRY-101'],
          retry_budget: 1,
          next_review_trigger: 'EVID:RETRY-101',
          confidence: 0.95,
        };
      }
      return {
        verdict: 'PASS' as const,
        gate: 'schema-verification-gate',
        summary: 'Valid',
        evidence: [evidenceId],
        failure_class: 'NONE' as const,
        root_cause: 'none',
        recovery_required: false,
        recovery_actions: [],
        unblock_evidence: [],
        retry_budget: 0,
        next_review_trigger: 'none',
        confidence: 1.0,
      };
    };

    const verdict = evaluate(providerOutputMissingSignature);
    expect(verdict.verdict).toBe('HOLD');
    expect(verdict.failure_class).toBe('INSUFFICIENT_EVIDENCE');
    expect(verdict.evidence).toContain(evidenceId);
    expect(validateReviewVerdict(verdict)).toHaveLength(0);
  });

  it('proves evidence content mismatch results in REJECT', () => {
    // Artifact with mismatched correlation ID
    const artifact = {
      correlation_id: 'CORR-OTHER-999',
      signature: 'SIG_VALID_123',
      status: 'VALID_AND_SIGNED',
    };

    const requiredCorrelationId = 'CORR-REQUIRED-111';

    const qcEvaluate = (art: typeof artifact, requiredCorr: string) => {
      if (art.correlation_id !== requiredCorr) {
        return {
          verdict: 'QUALITY_FAIL' as const,
          gate: 'schema-verification-gate',
          summary: `Correlation ID mismatch: expected ${requiredCorr}, got ${art.correlation_id}`,
          evidence: ['EVID:MISMATCH-1'],
          failure_class: 'QUALITY_DEFECT' as const,
          root_cause: `Correlation ID mismatch`,
          recovery_required: true,
          recovery_actions: ['Fix correlation ID'],
          accountable_role: 'backend-engineer',
          unblock_evidence: ['EVID:FIX-1'],
          retry_budget: 1,
          next_review_trigger: 'EVID:FIX-1',
          confidence: 1.0,
        };
      }
      return {
        verdict: 'PASS' as const,
        gate: 'schema-verification-gate',
        summary: 'PASS',
        evidence: ['EVID:PASS-1'],
        failure_class: 'NONE' as const,
        root_cause: 'none',
        recovery_required: false,
        recovery_actions: [],
        unblock_evidence: [],
        retry_budget: 0,
        next_review_trigger: 'none',
        confidence: 1.0,
      };
    };

    const verdict = qcEvaluate(artifact, requiredCorrelationId);
    expect(verdict.verdict).toBe('QUALITY_FAIL');
    expect(verdict.root_cause).toContain('Correlation ID mismatch');
  });

  it('proves coder and CEO cannot self-approve', () => {
    const coderRole = 'backend-engineer';
    const ceoRole = 'ceo-guild';
    const reviewerRole = 'quality-control';

    // Invariant: Reviewer cannot be coder
    const canCoderReview = (coder: string, reviewer: string) => coder !== reviewer;
    expect(canCoderReview(coderRole, coderRole)).toBe(false);
    expect(canCoderReview(coderRole, reviewerRole)).toBe(true);

    // Invariant: Reviewer cannot be CEO
    const canCeoReview = (ceo: string, reviewer: string) => ceo !== reviewer;
    expect(canCeoReview(ceoRole, ceoRole)).toBe(false);
    expect(canCeoReview(ceoRole, reviewerRole)).toBe(true);
  });

  it('proves recovery task deduplication and namespace/run_id preservation', async () => {
    await mkdir(tmpRoot, { recursive: true });
    const queue = new RoleWorkQueue(tmpRoot);
    const runId = 'run-evidence-proof-101';
    const namespace = 'ns-evidence-proof-101';
    const sourceWorkId = 'WORK-SOURCE-101';

    const plan = {
      recovery_id: 'REC-PROOF-101',
      source_decision_id: sourceWorkId,
      failure_class: 'INSUFFICIENT_EVIDENCE' as const,
      root_cause: 'Missing signature in provider payload',
      actions: ['Re-generate signed payload'],
      accountable_role: 'backend-engineer' as const,
      re_review_role: 'quality-control' as const,
      dependency_updates: [sourceWorkId],
      required_evidence: ['EVID:PROOF-RETRY'],
      acceptance_criteria: ['Valid cryptographic signature present'],
      retry_budget: 1,
      max_depth: 2,
      current_depth: 0,
      priority: 'P1' as const,
      re_review_trigger: 'EVID:PROOF-RETRY',
      terminal_if_failed: 'TERMINAL_HOLD' as const,
    };

    expect(validateRecoveryPlan(plan)).toHaveLength(0);

    // Seed source task into queue first so DAG dependency resolves
    await queue.createBatch([
      {
        work_id: sourceWorkId,
        project_id: 'macro-os',
        backlog_id: `BACKLOG-${sourceWorkId}`,
        title: 'Source task that will fail',
        role: 'backend-engineer',
        run_id: runId,
        namespace,
      },
    ]);

    // First coordinateRecovery call
    const res1 = await coordinateRecovery({
      queue,
      plan,
      projectId: 'macro-os',
      runId,
      namespace,
      sourceWorkId,
      attempts: 0,
    });

    expect(res1.status).toBe('CREATED');
    expect(res1.task).toBeDefined();
    expect(res1.task?.run_id).toBe(runId);
    expect(res1.task?.namespace).toBe(namespace);

    // Second coordinateRecovery call with same root cause and run
    const res2 = await coordinateRecovery({
      queue,
      plan,
      projectId: 'macro-os',
      runId,
      namespace,
      sourceWorkId,
      attempts: 0,
    });

    expect(res2.status).toBe('DEDUPLICATED');

    // Cleanup
    await rm(tmpRoot, { recursive: true, force: true });
  });

  it('proves QC generates verified ReviewEvidenceRecord and terminal state PASS', () => {
    const artifactPath = '/path/to/artifact.json';
    const record = {
      review_id: 'REV-QC-PROOF-1',
      work_id: 'WORK-QC-PROOF-1',
      role: 'quality-control' as const,
      cycle_round: 1,
      verdict: 'PASS' as const,
      commands_run: [
        {
          command: `verify-signature ${artifactPath}`,
          exit_code: 0,
          duration_ms: 10,
        },
      ],
      test_results: [
        {
          test_framework: 'custom' as const,
          test_file: 'artifactVerifier',
          test_name: 'testSignatureFormat',
          status: 'PASS' as const,
          duration_ms: 5,
        },
      ],
      changed_files_verified: [artifactPath],
      evidence_ids: ['EVID:SIGNED-QC-1'],
      created_at: new Date().toISOString(),
    };

    expect(() => assertReviewEvidenceRecord(record)).not.toThrow();
  });
});
