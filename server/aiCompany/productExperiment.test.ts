import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProductExperimentLedger } from './productExperiment';

describe('ProductExperimentLedger', () => {
  it('persists a complete local baseline-to-learning-to-priority chain', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-company-experiment-')); const ledger = new ProductExperimentLedger(dir); const input = { experiment_id: 'EXP-1', project_id: 'macro-os', metric_name: 'compare_completion', evidence_state: 'LOCAL_ONLY' as const, evidence_ids: ['telemetry:s1'] };
    await ledger.baseline({ ...input, value: 0.4 }); await ledger.prediction({ ...input, target: 0.6 }); await ledger.measurement({ ...input, value: 0.7 }); await ledger.learning({ ...input, decision_affected: 'prioritize compare-contract guard' }); await ledger.reprioritize({ ...input, decision_affected: 'BACKLOG-COMPARE-GUARD' });
    await expect(ledger.hasClosedLocalChain('EXP-1')).resolves.toBe(true);
  });
  it('rejects evidence-free measurement and learning', async () => {
    const ledger = new ProductExperimentLedger(await mkdtemp(join(tmpdir(), 'ai-company-experiment-'))); const input = { experiment_id: 'EXP-2', project_id: 'macro-os', metric_name: 'x', evidence_state: 'LOCAL_ONLY' as const, evidence_ids: [] };
    await expect(ledger.measurement({ ...input, value: 1 })).rejects.toThrow('evidence'); await expect(ledger.learning({ ...input, decision_affected: 'decision' })).rejects.toThrow('evidence');
  });

  it('measures only fresh post-baseline telemetry and fails closed on small samples', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-company-experiment-')); const source = join(dir, 'user-telemetry.jsonl'); await (await import('node:fs/promises')).writeFile(source, '{"eventType":"indicator_compare","sessionId":"old","timestamp":"2026-09-10T00:00:00Z"}\n{"eventType":"compare_explanation_opened","sessionId":"new","timestamp":"2026-09-11T00:00:00Z"}\n'); const ledger = new ProductExperimentLedger(dir);
    await expect(ledger.measureTelemetry({ experiment_id: 'EXP-4', project_id: 'macro-os', baseline_at: '2026-09-10T12:00:00Z', source, minimum_sessions: 2, production: false })).resolves.toMatchObject({ state: 'INSUFFICIENT_SAMPLE', sample_size: 1 });
    await expect(ledger.measureTelemetry({ experiment_id: 'EXP-4', project_id: 'macro-os', baseline_at: '2026-09-10T12:00:00Z', source, minimum_sessions: 1, production: false })).resolves.toMatchObject({ state: 'LOCAL_MEASURED', sample_size: 1 });
  });
});
