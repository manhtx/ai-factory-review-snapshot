import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  ProductMemoryLedger,
  validateMemoryForStorage,
  type TypedMemoryItem,
} from './productMemory';

describe('ProductMemoryLedger', () => {
  it('retrieves validated learning for future decision scenario', async () => {
    const memory = new ProductMemoryLedger(process.cwd());
    const learnings = await memory.retrieveLearnings('funnel telemetry conversion');

    expect(learnings.length).toBeGreaterThan(0);
    const item = learnings.find((l) => l.id.includes('LEARNING_001'));
    expect(item).toBeDefined();
    expect(item?.topic).toContain('Product Observability & Funnel Telemetry');
    expect(
      item?.decision_policy_rules.some((r) =>
        r.includes('always inspect `coreJourneyFunnel` conversion metrics before claiming a product win')
      )
    ).toBe(true);
  });

  it('returns empty array when query has no matching memories', async () => {
    const memory = new ProductMemoryLedger(process.cwd());
    const learnings = await memory.retrieveLearnings('unrelated rocket propulsion astrophysics');
    expect(learnings).toEqual([]);
  });

  describe('Typed Memory & Long-term Validation', () => {
    it('validates memory and rejects storage when evidence or reviewer confirmation is missing', () => {
      const invalidNoEvidence: any = {
        id: 'MEM-001',
        category: 'decisions',
        title: 'Decision without evidence',
        summary: 'Some decision',
        evidence_ids: [],
        timestamp: new Date().toISOString(),
        confidence: 0.9,
        owner: '@pm',
      };
      const res1 = validateMemoryForStorage(invalidNoEvidence);
      expect(res1.valid).toBe(false);
      expect(res1.errors).toContain('memory requires at least one verified evidence_id');

      const invalidNoReviewer: any = {
        ...invalidNoEvidence,
        evidence_ids: ['EVID:123'],
      };
      const res2 = validateMemoryForStorage(invalidNoReviewer);
      expect(res2.valid).toBe(false);
      expect(res2.errors).toContain('reviewer confirmation is required for long-term memory');

      const invalidFailedReview: any = {
        ...invalidNoEvidence,
        evidence_ids: ['EVID:123'],
        reviewer_confirmation: {
          reviewer: '@qa',
          verdict: 'QUALITY_FAIL',
          timestamp: new Date().toISOString(),
          evidence_id: 'EVID:FAIL',
        },
      };
      const res3 = validateMemoryForStorage(invalidFailedReview);
      expect(res3.valid).toBe(false);
      expect(res3.errors).toContain('reviewer confirmation must have PASS verdict');
    });

    it('stores and retrieves typed memories with hash integrity', async () => {
      const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'memory-test-'));
      const memory = new ProductMemoryLedger(tmpDir);

      const decision: Omit<TypedMemoryItem, 'hash'> = {
        id: 'DEC-101',
        category: 'decisions',
        title: 'Use L0/L1/L2 Context Manifest Budgets',
        summary: 'Adopt bounded token budgets instead of dumping whole repository history.',
        evidence_ids: ['EVID:BENCHMARK-TOKEN-SAVINGS'],
        timestamp: '2026-09-08T10:00:00.000Z',
        confidence: 0.95,
        owner: '@cto',
        reviewer_confirmation: {
          reviewer: '@independent-data-board',
          verdict: 'PASS',
          timestamp: '2026-09-08T10:30:00.000Z',
          evidence_id: 'EVID:BOARD-SIGN-OFF',
        },
        keywords: ['context budget', 'token efficiency', 'L0 L1 L2'],
      };

      const stored = await memory.recordMemory(decision);
      expect(stored.hash).toBeDefined();
      expect(stored.hash.length).toBe(64); // sha256 hex length

      const retrieved = await memory.getMemoriesByCategory('decisions');
      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].id).toBe('DEC-101');
      expect(retrieved[0].title).toContain('L0/L1/L2');
      expect(retrieved[0].hash).toBe(stored.hash);
    });

    it('prevents repeating previously rejected directions (anti-regression)', async () => {
      const memory = new ProductMemoryLedger(process.cwd());

      // Try a proposal that attempts direct un-gated production autonomy (matches REJ-001)
      const proposal = {
        title: 'Bypass human gate for direct production autonomy deployment',
        problem: 'Human gates slow down deployment pipeline',
        action: 'Enable full autonomous deploy to production without waiting for reviewer',
        keywords: ['un-gated production autonomy', 'autonomous deploy'],
      };

      const check = await memory.checkProposalAgainstRejected(proposal);
      expect(check.is_rejected).toBe(true);
      expect(check.matched_memory?.id).toBe('REJ-001');
      expect(check.reason).toContain('REJ-001');

      // Try an unrelated good proposal
      const validProposal = {
        title: 'Add localized unit test for cache eviction',
        keywords: ['cache', 'unit test'],
      };
      const validCheck = await memory.checkProposalAgainstRejected(validProposal);
      expect(validCheck.is_rejected).toBe(false);
    });
  });
});
