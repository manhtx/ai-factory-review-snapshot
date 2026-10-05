import { describe, expect, it } from 'vitest';
import { macroOsStrategy, strategySnapshot } from './strategyLedger';
describe('strategy ledger', () => { it('keeps CEO horizons explicit and surfaces risk', () => { const snapshot = strategySnapshot(); expect(snapshot.objectives).toHaveLength(4); expect(snapshot.byHorizon).toMatchObject({ H0: 1, H1: 1, H3: 1, H10: 1 }); expect(snapshot.atRisk).toContain('STRAT-H0-TRUTH'); expect(macroOsStrategy.every((item) => item.product_goal_reference && item.success_metric)).toBe(true); }); });
