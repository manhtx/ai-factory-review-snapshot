export type StrategyHorizon = 'H0' | 'H1' | 'H3' | 'H10';
export interface StrategyObjective { objective_id: string; horizon: StrategyHorizon; title: string; product_goal_reference: string; owner_role: 'ceo' | 'pm' | 'data-engineer' | 'release-security-gate'; success_metric: string; current_state: 'NOT_STARTED' | 'IN_PROGRESS' | 'AT_RISK' | 'ACHIEVED'; }

export const macroOsStrategy: readonly StrategyObjective[] = [
  { objective_id: 'STRAT-H0-TRUTH', horizon: 'H0', title: 'Make every decision-relevant observation real, traceable and fail-closed', product_goal_reference: 'Product Goal objectives 1, 8, 9', owner_role: 'data-engineer', success_metric: '100% gold-slice observations have source, as-of, freshness and rights state', current_state: 'AT_RISK' },
  { objective_id: 'STRAT-H1-DAILY', horizon: 'H1', title: 'Become the daily global macro intelligence destination', product_goal_reference: 'Global daily intelligence baseline', owner_role: 'pm', success_metric: 'Users answer what changed and why with evidence in under 30 seconds', current_state: 'IN_PROGRESS' },
  { objective_id: 'STRAT-H3-RESEARCH', horizon: 'H3', title: 'Become the trusted personal macro research operating system', product_goal_reference: 'Vision and product model', owner_role: 'ceo', success_metric: 'Research workflows are reproducible, comparable and outcome-measured', current_state: 'IN_PROGRESS' },
  { objective_id: 'STRAT-H10-INSTITUTIONAL', horizon: 'H10', title: 'Build a durable global macro intelligence institution', product_goal_reference: 'Long-term product direction', owner_role: 'ceo', success_metric: 'Sustained evidence quality, coverage, user value and safe release operations', current_state: 'NOT_STARTED' },
];

export function strategySnapshot(objectives: readonly StrategyObjective[] = macroOsStrategy) {
  return { objectives, byHorizon: Object.fromEntries((['H0', 'H1', 'H3', 'H10'] as const).map((horizon) => [horizon, objectives.filter((item) => item.horizon === horizon).length])), atRisk: objectives.filter((item) => item.current_state === 'AT_RISK').map((item) => item.objective_id) };
}
