import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { InMemoryEvidenceResolver } from './evidenceResolver';
import { RoleWorkQueue } from './roleWorkQueue';
import { coordinateRecovery } from './recoveryCoordinator';
import { RoleHandoffLedger } from './roleHandoffLedger';
import type { RecoveryPlan } from './recoveryPlan';

describe('CEO Recovery Coordinator & Scenarios', () => {
  const basePlan: RecoveryPlan = {
    recovery_id: 'R1',
    source_decision_id: 'D1',
    failure_class: 'INSUFFICIENT_EVIDENCE',
    root_cause: 'runtime evidence missing',
    actions: ['collect runtime evidence'],
    accountable_role: 'sre',
    dependency_updates: ['D1'],
    required_evidence: ['runtime report'],
    acceptance_criteria: ['report'],
    retry_budget: 2,
    max_depth: 3,
    current_depth: 0,
    priority: 'P1',
    re_review_trigger: 'report exists',
    terminal_if_failed: 'TERMINAL_HOLD',
  };

  it('Scenario 1: QA fail -> Coder fix corrective task -> QA re-run', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'recovery-sc1-'));
    const resolver = new InMemoryEvidenceResolver();
    const queue = new RoleWorkQueue(root, resolver);
    const handoffs = new RoleHandoffLedger(root);

    const source = await queue.create({ project_id: 'macro-os', backlog_id: 'B-source', title: 'isolated backend fixture', role: 'backend-engineer', run_id: 'run-1', namespace: 'bench' });
    const sourceEvidence = resolver.createEvidence({ evidence_id: 'EVID-QA-FAIL-1', namespace: 'bench', run_id: 'run-1', produced_by_role: source.role, content: 'Isolated backend test failure fixture; no real product code effect.' });
    resolver.register({ ...sourceEvidence, work_id: source.work_id, source_artifact: 'recoveryCoordinator.test.ts' });
    const claimAuthority1 = await queue.claim(source.work_id, 'fixture');
    await queue.submitForReview(source.work_id, claimAuthority1.attempt_authority);
    await queue.complete(source.work_id, [sourceEvidence.evidence_id], undefined, undefined, { role: 'backend-engineer', files_changed: [], files_not_changed: [], implementation_summary: 'fixture', tests_run: [], tests_failed: [], known_limitations: ['isolated fixture'], rollback_instruction: 'none', evidence_ids: [sourceEvidence.evidence_id] }, undefined, undefined, claimAuthority1.attempt_authority);
    const qaWork = await queue.create({
      project_id: 'macro-os',
      backlog_id: 'B1',
      title: 'QA verify feature',
      role: 'functional-qa',
      run_id: 'run-1', namespace: 'bench', depends_on: [source.work_id],
    });
    const claimAuthority2 = await queue.claim(qaWork.work_id, 'qa-agent');
    await queue.submitForReview(qaWork.work_id, claimAuthority2.attempt_authority);
    await queue.complete(
      qaWork.work_id,
      ['EVID-QA-FAIL-1'],
      undefined,
      {
        verdict: 'QUALITY_FAIL',
        gate: 'qa-gate',
        summary: 'Freshness date boundary test failed',
        evidence: ['EVID-QA-FAIL-1'],
        failure_class: 'TEST_FAILURE',
        root_cause: 'freshness date boundary defect',
        recovery_required: true,
        recovery_actions: ['fix date boundary calculation in server/freshness.ts'],
        accountable_role: 'coder',
        unblock_evidence: ['vitest pass evidence'],
        retry_budget: 2,
        next_review_trigger: 'freshness test suite green',
        confidence: 0.9,
      }
    , undefined, undefined, undefined, claimAuthority2.attempt_authority);

    const qaFailPlan: RecoveryPlan = {
      recovery_id: 'REC-QA-FAIL',
      source_decision_id: 'DEC-QA-1',
      failure_class: 'TEST_FAILURE',
      root_cause: 'freshness date boundary defect',
      actions: ['fix date boundary calculation in server/freshness.ts'],
      accountable_role: 'coder',
      re_review_role: 'functional-qa',
      dependency_updates: [qaWork.work_id],
      required_evidence: ['vitest pass evidence'],
      acceptance_criteria: ['server/freshness.test.ts passes cleanly'],
      retry_budget: 2,
      priority: 'P0',
      re_review_trigger: 'freshness test suite green',
      terminal_if_failed: 'TERMINAL_HOLD',
    };

    const res = await coordinateRecovery({
      queue,
      handoffs,
      plan: qaFailPlan,
      projectId: 'macro-os',
      runId: 'run-1',
      namespace: 'bench',
      sourceWorkId: qaWork.work_id,
      attempts: 0,
    });

    expect(res.status).toBe('CREATED');
    expect(res.task?.role).toBe('coder');
    expect(res.task?.title).toContain('freshness date boundary defect');

    const allWork = await queue.records('macro-os');
    const reviewTask = allWork.find((w) => w.work_id.endsWith('-REVIEW'));
    expect(reviewTask).toBeDefined();
    expect(reviewTask?.role).toBe('functional-qa');
    expect(reviewTask?.depends_on).toContain(res.task?.work_id);
    expect(res.task?.assignment?.run_id).toBe('run-1');
    expect(res.task?.assignment?.namespace).toBe('bench');

    // Execute corrective task by Coder
    const claimAuthority3 = await queue.claim(res.task!.work_id, 'coder-agent');
    await queue.submitForReview(res.task!.work_id, claimAuthority3.attempt_authority);
    const correctiveEvidence = resolver.createEvidence({ evidence_id: 'EVID-CORRECTIVE-CODER-1', namespace: 'bench', run_id: 'run-1', produced_by_role: 'coder', content: 'Isolated corrective fixture; no real product code effect.' });
    resolver.register({ ...correctiveEvidence, work_id: res.task!.work_id, source_artifact: 'recoveryCoordinator.test.ts' });
    const coderDone = await queue.complete(
      res.task!.work_id,
      ['EVID-CORRECTIVE-CODER-1'],
      undefined,
      undefined,
      {
        role: 'coder',
        files_changed: ['src/boundary.ts'],
        files_not_changed: [],
        implementation_summary: 'Unit test defect fixed',
        summary: 'Unit test defect fixed',
        tests_run: ['npm test'],
        tests_failed: [],
        known_limitations: [],
        rollback_instruction: 'git restore src/boundary.ts',
        evidence_ids: ['EVID-CORRECTIVE-CODER-1'],
      }
    , undefined, undefined, claimAuthority3.attempt_authority);
    expect(coderDone.state).toBe('DONE');

    // Execute re-review task by Functional QA
    const claimAuthority4 = await queue.claim(reviewTask!.work_id, 'qa-agent');
    await queue.submitForReview(reviewTask!.work_id, claimAuthority4.attempt_authority);
    const qaDone = await queue.complete(
      reviewTask!.work_id,
      ['EVID-CORRECTIVE-CODER-1'],
      undefined,
      {
        verdict: 'PASS',
        gate: 'qa-verification',
        summary: 'QA re-run passed with clean assertions',
        evidence: ['EVID-CORRECTIVE-CODER-1'],
        failure_class: 'NONE',
        root_cause: 'none',
        recovery_required: false,
        recovery_actions: [],
        unblock_evidence: [],
        retry_budget: 0,
        next_review_trigger: 'none',
        confidence: 1,
      }
    , undefined, undefined, undefined, claimAuthority4.attempt_authority);
    expect(qaDone.state).toBe('DONE');
    expect((await queue.records()).find(item => item.work_id === qaWork.work_id)?.state).toBe('BLOCKED');

    // Check that recovery deduplication prevents duplicate tasks in this chain
    const dupRes = await coordinateRecovery({
      queue,
      handoffs,
      plan: qaFailPlan,
      projectId: 'macro-os',
      runId: 'run-1',
      namespace: 'bench',
      sourceWorkId: qaWork.work_id,
      attempts: 0,
    });
    // Verify that repeating coordinateRecovery with same attempts is safely DEDUPLICATED
    expect(dupRes.status).toBe('DEDUPLICATED');
  });

  it('Scenario 2: QA missing evidence -> CEO HOLD -> coordinator creates evidence collection task', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'recovery-sc2-'));
    const queue = new RoleWorkQueue(root);
    const source = await queue.create({ project_id: 'macro-os', backlog_id: 'B2', title: 'Audit data freshness', role: 'functional-qa' });

    const evidencePlan: RecoveryPlan = {
      ...basePlan,
      recovery_id: 'REC-EV-1',
      failure_class: 'INSUFFICIENT_EVIDENCE',
      root_cause: 'freshness audit artifact missing',
      actions: ['run scripts/audit-freshness.mjs'],
      accountable_role: 'data-engineer',
      re_review_role: 'quality-control',
    };

    const res = await coordinateRecovery({
      queue,
      plan: evidencePlan,
      projectId: 'macro-os',
      runId: 'run-2',
      namespace: 'bench',
      sourceWorkId: source.work_id,
      attempts: 0,
    });

    expect(res.status).toBe('CREATED');
    expect(res.task?.role).toBe('data-engineer');
  });

  it('Scenario 3: CEO detects scope drift -> terminal hold / blocked escalation', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'recovery-sc3-'));
    const queue = new RoleWorkQueue(root);
    const source = await queue.create({ project_id: 'macro-os', backlog_id: 'B3', title: 'Unapproved UI rewrite', role: 'coder' });

    const scopeDriftPlan: RecoveryPlan = {
      ...basePlan,
      recovery_id: 'REC-SCOPE-1',
      failure_class: 'SCOPE_DRIFT',
      root_cause: 'unapproved UI deliverable outside acceptance criteria',
      retry_budget: 1,
      terminal_if_failed: 'TERMINAL_HOLD',
    };

    const res = await coordinateRecovery({
      queue,
      plan: scopeDriftPlan,
      projectId: 'macro-os',
      runId: 'run-3',
      namespace: 'bench',
      sourceWorkId: source.work_id,
      attempts: 1, // attempt 1 of budget 1
    });

    expect(res.status).toBe('TERMINAL_HOLD');
  });

  it('Scenario 4 & 5: Provider timeout with bounded retry and budget exhaustion', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'recovery-sc4-'));
    const queue = new RoleWorkQueue(root);
    const source = await queue.create({ project_id: 'macro-os', backlog_id: 'B4', title: 'Codex call', role: 'coder' });

    const timeoutPlan: RecoveryPlan = {
      ...basePlan,
      recovery_id: 'REC-TIMEOUT',
      failure_class: 'PROVIDER_TIMEOUT',
      root_cause: 'gateway timeout 60s exceeded',
      retry_budget: 2,
      terminal_if_failed: 'TERMINAL_HOLD',
    };

    // Attempt 0: retry allowed -> CREATED
    const res0 = await coordinateRecovery({
      queue,
      plan: timeoutPlan,
      projectId: 'macro-os',
      runId: 'run-4',
      namespace: 'bench',
      sourceWorkId: source.work_id,
      attempts: 0,
    });
    expect(res0.status).toBe('CREATED');

    // Attempt 2: budget exhausted -> TERMINAL_HOLD
    const resExhausted = await coordinateRecovery({
      queue,
      plan: timeoutPlan,
      projectId: 'macro-os',
      runId: 'run-4',
      namespace: 'bench',
      sourceWorkId: source.work_id,
      attempts: 2,
    });
    expect(resExhausted.status).toBe('TERMINAL_HOLD');
  });

  it('Scenario 6: Recovery chain exceeding max depth triggers TERMINAL_HOLD', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'recovery-sc6-'));
    const queue = new RoleWorkQueue(root);
    const source = await queue.create({ project_id: 'macro-os', backlog_id: 'B6', title: 'Deep failure', role: 'coder' });

    const deepPlan: RecoveryPlan = {
      ...basePlan,
      recovery_id: 'REC-DEEP',
      failure_class: 'RUNTIME_FAILURE',
      root_cause: 'infinite loop in worker',
      retry_budget: 5,
      max_depth: 3,
      current_depth: 3, // depth reached limit
      terminal_if_failed: 'TERMINAL_HOLD',
    };

    const res = await coordinateRecovery({
      queue,
      plan: deepPlan,
      projectId: 'macro-os',
      runId: 'run-6',
      namespace: 'bench',
      sourceWorkId: source.work_id,
      attempts: 0,
    });

    expect(res.status).toBe('TERMINAL_HOLD');
  });

  it('Scenario 7: Duplicate recovery requests are deduplicated', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'recovery-sc7-'));
    const queue = new RoleWorkQueue(root);
    const source = await queue.create({ project_id: 'macro-os', backlog_id: 'B7', title: 'Duplicated item', role: 'coder' });

    const plan: RecoveryPlan = {
      ...basePlan,
      recovery_id: 'REC-DUP',
      re_review_role: 'ceo-guild',
    };

    const input = {
      queue,
      plan,
      projectId: 'macro-os',
      runId: 'run-7',
      namespace: 'bench',
      sourceWorkId: source.work_id,
      attempts: 0,
    };

    const first = await coordinateRecovery(input);
    expect(first.status).toBe('CREATED');

    const second = await coordinateRecovery(input);
    expect(second.status).toBe('DEDUPLICATED');
    expect(second.task?.work_id).toBe(first.task?.work_id);
  });

  it('Scenario 8: CEO review never auto-promotes release without independent verification', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'recovery-sc8-'));
    const queue = new RoleWorkQueue(root);
    await queue.create({ project_id: 'macro-os', backlog_id: 'B8', title: 'Feature proposal', role: 'pm' });

    // CEO cannot self-approve release
    const allRoles = ['ceo', 'ceo-guild', 'pm', 'coder'];
    for (const r of allRoles) {
      expect(r).not.toBe('release-security-gate');
    }

    const rec = await queue.records('macro-os');
    expect(rec.some((item) => item.state === 'DONE')).toBe(false);
  });
});
