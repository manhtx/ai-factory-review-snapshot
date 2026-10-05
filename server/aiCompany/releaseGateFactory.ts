import type { CompanyHealth } from './healthMetrics';
import { evaluateProductionGate, type ProductionGateResult } from './productionGate';

export function createReleaseGate(input: { health: () => Promise<CompanyHealth>; independentVerification: () => Promise<boolean>; securityReview: () => Promise<boolean>; recoveryTest: () => Promise<boolean>; telegramAuthenticated: () => Promise<boolean> }): () => Promise<ProductionGateResult> {
  return async () => evaluateProductionGate({ health: await input.health(), independentVerification: await input.independentVerification(), securityReview: await input.securityReview(), recoveryTest: await input.recoveryTest(), telegramAuthenticated: await input.telegramAuthenticated() });
}
