import { describe, expect, it } from 'vitest';
import { ArchitectureTrialLedger } from './architectureTrial';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InMemoryEvidenceResolver } from './evidenceResolver';

const base = (arm: any) => ({ trial_id: 'TRIAL-1', arm, project_id: 'macro-os', product_task: 'inspect freshness provenance', product_goal_reference: 'docs/PRODUCT_GOAL.md#global-daily-intelligence', base_product_revision: 'REV-1', data_snapshot: 'SNAP-1', model_generation: 'MODEL-1', reasoning_effort: 'medium', available_tools: ['filesystem', 'tests'], authority: 'local-worktree', evaluator_version: 'EVAL-1', cognition_protocol: `cognition-${arm}`, action_protocol: `action-${arm}`, execution_order: 1, confounders: [], state: 'MEASURED' as const, product_quality: 4, product_quality_evidence_ids: ['quality:TRIAL-1'], domain_correctness: 4, domain_correctness_evidence_ids: ['domain:TRIAL-1'], process_integrity: 4, safety: 4, evidence_ids: ['prospective:TRIAL-1'], created_at: '2026-01-01T00:00:00.000Z' });

describe('ArchitectureTrialLedger', () => {
  it('registers prospective arm evidence and compares shared conditions', async () => {
    const ledger = new ArchitectureTrialLedger(await mkdtemp(join(tmpdir(), 'ai-company-architecture-')));
    await ledger.register(base('A_CURRENT_AI_COMPANY'));
    await ledger.register(base('B_STRONG_MINIMAL_AGENT'));
    await ledger.register(base('C_VERIFIED_PRODUCT_KERNEL'));
    const measured = (await ledger.records('TRIAL-1')).map((record) => ({ ...record, state: 'MEASURED' as const, product_quality: 4, process_integrity: 4, safety: 4 }));
    const result = ledger.compare(measured);
    expect(result.state).toBe('COMPARABLE');
    expect(result.arms).toHaveLength(3);
  });

  it('rejects architecture comparisons with a confounded revision', async () => {
    const ledger = new ArchitectureTrialLedger(await mkdtemp(join(tmpdir(), 'ai-company-architecture-')));
    await ledger.register(base('A_CURRENT_AI_COMPANY'));
    await ledger.register({ ...base('B_STRONG_MINIMAL_AGENT'), base_product_revision: 'REV-2' });
    const measured = (await ledger.records('TRIAL-1')).map((record) => ({ ...record, state: 'MEASURED' as const, product_quality: 4, process_integrity: 4, safety: 4 }));
    const result = ledger.compare(measured);
    expect(result.state).toBe('INVALID');
    expect(result.reason).toContain('comparable');
  });

  it('requires evidence and the Product Goal before registration', async () => {
    const ledger = new ArchitectureTrialLedger(await mkdtemp(join(tmpdir(), 'ai-company-architecture-')));
    await expect(ledger.register({ ...base('A_CURRENT_AI_COMPANY'), evidence_ids: [] })).rejects.toThrow('evidence');
    await expect(ledger.register({ ...base('A_CURRENT_AI_COMPANY'), product_goal_reference: '' })).rejects.toThrow('Product Goal');
  });

  it('rejects incomplete, duplicate, and unmeasured architecture arms', async () => {
    const ledger = new ArchitectureTrialLedger(await mkdtemp(join(tmpdir(), 'ai-company-architecture-')));
    const records = [base('A_CURRENT_AI_COMPANY'), base('A_CURRENT_AI_COMPANY'), base('B_STRONG_MINIMAL_AGENT')]
      .map((record, index) => index === 2 ? { ...record, state: 'REGISTERED' as const } : record);
    const result = ledger.compare(records);
    expect(result.state).toBe('INVALID');
    expect(result.invalid_arms.flatMap((entry) => entry.reasons).join(' ')).toContain('exactly one');
    expect(result.invalid_arms.flatMap((entry) => entry.reasons).join(' ')).toContain('required architecture arm is missing');
    expect(result.invalid_arms.flatMap((entry) => entry.reasons).join(' ')).toContain('measured state');
  });

  it('rejects invalid measurement domains and negative resource counts', async () => {
    const ledger = new ArchitectureTrialLedger(await mkdtemp(join(tmpdir(), 'ai-company-architecture-')));
    await expect(ledger.register({ ...base('A_CURRENT_AI_COMPANY'), product_quality: 6 })).rejects.toThrow('between 0 and 5');
    await expect(ledger.register({ ...base('A_CURRENT_AI_COMPANY'), token_actual: -1 })).rejects.toThrow('non-negative');
  });

  it('rejects unresolved confounders instead of declaring a clean comparison', () => {
    const ledger = new ArchitectureTrialLedger('/tmp/architecture-trial-test');
    const result = ledger.compare([
      base('A_CURRENT_AI_COMPANY'),
      { ...base('B_STRONG_MINIMAL_AGENT'), confounders: ['different execution scope'] },
      base('C_VERIFIED_PRODUCT_KERNEL'),
    ]);
    expect(result.state).toBe('INVALID');
    expect(result.invalid_arms.flatMap((entry) => entry.reasons).join(' ')).toContain('unresolved confounders');
  });

  it('rejects arms that secretly use the same cognition and action protocol', () => {
    const ledger = new ArchitectureTrialLedger('/tmp/architecture-trial-test');
    const same = { cognition_protocol: 'same', action_protocol: 'same' };
    const result = ledger.compare([
      { ...base('A_CURRENT_AI_COMPANY'), ...same },
      { ...base('B_STRONG_MINIMAL_AGENT'), ...same },
      base('C_VERIFIED_PRODUCT_KERNEL'),
    ]);
    expect(result.state).toBe('INVALID');
    expect(result.invalid_arms.flatMap((entry) => entry.reasons).join(' ')).toContain('distinct cognition/action protocols');
  });

  it('rejects a trial that has engineering quality but no independent domain correctness', () => {
    const ledger = new ArchitectureTrialLedger('/tmp/architecture-trial-test');
    const result = ledger.compare([
      { ...base('A_CURRENT_AI_COMPANY'), domain_correctness: undefined },
      { ...base('B_STRONG_MINIMAL_AGENT'), domain_correctness: undefined },
      { ...base('C_VERIFIED_PRODUCT_KERNEL'), domain_correctness: undefined },
    ]);
    expect(result.state).toBe('INVALID');
    expect(result.invalid_arms.flatMap((entry) => entry.reasons).join(' ')).toContain('missing domain correctness');
  });

  it('rejects score claims without evidence references', () => {
    const ledger = new ArchitectureTrialLedger('/tmp/architecture-trial-test');
    const result = ledger.compare([
      { ...base('A_CURRENT_AI_COMPANY'), product_quality_evidence_ids: [] },
      { ...base('B_STRONG_MINIMAL_AGENT'), product_quality_evidence_ids: [] },
      { ...base('C_VERIFIED_PRODUCT_KERNEL'), product_quality_evidence_ids: [] },
    ]);
    expect(result.state).toBe('INVALID');
    expect(result.invalid_arms.flatMap((entry) => entry.reasons).join(' ')).toContain('missing product quality evidence');
  });

  it('rejects structurally valid but unresolvable architecture evidence', async () => {
    const ledger = new ArchitectureTrialLedger(await mkdtemp(join(tmpdir(), 'ai-company-architecture-')));
    const resolver = new InMemoryEvidenceResolver();
    const result = await ledger.validateEvidence([base('A_CURRENT_AI_COMPANY')], resolver, { expectedNamespace: 'trial' });
    expect(result.valid).toBe(false);
    expect(result.invalid_arms[0].reasons.join(' ')).toContain('cannot be resolved');
  });

  it('accepts resolved evidence only when it is in the trial, namespaced, hashed, and sourced', async () => {
    const ledger = new ArchitectureTrialLedger(await mkdtemp(join(tmpdir(), 'ai-company-architecture-')));
    const resolver = new InMemoryEvidenceResolver();
    for (const id of ['prospective:TRIAL-1', 'quality:TRIAL-1', 'domain:TRIAL-1']) {
      const evidence = resolver.createEvidence({ evidence_id: id, namespace: 'trial', run_id: 'TRIAL-1', produced_by_role: 'deterministic-verifier', content: id });
      evidence.source_artifact = 'reports/trial.json';
    }
    const result = await ledger.validateEvidence([base('A_CURRENT_AI_COMPANY')], resolver, { expectedNamespace: 'trial' });
    expect(result).toEqual({ valid: true, invalid_arms: [] });
  });

  it('allows D to remain a bottleneck hypothesis without architecture quality scores', () => {
    const ledger = new ArchitectureTrialLedger('/tmp/architecture-trial-test');
    const result = ledger.compare([{ ...base('D_PRODUCT_BOTTLENECK'), product_quality: undefined, domain_correctness: undefined, product_quality_evidence_ids: [], domain_correctness_evidence_ids: [] }]);
    expect(result.invalid_arms.find((entry) => entry.arm === 'D_PRODUCT_BOTTLENECK')?.reasons ?? []).not.toContain('missing product quality');
  });
});
