import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CeoGuildDecisionLedger } from './ceoGuildDecision';

describe('CEO guild decision protocol', () => {
  it('requires evidence and explicit dissent review before acceptance', async () => {
    const ledger = new CeoGuildDecisionLedger(await mkdtemp(path.join(os.tmpdir(), 'ceo-guild-')));
    const base = { decision_id: 'D1', project_id: 'macro-os', subject_id: 'IDEA-1', action: 'ACCEPT' as const, decision_owner: 'CEO' as const, accountable_pm: 'pm-agent', evidence_ids: ['USER-1', 'QC-1'], rationale: 'strong user value and bounded delivery', validation_metric: 'task success >= 70%' };
    await expect(ledger.decide({ ...base, dissent: [] })).rejects.toThrow('explicit dissent');
    await expect(ledger.decide({ ...base, dissent: ['No unresolved dissent after stakeholder review'] })).resolves.toMatchObject({ action: 'ACCEPT', evidence_ids: ['USER-1', 'QC-1'] });
  });
});
