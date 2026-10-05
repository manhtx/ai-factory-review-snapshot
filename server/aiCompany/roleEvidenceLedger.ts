import path from "node:path";
import { createHash } from "node:crypto";
import { RoleWorkQueue, type AttemptAuthority, type RoleWorkItem } from "./roleWorkQueue";
import { captureEvidenceFileSnapshot, type EvidenceSnapshot, type IEvidenceResolver, type StoredEvidence } from './evidenceResolver';

export interface RoleEvidenceArtifact { evidence_id: string; project_id: string; work_id: string; role: RoleWorkItem["role"]; provider_id: string; model: string; output: string; limitation: string; namespace?: string; run_id?: string; attempt_id?: string; content_hash?: string; source_artifact?: string; protocol_status?: 'PASS' | 'RECEIVED'; content_quality?: 'PASS' | 'QUALITY_FAIL' | 'REVIEW_REQUIRED'; quality_warnings?: string[]; context_fingerprint?: string; usage: { input_tokens: number; output_tokens: number; estimated_cost_usd: number }; created_at: string; }
type NewRoleEvidence = Omit<RoleEvidenceArtifact, 'evidence_id' | 'created_at' | 'content_hash' | 'source_artifact' | 'protocol_status'> & { namespace: string; run_id: string; attempt_id: string; protocol_status?: 'RECEIVED'; receipt_id?: string };

function isReceipt(value: unknown): value is RoleEvidenceArtifact {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return ['evidence_id', 'project_id', 'work_id', 'role', 'provider_id', 'model', 'output', 'limitation', 'created_at'].every(key => typeof row[key] === 'string' && (row[key] as string).trim())
    && !!row.usage && typeof row.usage === 'object'
    && ['input_tokens', 'output_tokens', 'estimated_cost_usd'].every(key => typeof (row.usage as Record<string, unknown>)[key] === 'number' && Number.isFinite((row.usage as Record<string, number>)[key]) && (row.usage as Record<string, number>)[key] >= 0);
}

export function nativeProviderReceiptId(workId: string, attemptId: string): string {
  if (!/^[A-Za-z0-9_:-]+$/.test(workId) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(attemptId)) throw new Error('native receipt identity requires safe work and claimed attempt');
  return `ROLE-EVIDENCE-${workId}:${attemptId}`;
}

export function parseNativeEvidenceRecords(content: string): RoleEvidenceArtifact[] {
  return content.split('\n').filter(line => line.trim()).map((line,index) => {
    let row: unknown; try { row = JSON.parse(line); } catch { throw new Error(`corrupt native evidence ledger: invalid JSON at row ${index + 1}`); }
    if (!isReceipt(row)) throw new Error(`corrupt native evidence ledger: invalid receipt at row ${index + 1}`);
    return row;
  });
}

export class RoleEvidenceLedger implements IEvidenceResolver {
  private readonly file: string;
  constructor(private readonly rootDir: string) { this.file = path.join(rootDir, "role-evidence.jsonl"); }
  async assertQueueRoot(queue: RoleWorkQueue): Promise<void> { await queue.assertNativeEvidenceRoot(this.rootDir); }
  async record(input: NewRoleEvidence, authority?: AttemptAuthority): Promise<RoleEvidenceArtifact> {
    if (!input.project_id || !input.work_id || !input.output.trim() || !input.limitation.trim() || !input.namespace?.trim() || !input.run_id?.trim()) throw new Error("role evidence scope, output and limitation are required");
    if (typeof input.attempt_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.attempt_id)) throw new Error('native provider receipt requires a valid claimed attempt_id');
    if (input.protocol_status !== undefined && input.protocol_status !== 'RECEIVED') throw new Error('native evidence is a receipt, not a review PASS');
    const { receipt_id: requestedId, ...artifactInput } = input;
    if (requestedId !== undefined && requestedId !== nativeProviderReceiptId(input.work_id, input.attempt_id)) throw new Error('native receipt reservation does not match work and attempt');
    const evidenceId = nativeProviderReceiptId(input.work_id, input.attempt_id);
    const row = { ...artifactInput, evidence_id: evidenceId, protocol_status: 'RECEIVED' as const, evidence_kind: 'PROVIDER_OUTPUT' as const, content_hash: createHash('sha256').update(input.output, 'utf8').digest('hex'), source_artifact: `${this.file}#${evidenceId}`, created_at: new Date().toISOString() };
    if (!isReceipt(row)) throw new Error('native evidence receipt is invalid');
    return new RoleWorkQueue(this.rootDir).publishNativeReceipt(row, authority);
  }
  private parseRecords(content: string): RoleEvidenceArtifact[] {
    return parseNativeEvidenceRecords(content);
  }
  async records(projectId?: string): Promise<RoleEvidenceArtifact[]> {
    const file = await captureEvidenceFileSnapshot(this.file);
    const rows = this.parseRecords(file.content); return projectId ? rows.filter(row => row.project_id === projectId) : rows;
  }
  async snapshot(): Promise<EvidenceSnapshot> {
    const file = await captureEvidenceFileSnapshot(this.file); const rows = this.parseRecords(file.content);
    const inspect = (items: RoleEvidenceArtifact[],id: string): {exists:boolean;evidence:StoredEvidence|null} => {
      const matches = items.filter(row => row.evidence_id === id);
      if (matches.length > 1) throw new Error('corrupt native evidence ledger: duplicate evidence identity');
      const row = matches[0]; if (!row) return {exists:false,evidence:null};
      if (!row.namespace || !row.run_id || !row.content_hash || !row.source_artifact || !row.attempt_id) return {exists:true,evidence:null};
      return {exists:true,evidence:{evidence_id:row.evidence_id,namespace:row.namespace,run_id:row.run_id,produced_by_role:row.role,work_id:row.work_id,evidence_kind:'PROVIDER_OUTPUT',attempt_id:row.attempt_id,content:row.output,content_hash:row.content_hash,source_artifact:row.source_artifact,created_at:row.created_at}};
    };
    const inspectIdentity=(id:string)=>inspect(rows,id);
    return {resolve:id=>inspectIdentity(id).evidence,inspectIdentity,assertCurrent:(ids)=>{if (!ids) return file.assertCurrent();const current=this.parseRecords(file.readCurrentContent());if (new Set(current.map(row=>row.evidence_id)).size !== current.length) throw new Error('duplicate native receipt identity');if (ids.some(id=>JSON.stringify(inspect(rows,id)) !== JSON.stringify(inspect(current,id)))) throw new Error('selected evidence snapshot changed before decision');}};
  }
  async resolve(evidenceId: string): Promise<StoredEvidence | null> { return (await this.snapshot()).resolve(evidenceId); }
  async inspectIdentity(evidenceId: string): Promise<{ exists: boolean; evidence: StoredEvidence | null }> { return (await this.snapshot()).inspectIdentity!(evidenceId); }
}
