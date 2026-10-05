import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createCeoEscalations, EscalationLedger } from './escalationLedger';
import type { CeoReview } from './ceoReviewLedger';

describe('CEO escalation ledger', () => {
  it('creates idempotent rescore and drift escalations', async () => {
    const ledger = new EscalationLedger(await mkdtemp(path.join(os.tmpdir(), 'escalation-')));
    const review = { review_id: 'R', project_id: 'macro-os', period: 'W1', created_at: '', idea_count: 1, scored_count: 1, at_risk_ideas: [], ready_for_rescore_ideas: ['I-1'], score_changes: [{ idea_id: 'I-1', previous: 4, current: 6, action: 'REDECIDE' as const }] } satisfies CeoReview;
    expect(await createCeoEscalations(review, ledger)).toHaveLength(2);
    expect(await createCeoEscalations(review, ledger)).toHaveLength(2);
    expect(await ledger.records('macro-os')).toHaveLength(2);
  });
  it('requires owner acknowledgement and evidence-backed resolution', async () => {
    const ledger = new EscalationLedger(await mkdtemp(path.join(os.tmpdir(), 'escalation-life-')));
    await ledger.create({ escalation_id: 'E-1', project_id: 'macro-os', trigger: 'READY_FOR_RESCORE', target_id: 'I', severity: 'P1', owner_role: 'pm', status: 'OPEN', reason: 'review' });
    await expect(ledger.transition('E-1', 'ACKNOWLEDGED', 'ceo')).rejects.toThrow('owned by pm');
    await ledger.transition('E-1', 'ACKNOWLEDGED', 'pm');
    await expect(ledger.transition('E-1', 'RESOLVED', 'pm')).rejects.toThrow('resolution evidence');
    await expect(ledger.transition('E-1', 'RESOLVED', 'pm', ['E-RESOLVE'])).resolves.toMatchObject({ status: 'RESOLVED' });
  });
});
