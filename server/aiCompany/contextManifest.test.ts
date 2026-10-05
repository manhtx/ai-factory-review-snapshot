import { describe, expect, it } from 'vitest';
import {
  estimateTokens,
  validateEvidenceManifest,
  buildContextManifest,
  type ContextManifestItem,
} from './contextManifest';

describe('Context Manifest & Anti-Context Explosion', () => {
  it('bounds evidence context and reports approximate token categories', () => {
    expect(
      validateEvidenceManifest({
        required: ['goal'],
        optional: ['qa'],
        forbidden: ['history'],
        target_tokens: 100,
        max_tokens: 200,
      })
    ).toEqual([]);
    expect(estimateTokens({ assignment: '1234' })).toEqual({ assignment: 1 });
  });

  const sampleItems: ContextManifestItem[] = [
    { name: 'product-goal', category: 'product_goal', content: 'Macro OS Research truth and reproducibility.' },
    { name: 'assignment', category: 'assignment', content: 'Verify freshness calculation boundaries.' },
    { name: 'dependency-dep1', category: 'dependency', content: 'Freshness API returns JSON payload.' },
    { name: 'history-epoch-10', category: 'history', content: 'Long history log from epoch 10 with 5000 words...' },
  ];

  it('L0 includes only Product Goal, assignment, criteria, and role contract; discards dependencies and history', () => {
    const res = buildContextManifest({
      assignment_id: 'ASSIGN-1',
      level: 'L0',
      max_tokens: 500,
      target_tokens: 200,
      items: sampleItems,
    });

    expect(res.level).toBe('L0');
    expect(res.compiled_prompt).toContain('product-goal');
    expect(res.compiled_prompt).toContain('assignment');
    expect(res.compiled_prompt).not.toContain('dependency-dep1');
    expect(res.compiled_prompt).not.toContain('history-epoch-10');

    expect(res.discarded_items.some((d) => d.name === 'dependency-dep1')).toBe(true);
    expect(res.discarded_items.some((d) => d.name === 'history-epoch-10')).toBe(true);
  });

  it('L1 includes dependencies but discards historical context', () => {
    const res = buildContextManifest({
      assignment_id: 'ASSIGN-1',
      level: 'L1',
      max_tokens: 500,
      target_tokens: 200,
      items: sampleItems,
    });

    expect(res.compiled_prompt).toContain('dependency-dep1');
    expect(res.compiled_prompt).not.toContain('history-epoch-10');
  });

  it('generates reproducible manifest_hash and manifest_id for identical inputs across different runners', () => {
    const res1 = buildContextManifest({
      assignment_id: 'ASSIGN-SAME',
      level: 'L1',
      max_tokens: 1000,
      target_tokens: 500,
      items: sampleItems,
    });

    const res2 = buildContextManifest({
      assignment_id: 'ASSIGN-SAME',
      level: 'L1',
      max_tokens: 1000,
      target_tokens: 500,
      items: sampleItems,
    });

    expect(res1.manifest_id).toBe(res2.manifest_id);
    expect(res1.manifest_hash).toBe(res2.manifest_hash);
  });

  it('detects duplicate content and discards redundant tokens', () => {
    const itemsWithDuplicate: ContextManifestItem[] = [
      ...sampleItems,
      { name: 'duplicate-item', category: 'assignment', content: 'Verify freshness calculation boundaries.' },
    ];

    const res = buildContextManifest({
      assignment_id: 'ASSIGN-DUP',
      level: 'L1',
      max_tokens: 1000,
      target_tokens: 500,
      items: itemsWithDuplicate,
    });

    expect(res.token_breakdown.repeated_tokens).toBeGreaterThan(0);
    expect(res.discarded_items.some((d) => d.name === 'duplicate-item' && d.reason.includes('duplicate'))).toBe(true);
  });

  it('discards items exceeding max token budget', () => {
    const largeItem: ContextManifestItem = {
      name: 'giant-item',
      category: 'dependency',
      content: 'A'.repeat(4000), // ~1000 tokens
    };

    const res = buildContextManifest({
      assignment_id: 'ASSIGN-BUDGET',
      level: 'L1',
      max_tokens: 200, // tight limit
      target_tokens: 100,
      items: [largeItem],
    });

    expect(res.discarded_items.some((d) => d.name === 'giant-item' && d.reason.includes('context limit exceeded'))).toBe(true);
    expect(res.compiled_prompt).toBe('');
    expect(res.total_tokens).toBe(0);
    expect(res.is_overflow).toBe(true);
  });
});
