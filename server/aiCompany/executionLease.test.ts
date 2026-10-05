import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { ExecutionLeaseManager, resolveModelMetadata } from './executionLease';

describe('Controller-Scoped Execution Authority V2 (T1–T17)', () => {
  let tmpDir: string;
  let leaseManager: ExecutionLeaseManager;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'execution-lease-test-'));
    leaseManager = new ExecutionLeaseManager(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => null);
  });

  describe('Model Metadata Normalization', () => {
    it('normalizes Gemini 3.8 Flash High correctly', () => {
      const meta = resolveModelMetadata('Gemini 3.8 Flash High');
      expect(meta).not.toBeNull();
      expect(meta?.runtime_model_id).toBe('gemini-3.8-flash-high');
      expect(meta?.provider).toBe('gemini');
      expect(meta?.runner).toBe('agy');
    });

    it('normalizes GPT-5.6 Sol correctly', () => {
      const meta = resolveModelMetadata('GPT-5.6 Sol');
      expect(meta).not.toBeNull();
      expect(meta?.runtime_model_id).toBe('gpt-5.6-sol');
      expect(meta?.provider).toBe('openai');
      expect(meta?.runner).toBe('codex');
    });

    it('normalizes Claude Sonnet on agy correctly', () => {
      const meta = resolveModelMetadata('Claude Sonnet 4.6 (Thinking)');
      expect(meta).not.toBeNull();
      expect(meta?.runtime_model_id).toBe('claude-sonnet-4-6');
      expect(meta?.provider).toBe('anthropic');
      expect(meta?.runner).toBe('agy');
    });
  });

  describe('Authority Order (T1–T4)', () => {
    it('T1: Anti + Gemini explicit handoff routes to Gemini 3.8 Flash High on agy', async () => {
      const result = await leaseManager.resolveExecutionAuthority({
        explicitHandoff: {
          controller: 'antigravity',
          model: 'Gemini 3.8 Flash High',
        },
      });

      expect(result.status).toBe('RESOLVED');
      expect(result.lease?.controller).toBe('antigravity');
      expect(result.lease?.provider).toBe('gemini');
      expect(result.lease?.runtime_model_id).toBe('gemini-3.8-flash-high');
      expect(result.lease?.runner).toBe('agy');
      expect(result.lease?.affinity_revision).toBe(1);
    });

    it('T2: Codex + GPT explicit handoff routes to GPT-5.6 Sol on codex', async () => {
      const result = await leaseManager.resolveExecutionAuthority({
        explicitHandoff: {
          controller: 'codex',
          model: 'GPT-5.6 Sol',
        },
      });

      expect(result.status).toBe('RESOLVED');
      expect(result.lease?.controller).toBe('codex');
      expect(result.lease?.provider).toBe('openai');
      expect(result.lease?.runtime_model_id).toBe('gpt-5.6-sol');
      expect(result.lease?.runner).toBe('codex');
      expect(result.lease?.affinity_revision).toBe(1);
    });

    it('T3: Anti + Different Model (Anti with Claude Sonnet routes to Claude, proving Anti != hardcoded Gemini)', async () => {
      const result = await leaseManager.resolveExecutionAuthority({
        explicitHandoff: {
          controller: 'antigravity',
          model: 'Claude Sonnet 4.6 (Thinking)',
        },
      });

      expect(result.status).toBe('RESOLVED');
      expect(result.lease?.controller).toBe('antigravity');
      expect(result.lease?.provider).toBe('anthropic');
      expect(result.lease?.runtime_model_id).toBe('claude-sonnet-4-6');
      expect(result.lease?.runner).toBe('agy');
    });

    it('T4: Codex + Different Model (Codex with GPT-5 routes to GPT-5, proving Codex != hardcoded GPT-5.6 Sol)', async () => {
      const result = await leaseManager.resolveExecutionAuthority({
        explicitHandoff: {
          controller: 'codex',
          model: 'gpt-5',
        },
      });

      expect(result.status).toBe('RESOLVED');
      expect(result.lease?.controller).toBe('codex');
      expect(result.lease?.provider).toBe('openai');
      expect(result.lease?.runtime_model_id).toBe('gpt-5');
      expect(result.lease?.runner).toBe('codex');
    });
  });

  describe('Historical Affinity as Provenance Only (T5–T6)', () => {
    it('T5: Historical Codex/GPT overridden by current explicit Anti/Gemini handoff', async () => {
      // Create initial historical Codex lease
      await leaseManager.createOrUpdateExecutionLease({
        controller: 'codex',
        model: 'GPT-5.6 Sol',
      });

      // New interactive run supplies explicit Anti / Gemini handoff
      const result = await leaseManager.resolveExecutionAuthority({
        explicitHandoff: {
          controller: 'antigravity',
          model: 'Gemini 3.8 Flash High',
        },
      });

      expect(result.status).toBe('RESOLVED');
      expect(result.lease?.controller).toBe('antigravity');
      expect(result.lease?.provider).toBe('gemini');
      expect(result.lease?.runtime_model_id).toBe('gemini-3.8-flash-high');
      expect(result.lease?.affinity_revision).toBe(2);
      expect(result.lease?.takeover_predecessor).toBe('LEASE:MARATHON-ANTIGRAVITY-PERPETUAL-01:rev-1');
    });

    it('T6: Historical Anti/Gemini overridden by current explicit Codex/GPT handoff', async () => {
      await leaseManager.createOrUpdateExecutionLease({
        controller: 'antigravity',
        model: 'Gemini 3.8 Flash High',
      });

      const result = await leaseManager.resolveExecutionAuthority({
        explicitHandoff: {
          controller: 'codex',
          model: 'GPT-5.6 Sol',
        },
      });

      expect(result.status).toBe('RESOLVED');
      expect(result.lease?.controller).toBe('codex');
      expect(result.lease?.provider).toBe('openai');
      expect(result.lease?.runtime_model_id).toBe('gpt-5.6-sol');
      expect(result.lease?.affinity_revision).toBe(2);
    });
  });

  describe('Fail Closed on Unresolved Authority (T7–T9)', () => {
    it('T7: No current execution lease -> fails closed with EXECUTOR_AFFINITY_UNRESOLVED', async () => {
      const result = await leaseManager.resolveExecutionAuthority();
      expect(result.status).toBe('EXECUTOR_AFFINITY_UNRESOLVED');
      expect(result.lease).toBeUndefined();
    });

    it('T8: Controller known, model unknown -> fails closed with EXECUTOR_AFFINITY_UNRESOLVED', async () => {
      const result = await leaseManager.resolveExecutionAuthority({
        explicitHandoff: {
          controller: 'antigravity',
          model: '',
        },
      });
      expect(result.status).toBe('EXECUTOR_AFFINITY_UNRESOLVED');
      expect(result.reason).toContain('model is required');
    });

    it('T9: Model known, provider/controller mapping ambiguous -> fails closed without guessing', async () => {
      const result = await leaseManager.resolveExecutionAuthority({
        explicitHandoff: {
          controller: 'antigravity',
          model: 'unsupported-mystery-model-xyz',
        },
      });
      expect(result.status).toBe('EXECUTOR_AFFINITY_UNRESOLVED');
      expect(result.reason).toContain('could not be resolved');
    });
  });

  describe('Takeover & Boundary Preservation (T10–T12)', () => {
    it('T10: Safe takeover when idle -> new revision issued, next call uses new controller/model', async () => {
      const initial = await leaseManager.createOrUpdateExecutionLease({
        controller: 'antigravity',
        model: 'Gemini 3.8 Flash High',
      });
      expect(initial.affinity_revision).toBe(1);

      const takeover = await leaseManager.takeoverExecutionLease({
        controller: 'codex',
        model: 'GPT-5.6 Sol',
        expectedRevision: 1,
        isCognitionActive: false,
      });

      expect(takeover.controller).toBe('codex');
      expect(takeover.runtime_model_id).toBe('gpt-5.6-sol');
      expect(takeover.affinity_revision).toBe(2);
      expect(takeover.source_of_selection).toBe('takeover');
      expect(takeover.takeover_predecessor).toBe(initial.lease_id);
    });

    it('T11: Takeover requested while cognition is active -> rejected until safe boundary', async () => {
      await leaseManager.createOrUpdateExecutionLease({
        controller: 'antigravity',
        model: 'Gemini 3.8 Flash High',
      });

      await expect(
        leaseManager.takeoverExecutionLease({
          controller: 'codex',
          model: 'GPT-5.6 Sol',
          isCognitionActive: true,
        })
      ).rejects.toThrow(/active atomic cognition in flight/);
    });

    it('T12: Stale session tries to restore old revision -> rejected with STALE_LEASE_REVISION', async () => {
      await leaseManager.createOrUpdateExecutionLease({
        controller: 'antigravity',
        model: 'Gemini 3.8 Flash High',
      });
      // Advance to revision 2
      await leaseManager.createOrUpdateExecutionLease({
        controller: 'codex',
        model: 'GPT-5.6 Sol',
      });

      // Stale session attempts to write using expected revision 1
      await expect(
        leaseManager.createOrUpdateExecutionLease({
          controller: 'antigravity',
          model: 'Gemini 3.8 Flash High',
          expectedRevision: 1,
        })
      ).rejects.toThrow(/STALE_LEASE_REVISION/);
    });
  });

  describe('Resource Failure Without Silent Fallback (T13–T14)', () => {
    it('T13: Gemini quota exhaustion -> records WAIT_SAME_PROVIDER with zero cross-fallback', async () => {
      await leaseManager.createOrUpdateExecutionLease({
        controller: 'antigravity',
        model: 'Gemini 3.8 Flash High',
      });

      const paused = await leaseManager.recordQuotaWait('Gemini 429 quota exhausted', 60_000);
      expect(paused.resource_state?.status).toBe('WAIT_SAME_PROVIDER');
      expect(paused.provider).toBe('gemini');
      expect(paused.runtime_model_id).toBe('gemini-3.8-flash-high');

      const resolution = await leaseManager.resolveExecutionAuthority();
      expect(resolution.status).toBe('RESOURCE_WAIT');
      expect(resolution.lease?.provider).toBe('gemini');
      // Proves NO silent switch to Codex/GPT
      expect(resolution.lease?.runner).toBe('agy');
      expect(resolution.lease?.runtime_model_id).toBe('gemini-3.8-flash-high');
    });

    it('T14: Provider recovers -> clears wait state and resumes on same provider', async () => {
      await leaseManager.createOrUpdateExecutionLease({
        controller: 'antigravity',
        model: 'Gemini 3.8 Flash High',
      });
      await leaseManager.recordQuotaWait('Gemini 429', 60_000);
      await leaseManager.clearQuotaWait();

      const resolution = await leaseManager.resolveExecutionAuthority();
      expect(resolution.status).toBe('RESOLVED');
      expect(resolution.lease?.resource_state?.status).toBe('OK');
      expect(resolution.lease?.provider).toBe('gemini');
    });
  });

  describe('Run Resume vs New Run (T15–T16)', () => {
    it('T15: Supervisor restart during SAME run resumes active lease (run continuation)', async () => {
      const created = await leaseManager.createOrUpdateExecutionLease({
        controller: 'antigravity',
        model: 'Gemini 3.8 Flash High',
        run_id: 'marathon-run-alpha',
      });

      // Fresh lease manager instance simulating supervisor process restart
      const supervisorLeaseManager = new ExecutionLeaseManager(tmpDir);
      const resumed = await supervisorLeaseManager.resolveExecutionAuthority();

      expect(resumed.status).toBe('RESOLVED');
      expect(resumed.lease?.lease_id).toBe(created.lease_id);
      expect(resumed.lease?.run_id).toBe('marathon-run-alpha');
      expect(resumed.lease?.provider).toBe('gemini');
    });

    it('T16: A new interactive run supersedes prior run context cleanly', async () => {
      await leaseManager.createOrUpdateExecutionLease({
        controller: 'antigravity',
        model: 'Gemini 3.8 Flash High',
        run_id: 'run-1',
      });

      const newRunLease = await leaseManager.createOrUpdateExecutionLease({
        controller: 'codex',
        model: 'GPT-5.6 Sol',
        run_id: 'run-2',
      });

      expect(newRunLease.run_id).toBe('run-2');
      expect(newRunLease.affinity_revision).toBe(2);
      expect(newRunLease.takeover_predecessor).toBe('LEASE:MARATHON-ANTIGRAVITY-PERPETUAL-01:rev-1');
    });
  });

  describe('Split-Brain Protection (T17)', () => {
    it('T17: Two controllers attempt to update the same lease concurrently -> CAS ensures exactly one wins', async () => {
      const initial = await leaseManager.createOrUpdateExecutionLease({
        controller: 'antigravity',
        model: 'Gemini 3.8 Flash High',
      });
      expect(initial.affinity_revision).toBe(1);

      // Controller A attempts update expecting revision 1
      const updateA = await leaseManager.createOrUpdateExecutionLease({
        controller: 'antigravity',
        model: 'gemini-3.7-flash-high',
        expectedRevision: 1,
      });
      expect(updateA.affinity_revision).toBe(2);

      // Controller B attempts update concurrently also expecting revision 1
      await expect(
        leaseManager.createOrUpdateExecutionLease({
          controller: 'codex',
          model: 'GPT-5.6 Sol',
          expectedRevision: 1,
        })
      ).rejects.toThrow(/STALE_LEASE_REVISION/);
    });
  });
});
