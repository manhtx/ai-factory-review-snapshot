import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

type MutationRecord = { operation_id: string; target: string; desired_hash: string; state: 'INTENT' | 'COMMITTED'; created_at: string };

/** Small crash-safe boundary for reversible local product mutations. */
export class ProductMutationJournal {
  private readonly file: string;
  constructor(private readonly rootDir: string, journalPath?: string) { this.file = journalPath ?? path.join(rootDir, 'product-mutations.jsonl'); }
  private async records() { try { return (await readFile(this.file, 'utf8')).split('\n').filter(Boolean).map((x) => JSON.parse(x) as MutationRecord); } catch (e: any) { if (e?.code === 'ENOENT') return []; throw e; } }
  async apply(input: { operation_id: string; target: string; content: string | Uint8Array }) {
    if (!input.operation_id.trim() || path.isAbsolute(input.target) || input.target.includes('..')) throw new Error('unsafe product mutation identity or target');
    const desired_hash = createHash('sha256').update(input.content).digest('hex');
    const rows = await this.records();
    const existing = rows.filter((row) => row.operation_id === input.operation_id).at(-1);
    if (existing && (existing.desired_hash !== desired_hash || existing.target !== input.target)) throw new Error('mutation operation identity reused with different payload');
    if (existing?.state === 'COMMITTED') return existing;
    const target = path.resolve(this.rootDir, input.target);
    if (!target.startsWith(`${path.resolve(this.rootDir)}${path.sep}`)) throw new Error('mutation target escapes journal root');
    await mkdir(path.dirname(target), { recursive: true });
    if (!existing) { const intent: MutationRecord = { operation_id: input.operation_id, target: input.target, desired_hash, state: 'INTENT', created_at: new Date().toISOString() }; await appendFile(this.file, `${JSON.stringify(intent)}\n`); }
    const safeSuffix = createHash('sha256').update(input.operation_id).digest('hex').slice(0, 16);
    const tmpPath = `${target}.tmp-${safeSuffix}`;
    await writeFile(tmpPath, input.content, 'utf8');
    await rename(tmpPath, target);
    const committed: MutationRecord = { operation_id: input.operation_id, target: input.target, desired_hash, state: 'COMMITTED', created_at: new Date().toISOString() };
    await appendFile(this.file, `${JSON.stringify(committed)}\n`);
    return committed;
  }
  async reconcile() {
    const rows = await this.records(); const latest = new Map<string, MutationRecord>(); for (const row of rows) latest.set(row.operation_id, row);
    const recovered: MutationRecord[] = [];
    for (const row of [...latest.values()].filter((x) => x.state === 'INTENT')) {
      const target = path.resolve(this.rootDir, row.target); let content: string | null = null;
      try { content = await readFile(target, 'utf8'); } catch (e: any) { if (e?.code !== 'ENOENT') throw e; }
      if (content !== null && createHash('sha256').update(content).digest('hex') === row.desired_hash) { const committed = { ...row, state: 'COMMITTED' as const, created_at: new Date().toISOString() }; await appendFile(this.file, `${JSON.stringify(committed)}\n`); recovered.push(committed); }
    }
    return recovered;
  }
}
