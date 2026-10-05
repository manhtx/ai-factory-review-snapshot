import type { CompanyHealth } from './healthMetrics';
import { computeCompanyHealth } from './healthMetrics';
import type { CompanyStateStore } from './stateStore';
import type { UsageLedger } from './usageLedger';

export function createCompanyHealthProvider(store: CompanyStateStore, usage: UsageLedger): () => Promise<CompanyHealth> {
  return async () => computeCompanyHealth(await store.events(), await usage.records());
}
