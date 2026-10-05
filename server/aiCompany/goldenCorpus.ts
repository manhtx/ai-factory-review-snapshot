export type GoldenDimension = 'requirements' | 'evidence' | 'usability' | 'release-safety';

export interface GoldenTaskCase {
  case_id: string;
  dimension: GoldenDimension;
  goal: string;
  required_agents: string[];
  acceptance_criteria: string[];
  evidence_required: boolean;
}

export const MACRO_OS_GOLDEN_CORPUS: GoldenTaskCase[] = [
  { case_id: 'requirements-traceability', dimension: 'requirements', goal: 'Convert a Macro OS product goal into an auditable backlog item.', required_agents: ['pm', 'ceo', 'requirements-qa'], acceptance_criteria: ['goal alignment recorded', 'priority and owner recorded', 'acceptance criteria non-empty'], evidence_required: true },
  { case_id: 'evidence-provenance', dimension: 'evidence', goal: 'Produce a macro conclusion with source and provenance.', required_agents: ['domain-expert', 'functional-qa', 'coder'], acceptance_criteria: ['source identity recorded', 'confidence recorded', 'provenance evidence linked'], evidence_required: true },
  { case_id: 'user-comprehension', dimension: 'usability', goal: 'Validate that a target user can understand a research output.', required_agents: ['ux-research', 'coder', 'functional-qa'], acceptance_criteria: ['user feedback recorded', 'comprehension issue dispositioned', 'accessibility reviewed'], evidence_required: true },
  { case_id: 'release-integrity', dimension: 'release-safety', goal: 'Block release when independent verification fails.', required_agents: ['functional-qa', 'security-gate', 'release-gate'], acceptance_criteria: ['independent verification exists', 'security gate exists', 'failed gate cannot release'], evidence_required: true },
];

export function validateGoldenCorpus(cases: GoldenTaskCase[] = MACRO_OS_GOLDEN_CORPUS): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const item of cases) {
    if (ids.has(item.case_id)) errors.push(`${item.case_id}: duplicate case id`);
    ids.add(item.case_id);
    if (!item.goal.trim()) errors.push(`${item.case_id}: goal missing`);
    if (item.required_agents.length < 2) errors.push(`${item.case_id}: independent agent coverage missing`);
    if (item.acceptance_criteria.length < 2) errors.push(`${item.case_id}: acceptance criteria incomplete`);
    if (!item.evidence_required) errors.push(`${item.case_id}: evidence requirement disabled`);
  }
  return errors;
}
