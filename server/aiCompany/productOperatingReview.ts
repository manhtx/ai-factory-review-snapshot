import { OutcomeLedger, summarizeProductOutcomes, type ProductOutcome } from './outcomeLedger';

export interface ProductOperatingRecommendation { owner: 'ceo' | 'pm'; priority: 'P0' | 'P1' | 'P2'; action: string; rationale: string; source_outcome_ids: string[] }

export interface ProductOperatingReview { project_id: string; period: string; outcomes: ReturnType<typeof summarizeProductOutcomes>; recommendations: ProductOperatingRecommendation[]; reviewed_outcome_ids: string[] }

export async function runProductOperatingReview(input: { ledger: OutcomeLedger; projectId: string; period?: string }): Promise<ProductOperatingReview> {
  const outcomes = await input.ledger.records(input.projectId);
  const recommendations = recommendProductActions(outcomes);
  return { project_id: input.projectId, period: input.period ?? new Date().toISOString().slice(0, 10), outcomes: summarizeProductOutcomes(outcomes), recommendations, reviewed_outcome_ids: outcomes.map((outcome) => outcome.outcome_id) };
}

export function recommendProductActions(outcomes: ProductOutcome[]): ProductOperatingRecommendation[] {
  const recommendations: ProductOperatingRecommendation[] = [];
  const blocked = outcomes.filter((outcome) => outcome.verdict === 'BLOCKED');
  if (blocked.length) recommendations.push({ owner: 'ceo', priority: 'P0', action: 'open a blocker decision and assign an executive owner', rationale: `${blocked.length} product outcome(s) are blocked`, source_outcome_ids: blocked.map((outcome) => outcome.outcome_id) });
  const failures = outcomes.filter((outcome) => outcome.verdict === 'FAILURE');
  if (failures.length) recommendations.push({ owner: 'pm', priority: 'P1', action: 'revise the affected workflow acceptance criteria and backlog item', rationale: `${failures.length} outcome(s) failed user or stakeholder acceptance`, source_outcome_ids: failures.map((outcome) => outcome.outcome_id) });
  const belowTarget = outcomes.filter((outcome) => outcome.metric.target !== undefined && outcome.metric.value < outcome.metric.target);
  if (belowTarget.length) recommendations.push({ owner: 'pm', priority: 'P1', action: 'investigate target miss before expanding scope', rationale: `${belowTarget.length} measured outcome(s) missed target`, source_outcome_ids: belowTarget.map((outcome) => outcome.outcome_id) });
  return recommendations;
}
