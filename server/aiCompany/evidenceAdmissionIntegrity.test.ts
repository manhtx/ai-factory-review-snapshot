import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsonlEvidenceResolver, validateEvidenceResolution, type StoredEvidence, type EvidenceResolutionContext } from './evidenceResolver';

const now = Date.parse('2026-10-02T01:00:00.000Z');
const context = { expected_namespace: 'isolated', expected_run_id: 'run-isolated', reviewer_role: 'quality-control', now: () => now };
const record: StoredEvidence = { evidence_id: 'EV-REAL', namespace: 'isolated', run_id: 'run-isolated', produced_by_role: 'data-engineer', content: 'source fact', content_hash: createHash('sha256').update('source fact').digest('hex'), created_at: '2026-10-02T00:00:00.000Z', source_artifact: 'isolated fixture' };
describe('evidence admission integrity', () => {
  it('admits a current matching control with exact content hash', () => {
    expect(validateEvidenceResolution(record, 'EV-REAL', context)).toEqual([]);
  });
  for (const [name, mutation] of Object.entries({
    identity: { evidence_id: 'EV-WRONG' }, invalidTime: { created_at: 'invalid' },
    futureTime: { created_at: '2099-01-01T00:00:00.000Z' }, invalidCalendar: { created_at: '2026-02-30T00:00:00.000Z' },
    missingZone: { created_at: '2026-10-02T00:00:00' }, emptyProducer: { produced_by_role: '' },
    malformedContent: { content: 42 }, missingNamespace: { namespace: '' }, missingRun: { run_id: '' },
  })) it(`rejects ${name}`, () => {
    expect(validateEvidenceResolution({ ...record, ...mutation } as StoredEvidence, 'EV-REAL', context).length).toBeGreaterThan(0);
  });
  for (const maxAge of [NaN, Infinity, -1]) it(`rejects invalid maximum age ${maxAge}`, () => {
    expect(validateEvidenceResolution(record, 'EV-REAL', { ...context, max_age_ms: maxAge }).length).toBeGreaterThan(0);
  });
  it('rejects an invalid or throwing policy clock', () => {
    for (const clock of [() => NaN, () => { throw new Error('clock unavailable'); }]) {
      expect(validateEvidenceResolution(record, 'EV-REAL', { ...context, now: clock }).length).toBeGreaterThan(0);
    }
  });
  for (const policy of [null, { ...context, max_age_ms: null }, { ...context, now: false }, { ...context, now: null }]) {
    it(`rejects malformed supplied policy ${JSON.stringify(policy)}`, () => {
      expect(validateEvidenceResolution(record, 'EV-REAL', policy as unknown as EvidenceResolutionContext).some(error => error.includes('policy'))).toBe(true);
    });
  }
  for (const suffix of ['{corrupt', 'null', '[]', '{}', JSON.stringify(record) + JSON.stringify(record)]) {
    it(`rejects damaged ledger rows without changing bytes: ${suffix.slice(0, 12)}`, async () => {
      const root = await mkdtemp(path.join(tmpdir(), 'evidence-admission-'));
      try {
        const file = path.join(root, 'ledger.jsonl');
        const bytes = JSON.stringify(record) + '\n' + suffix + '\n';
        await writeFile(file, bytes);
        await expect(new JsonlEvidenceResolver(file).resolve('EV-REAL')).rejects.toThrow(/corrupt evidence ledger/);
        expect(await readFile(file, 'utf8')).toBe(bytes);
      } finally { await rm(root, { recursive: true, force: true }); }
    });
  }
  it('resolves a valid ledger and treats a missing file as unresolved', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'evidence-control-'));
    try {
      const file = path.join(root, 'ledger.jsonl');
      const resolver = new JsonlEvidenceResolver(file);
      expect(await resolver.resolve('EV-REAL')).toBeNull();
      await writeFile(file, JSON.stringify(record) + '\n');
      expect(await resolver.resolve('EV-REAL')).toEqual(record);
      expect(await resolver.resolve('EV-MISSING')).toBeNull();
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
