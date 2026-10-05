import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProductMutationJournal } from './productMutationJournal';

describe('product mutation journal', () => {
  it('commits an idempotent atomic product mutation', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-company-mutation-')); const journal = new ProductMutationJournal(dir);
    await journal.apply({ operation_id: 'OP-1', target: 'product.txt', content: 'fresh\n' });
    await journal.apply({ operation_id: 'OP-1', target: 'product.txt', content: 'fresh\n' });
    expect(await journal.reconcile()).toHaveLength(0);
  });
  it('reconciles a crash-after-rename intent without duplicating the mutation', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-company-mutation-recovery-')); const journal = new ProductMutationJournal(dir);
    await writeFile(join(dir, 'product.txt'), 'resumed\n');
    await writeFile(join(dir, 'product-mutations.jsonl'), `${JSON.stringify({ operation_id: 'OP-CRASH', target: 'product.txt', desired_hash: '535fd952fb9473150fd21218d3bdacd1eae57d613c3ffc561cbd595da558631b', state: 'INTENT', created_at: new Date().toISOString() })}\n`);
    expect(await journal.reconcile()).toHaveLength(1);
    const committed = await journal.apply({ operation_id: 'OP-CRASH', target: 'product.txt', content: 'resumed\n' });
    expect(committed.state).toBe('COMMITTED');
  });
});
