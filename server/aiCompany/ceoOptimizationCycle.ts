import type { CompanyHealth } from './healthMetrics';
import { buildExecutiveReport, type ExecutiveReport } from './executiveReport';
import { proposeOptimizations } from './optimizationPlanner';
import type { OptimizationLedger } from './optimizationLedger';

export async function runCeoOptimizationCycle(input: { period: string; health: CompanyHealth; ledger: OptimizationLedger; chairmanDecisions?: string[] }): Promise<ExecutiveReport> {
  const proposals = proposeOptimizations(input.health);
  for (const proposal of proposals) await input.ledger.record(proposal);
  return buildExecutiveReport({ period: input.period, health: input.health, proposals, chairmanDecisions: input.chairmanDecisions });
}
