import { createHash } from 'node:crypto';

export type EvidenceClass =
  | 'HUMAN_EXPERT_REVIEW'
  | 'SYNTHETIC_EXPERT_EVAL'
  | 'SYNTHETIC_USER_EVAL'
  | 'SYNTHETIC_ADVERSARIAL_EVAL'
  | 'DETERMINISTIC_PRODUCT_EVAL'
  | 'BROWSER_RUNTIME_EVIDENCE'
  | 'REPOSITORY_EVIDENCE'
  | 'REAL_USER_BEHAVIOR'
  | 'REAL_USER_FEEDBACK'
  | 'PRODUCTION_TELEMETRY';

export type ProductStage =
  | 'STAGE_0_INTERNAL_BUILD'
  | 'STAGE_1_SYNTHETIC_VALIDATION'
  | 'STAGE_2_EXPERT_VALIDATION'
  | 'STAGE_3_CONTROLLED_REAL_USER_VALIDATION'
  | 'STAGE_4_PRODUCTION_BEHAVIOR'
  | 'STAGE_5_SCALED_PRODUCT_LEARNING';

export type FindingSeverity = 'S1' | 'S2' | 'S3' | 'S4';
export type FindingConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

export interface EvaluatorProfile {
  evaluator_id: string;
  kind: 'EXPERT' | 'SYNTHETIC_USER' | 'ADVERSARIAL';
  role: string;
  persona_or_lens: string;
  independence_group: string;
  token_budget: number;
}

export interface EvaluationScenario {
  scenario_id: string;
  product: 'macro-os';
  task: string;
  starting_url: string;
  success_observable: string;
  required_viewports: Array<'desktop' | 'mobile'>;
  risk: 'P1' | 'P2' | 'P3';
}

export interface EvaluationEvidence {
  evidence_id: string;
  evidence_class: EvidenceClass;
  source: string;
  observed_at: string;
  content_hash: string;
  provenance_note: string;
}

export interface Finding {
  finding_id: string;
  evaluator_id: string;
  scenario_id: string;
  title: string;
  statement: string;
  severity: FindingSeverity;
  confidence: FindingConfidence;
  evidence_ids: string[];
  affected_personas: string[];
  reproducible: boolean;
  locked_at?: string;
}

export interface LockedFindingSet {
  lock_id: string;
  snapshot_id: string;
  findings: Finding[];
  locked_at: string;
  immutable_hash: string;
}

export interface EvaluationSnapshot {
  snapshot_id: string;
  product: 'macro-os';
  stage: ProductStage;
  revision: string;
  captured_at: string;
  browser_evidence_ids: string[];
  deterministic_evidence_ids: string[];
}

export interface AggregatedFinding {
  cluster_id: string;
  source_finding_ids: string[];
  title: string;
  severity: FindingSeverity;
  confidence: FindingConfidence;
  evaluator_count: number;
  disagreement: string[];
  evidence_ids: string[];
}

export interface ProductQualityScore {
  product_value: number;
  domain_usefulness: number;
  trust_evidence: number;
  usability: number;
  information_architecture: number;
  ui_quality: number;
  task_efficiency: number;
  accessibility: number;
  reliability: number;
  product_coherence: number;
  total: number;
  evidence_ids: string[];
  provenance: 'SYNTHETIC_PRODUCT_QUALITY_NOT_MARKET_SUCCESS';
}

export type CycleDecision = 'PROMOTE' | 'REVISE' | 'REVERT' | 'INCONCLUSIVE';

export interface BeforeAfterComparison {
  baseline_snapshot_id: string;
  candidate_snapshot_id: string;
  baseline_score: number;
  candidate_score: number;
  regression_count: number;
  decision: CycleDecision;
  rationale: string;
  evidence_ids: string[];
}

const rank: Record<FindingSeverity, number> = { S1: 4, S2: 3, S3: 2, S4: 1 };

export function lockFindings(snapshotId: string, findings: Finding[], now = new Date().toISOString()): LockedFindingSet {
  if (!snapshotId.trim() || findings.length === 0) throw new Error('snapshot and findings are required');
  if (findings.some((finding) => finding.locked_at)) throw new Error('findings must be unlocked before locking');
  const locked = findings.map((finding) => ({ ...finding, evidence_ids: [...new Set(finding.evidence_ids)].sort(), locked_at: now }));
  const payload = JSON.stringify({ snapshotId, locked, now });
  return { lock_id: `LOCK-${snapshotId}`, snapshot_id: snapshotId, findings: locked, locked_at: now, immutable_hash: createHash('sha256').update(payload).digest('hex') };
}

export function aggregateLockedFindings(lock: LockedFindingSet): AggregatedFinding[] {
  const groups = new Map<string, Finding[]>();
  for (const finding of lock.findings) {
    const key = finding.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    groups.set(key, [...(groups.get(key) ?? []), finding]);
  }
  return [...groups.entries()].map(([cluster, findings]) => {
    const strongest = [...findings].sort((a, b) => rank[b.severity] - rank[a.severity])[0];
    const confidence: FindingConfidence = findings.some((item) => item.confidence === 'HIGH') ? 'HIGH' : findings.some((item) => item.confidence === 'MEDIUM') ? 'MEDIUM' : 'LOW';
    return { cluster_id: `CLUSTER-${cluster}`, source_finding_ids: findings.map((item) => item.finding_id), title: strongest.title, severity: strongest.severity, confidence, evaluator_count: new Set(findings.map((item) => item.evaluator_id)).size, disagreement: findings.filter((item) => item.statement !== strongest.statement).map((item) => item.statement), evidence_ids: [...new Set(findings.flatMap((item) => item.evidence_ids))].sort() };
  }).sort((a, b) => rank[b.severity] - rank[a.severity]);
}

export function scoreSyntheticProduct(input: Omit<ProductQualityScore, 'total' | 'provenance'>): ProductQualityScore {
  const dimensions: number[] = [input.product_value, input.domain_usefulness, input.trust_evidence, input.usability, input.information_architecture, input.ui_quality, input.task_efficiency, input.accessibility, input.reliability, input.product_coherence];
  if (dimensions.some((value) => typeof value !== 'number' || value < 0)) throw new Error('quality dimensions must be non-negative numbers');
  const total = dimensions.reduce((sum, value) => sum + value, 0);
  return { ...input, total, provenance: 'SYNTHETIC_PRODUCT_QUALITY_NOT_MARKET_SUCCESS' };
}

export function compareBeforeAfter(input: Omit<BeforeAfterComparison, 'decision' | 'rationale'>): BeforeAfterComparison {
  const decision: CycleDecision = input.regression_count > 0 ? 'REVISE' : input.candidate_score > input.baseline_score ? 'PROMOTE' : input.candidate_score < input.baseline_score ? 'REVERT' : 'INCONCLUSIVE';
  const rationale = input.regression_count > 0 ? 'Regression evidence prevents promotion.' : decision === 'PROMOTE' ? 'Candidate improved synthetic quality without recorded regressions.' : decision === 'REVERT' ? 'Candidate reduced synthetic quality.' : 'No material score movement was proven.';
  return { ...input, decision, rationale };
}
