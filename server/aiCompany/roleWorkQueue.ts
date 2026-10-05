import { assertResearchResult, type ResearchResult } from './researchResult';
import { appendFile, mkdir, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execPath } from 'node:process';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { getRoleContract, type CompanyRoleId } from './roleContracts';
import { assertAssignmentEnvelope, type AssignmentEnvelope } from './assignmentEnvelope';
import { assertReviewVerdict, type ReviewVerdict } from './verdict';
import { validateStructuredRoleOutput, type AnyStructuredRoleOutput } from './structuredRoleOutput';
import { validateMetricContract, type MetricContract } from './productOutcomeValidator';
import { assertReviewEvidenceRecord, type ReviewEvidenceRecord } from './reviewEvidenceContract';
import { captureEvidenceFileSnapshot, parseStoredEvidenceRecords, validateEvidenceResolution, type StoredEvidence, type EvidenceSnapshot, type IEvidenceResolver } from './evidenceResolver';
import { withQueueMutationGate } from './queueMutationGate';
import { nativeProviderReceiptId, parseNativeEvidenceRecords, type RoleEvidenceArtifact } from './roleEvidenceLedger';

export interface AttemptAuthority { attempt_id: string; owner: string; token: string; }
export type ClaimedRoleWorkItem = RoleWorkItem & { attempt_authority: AttemptAuthority };

export type WorkItemState = 'READY' | 'CLAIMED' | 'IN_REVIEW' | 'DONE' | 'BLOCKED' | 'QUARANTINED';
export interface RoleWorkItem {
  work_id: string;
  project_id: string;
  backlog_id: string;
  title: string;
  role: CompanyRoleId;
  state: WorkItemState;
  assignment?: AssignmentEnvelope;
  review_verdict?: ReviewVerdict;
  structured_output?: AnyStructuredRoleOutput;
  owner?: string;
  blocked_reason?: string;
  retry_count?: number;
  due_at?: string;
  run_id?: string;
  namespace?: string;
  workflow_id?: string;
  depends_on?: string[];
  recovery_source_work_id?: string;
  evidence_ids: string[];
  research_result?: ResearchResult;
  metric_contract?: MetricContract;
  review_evidence_record?: ReviewEvidenceRecord;
  created_at: string;
  updated_at: string;
  queue_revision?: number;
  provider_dispatch?: { attempt_id: string; provider_id: string; issued_at: string };
  attempt_id?: string;
  attempt_token_hash?: string;
}
export type RoleWorkSpec = { work_id: string; project_id: string; backlog_id: string; title: string; role: CompanyRoleId; assignment?: AssignmentEnvelope; run_id?: string; namespace?: string; workflow_id?: string; depends_on?: string[]; recovery_source_work_id?: string; };

export function isReviewRoleWork(item: RoleWorkItem): boolean {
  return ['functional-qa', 'quality-control', 'critic', 'security', 'release-security-gate'].includes(item.role)
    || item.assignment?.task_type === 'code_review' || item.work_id.endsWith('-REVIEW');
}

export function hasNonPassReview(item: RoleWorkItem): boolean {
  return Boolean((item.review_verdict && item.review_verdict.verdict !== 'PASS')
    || (item.review_evidence_record && item.review_evidence_record.verdict !== 'PASS')
    || (item.structured_output && 'verdict' in item.structured_output && item.structured_output.verdict !== 'PASS'));
}

function validTerminalRoleWork(item: RoleWorkItem): boolean {
  if (item.state !== 'DONE' || hasNonPassReview(item)) return false;
  try {
    if (item.review_verdict) assertReviewVerdict(item.review_verdict);
    if (item.review_evidence_record) assertReviewEvidenceRecord(item.review_evidence_record);
  } catch { return false; }
  return !isReviewRoleWork(item) || item.review_verdict?.verdict === 'PASS' || item.review_evidence_record?.verdict === 'PASS';
}
function validCorrectiveDependency(work: RoleWorkItem, dependency: RoleWorkItem): boolean {
  if (!['BLOCKED', 'DONE'].includes(dependency.state) || !hasNonPassReview(dependency) || !dependency.evidence_ids?.length) return false;
  try {
    if (!dependency.review_verdict && !dependency.review_evidence_record) return false;
    if (dependency.review_verdict) assertReviewVerdict(dependency.review_verdict);
    if (dependency.review_evidence_record) assertReviewEvidenceRecord(dependency.review_evidence_record);
  }
  catch { return false; }
  return Boolean(work.assignment?.run_id && work.assignment.namespace
    && work.assignment.run_id === dependency.assignment?.run_id
    && work.assignment.namespace === dependency.assignment?.namespace);
}
function currentGraphAdmissible(item: RoleWorkItem, rows: readonly RoleWorkItem[], requireSuccess: boolean): boolean {
  if (!Array.isArray(rows) || !item) return false;
  const byId = new Map<string, RoleWorkItem>();
  for (const row of rows) {
    if (!row || typeof row.work_id !== 'string' || !row.work_id || byId.has(row.work_id)) return false;
    byId.set(row.work_id, row);
  }
  const root = byId.get(item.work_id);
  if (!root || root.project_id !== item.project_id) return false;
  const active = new Set<string>(), structural = new Set<string>(), successful = new Set<string>();
  const stack = [{ node: root, required: requireSuccess, exit: false }];
  while (stack.length) {
    const frame = stack.pop()!; const node = frame.node;
    if (frame.exit) { active.delete(node.work_id); structural.add(node.work_id); if (frame.required) successful.add(node.work_id); continue; }
    if (active.has(node.work_id)) return false;
    if ((frame.required ? successful : structural).has(node.work_id)) continue;
    if (frame.required && !validTerminalRoleWork(node)) return false;
    const deps = node.depends_on ?? [];
    if (!Array.isArray(deps) || deps.some(id => typeof id !== 'string' || !id.trim())) return false;
    if (node.recovery_source_work_id !== undefined && !deps.includes(node.recovery_source_work_id)) return false;
    active.add(node.work_id); stack.push({ ...frame, exit: true });
    for (const id of deps) {
      const dependency = byId.get(id);
      // Failed review context may have missing inputs; it grants no success.
      if (!dependency) { if (frame.required) return false; continue; }
      if (dependency.project_id !== node.project_id) return false;
      let required = frame.required;
      if (required && node.recovery_source_work_id === id) {
        if (!validCorrectiveDependency(node, dependency)) return false;
        required = false;
      }
      stack.push({ node: dependency, required, exit: false });
    }
  }
  return true;
}
export function isSuccessfulRoleWork(item: RoleWorkItem, rows: readonly RoleWorkItem[]): boolean {
  return currentGraphAdmissible(item, rows, true);
}
export function roleDependencySatisfied(work: RoleWorkItem, dependency: RoleWorkItem | undefined, rows: readonly RoleWorkItem[]): boolean {
  if (!Array.isArray(rows) || !dependency) return false;
  const currentWork = rows.filter(row => row.work_id === work.work_id);
  const currentDependency = rows.filter(row => row.work_id === dependency.work_id);
  if (currentWork.length !== 1 || currentDependency.length !== 1) return false;
  const parent = currentWork[0], source = currentDependency[0];
  if (parent.project_id !== work.project_id || source.project_id !== parent.project_id || !(parent.depends_on ?? []).includes(source.work_id)) return false;
  if (parent.recovery_source_work_id !== source.work_id) return isSuccessfulRoleWork(source, rows);
  return validCorrectiveDependency(parent, source) && currentGraphAdmissible(source, rows, false);
}

function assertCurrentDependencies(work: RoleWorkItem, rows: RoleWorkItem[]): void {
  const unresolved = (work.depends_on ?? []).filter(id => !roleDependencySatisfied(work, rows.find(row => row.work_id === id), rows));
  if (unresolved.length) throw new Error(`work dependencies are not complete: ${unresolved.join(', ')}`);
}

function currentRoleEvidenceErrors(item: RoleWorkItem, rows: readonly RoleWorkItem[], snapshot: EvidenceSnapshot | undefined): string[] {
  if (!snapshot) return ['current evidence snapshot authority is unavailable'];
  if (!item.evidence_ids.length) return ['current completion evidence is missing'];
  if (!item.research_result && !item.review_verdict && !item.review_evidence_record && !item.structured_output && !item.metric_contract) return ['terminal contract is missing'];
  try {
    if (item.research_result) assertResearchResult(item.research_result);
    if (item.review_verdict) assertReviewVerdict(item.review_verdict);
    if (item.review_evidence_record) assertReviewEvidenceRecord(item.review_evidence_record);
  } catch (error) { return [`terminal contract is invalid: ${String(error)}`]; }
  const ids = new Set(item.evidence_ids);
  for (const id of item.structured_output?.evidence_ids ?? []) ids.add(id);
  for (const id of item.review_verdict?.evidence ?? []) ids.add(id);
  for (const id of item.review_evidence_record?.evidence_ids ?? []) ids.add(id);
  if (item.research_result?.source_reference) ids.add(item.research_result.source_reference);
  const errors: string[] = [];
  for (const id of ids) {
    if (typeof id !== 'string' || !/^[A-Za-z0-9_:-]+$/.test(id)) {errors.push('invalid declared evidence identity');continue;}
    try {
      const evidence = snapshot.resolve(id);
      errors.push(...validateEvidenceResolution(evidence,id,{expected_namespace:item.assignment?.namespace ?? item.namespace ?? '',expected_run_id:item.assignment?.run_id ?? item.run_id ?? '',reviewer_role:isReviewRoleWork(item) ? item.role : ''}));
      if (!evidence?.source_artifact) errors.push(`evidence '${id}' has no source artifact`);
      if (evidence?.work_id && evidence.work_id !== item.work_id && !(item.depends_on ?? []).includes(evidence.work_id)) errors.push(`evidence '${id}' belongs to an undeclared producer`);
      if (evidence?.evidence_kind === 'PROVIDER_OUTPUT') {
        const producer=evidence.work_id === item.work_id ? item : rows.find(row => row.work_id === evidence.work_id && (item.depends_on ?? []).includes(row.work_id));
        if (!producer?.attempt_id || producer.attempt_id !== evidence.attempt_id) errors.push(`evidence '${id}' does not belong to the selected producer attempt`);
      }
    } catch (error) {errors.push(`evidence resolution unavailable: ${String(error)}`);}
  }
  return errors;
}

const issuedCurrentAuthorities = new WeakSet<object>();
export function isIssuedCurrentRoleAuthority(value: unknown): value is CurrentRoleAuthority { return Boolean(value && typeof value === 'object' && issuedCurrentAuthorities.has(value)); }

export interface CurrentRoleAuthority {
  currentRows(): readonly RoleWorkItem[];
  rows: readonly RoleWorkItem[];
  errors: ReadonlyMap<string, readonly string[]>;
  assertCurrent(): void;
  isSuccessful(item: RoleWorkItem): boolean;
  dependencySatisfied(work: RoleWorkItem, dependency: RoleWorkItem | undefined): boolean;
}

function assertRecoveryDependency(input: { recovery_source_work_id?: string; depends_on?: string[] }): void {
  if (input.recovery_source_work_id !== undefined
    && (typeof input.recovery_source_work_id !== 'string' || !input.recovery_source_work_id.trim() || !input.depends_on?.includes(input.recovery_source_work_id))) {
    throw new Error('recovery source must name an explicit work dependency');
  }
}

function assignmentFor(spec: RoleWorkSpec): AssignmentEnvelope {
  const runId = spec.run_id ?? `run-${spec.work_id}`; const namespace = spec.namespace ?? `project:${spec.project_id}`;
  const mutationPolicy = spec.assignment?.mutation_policy ?? (spec.workflow_id === 'codex-benchmark-f-control-plane' ? 'worktree' : 'read_only');
  return assertAssignmentEnvelope(spec.assignment ?? { assignment_id: `ASSIGNMENT:${spec.work_id}`, run_id: runId, namespace, product_id: spec.project_id, objective_id: spec.backlog_id, work_id: spec.work_id, role: spec.role, task_type: 'role-work', objective: spec.title, product_goal_alignment: ['Product Goal alignment required'], scope: ['assigned work only'], allowed_paths: ['assigned workspace'], forbidden_paths: ['.env', '.ai-company/runtime', '.ai-company/company-state.json'], allowed_tools: ['repository inspection'], forbidden_tools: ['deployment', 'secret access'], inputs: ['assigned work contract'], evidence_manifest: ['assigned work item'], dependencies: spec.depends_on ?? [], acceptance_criteria: ['durable evidence recorded'], output_schema: 'none', allowed_verdicts: ['PASS', 'REVISE', 'QUALITY_FAIL', 'HOLD', 'BLOCKED'], risk_level: 'P1', mutation_policy: mutationPolicy, test_policy: 'targeted', context_budget: { target_tokens: 4000, max_tokens: 8000 }, token_budget: 16000, timeout: 600, retry_budget: 1, escalation_policy: 'bounded escalation' });
}

export class RoleWorkQueue {
  private file: string;
  private canonicalRoot?: Promise<string>;
  constructor(private readonly rootDir: string, private readonly evidenceResolver?: IEvidenceResolver) { this.file = path.join(rootDir, 'role-work-queue.jsonl'); }
  private boundRoot(): Promise<string> {
    return this.canonicalRoot ??= (async () => {
      await mkdir(this.rootDir, { recursive: true });
      const root = await realpath(this.rootDir);
      this.file = path.join(root, 'role-work-queue.jsonl');
      return root;
    })();
  }
  async assertNativeEvidenceRoot(rootDir: string): Promise<void> {
    if (await realpath(rootDir) !== await this.boundRoot()) throw new Error('native evidence ledger must share canonical queue root');
  }
  assertEvidenceResolutionConfigured(): void {
    if (!this.evidenceResolver || typeof this.evidenceResolver.resolve !== 'function') {
      throw new Error('completion requires an explicitly configured evidence resolver');
    }
    if (typeof this.evidenceResolver.snapshot !== 'function') throw new Error('consistent evidence snapshot capability is required before provider dispatch or completion');
  }
  async create(input: { project_id: string; backlog_id: string; title: string; role: CompanyRoleId; due_at?: string; run_id?: string; namespace?: string; workflow_id?: string; depends_on?: string[]; recovery_source_work_id?: string }): Promise<RoleWorkItem> {
    getRoleContract(input.role);
    assertRecoveryDependency(input);
    if (!input.project_id || !input.backlog_id || !input.title.trim()) throw new Error('work item identity is required');
    const now = new Date().toISOString();
    const work_id = `WORK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const item: RoleWorkItem = { ...input, work_id, assignment: assignmentFor({ ...input, work_id }), depends_on: [...new Set(input.depends_on ?? [])], state: 'READY', evidence_ids: [], created_at: now, updated_at: now };
    await this.append(item);
    return item;
  }
  async createBatch(specs: RoleWorkSpec[]): Promise<RoleWorkItem[]> {
    return withQueueMutationGate(await this.boundRoot(), (bytes) => {
    const existing = this.parseRecords(bytes.toString('utf8'));
    const ids = new Set(existing.map((item) => item.work_id));
    if (!specs.length) throw new Error('DAG must contain at least one work item');
    for (const spec of specs) {
      getRoleContract(spec.role);
      assertRecoveryDependency(spec);
      if (!spec.work_id || !spec.project_id || !spec.backlog_id || !spec.title.trim()) throw new Error('DAG work item identity is required');
      if (ids.has(spec.work_id)) throw new Error(`duplicate work id: ${spec.work_id}`);
      ids.add(spec.work_id);
    }
    const byId = new Map(specs.map((spec) => [spec.work_id, spec]));
    for (const spec of specs) for (const dependency of spec.depends_on ?? []) if (!byId.has(dependency) && !existing.some((item) => item.work_id === dependency)) throw new Error(`unknown DAG dependency: ${dependency}`);
    const visiting = new Set<string>(), visited = new Set<string>();
    const visit = (id: string) => { if (visiting.has(id)) throw new Error(`DAG cycle detected at ${id}`); if (visited.has(id)) return; visiting.add(id); for (const dep of byId.get(id)?.depends_on ?? []) if (byId.has(dep)) visit(dep); visiting.delete(id); visited.add(id); };
    for (const spec of specs) visit(spec.work_id);
    const now = new Date().toISOString();
    const items = specs.map((spec) => ({ ...spec, assignment: assignmentFor(spec), depends_on: [...new Set(spec.depends_on ?? [])], state: 'READY' as const, evidence_ids: [], created_at: now, updated_at: now, queue_revision: 1 }));
    return { value: items, append: `${items.map((item) => JSON.stringify(item)).join('\n')}\n` };
    });
  }
  async claim(workId: string, owner: string): Promise<ClaimedRoleWorkItem> {
    const token = randomBytes(32).toString('hex');
    const attempt_id = randomUUID();
    const item = await this.update(workId, (item, rows) => {
      if (item.state !== 'READY') throw new Error(`work item is not ready: ${item.state}`);
      if (!owner.trim()) throw new Error('work owner is required');
      assertCurrentDependencies(item, rows);
      return { ...item, state: 'CLAIMED', owner, attempt_id, provider_dispatch: undefined, attempt_token_hash: this.attemptTokenHash(item, owner, token), updated_at: new Date().toISOString() };
    }, undefined, undefined, true);
    return { ...item, attempt_authority: { attempt_id, owner, token } };
  }
  private attemptTokenHash(item: RoleWorkItem, owner: string, token: string): string {
    return createHash('sha256').update(JSON.stringify({ queue: this.file, work_id: item.work_id, project_id: item.project_id, assignment: item.assignment, owner, token })).digest('hex');
  }
  private assertAttempt(item: RoleWorkItem, authority?: AttemptAuthority): void {
    if (!authority || typeof authority !== 'object' || Array.isArray(authority)
      || typeof authority.attempt_id !== 'string' || typeof authority.owner !== 'string'
      || typeof authority.token !== 'string' || !/^[a-f0-9]{64}$/.test(authority.token)
      || !item.attempt_id || item.attempt_id !== authority.attempt_id || item.owner !== authority.owner
      || typeof item.attempt_token_hash !== 'string' || !/^[a-f0-9]{64}$/.test(item.attempt_token_hash)
      || !timingSafeEqual(Buffer.from(item.attempt_token_hash, 'hex'), Buffer.from(this.attemptTokenHash(item, authority.owner, authority.token), 'hex'))) {
      throw new Error('current claimed attempt authority is required; missing, stale or invalid capability');
    }
  }
  async reserveProviderDispatch(workId: string, providerId: string, authority: AttemptAuthority | undefined, selected: RoleWorkItem): Promise<RoleWorkItem> {
    const snapshot = { ...selected } as RoleWorkItem & { attempt_authority?: AttemptAuthority };
    delete snapshot.attempt_authority;
    return this.update(workId, (item, rows) => {
      this.assertAttempt(item, authority);
      assertCurrentDependencies(item, rows);
      if (item.state !== 'CLAIMED') throw new Error(`provider dispatch requires claimed work: ${item.state}`);
      this.assertEvidenceResolutionConfigured();
      if (!providerId.trim()) throw new Error('provider identity is required');
      if (item.provider_dispatch !== undefined) throw new Error('provider dispatch already issued for this attempt; effect may be unknown, repeated dispatch refused');
      return { ...item, provider_dispatch: { attempt_id: item.attempt_id!, provider_id: providerId, issued_at: new Date().toISOString() }, updated_at: new Date().toISOString() };
    }, snapshot, undefined, true);
  }
  async submitForReview(workId: string, authority?: AttemptAuthority): Promise<RoleWorkItem> {
    return this.update(workId, (item, rows) => {
      this.assertAttempt(item, authority);
      assertCurrentDependencies(item, rows);
      if (item.state !== 'CLAIMED') throw new Error(`work item is not claimed: ${item.state}`);
      return { ...item, state: 'IN_REVIEW', updated_at: new Date().toISOString() };
    }, undefined, undefined, true);
  }
  async blockAttempt(workId: string, reason: string, authority: AttemptAuthority): Promise<RoleWorkItem> {
    return this.update(workId, item => {
      this.assertAttempt(item, authority);
      if (!['CLAIMED', 'IN_REVIEW'].includes(item.state)) throw new Error(`attempt is not active: ${item.state}`);
      if (!reason.trim()) throw new Error('block reason is required');
      return { ...item, state: 'BLOCKED', blocked_reason: reason, updated_at: new Date().toISOString() };
    });
  }
  async block(workId: string, reason: string, selected?: RoleWorkItem): Promise<RoleWorkItem> { return this.update(workId, (item) => { if (!reason.trim()) throw new Error('block reason is required'); if (item.state === 'DONE') throw new Error('completed work cannot be blocked'); return { ...item, state: 'BLOCKED', blocked_reason: reason, updated_at: new Date().toISOString() }; }, selected); }
  async quarantine(workId: string, reason: string, selected?: RoleWorkItem): Promise<RoleWorkItem> { return this.update(workId, (item) => { if (!reason.trim()) throw new Error('quarantine reason is required'); return { ...item, state: 'QUARANTINED', blocked_reason: reason, updated_at: new Date().toISOString() }; }, selected); }
  async complete(
    workId: string,
    evidenceIds: string[],
    researchResult?: RoleWorkItem['research_result'],
    reviewVerdict?: ReviewVerdict,
    structuredOutput?: AnyStructuredRoleOutput,
    metricContract?: MetricContract,
    reviewEvidenceRecord?: ReviewEvidenceRecord,
    authority?: AttemptAuthority
  ): Promise<RoleWorkItem> {
    return this.update(workId, async (item, decisionRows) => {
      assertCurrentDependencies(item, decisionRows);
      if (item.state !== 'IN_REVIEW') throw new Error(`work item is not in review: ${item.state}`);

      // 1. Evidence IDs validation
      if (!Array.isArray(evidenceIds) || !evidenceIds.length) {
        throw new Error('completion evidence is required');
      }
      for (const id of evidenceIds) {
        if (typeof id !== 'string' || !id.trim() || !/^[A-Za-z0-9_:-]+$/.test(id)) {
          throw new Error(`invalid evidence ID format: '${id}'`);
        }
      }

      // 2. Product tasks require MetricContract
      const isProductTask =
        item.assignment?.task_type === 'product_discovery' ||
        item.assignment?.task_type === 'product_metric' ||
        item.assignment?.task_type === 'product_improvement';
      if (isProductTask) {
        if (!metricContract) {
          throw new Error('product task requires valid MetricContract with baseline and target before marking DONE');
        }
        const metricValidation = validateMetricContract(metricContract);
        if (!metricValidation.valid) {
          throw new Error(`invalid metric contract: ${metricValidation.errors.join('; ')}`);
        }
      }

      // 3. Roles that produce structured output MUST provide valid structuredOutput
      const STRUCTURED_OUTPUT_ROLES: CompanyRoleId[] = [
        'pm',
        'tech-lead',
        'coder',
        'backend-engineer',
        'frontend-engineer',
        'data-engineer',
        'ceo',
        'ceo-guild',
      ];
      const isStructuredRole = STRUCTURED_OUTPUT_ROLES.includes(item.role);
      const reviewContractRoles: CompanyRoleId[] = ['functional-qa', 'quality-control', 'critic', 'security', 'release-security-gate'];
      const requiresStructuredOutput =
        isStructuredRole ||
        (Boolean(item.assignment?.output_schema && item.assignment.output_schema !== 'none') && !reviewContractRoles.includes(item.role)) ||
        Boolean(structuredOutput);

      if (requiresStructuredOutput) {
        if (!structuredOutput) {
          throw new Error(`role ${item.role} requires valid structuredOutput before marking DONE`);
        }
        // Verify role contract consistency
        const allowedRoleMappings: Record<string, string[]> = {
          coder: ['coder', 'backend-engineer', 'frontend-engineer', 'data-engineer'],
          'backend-engineer': ['coder', 'backend-engineer'],
          'frontend-engineer': ['coder', 'frontend-engineer'],
          'data-engineer': ['coder', 'data-engineer'],
          pm: ['pm'],
          'tech-lead': ['tech-lead'],
          ceo: ['ceo', 'ceo-guild'],
          'ceo-guild': ['ceo', 'ceo-guild'],
        };
        const allowed = allowedRoleMappings[item.role] ?? [item.role];
        if (!allowed.includes(structuredOutput.role)) {
          throw new Error(`structuredOutput role contract mismatch: declared ${structuredOutput.role}, expected ${item.role}`);
        }
        const validation = validateStructuredRoleOutput(structuredOutput.role as CompanyRoleId, structuredOutput);
        if (!validation.valid) {
          throw new Error(`structured output validation failed for role ${item.role}: ${validation.errors.join('; ')}`);
        }
      }

      // 4. Pure evidence-only completion is strictly forbidden
      const hasAnyContract = Boolean(
        researchResult ||
        reviewVerdict ||
        structuredOutput ||
        metricContract ||
        reviewEvidenceRecord
      );
      if (!hasAnyContract) {
        if (STRUCTURED_OUTPUT_ROLES.includes(item.role)) {
          throw new Error(`role ${item.role} requires valid structuredOutput before marking DONE`);
        }
        throw new Error(
          `evidence-only completion is forbidden: role ${item.role} must supply its required contract (structuredOutput, reviewVerdict, reviewEvidenceRecord, researchResult, or metricContract) before marking DONE`
        );
      }

      if (researchResult) assertResearchResult(researchResult);
      if (['user-persona','ux-research','stakeholder-panel','domain-expert'].includes(item.role) && !isReviewRoleWork(item) && !researchResult) throw new Error(`research role ${item.role} requires an explicit research result`);

      // 5. Review roles require ReviewVerdict or ReviewEvidenceRecord
      const isReviewWork = isReviewRoleWork(item);
      if (reviewVerdict) assertReviewVerdict(reviewVerdict);
      if (isReviewWork) {
        if (!reviewVerdict && !reviewEvidenceRecord) {
          throw new Error(`review role ${item.role} requires valid ReviewVerdict or ReviewEvidenceRecord before marking DONE`);
        }
        if (reviewVerdict) {
          assertReviewVerdict(reviewVerdict);
        }
        if (reviewEvidenceRecord) {
          if (reviewEvidenceRecord.role !== item.role) {
            throw new Error(`reviewEvidenceRecord role mismatch: declared ${reviewEvidenceRecord.role}, expected ${item.role}`);
          }
          assertReviewEvidenceRecord(reviewEvidenceRecord, {
            test_policy: item.assignment?.test_policy,
            task_type: item.assignment?.task_type,
            allowed_paths: item.assignment?.allowed_paths,
          });
        }
      }

      // Resolve every declared reference before the terminal write.
      this.assertEvidenceResolutionConfigured();
      this.assertAttempt(item, authority);
      {
        const expectedNamespace = item.assignment?.namespace ?? item.namespace ?? '';
        const expectedRunId = item.assignment?.run_id ?? item.run_id ?? '';
        const declaredEvidenceIds = new Set(evidenceIds);
        if (structuredOutput) for (const id of structuredOutput.evidence_ids ?? []) declaredEvidenceIds.add(id);
        if (reviewVerdict) for (const id of reviewVerdict.evidence ?? []) declaredEvidenceIds.add(id);
        if (reviewEvidenceRecord) for (const id of reviewEvidenceRecord.evidence_ids ?? []) declaredEvidenceIds.add(id);
        if (researchResult?.source_reference) declaredEvidenceIds.add(researchResult.source_reference);
        for (const id of declaredEvidenceIds) {
          if (typeof id !== 'string' || !id.trim() || !/^[A-Za-z0-9_:-]+$/.test(id)) {
            throw new Error(`invalid declared evidence ID format: '${id}'`);
          }
          const evidence = await this.evidenceResolver!.resolve(id);
          const errors = validateEvidenceResolution(evidence, id, {
            expected_namespace: expectedNamespace,
            expected_run_id: expectedRunId,
            reviewer_role: isReviewWork ? item.role : '',
          });
          if (errors.length) throw new Error(`evidence resolution failed: ${errors.join('; ')}`);
          if (evidence?.work_id && evidence.work_id !== item.work_id && !(item.depends_on ?? []).includes(evidence.work_id)) throw new Error(`evidence '${id}' belongs to work '${evidence.work_id}', expected '${item.work_id}' or an explicit dependency`);
          if (evidence?.evidence_kind === 'PROVIDER_OUTPUT') {
            const producer = evidence.work_id === item.work_id ? item : decisionRows.find(row => row.work_id === evidence.work_id && (item.depends_on ?? []).includes(row.work_id));
            if (!producer?.attempt_id || evidence.attempt_id !== producer.attempt_id) throw new Error(`provider-output evidence '${id}' does not belong to the selected producer attempt`);
          }
          if (!evidence?.source_artifact) throw new Error(`evidence '${id}' has no source artifact`);
        }
      }

      return {
        ...item,
        state: hasNonPassReview({ ...item, review_verdict: reviewVerdict, review_evidence_record: reviewEvidenceRecord, structured_output: structuredOutput }) ? 'BLOCKED' : 'DONE',
        blocked_reason: hasNonPassReview({ ...item, review_verdict: reviewVerdict, review_evidence_record: reviewEvidenceRecord, structured_output: structuredOutput }) ? 'admitted non-PASS review; correction or re-evaluation required' : undefined,
        evidence_ids: [...new Set(evidenceIds)],
        research_result: researchResult,
        review_verdict: reviewVerdict,
        structured_output: structuredOutput,
        metric_contract: metricContract,
        review_evidence_record: reviewEvidenceRecord,
        updated_at: new Date().toISOString(),
      };
    }, undefined, undefined, true);
  }
  private parseRecords(content: string): RoleWorkItem[] {
    if (content && !content.endsWith('\n')) throw new Error('corrupt queue: unterminated history');
    const rows = content.split('\n').filter(Boolean).map((line, index) => {
      const row = JSON.parse(line) as RoleWorkItem;
      if (!row || typeof row !== 'object' || Array.isArray(row)
        || ['work_id', 'project_id', 'backlog_id', 'title', 'role', 'created_at', 'updated_at'].some(key => typeof row[key as keyof RoleWorkItem] !== 'string' || !(row[key as keyof RoleWorkItem] as string).trim())
        || !['READY', 'CLAIMED', 'IN_REVIEW', 'DONE', 'BLOCKED', 'QUARANTINED'].includes(row.state)
        || !Array.isArray(row.evidence_ids)
        || (row.queue_revision !== undefined && (!Number.isSafeInteger(row.queue_revision) || row.queue_revision < 1))) throw new Error(`corrupt queue record at row ${index + 1}`);
      const dispatch = row.provider_dispatch;
      if (dispatch !== undefined && (!dispatch || typeof dispatch !== 'object' || Array.isArray(dispatch)
        || typeof dispatch.attempt_id !== 'string' || dispatch.attempt_id !== row.attempt_id
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dispatch.attempt_id)
        || typeof dispatch.provider_id !== 'string' || !dispatch.provider_id.trim()
        || typeof dispatch.issued_at !== 'string' || !Number.isFinite(Date.parse(dispatch.issued_at))
        || new Date(dispatch.issued_at).toISOString() !== dispatch.issued_at)) throw new Error(`corrupt provider dispatch at queue row ${index + 1}`);
      return row;
    });
    return [...new Map(rows.map(row => [row.work_id, row])).values()];
  }
  async records(projectId?: string): Promise<RoleWorkItem[]> { try { await this.boundRoot(); const result = this.parseRecords(new TextDecoder('utf-8', { fatal: true }).decode(await readFile(this.file))); return projectId ? result.filter(row => row.project_id === projectId) : result; } catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; } }
  async currentSuccess(selected: RoleWorkItem): Promise<boolean> {
    return this.currentEvidenceSelection(selected);
  }
  async publishNativeReceipt(input: RoleEvidenceArtifact, authority: AttemptAuthority | undefined): Promise<RoleEvidenceArtifact> {
    const receipt = structuredClone(input);
    parseNativeEvidenceRecords(`${JSON.stringify(receipt)}\n`);
    const root = await this.boundRoot();
    receipt.source_artifact = `${path.join(root, 'role-evidence.jsonl')}#${receipt.evidence_id}`;
    return withQueueMutationGate(root, (bytes, queueBytes) => {
      const work = this.parseRecords(queueBytes.toString('utf8')).find(row => row.work_id === receipt.work_id);
      if (!work) throw new Error('native receipt work is missing');
      this.assertAttempt(work, authority);
      if (!['CLAIMED', 'IN_REVIEW'].includes(work.state) || work.provider_dispatch?.attempt_id !== work.attempt_id || work.provider_dispatch?.provider_id !== receipt.provider_id) throw new Error('native receipt requires active issued provider attempt');
      if (receipt.evidence_id !== nativeProviderReceiptId(work.work_id, work.attempt_id!) || receipt.attempt_id !== work.attempt_id || receipt.project_id !== work.project_id || receipt.role !== work.role || receipt.protocol_status !== 'RECEIVED') throw new Error('native receipt identity does not match current producer');
      const issues = validateEvidenceResolution({ evidence_id: receipt.evidence_id, namespace: receipt.namespace ?? '', run_id: receipt.run_id ?? '', produced_by_role: receipt.role, work_id: receipt.work_id, attempt_id: receipt.attempt_id, content: receipt.output, content_hash: receipt.content_hash ?? '', created_at: receipt.created_at, source_artifact: receipt.source_artifact, evidence_kind: 'PROVIDER_OUTPUT' }, receipt.evidence_id, { expected_namespace: work.assignment?.namespace ?? work.namespace ?? '', expected_run_id: work.assignment?.run_id ?? work.run_id ?? '', reviewer_role: '' });
      if (issues.length) throw new Error(`native receipt content or scope is invalid: ${issues.join('; ')}`);
      if (bytes.length && !bytes.toString('utf8').endsWith('\n')) throw new Error('corrupt native evidence ledger: unterminated history');
      const stored = parseNativeEvidenceRecords(bytes.toString('utf8'));
      if (new Set(stored.map(row => row.evidence_id)).size !== stored.length) throw new Error('duplicate native receipt identity');
      if (stored.some(row => row.content_hash !== undefined && createHash('sha256').update(row.output, 'utf8').digest('hex') !== row.content_hash)) throw new Error('corrupt native evidence ledger: original content hash mismatch');
      const existing = stored.find(row => row.evidence_id === receipt.evidence_id);
      if (existing) {
        const comparable = (row: RoleEvidenceArtifact) => JSON.stringify(Object.entries(row).filter(([key]) => key !== 'created_at').sort(([a], [b]) => a.localeCompare(b)));
        if (comparable(existing) !== comparable(receipt)) throw new Error('native attempt receipt identity reused with different output or lineage');
        return { value: existing };
      }
      return { value: receipt, append: `${JSON.stringify(receipt)}\n` };
    }, 'role-evidence.jsonl');
  }
  async publishCliReceipt(input: StoredEvidence & { project_id: string; runner: string; model: string }, authority: AttemptAuthority): Promise<StoredEvidence> {
    const receipt = structuredClone(input);
    parseStoredEvidenceRecords(`${JSON.stringify(receipt)}\n`);
    return withQueueMutationGate(await this.boundRoot(), (bytes, queueBytes) => {
      const rows = this.parseRecords(queueBytes.toString('utf8'));
      const work = rows.find(row => row.work_id === receipt.work_id);
      if (!work) throw new Error('CLI receipt work is missing');
      this.assertAttempt(work, authority);
      if (!['CLAIMED', 'IN_REVIEW'].includes(work.state) || work.provider_dispatch?.provider_id !== `cli:${receipt.runner}:${receipt.model}`) throw new Error('CLI receipt requires active issued provider attempt');
      if (receipt.evidence_id !== `ROLE-DISPATCH:${work.work_id}:${work.attempt_id}` || receipt.attempt_id !== work.attempt_id || receipt.project_id !== work.project_id || receipt.produced_by_role !== work.role || receipt.evidence_kind !== 'PROVIDER_OUTPUT') throw new Error('CLI receipt identity does not match current producer');
      const issues = validateEvidenceResolution(receipt, receipt.evidence_id, { expected_namespace: work.assignment?.namespace ?? work.namespace ?? '', expected_run_id: work.assignment?.run_id ?? work.run_id ?? '', reviewer_role: '' });
      if (issues.length || !receipt.source_artifact) throw new Error(`CLI receipt content or scope is invalid: ${issues.join('; ')}`);
      if (bytes.length && !bytes.toString('utf8').endsWith('\n')) throw new Error('corrupt CLI receipt ledger: unterminated history');
      const stored = parseStoredEvidenceRecords(bytes.toString('utf8'));
      if (stored.some(row => createHash('sha256').update(row.content, 'utf8').digest('hex') !== row.content_hash)) throw new Error('corrupt CLI receipt ledger: original content hash mismatch');
      const existing = stored.find(row => row.evidence_id === receipt.evidence_id);
      if (existing) {
        const comparable = (row: StoredEvidence) => JSON.stringify(Object.entries(row).filter(([key]) => key !== 'created_at').sort(([a], [b]) => a.localeCompare(b)));
        if (comparable(existing) !== comparable(receipt)) throw new Error('CLI receipt identity reused with different content or lineage');
        return { value: existing };
      }
      return { value: receipt, append: `${JSON.stringify(receipt)}\n` };
    }, 'role-dispatch-evidence.jsonl');
  }
  async currentDependencySatisfied(work: RoleWorkItem, dependency: RoleWorkItem | undefined): Promise<boolean> {
    if (!dependency) return false;
    return this.currentEvidenceSelection(work, dependency);
  }
  private async currentEvidenceSelection(selected: RoleWorkItem, dependency?: RoleWorkItem): Promise<boolean> {
    let snapshot: EvidenceSnapshot | undefined;
    try { snapshot = await this.evidenceResolver?.snapshot?.(); }
    catch { return false; }
    if (!snapshot) return false;
    return withQueueMutationGate(await this.boundRoot(), bytes => {
      const rows = this.parseRecords(bytes.toString('utf8'));
      const current = rows.find(row => row.work_id === selected.work_id);
      if (!current || JSON.stringify(current) !== JSON.stringify(selected)) return { value: false };
      const source = dependency ? rows.find(row => row.work_id === dependency.work_id) : current;
      if (!source || (dependency && JSON.stringify(source) !== JSON.stringify(dependency))) return { value: false };
      if (dependency ? !roleDependencySatisfied(current, source, rows) : !isSuccessfulRoleWork(current, rows)) return { value: false };
      const ids = new Set<string>();
      const tracking: EvidenceSnapshot = { resolve: id => { ids.add(id); return snapshot!.resolve(id); }, assertCurrent: ids => snapshot!.assertCurrent(ids) };
      const pending = [{ row: source, context: Boolean(dependency && current.recovery_source_work_id === source.work_id) }], visited = new Set<string>();
      let valid = true;
      while (pending.length) {
        const { row, context } = pending.pop()!;
        const key = `${row.work_id}:${context}`;
        if (visited.has(key)) continue;
        visited.add(key);
        if (currentRoleEvidenceErrors(row, rows, tracking).length) valid = false;
        if (!context) for (const id of row.depends_on ?? []) {
          const dependency = rows.find(candidate => candidate.work_id === id);
          if (!dependency) { valid = false; continue; }
          pending.push({ row: dependency, context: row.recovery_source_work_id === id });
        }
      }
      snapshot!.assertCurrent([...ids]);
      return { value: valid };
    });
  }
  async currentAuthority(projectId?: string): Promise<CurrentRoleAuthority> {
    await this.boundRoot();
    const queueFile = await captureEvidenceFileSnapshot(this.file);
    const rows = this.parseRecords(queueFile.content);
    let evidence: EvidenceSnapshot | undefined;
    let failure: string | undefined;
    try { evidence = await this.evidenceResolver?.snapshot?.(); } catch (error) {failure=String(error);}
    const errors = new Map<string,readonly string[]>();
    for (const row of rows) if (['DONE','BLOCKED'].includes(row.state)) errors.set(row.work_id, failure ? [failure] : currentRoleEvidenceErrors(row,rows,evidence));
    const assertCurrent = () => {queueFile.assertCurrent();evidence?.assertCurrent();};
    assertCurrent();
    const evidenceAdmissible = (item: RoleWorkItem) => {
      const pending=[item],visited=new Set<string>();
      while (pending.length) {
        const current=pending.pop()!;if (visited.has(current.work_id)) continue;visited.add(current.work_id);
        if (currentRoleEvidenceErrors(current,rows,evidence).length) return false;
        for (const id of current.depends_on ?? []) {
          const dependency=rows.find(row=>row.work_id===id);if (!dependency) return false;
          if (id === current.recovery_source_work_id) {if (currentRoleEvidenceErrors(dependency,rows,evidence).length) return false;}
          else pending.push(dependency);
        }
      }
      return true;
    };
    const isSuccessful = (item: RoleWorkItem) => {
      assertCurrent();const current=rows.find(row=>row.work_id===item.work_id);
      return Boolean(current && (!projectId || current.project_id === projectId) && current.project_id===item.project_id && isSuccessfulRoleWork(current,rows) && evidenceAdmissible(current));
    };
    const view:CurrentRoleAuthority = {
      currentRows() {assertCurrent();return structuredClone(projectId ? rows.filter(row => row.project_id === projectId) : rows);},
      rows:structuredClone(projectId ? rows.filter(row=>row.project_id===projectId) : rows),
      errors:new Map([...errors].map(([id,issues])=>[id,Object.freeze([...issues])])),assertCurrent,isSuccessful,
      dependencySatisfied(work,dependency) {
        assertCurrent();if (!dependency || (projectId && (work.project_id !== projectId || dependency.project_id !== projectId)) || !roleDependencySatisfied(work,dependency,rows)) return false;
        const parent=rows.find(row=>row.work_id===work.work_id),source=rows.find(row=>row.work_id===dependency.work_id);
        return Boolean(parent && source && (parent.recovery_source_work_id === source.work_id ? !currentRoleEvidenceErrors(source,rows,evidence).length : isSuccessful(source)));
      }
    };
    Object.freeze(view);issuedCurrentAuthorities.add(view);return view;
  }
  async summary(projectId?: string) { const rows = await this.records(projectId); return { total: rows.length, byState: Object.fromEntries(['READY', 'CLAIMED', 'IN_REVIEW', 'DONE', 'BLOCKED', 'QUARANTINED'].map((state) => [state, rows.filter((row) => row.state === state).length])) }; }
  async triage(projectId?: string, now = new Date()): Promise<{ blocked: RoleWorkItem[]; overdue: RoleWorkItem[] }> { const rows = await this.records(projectId); return { blocked: rows.filter((row) => row.state === 'BLOCKED'), overdue: rows.filter((row) => row.state !== 'DONE' && row.state !== 'BLOCKED' && row.due_at && Date.parse(row.due_at) < now.getTime()) }; }
  async recoverStaleLeases(projectId: string, leaseMs: number, now = new Date()): Promise<RoleWorkItem[]> { const recovered: RoleWorkItem[] = []; const threshold = Math.max(1_000, leaseMs); for (const item of await this.records(projectId)) { if (!['CLAIMED', 'IN_REVIEW'].includes(item.state) || now.getTime() - Date.parse(item.updated_at) < threshold) continue; recovered.push(await this.update(item.work_id, (current) => ({ ...current, state: 'READY', owner: undefined, blocked_reason: `stale lease recovered from ${current.state} after ${threshold}ms`, updated_at: now.toISOString() }), item)); } return recovered; }
  async quarantineBlocked(projectId: string, before: Date, reason = 'historical blocked work quarantined for explicit reconciliation'): Promise<RoleWorkItem[]> { const quarantined: RoleWorkItem[] = []; for (const item of await this.records(projectId)) { if (item.state !== 'BLOCKED' || Date.parse(item.created_at) >= before.getTime()) continue; quarantined.push(await this.update(item.work_id, (current) => ({ ...current, state: 'QUARANTINED', blocked_reason: `${current.blocked_reason ?? 'blocked'}; ${reason}`, updated_at: new Date().toISOString() }), item)); } return quarantined; }
  async quarantineStaleReady(projectId: string, before: Date, reason = 'historical READY work quarantined pending explicit revalidation'): Promise<RoleWorkItem[]> { const quarantined: RoleWorkItem[] = []; for (const item of await this.records(projectId)) { if (item.state !== 'READY' || Date.parse(item.created_at) >= before.getTime()) continue; quarantined.push(await this.update(item.work_id, (current) => ({ ...current, state: 'QUARANTINED', blocked_reason: reason, updated_at: new Date().toISOString() }), item)); } return quarantined; }
  async requeueBlocked(workId: string, reason = 'bounded retry after provider contract', selected?: RoleWorkItem): Promise<RoleWorkItem> { return this.update(workId, (item) => { if (item.state !== 'BLOCKED') throw new Error(`work item is not blocked: ${item.state}`); const retryCount = item.retry_count ?? 0; const retryBudget = item.assignment?.retry_budget ?? 0; if (retryCount >= retryBudget) throw new Error(`retry budget exhausted: ${retryCount}/${retryBudget}`); return { ...item, state: 'READY', owner: undefined, retry_count: retryCount + 1, blocked_reason: `${item.blocked_reason ?? 'blocked'}; ${reason} (${retryCount + 1}/${retryBudget})`, updated_at: new Date().toISOString() }; }, selected); }
  async reconcileOrphanedReady(projectId?: string): Promise<RoleWorkItem[]> {
    const rows = await this.records(projectId);
    const byId = new Map(rows.map((row) => [row.work_id, row]));
    const quarantined: RoleWorkItem[] = [];
    for (const item of rows) {
      if (item.state !== 'READY') continue;
      const deps = item.depends_on ?? [];
      if (!deps.length) continue;
      const unviableDeps = deps
        .map((depId) => byId.get(depId))
        .filter((dep) => dep && (dep.state === 'QUARANTINED' || dep.state === 'BLOCKED') && !roleDependencySatisfied(item, dep, rows));
      if (unviableDeps.length > 0) {
        const blockerDetails = unviableDeps.map((d) => `${d!.work_id}(${d!.state})`).join(', ');
        quarantined.push(
          await this.update(item.work_id, (current) => ({
            ...current,
            state: 'QUARANTINED',
            blocked_reason: `UPSTREAM_DEPENDENCY_TERMINATED: unviable dependencies [${blockerDetails}]; orphan quarantined fail-closed`,
            updated_at: new Date().toISOString(),
          }), item, rows)
        );
      }
    }
    return quarantined;
  }
  private async append(item: RoleWorkItem) {
    const previous = await withQueueMutationGate(await this.boundRoot(), bytes => {
      const rows = this.parseRecords(bytes.toString('utf8'));
      if (rows.some(row => row.work_id === item.work_id)) throw new Error(`duplicate work id: ${item.work_id}`);
      item.queue_revision = 1;
      return { value: undefined, append: `${JSON.stringify(item)}\n` };
    });
    try { await this.recordProvenance(item, previous); }
    catch (error) { throw new Error('QUEUE_COMMITTED_PROVENANCE_FAILURE: work state committed; inspect before retry', { cause: error }); }
  }
  private async recordProvenance(item: RoleWorkItem, previous?: RoleWorkItem) {
    const forensicRunId = process.env.AI_COMPANY_FORENSIC_RUN_ID;
    if (forensicRunId) {
      const provenancePath = path.join(this.rootDir, 'forensic-write-provenance.jsonl');
      const stack = new Error().stack?.split('\n').slice(2, 6).join('\n') ?? null;
      const sourcePath = fileURLToPath(import.meta.url);
      await appendFile(provenancePath, `${JSON.stringify({
        forensic_run_id: forensicRunId,
        cycle_id: process.env.AI_COMPANY_CYCLE_ID ?? null,
        task_id: item.work_id,
        writer_instance_id: process.env.AI_COMPANY_WRITER_INSTANCE_ID ?? `pid-${process.pid}-${process.uptime()}`,
        pid: process.pid,
        ppid: process.ppid,
        hostname: os.hostname(),
        process_started_at: new Date(Date.now() - process.uptime() * 1000).toISOString(),
        executable: execPath,
        argv: process.argv,
        cwd: process.cwd(),
        repo_root: process.env.AI_COMPANY_CONTROL_ROOT ?? process.cwd(),
        worktree: process.env.AI_COMPANY_WORKSPACE ?? null,
        runtime_entrypoint: process.argv[1] ?? null,
        module_path: sourcePath,
        module_hash: createHash('sha256').update(await readFile(sourcePath)).digest('hex'),
        previous_state: previous?.state ?? null,
        requested_state: item.state,
        committed_state: item.state,
        timestamp: new Date().toISOString(),
        write_path: this.file,
        callsite: stack,
      })}\n`, 'utf8');
    }
  }
  private async update(workId: string, mutate: (item: RoleWorkItem, rows: RoleWorkItem[]) => RoleWorkItem | Promise<RoleWorkItem>, selected?: RoleWorkItem, decisionRows?: RoleWorkItem[], requireCurrentDependencies = false) {
    const rows = await this.records();
    const item = rows.find(row => row.work_id === workId);
    if (!item) throw new Error(`work item not found: ${workId}`);
    if (selected && JSON.stringify(item) !== JSON.stringify(selected)) throw new Error('stale queue selection: work changed before mutation');
    const observed = JSON.stringify(item);
    const dependencies = (item.depends_on ?? []).map(id => [id, JSON.stringify((decisionRows ?? rows).find(row => row.work_id === id))] as const);
    const graphReadSet = new Map<string,string|undefined>();
    if (requireCurrentDependencies) {
      const pending=[workId];while(pending.length){const id=pending.pop()!;if(graphReadSet.has(id))continue;const row=rows.find(candidate=>candidate.work_id===id);graphReadSet.set(id,row ? JSON.stringify(row) : undefined);if(row)pending.push(...(row.depends_on ?? []));}
    }
    const next = await mutate(item, rows);
    const snapshot = requireCurrentDependencies && ((item.depends_on ?? []).length || ['DONE','BLOCKED'].includes(next.state) || next.provider_dispatch !== item.provider_dispatch) ? await this.evidenceResolver?.snapshot?.() : undefined;
    if ((item.queue_revision ?? 0) >= Number.MAX_SAFE_INTEGER) throw new Error('queue revision exhausted; no mutation committed');
    next.queue_revision = (item.queue_revision ?? 0) + 1;
    await withQueueMutationGate(await this.boundRoot(), bytes => {
      const current = this.parseRecords(bytes.toString('utf8'));
      if (JSON.stringify(current.find(row => row.work_id === workId)) !== observed
        || dependencies.some(([id, snapshot]) => JSON.stringify(current.find(row => row.work_id === id)) !== snapshot)) throw new Error('stale queue mutation: work or dependency changed before commit');
      // Ancestor admission must use the same locked snapshot as the terminal append.
      if (requireCurrentDependencies) {
        assertCurrentDependencies(item,current);
        if (next.provider_dispatch !== item.provider_dispatch && !snapshot) throw new Error('current evidence snapshot is unavailable before provider issuance');
        if ([...graphReadSet].some(([id,observed])=>JSON.stringify(current.find(row=>row.work_id===id))!==observed)) throw new Error('stale queue mutation: dependency graph changed before commit');
        const inputs:RoleWorkItem[]=[];const pending=(item.depends_on ?? []).map(id=>({id,context:item.recovery_source_work_id===id}));const seen=new Set<string>();
        while(pending.length){const {id,context}=pending.pop()!;const key=`${id}:${context}`;if(seen.has(key))continue;seen.add(key);const row=current.find(candidate=>candidate.work_id===id);if(!row)throw new Error('current dependency evidence work missing');inputs.push(row);if(!context)pending.push(...(row.depends_on ?? []).map(dep=>({id:dep,context:row.recovery_source_work_id===dep})));}
        if (['DONE','BLOCKED'].includes(next.state)) inputs.push(next);
        const evidenceIds=new Set<string>();
        const tracking:EvidenceSnapshot|undefined=snapshot ? {resolve:id=>{evidenceIds.add(id);return snapshot.resolve(id);},assertCurrent:ids=>snapshot.assertCurrent(ids)} : undefined;
        for(const input of inputs){const issues=currentRoleEvidenceErrors(input,current,tracking);if(issues.length)throw new Error(`current evidence authority failed: ${issues.join('; ')}`);}
        snapshot?.assertCurrent([...evidenceIds]);
      }
      return { value: next, append: `${JSON.stringify(next)}\n` };
    });
    try { await this.recordProvenance(next, item); }
    catch (error) { throw new Error('QUEUE_COMMITTED_PROVENANCE_FAILURE: work state committed; inspect before retry', { cause: error }); }
    return next;
  }
}
