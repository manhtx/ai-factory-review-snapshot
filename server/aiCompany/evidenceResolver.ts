import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export interface StoredEvidence {
  evidence_id: string;
  namespace: string;
  run_id: string;
  produced_by_role: string;
  content: string;
  content_hash: string;
  created_at: string;
  source_artifact?: string;
  work_id?: string;
  evidence_kind?: 'PROVIDER_OUTPUT';
  attempt_id?: string;
}

export interface EvidenceResolutionContext {
  expected_namespace: string;
  expected_run_id: string;
  reviewer_role: string;
  max_age_ms?: number;
  now?: () => number;
}

export interface EvidenceSnapshot extends IEvidenceResolver {
  resolve(evidenceId: string): StoredEvidence | null;
  assertCurrent(evidenceIds?: readonly string[]): void;
  inspectIdentity?(evidenceId: string): { exists: boolean; evidence: StoredEvidence | null };
}

export async function captureEvidenceFileSnapshot(file: string): Promise<{ content: string; readCurrentContent(): string; assertCurrent(): void }> {
  let captured: Buffer | undefined;
  try { captured = await readFile(file); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const content = captured === undefined ? '' : new TextDecoder('utf-8', { fatal: true }).decode(captured);
  return { content, readCurrentContent() { try { return new TextDecoder('utf-8', {fatal:true}).decode(readFileSync(file)); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return ''; throw error; } }, assertCurrent() {
    let current: Buffer | undefined;
    try { current = readFileSync(file); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    if ((current === undefined) !== (captured === undefined) || (current && captured && !current.equals(captured))) throw new Error('evidence snapshot changed before decision; revalidation required');
  } };
}

export interface IEvidenceResolver {
  snapshot?(): Promise<EvidenceSnapshot> | EvidenceSnapshot;
  resolve(evidenceId: string): Promise<StoredEvidence | null> | StoredEvidence | null;
}

function isStoredEvidence(value: unknown): value is StoredEvidence {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return ['evidence_id', 'namespace', 'run_id', 'produced_by_role', 'content', 'content_hash', 'created_at']
    .every(key => typeof row[key] === 'string' && (row[key] as string).trim().length > 0)
    && (row.evidence_kind === undefined || row.evidence_kind === 'PROVIDER_OUTPUT')
    && (row.attempt_id === undefined || (typeof row.attempt_id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.attempt_id)))
    && ['source_artifact', 'work_id'].every(key => row[key] === undefined || (typeof row[key] === 'string' && (row[key] as string).trim().length > 0));
}

export class InMemoryEvidenceResolver implements IEvidenceResolver {
  private store = new Map<string, StoredEvidence>();

  register(evidence: StoredEvidence): void {
    this.store.set(evidence.evidence_id, evidence);
  }

  createEvidence(params: {
    evidence_id: string;
    namespace: string;
    run_id: string;
    produced_by_role: string;
    content: string;
    created_at?: string;
  }): StoredEvidence {
    const content_hash = createHash('sha256').update(params.content, 'utf8').digest('hex');
    const record: StoredEvidence = {
      evidence_id: params.evidence_id,
      namespace: params.namespace,
      run_id: params.run_id,
      produced_by_role: params.produced_by_role,
      content: params.content,
      content_hash,
      created_at: params.created_at ?? new Date().toISOString(),
    };
    this.register(record);
    return record;
  }

  snapshot(): EvidenceSnapshot {
    const serialized = JSON.stringify([...this.store.entries()]);
    const captured = new Map<string, StoredEvidence>(JSON.parse(serialized));
    return { resolve: id => { const row = captured.get(id); return row ? structuredClone(row) : null; }, assertCurrent: ids => { if (ids ? ids.some(id => JSON.stringify(this.store.get(id)) !== JSON.stringify(captured.get(id))) : JSON.stringify([...this.store.entries()]) !== serialized) throw new Error('evidence snapshot changed before decision; revalidation required'); } };
  }

  resolve(evidenceId: string): StoredEvidence | null {
    return this.store.get(evidenceId) ?? null;
  }
}

export function parseStoredEvidenceRecords(content: string): StoredEvidence[] {
  const rows: StoredEvidence[] = [];
  for (const [index, line] of content.split('\n').entries()) {
    const trimmed = line.trim(); if (!trimmed) continue;
    let row: unknown;
    try { row = JSON.parse(trimmed); } catch { throw new Error(`corrupt evidence ledger: invalid JSON at row ${index + 1}`); }
    if (!isStoredEvidence(row)) throw new Error(`corrupt evidence ledger: invalid record at row ${index + 1}`);
    rows.push(row);
  }
  if (new Set(rows.map(row => row.evidence_id)).size !== rows.length) throw new Error('ambiguous evidence identity duplicated in store');
  return rows;
}

export class JsonlEvidenceResolver implements IEvidenceResolver {
  constructor(private readonly file: string, private readonly origin?: 'PROVIDER_OUTPUT') {}
  async resolve(evidenceId: string): Promise<StoredEvidence | null> { return (await this.snapshot()).resolve(evidenceId); }
  async inspectIdentity(evidenceId: string): Promise<{ exists: boolean; evidence: StoredEvidence | null }> { return (await this.snapshot()).inspectIdentity!(evidenceId); }
  async snapshot(): Promise<EvidenceSnapshot> {
    const file = await captureEvidenceFileSnapshot(this.file);
    const rows = parseStoredEvidenceRecords(file.content);
    const inspect = (items: StoredEvidence[],id: string) => {
      const matches = items.filter(row => row.evidence_id === id);
      if (matches.length > 1) throw new Error(`ambiguous evidence identity '${id}' is duplicated in its store`);
      const row = matches[0]; if (!row) return { exists:false,evidence:null };
      return { exists:true,evidence:this.origin === 'PROVIDER_OUTPUT' ? (row.work_id && row.attempt_id ? {...row,evidence_kind:'PROVIDER_OUTPUT' as const} : null) : structuredClone(row) };
    };
    const inspectIdentity = (id: string) => inspect(rows,id);
    return { resolve: id => inspectIdentity(id).evidence, inspectIdentity, assertCurrent(ids) { if (!ids) return file.assertCurrent(); const current=parseStoredEvidenceRecords(file.readCurrentContent()); if (ids.some(id=>JSON.stringify(inspect(rows,id)) !== JSON.stringify(inspect(current,id)))) throw new Error('selected evidence snapshot changed before decision'); } };
  }
}

export function validateEvidenceResolution(
  evidence: StoredEvidence | null,
  evidenceId: string,
  context: EvidenceResolutionContext
): string[] {
  const errors: string[] = [];

  if (!evidence) {
    errors.push(`evidence '${evidenceId}' cannot be resolved or does not exist`);
    return errors;
  }
  if (!isStoredEvidence(evidence)) return [`evidence '${evidenceId}' has an invalid record shape`];
  if (typeof evidenceId !== 'string' || !evidenceId.trim() || evidence.evidence_id !== evidenceId) {
    errors.push('resolved evidence identity does not match the requested ID');
  }
  if (!context || typeof context !== 'object' || Array.isArray(context)
    || (context.now !== undefined && typeof context.now !== 'function')) {
    return [...errors, 'evidence admission context/policy is invalid'];
  }

  // 1. Namespace match
  if (context.expected_namespace && evidence.namespace !== context.expected_namespace) {
    errors.push(
      `evidence '${evidenceId}' namespace mismatch: expected '${context.expected_namespace}', got '${evidence.namespace}'`
    );
  }

  // 2. Run ID match
  if (context.expected_run_id && evidence.run_id !== context.expected_run_id) {
    errors.push(
      `evidence '${evidenceId}' run_id mismatch: expected '${context.expected_run_id}', got '${evidence.run_id}'`
    );
  }

  // 3. Content hash verification
  const computedHash = createHash('sha256').update(evidence.content, 'utf8').digest('hex');
  if (computedHash !== evidence.content_hash) {
    errors.push(
      `evidence '${evidenceId}' hash mismatch: recorded '${evidence.content_hash}', computed '${computedHash}'`
    );
  }

  // 4. Self-produced check (reviewer cannot cite evidence produced by self to self-certify)
  if (context.reviewer_role && evidence.produced_by_role === context.reviewer_role) {
    errors.push(
      `evidence '${evidenceId}' was self-produced by reviewer role '${context.reviewer_role}' (self-certification forbidden)`
    );
  }

  // 5. Stale evidence check
  const maxAge = context.max_age_ms === undefined ? 7 * 24 * 60 * 60 * 1000 : context.max_age_ms;
  let now: number;
  try { now = context.now ? context.now() : Date.now(); }
  catch { return [...errors, 'evidence admission policy clock is unavailable']; }
  if (!Number.isFinite(now) || !Number.isFinite(maxAge) || maxAge < 0) {
    return [...errors, 'evidence admission clock/age policy is invalid'];
  }
  const createdAtMs = new Date(evidence.created_at).getTime();
  const canonical = evidence.created_at.includes('.') ? evidence.created_at : evidence.created_at.replace('Z', '.000Z');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(evidence.created_at)
    || !Number.isFinite(createdAtMs) || new Date(createdAtMs).toISOString() !== canonical) {
    return [...errors, `evidence '${evidenceId}' has an invalid canonical UTC timestamp`];
  }
  const ageMs = now - createdAtMs;
  if (ageMs < 0) errors.push(`evidence '${evidenceId}' is from the future`);

  if (ageMs > maxAge) {
    errors.push(
      `evidence '${evidenceId}' is stale (age: ${Math.round(ageMs / 1000)}s exceeds policy max: ${Math.round(maxAge / 1000)}s)`
    );
  }

  return errors;
}
