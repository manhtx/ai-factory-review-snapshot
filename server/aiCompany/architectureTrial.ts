import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateEvidenceResolution, type IEvidenceResolver } from './evidenceResolver';

export const ARCHITECTURE_ARMS = ['A_CURRENT_AI_COMPANY', 'B_STRONG_MINIMAL_AGENT', 'C_VERIFIED_PRODUCT_KERNEL', 'D_PRODUCT_BOTTLENECK'] as const;
export type ArchitectureArm = typeof ARCHITECTURE_ARMS[number];
export type ArchitectureTrialState = 'REGISTERED' | 'VALID' | 'INVALID' | 'MEASURED' | 'DECIDED';

export interface ArchitectureTrialRecord {
  trial_id: string;
  arm: ArchitectureArm;
  project_id: string;
  product_task: string;
  product_goal_reference: string;
  base_product_revision: string;
  data_snapshot: string;
  model_generation: string;
  reasoning_effort: string;
  available_tools: string[];
  authority: string;
  evaluator_version: string;
  cognition_protocol: string;
  action_protocol: string;
  execution_order: number;
  state: ArchitectureTrialState;
  confounders: string[];
  product_quality?: number;
  product_quality_evidence_ids: string[];
  domain_correctness?: number;
  domain_correctness_evidence_ids: string[];
  process_integrity?: number;
  safety?: number;
  rework_count?: number;
  founder_interventions?: number;
  token_actual?: number;
  token_estimated?: number;
  token_unknown?: number;
  first_critical_failure?: 'PERCEPTION' | 'STATE' | 'DECISION' | 'ACTION' | 'VERIFICATION' | 'POLICY' | 'COORDINATION' | 'INFRASTRUCTURE' | 'DATA' | 'PRODUCT_ENVIRONMENT' | 'EVALUATION';
  evidence_ids: string[];
  created_at: string;
}

export interface ArchitectureTrialComparison {
  trial_id: string;
  state: 'COMPARABLE' | 'INVALID';
  reason: string;
  arms: ArchitectureArm[];
  shared_fields: string[];
  invalid_arms: Array<{ arm: ArchitectureArm; reasons: string[] }>;
}

export interface ArchitectureEvidenceValidation {
  valid: boolean;
  invalid_arms: Array<{ arm: ArchitectureArm; reasons: string[] }>;
}

const sharedKeys = ['project_id', 'product_task', 'product_goal_reference', 'base_product_revision', 'data_snapshot', 'model_generation', 'reasoning_effort', 'authority', 'evaluator_version'] as const;

export class ArchitectureTrialLedger {
  private readonly file: string;
  constructor(private readonly rootDir: string) { this.file = join(rootDir, 'architecture-trials.jsonl'); }
  private async add(record: ArchitectureTrialRecord) {
    await mkdir(this.rootDir, { recursive: true });
    await appendFile(this.file, `${JSON.stringify(record)}\n`, 'utf8');
    return record;
  }
  async register(input: Omit<ArchitectureTrialRecord, 'created_at' | 'state'>) {
    if (!ARCHITECTURE_ARMS.includes(input.arm)) throw new Error(`unknown architecture arm: ${input.arm}`);
    if (!input.trial_id || !input.product_task.trim() || !input.product_goal_reference.trim()) throw new Error('trial requires identity, product task and Product Goal reference');
    if (!input.base_product_revision || !input.data_snapshot || !input.model_generation || !input.evaluator_version) throw new Error('trial requires comparable revision, data snapshot, model and evaluator');
    if (!input.cognition_protocol?.trim() || !input.action_protocol?.trim()) throw new Error('trial requires explicit cognition and action protocols');
    if (input.evidence_ids.length === 0) throw new Error('trial requires prospective evidence references');
    for (const [label, value] of [['product_quality', input.product_quality], ['domain_correctness', input.domain_correctness], ['process_integrity', input.process_integrity], ['safety', input.safety]] as const) {
      if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 5)) throw new Error(`${label} must be a finite score between 0 and 5`);
    }
    for (const [label, value] of [['token_actual', input.token_actual], ['token_estimated', input.token_estimated], ['token_unknown', input.token_unknown], ['rework_count', input.rework_count], ['founder_interventions', input.founder_interventions]] as const) {
      if (value !== undefined && (!Number.isFinite(value) || value < 0)) throw new Error(`${label} must be a finite non-negative number`);
    }
    return this.add({ ...input, state: 'REGISTERED', created_at: new Date().toISOString() });
  }
  async recordMeasured(input: Omit<ArchitectureTrialRecord, 'created_at'>) {
    if (input.state !== 'MEASURED' && input.state !== 'DECIDED') throw new Error('measured record must be MEASURED or DECIDED');
    const { state: _state, ...registration } = input;
    await this.register(registration);
    return this.add({ ...input, created_at: new Date().toISOString() });
  }
  async records(trialId?: string) {
    try {
      const rows = (await readFile(this.file, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line) as ArchitectureTrialRecord);
      return trialId ? rows.filter((row) => row.trial_id === trialId) : rows;
    } catch (error: any) { if (error?.code === 'ENOENT') return []; throw error; }
  }

  /** Resolve every reference before a trial is decision-grade. */
  async validateEvidence(records: ArchitectureTrialRecord[], resolver: IEvidenceResolver, options?: {
    expectedNamespace?: string;
    maxAgeMs?: number;
  }): Promise<ArchitectureEvidenceValidation> {
    const invalid_arms: ArchitectureEvidenceValidation['invalid_arms'] = [];
    for (const row of records) {
      const ids = [...new Set([...row.evidence_ids, ...row.product_quality_evidence_ids, ...row.domain_correctness_evidence_ids])];
      const reasons: string[] = [];
      for (const id of ids) {
        const evidence = await resolver.resolve(id);
        reasons.push(...validateEvidenceResolution(evidence, id, {
          expected_namespace: options?.expectedNamespace ?? '',
          expected_run_id: row.trial_id,
          reviewer_role: `architecture-arm:${row.arm}`,
          max_age_ms: options?.maxAgeMs,
        }));
        if (evidence && !evidence.source_artifact) reasons.push(`evidence '${id}' has no source artifact`);
      }
      if (reasons.length) invalid_arms.push({ arm: row.arm, reasons: [...new Set(reasons)] });
    }
    return { valid: invalid_arms.length === 0, invalid_arms };
  }
  compare(rows: ArchitectureTrialRecord[]): ArchitectureTrialComparison {
    const arms = [...new Set(rows.map((row) => row.arm))];
    const invalidArms = rows.map((row) => ({ arm: row.arm, reasons: [
      ...(row.state === 'INVALID' ? ['arm is already invalid'] : []),
      ...(row.confounders.length ? [`unresolved confounders: ${row.confounders.join('; ')}`] : []),
      ...(row.evidence_ids.length ? [] : ['missing evidence']),
      ...(row.state !== 'MEASURED' && row.state !== 'DECIDED' ? ['arm has not reached measured state'] : []),
      ...(!row.cognition_protocol?.trim() ? ['missing cognition protocol'] : []),
      ...(!row.action_protocol?.trim() ? ['missing action protocol'] : []),
      ...(row.arm === 'D_PRODUCT_BOTTLENECK' ? [] : [
        ...(row.product_quality === undefined ? ['missing product quality'] : []),
        ...(row.domain_correctness === undefined ? ['missing domain correctness'] : []),
        ...(row.product_quality_evidence_ids?.length ? [] : ['missing product quality evidence']),
        ...(row.domain_correctness_evidence_ids?.length ? [] : ['missing domain correctness evidence']),
      ]),
      ...(row.process_integrity === undefined ? ['missing process integrity'] : []),
      ...(row.safety === undefined ? ['missing safety measurement'] : []),
    ] })).filter((row) => row.reasons.length);
    const trialIds = new Set(rows.map((row) => row.trial_id));
    if (trialIds.size > 1) for (const arm of arms) invalidArms.push({ arm, reasons: ['records belong to different trial IDs'] });
    const requiredArms = ARCHITECTURE_ARMS.filter((arm) => arm !== 'D_PRODUCT_BOTTLENECK');
    for (const arm of requiredArms) {
      const armRows = rows.filter((row) => row.arm === arm);
      if (armRows.length === 0) invalidArms.push({ arm, reasons: ['required architecture arm is missing'] });
      if (armRows.length > 1) invalidArms.push({ arm, reasons: ['architecture arm must have exactly one prospective record'] });
    }
    if (arms.length < 2) return { trial_id: rows[0]?.trial_id ?? '', state: 'INVALID', reason: 'at least two architecture arms are required', arms, shared_fields: [], invalid_arms: invalidArms };
    const shared: string[] = [];
    for (const key of sharedKeys) {
      const values = new Set(rows.map((row) => String(row[key])));
      if (values.size === 1) shared.push(key);
      else for (const arm of arms) invalidArms.push({ arm, reasons: [`non-comparable ${key}`] });
    }
    const required = sharedKeys.length;
    const protocolSignatures = rows.map((row) => `${row.cognition_protocol.trim()}|${row.action_protocol.trim()}`);
    if (new Set(protocolSignatures).size !== protocolSignatures.length) {
      for (const arm of arms) invalidArms.push({ arm, reasons: ['architecture arms do not have distinct cognition/action protocols'] });
    }
    return { trial_id: rows[0]?.trial_id ?? '', state: invalidArms.length || shared.length !== required ? 'INVALID' : 'COMPARABLE', reason: invalidArms.length || shared.length !== required ? 'arms differ on required comparable conditions' : 'all required comparable conditions match', arms, shared_fields: shared, invalid_arms: invalidArms };
  }
}
