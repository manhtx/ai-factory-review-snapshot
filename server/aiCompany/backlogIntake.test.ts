import { describe, expect, it } from 'vitest';
import { BacklogIntakeGateway } from './backlogIntake';

const input = (source_type: 'FOUNDER' | 'QA', source_id: string) => ({ project_id: 'macro-os', source_type, source_id, created_by: source_type.toLowerCase(), observation: 'Observed issue', problem_signal: 'Users cannot complete the research task', affected_product_area: 'research workflow', evidence_ids: ['E-1'], evidence_quality: 'REQUIRES_MORE_EVIDENCE' as const, severity_signal: 'MEDIUM' as const, confidence_signal: .7 });
describe('backlog intake gateway', () => {
  it('preserves provenance and routes a candidate to PM inbox only', async () => { const gateway = new BacklogIntakeGateway(`/tmp/intake-${Date.now()}`); const result = await gateway.submit(input('FOUNDER', 'founder-1')); expect(result.created).toBe(true); expect(result.candidate.status).toBe('PM_INBOX'); expect(result.candidate.provenance.source_type).toBe('FOUNDER'); expect(result.candidate.related_backlog_ids).toEqual([]); });
  it('deduplicates exact source events without creating execution work', async () => { const gateway = new BacklogIntakeGateway(`/tmp/intake-${Date.now()}`); const first = await gateway.submit(input('QA', 'qa-1')); const second = await gateway.submit(input('QA', 'qa-1')); expect(first.created).toBe(true); expect(second.created).toBe(false); expect(second.duplicate_of).toBe(first.candidate.candidate_id); expect((await gateway.candidates()).length).toBe(1); });
  it('rejects anonymous or malformed candidates', async () => { const gateway = new BacklogIntakeGateway(`/tmp/intake-${Date.now()}`); await expect(gateway.submit({ ...input('FOUNDER', 'bad'), created_by: '' })).rejects.toThrow('CANDIDATE_PROVENANCE_REQUIRED'); await expect(gateway.submit({ ...input('FOUNDER', 'bad-2'), observation: '' })).rejects.toThrow('CANDIDATE_OBSERVATION_REQUIRED'); });
  it('deduplicates concurrent submissions in the critical section', async () => {
    const gateway = new BacklogIntakeGateway(`/tmp/intake-concurrent-${Date.now()}`);
    const results = await Promise.all([
      gateway.submit(input('QA', 'same-event')),
      gateway.submit(input('QA', 'same-event')),
      gateway.submit(input('QA', 'same-event')),
    ]);
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(results.filter((result) => !result.created && result.duplicate_of)).toHaveLength(2);
    expect(await gateway.candidates()).toHaveLength(1);
  });
  it('persists PM grooming status changes atomically', async () => {
    const gateway = new BacklogIntakeGateway(`/tmp/intake-update-${Date.now()}`);
    const created = await gateway.submit(input('QA', 'status-event'));
    const updated = await gateway.update({ ...created.candidate, status: 'HOLD_FOR_EVIDENCE' });
    expect(updated.status).toBe('HOLD_FOR_EVIDENCE');
    expect((await gateway.candidates())[0].status).toBe('HOLD_FOR_EVIDENCE');
  });
  it('reopens held demand only when genuinely new evidence is supplied', async () => {
    const gateway = new BacklogIntakeGateway(`/tmp/intake-reopen-${Date.now()}`);
    const created = await gateway.submit(input('QA', 'reopen-event'));
    const held = await gateway.update({ ...created.candidate, status: 'HOLD_FOR_EVIDENCE' });
    await expect(gateway.reopenForEvidence(held.candidate_id, ['E-1'])).rejects.toThrow('NO_NEW_EVIDENCE');
    const reopened = await gateway.reopenForEvidence(held.candidate_id, ['REAL-AUDIT-1']);
    expect(reopened.status).toBe('PM_INBOX');
    expect(reopened.evidence_ids).toEqual(['E-1', 'REAL-AUDIT-1']);
  });
});
