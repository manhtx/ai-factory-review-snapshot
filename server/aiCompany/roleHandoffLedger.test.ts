import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RoleHandoffLedger } from './roleHandoffLedger';

describe('role handoff ledger', () => {
  it('requires an evidence-backed handoff contract and persists it', async () => {
    const ledger = new RoleHandoffLedger(await mkdtemp(path.join(os.tmpdir(), 'role-handoff-')));
    await expect(ledger.record({ project_id: 'macro-os', work_id: 'W1', from_role: 'pm', to_role: 'coder', actor: 'pm-agent', objective: 'implement approved slice', context: [], evidence_ids: ['REQ-1'], acceptance_criteria: ['tests pass'] })).rejects.toThrow('context, evidence and acceptance');
    const handoff = await ledger.record({ project_id: 'macro-os', work_id: 'W1', from_role: 'pm', to_role: 'coder', actor: 'pm-agent', objective: 'implement approved slice', context: ['approved requirement'], evidence_ids: ['REQ-1'], acceptance_criteria: ['tests pass'], handoff_id: 'H1' });
    expect(handoff).toMatchObject({ handoff_id: 'H1', from_role: 'pm', to_role: 'coder' });
    await expect(ledger.records('macro-os', 'W1')).resolves.toHaveLength(1);
  });

  it('is idempotent for concurrent retries', async () => {
    const ledger = new RoleHandoffLedger(await mkdtemp(path.join(os.tmpdir(), 'role-handoff-retry-')));
    const input = { project_id: 'macro-os', work_id: 'W2', from_role: 'coder' as const, to_role: 'functional-qa' as const, actor: 'coder-agent', objective: 'request independent test', context: ['changed files'], evidence_ids: ['COMMIT-1'], acceptance_criteria: ['functional behavior verified'], handoff_id: 'H2' };
    await Promise.all([ledger.record(input), ledger.record(input)]);
    await expect(ledger.records()).resolves.toHaveLength(1);
  });
});
