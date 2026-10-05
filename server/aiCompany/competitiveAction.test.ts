import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BacklogLedger } from './backlogLedger';
import { CompetitiveEvidenceLedger } from './competitiveEvidenceLedger';
import { createCompetitiveReviewActions } from './competitiveAction';
describe('competitive review actions', () => { it('creates an idempotent discovery action when evidence is absent', async () => { const root = await mkdtemp(path.join(os.tmpdir(), 'ci-action-')); const input = { projectId: 'macro-os', evidence: new CompetitiveEvidenceLedger(root), backlog: new BacklogLedger(root) }; await expect(createCompetitiveReviewActions(input)).resolves.toMatchObject({ created: true, backlogId: 'CI-EVIDENCE-DISCOVERY', status: 'NO_EVIDENCE' }); await expect(createCompetitiveReviewActions(input)).resolves.toMatchObject({ created: false, backlogId: 'CI-EVIDENCE-DISCOVERY' }); }); });
