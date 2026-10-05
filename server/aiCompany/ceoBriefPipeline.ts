import type { CompanyHealth } from './healthMetrics';
import { OptimizationLedger } from './optimizationLedger';
import { runCeoOptimizationCycle } from './ceoOptimizationCycle';
import { formatExecutiveTelegram } from './telegramOutbound';
import { BriefScheduler, type BriefPeriod } from './briefScheduler';

export interface BriefPipelineDeps {
  health: () => Promise<CompanyHealth>;
  send: (text: string, reportId: string) => Promise<void>;
  state?: { get: (key: string) => Promise<string | null>; set: (key: string, value: string) => Promise<void> };
  now?: () => Date;
  optimizationLedger?: OptimizationLedger;
}

export function createCeoBriefPipeline(deps: BriefPipelineDeps): BriefScheduler {
  return new BriefScheduler({
    now: deps.now,
    state: deps.state,
    send: async (period: BriefPeriod) => {
      const health = await deps.health();
      const report = deps.optimizationLedger
        ? await runCeoOptimizationCycle({ period, health, ledger: deps.optimizationLedger })
        : await runCeoOptimizationCycle({ period, health, ledger: new OptimizationLedger('.ai-company/runtime') });
      await deps.send(formatExecutiveTelegram(report), report.report_id);
    },
  });
}
