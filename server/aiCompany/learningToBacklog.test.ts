import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BacklogLedger } from './backlogLedger';
import { ProductExperimentLedger } from './productExperiment';
import { applyExperimentLearningToBacklog } from './learningToBacklog';

describe('learning to backlog', () => {
  it('changes a backlog decision only after linked learning exists', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-company-learning-')); const experiment = new ProductExperimentLedger(dir); const base = { experiment_id: 'EXP-3', project_id: 'macro-os', metric_name: 'x', evidence_state: 'LOCAL_ONLY' as const, evidence_ids: ['e1'] };
    await experiment.learning({ ...base, decision_affected: 'compare path needs validation' });
    const decision = await applyExperimentLearningToBacklog({ experiment, experimentId: 'EXP-3', item: { backlog_id: 'BL-1', project_id: 'macro-os' }, evidenceId: 'e1', ledger: new BacklogLedger(dir) });
    expect(decision).toMatchObject({ backlog_id: 'BL-1', priority: 'P1' });
    expect((await experiment.records('EXP-3')).some((row) => row.record_type === 'REPRIORITIZATION' && row.decision_affected === 'BL-1')).toBe(true);
  });
  it('fails closed without linked learning', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-company-learning-')); await expect(applyExperimentLearningToBacklog({ experiment: new ProductExperimentLedger(dir), experimentId: 'missing', item: { backlog_id: 'BL-1', project_id: 'macro-os' }, evidenceId: 'e1', ledger: new BacklogLedger(dir) })).rejects.toThrow('learning');
  });
});
