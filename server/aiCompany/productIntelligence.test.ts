import { describe, expect, it } from 'vitest';
import { createProductObservation, discoverFrontierGapOpportunity, discoverOpportunities, selectOpportunity } from './productIntelligence';
describe('product intelligence', () => {
  it('turns one frontier gap into PM-gated discovery without authorizing execution', () => {
    const candidate = discoverFrontierGapOpportunity({ observation: createProductObservation({ revision: 'r1', routes: [] }), gap: { gap_id: 'GAP-HOLIDAY-CALENDAR-AWARENESS', domain: 'INGESTION_FRESHNESS', severity: 'P2', description: 'Freshness needs jurisdiction-aware release calendars.', candidate_opportunity: 'OPP-JURISDICTION-HOLIDAY-CALENDAR' } });
    expect(candidate).toMatchObject({ opportunity_id: 'OPP-JURISDICTION-HOLIDAY-CALENDAR', evidence_quality: 'STRUCTURAL', pm_decision: 'PENDING', suggested_work_intent: 'PRODUCT_DISCOVERY' });
  });

  it('deduplicates an already-present frontier gap', () => {
    expect(discoverFrontierGapOpportunity({ observation: createProductObservation({ revision: 'r1', routes: [] }), existingIds: ['OPP-JURISDICTION-HOLIDAY-CALENDAR'], gap: { gap_id: 'GAP-HOLIDAY-CALENDAR-AWARENESS', domain: 'INGESTION_FRESHNESS', severity: 'P2', description: 'Freshness needs jurisdiction-aware release calendars.', candidate_opportunity: 'OPP-JURISDICTION-HOLIDAY-CALENDAR' } })).toBeNull();
  });
  it('creates a revision-bound observation with stable surface ids', () => { const o = createProductObservation({ revision: 'r1', routes: [['/indicators/:id', 'Indicator Detail']] }); expect(o.surfaces[0].surface_id).toHaveLength(12); expect(o.journeys.length).toBeGreaterThan(3); });
  it('carries validated prior learning references into the observation', () => { const o = createProductObservation({ revision: 'r1', routes: [], priorLearnings: ['LEARN-1'] }); expect(o.prior_learning_references).toEqual(['LEARN-1']); });
  it('discovers only when product evidence supports a candidate and deduplicates existing work', () => { const o = createProductObservation({ revision: 'r1', routes: [['/indicators/:id', 'Indicator Detail']], evidence: ['OBS-ROUTE-INDICATOR-DETAIL', 'PRODUCT_GOAL-TRUST'] }); const c = discoverOpportunities(o, ['OPP-PROVENANCE-TRACEABILITY']); expect(c.some((x) => x.opportunity_id === 'OPP-PROVENANCE-TRACEABILITY')).toBe(false); expect(c.every((x) => x.evidence_ids.length > 0)).toBe(true); });
  it('returns no work when observation has no actionable evidence', () => { const o = createProductObservation({ revision: 'r1', routes: [] }); expect(selectOpportunity(discoverOpportunities(o))).toBeNull(); });
  it('emits a complete PM-ready backlog item before execution', () => { const o = createProductObservation({ revision: 'r1', routes: [['/indicators/:id', 'Indicator Detail']], evidence: ['OBS-ROUTE-INDICATOR-DETAIL', 'PRODUCT_GOAL-TRUST'] }); const item = discoverOpportunities(o)[0]; expect(item).toMatchObject({ idea: expect.any(String), user_problem: expect.any(String), product_goal_objectives: expect.any(Array), priority: expect.stringMatching(/^P[0-3]$/), risk: expect.stringMatching(/^(HIGH|MEDIUM|LOW)$/), pm_decision: 'PENDING', lifecycle_status: 'EVIDENCE_READY' }); expect(item.acceptance_criteria.length).toBeGreaterThan(0); });
});
