import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type CandidateSource = 'FOUNDER' | 'PRODUCT_DISCOVERY' | 'USER_EVIDENCE' | 'SYNTHETIC_USER_EVAL' | 'SYNTHETIC_EXPERT_EVAL' | 'QA' | 'ENGINEERING' | 'DATA' | 'SECURITY' | 'TELEMETRY' | 'OUTCOME' | 'LEARNING' | 'INCIDENT';
export type CandidateStatus = 'PM_INBOX' | 'MERGED' | 'PROMOTED' | 'HOLD_FOR_EVIDENCE' | 'DEFERRED' | 'REJECTED' | 'INVALID';
export type BacklogCandidate = { candidate_id: string; project_id: string; source_type: CandidateSource; source_id: string; created_by: string; created_at: string; observation: string; problem_signal: string; affected_product_area: string; evidence_ids: string[]; evidence_quality: 'SUFFICIENT' | 'STALE' | 'CONFLICTED' | 'SYNTHETIC_ONLY' | 'REQUIRES_MORE_EVIDENCE' | 'UNKNOWN'; severity_signal: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; confidence_signal: number; user_or_persona?: string; suggested_opportunity?: string; suggested_solution?: string; related_backlog_ids: string[]; provenance: { source_type: CandidateSource; source_id: string; created_by: string; captured_at: string }; status: CandidateStatus };

export type CandidateInput = Omit<BacklogCandidate, 'candidate_id' | 'created_at' | 'related_backlog_ids' | 'provenance' | 'status'> & { candidate_id?: string; created_at?: string; related_backlog_ids?: string[] };

/** Convert legacy discovery/quality signals into the single PM inbox contract. */
export function candidateFromObservation(input: {
  project_id: string; source_type: CandidateSource; source_id: string; created_by: string;
  observation: string; problem_signal: string; affected_product_area: string;
  evidence_ids?: string[]; evidence_quality?: BacklogCandidate['evidence_quality'];
  severity_signal?: BacklogCandidate['severity_signal']; confidence_signal?: number;
  user_or_persona?: string; suggested_opportunity?: string; suggested_solution?: string;
  related_backlog_ids?: string[]; created_at?: string;
}): CandidateInput {
  return { ...input, evidence_ids: input.evidence_ids ?? [], evidence_quality: input.evidence_quality ?? 'UNKNOWN',
    severity_signal: input.severity_signal ?? 'MEDIUM', confidence_signal: input.confidence_signal ?? 0.5 };
}

export function candidateFromProductIdea(idea: { idea_id: string; project_id: string; title: string; problem: string; target_persona: string; validation_metric: string; differentiation_hypothesis?: string }, createdBy = 'idea-ledger'): CandidateInput {
  return candidateFromObservation({ project_id: idea.project_id, source_type: 'PRODUCT_DISCOVERY', source_id: `idea:${idea.idea_id}`, created_by: createdBy,
    observation: idea.title, problem_signal: idea.problem, affected_product_area: 'product-discovery', evidence_ids: [`idea:${idea.idea_id}`],
    evidence_quality: 'REQUIRES_MORE_EVIDENCE', user_or_persona: idea.target_persona, suggested_opportunity: idea.validation_metric,
    suggested_solution: idea.differentiation_hypothesis });
}

export function candidateFromTelemetryOpportunity(opportunity: { opportunity_id: string; project_id: string; problem: string; evidence_ids: string[]; confidence: number }, createdBy = 'telemetry'): CandidateInput {
  return candidateFromObservation({ project_id: opportunity.project_id, source_type: 'TELEMETRY', source_id: `opportunity:${opportunity.opportunity_id}`, created_by: createdBy,
    observation: opportunity.problem, problem_signal: opportunity.problem, affected_product_area: 'product-telemetry', evidence_ids: opportunity.evidence_ids,
    evidence_quality: 'REQUIRES_MORE_EVIDENCE', confidence_signal: opportunity.confidence });
}

export function candidateFromProductOpportunity(opportunity: {
  opportunity_id: string; project_id?: string; idea: string; problem_statement: string;
  affected_surface: string; affected_persona: string; evidence_ids: string[];
  evidence_quality: 'STRUCTURAL' | 'RUNTIME' | 'SYNTHETIC' | 'UNKNOWN';
  severity: 'HIGH' | 'MEDIUM' | 'LOW'; confidence: number; expected_value: 'HIGH' | 'MEDIUM' | 'LOW';
  acceptance_criteria: string[]; non_goals: string[];
}, createdBy = 'product-discovery'): CandidateInput {
  const quality = opportunity.evidence_quality === 'STRUCTURAL' ? 'REQUIRES_MORE_EVIDENCE' : opportunity.evidence_quality === 'SYNTHETIC' ? 'SYNTHETIC_ONLY' : opportunity.evidence_quality === 'RUNTIME' ? 'SUFFICIENT' : 'UNKNOWN';
  return candidateFromObservation({ project_id: opportunity.project_id ?? 'macro-os', source_type: 'PRODUCT_DISCOVERY', source_id: `opportunity:${opportunity.opportunity_id}`, created_by: createdBy, observation: opportunity.idea, problem_signal: opportunity.problem_statement, affected_product_area: opportunity.affected_surface, evidence_ids: opportunity.evidence_ids, evidence_quality: quality, severity_signal: opportunity.severity === 'HIGH' ? 'HIGH' : opportunity.severity === 'LOW' ? 'LOW' : 'MEDIUM', confidence_signal: opportunity.confidence, user_or_persona: opportunity.affected_persona, suggested_opportunity: opportunity.expected_value, suggested_solution: `Acceptance: ${opportunity.acceptance_criteria.join('; ')}. Non-goals: ${opportunity.non_goals.join('; ')}` });
}

function stableCandidateId(input: CandidateInput) { return `CANDIDATE:${input.project_id}:${input.source_type}:${input.source_id}`; }
function normalize(value: string) { return value.trim().replace(/\s+/g, ' '); }

export class BacklogIntakeGateway {
  private chain: Promise<void> = Promise.resolve();
  private readonly file: string;
  constructor(private readonly rootDir: string) { this.file = path.join(rootDir, 'backlog-candidates.jsonl'); }
  async candidates(projectId?: string): Promise<BacklogCandidate[]> { try { const rows = (await readFile(this.file, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line) as BacklogCandidate); return projectId ? rows.filter((row) => row.project_id === projectId) : rows; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; } }
  async submit(input: CandidateInput): Promise<{ candidate: BacklogCandidate; created: boolean; duplicate_of?: string }> {
    this.validate(input);
    // The duplicate read must be inside the same serialized critical section
    // as the append. Serializing only the write still permits two concurrent
    // callers to observe an empty inbox and create duplicate demand records.
    let result: { candidate: BacklogCandidate; created: boolean; duplicate_of?: string };
    const operation = this.chain.then(async () => {
      const existing = await this.candidates(input.project_id);
      const duplicate = existing.find((row) => row.source_type === input.source_type && row.source_id === input.source_id);
      if (duplicate) {
        if (duplicate.status === 'HOLD_FOR_EVIDENCE') {
          const newEv = input.evidence_ids.filter((e) => !duplicate.evidence_ids.includes(e));
          if (newEv.length > 0) {
            const reopened = await this.reopenForEvidence(duplicate.candidate_id, newEv);
            result = { candidate: reopened, created: true };
            return;
          }
        }
        result = { candidate: duplicate, created: false, duplicate_of: duplicate.candidate_id };
        return;
      }
      const now = input.created_at ?? new Date().toISOString();
      const candidate: BacklogCandidate = { ...input, candidate_id: input.candidate_id ?? stableCandidateId(input), created_at: now, observation: normalize(input.observation), problem_signal: normalize(input.problem_signal), affected_product_area: normalize(input.affected_product_area), evidence_ids: [...new Set(input.evidence_ids)], related_backlog_ids: [...new Set(input.related_backlog_ids ?? [])], provenance: { source_type: input.source_type, source_id: input.source_id, created_by: input.created_by, captured_at: now }, status: 'PM_INBOX' };
      await mkdir(this.rootDir, { recursive: true });
      await appendFile(this.file, `${JSON.stringify(candidate)}\n`, 'utf8');
      result = { candidate, created: true };
    });
    this.chain = operation.catch(() => undefined);
    await operation;
    return result!;
  }
  async update(candidate: BacklogCandidate): Promise<BacklogCandidate> {
    let result: BacklogCandidate;
    const operation = this.chain.then(async () => {
      const rows = await this.candidates();
      const index = rows.findIndex((row) => row.candidate_id === candidate.candidate_id);
      if (index < 0) throw new Error('CANDIDATE_NOT_FOUND');
      rows[index] = candidate;
      await mkdir(this.rootDir, { recursive: true });
      const temporary = `${this.file}.tmp`;
      await writeFile(temporary, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8');
      await rename(temporary, this.file);
      result = candidate;
    });
    this.chain = operation.catch(() => undefined);
    await operation;
    return result!;
  }
  async reopenForEvidence(candidateId: string, newEvidenceIds: string[]): Promise<BacklogCandidate> {
    if (!newEvidenceIds.length) throw new Error('NEW_EVIDENCE_REQUIRED');
    const rows = await this.candidates();
    const candidate = rows.find((row) => row.candidate_id === candidateId);
    if (!candidate) throw new Error('CANDIDATE_NOT_FOUND');
    if (candidate.status !== 'HOLD_FOR_EVIDENCE') throw new Error('CANDIDATE_NOT_HELD');
    const evidenceIds = [...new Set([...candidate.evidence_ids, ...newEvidenceIds.filter(Boolean)])];
    if (evidenceIds.length === candidate.evidence_ids.length) throw new Error('NO_NEW_EVIDENCE');
    return this.update({ ...candidate, evidence_ids: evidenceIds, evidence_quality: 'REQUIRES_MORE_EVIDENCE', status: 'PM_INBOX' });
  }
  private validate(input: CandidateInput) { if (!input.project_id || !input.source_type || !input.source_id || !input.created_by) throw new Error('CANDIDATE_PROVENANCE_REQUIRED'); if (!input.observation?.trim() || !input.problem_signal?.trim() || !input.affected_product_area?.trim()) throw new Error('CANDIDATE_OBSERVATION_REQUIRED'); if (!Array.isArray(input.evidence_ids)) throw new Error('CANDIDATE_EVIDENCE_REQUIRED'); if (!Number.isFinite(input.confidence_signal) || input.confidence_signal < 0 || input.confidence_signal > 1) throw new Error('CANDIDATE_CONFIDENCE_INVALID'); }
}
