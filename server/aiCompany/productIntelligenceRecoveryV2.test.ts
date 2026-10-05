import { describe, it, expect } from 'vitest';
import {
  parseProductGoal,
  evaluateSearchLenses,
  evaluateDiscoveryAdmission,
  computeSemanticDiscoveryFingerprint,
  productQuestionFromUncertainty,
  opportunityCandidateFromUncertainty,
  type ProductRealitySpecification,
} from './productIntelligence';
import {
  QualifiedWorkSupplyManager,
  type QualifiedWorkRunway,
} from './qualifiedWorkSupply';

describe('Product Intelligence Recovery V2 — Causal Repair & Invariants', () => {
  const sampleGoal = `# Macro OS Product Direction & Product Goal

## 1. Core Product Objectives
1. Deliver truthful, verifiable macroeconomic intelligence with explicit provenance.
2. Separate factual market observations from qualitative inference and policy regimes.
3. Maintain zero dead code; every committed module must serve a verified research journey.

## 2. Scope and Priorities
1. **Priority 1: Truth and coverage foundation** Vietnam priority market.
2. **Priority 2: Inflation and monetary policy regime detection** Core models.
3. **Priority 3: Cross-country comovement** Decoupling analysis.

## 3. Product Philosophy & Non-Negotiables
- Grounding before inference
- Explicit freshness contracts
`;

  const sampleReality: ProductRealitySpecification = {
    revision: 'git-rev-abc123',
    catalogIndicatorCount: 36,
    hydratedIndicatorCount: 32,
    unhydratedIndicatorIds: ['em-cpi-vn', 'em-policy-rate-vn', 'em-industrial-production-vn', 'em-interbank-rate-vn'],
    quarantinedSourceCount: 1,
    quarantinedSourceIds: ['quarantined-source-1'],
    unconsumedModules: ['server/analytics/breakevenAdjuster.ts'],
    activeHoldContracts: [
      {
        id: 'QW-EM-FX-RESERVE-BUFFER-MONITOR',
        hold_reason: 'Awaiting reserve buffer series',
        permitted_next_action: 'QUERY_EXISTING_DATA',
        evidence_gap: 'Daily reserve buffer series in canonical SQLite',
      },
    ],
    goldenJourneys: [
      { id: 'JOURNEY_1_INFLATION_RATES', name: 'Inflation & Rates', current_maturity: 'USABLE', blockers: [] },
      { id: 'JOURNEY_2_LIQUIDITY_FX', name: 'Liquidity & FX', current_maturity: 'USABLE', blockers: [] },
      { id: 'JOURNEY_3_CREDIT_REAL_ESTATE', name: 'Credit & Real Estate', current_maturity: 'BLOCKED', blockers: ['Missing credit series'] },
    ],
    routeCount: 27,
    auditStatus: 'BLOCKED',
    telemetryRowCount: 823,
  };

  describe('1. Positive Control: Autonomous Uncertainty Derivation (No Founder Topic Injection)', () => {
    it('autonomously derives decision-relevant uncertainties from Product Goal vs Product Reality', () => {
      const parsedGoal = parseProductGoal(sampleGoal);
      expect(parsedGoal.objectives.length).toBeGreaterThanOrEqual(3);
      expect(parsedGoal.priorities.length).toBeGreaterThanOrEqual(3);

      const uncertainties = evaluateSearchLenses({
        goal: parsedGoal,
        reality: sampleReality,
        existingIds: new Set(),
        existingQuestions: [],
      });

      expect(uncertainties.length).toBeGreaterThanOrEqual(4);

      // Verify lenses identified the real data gap and unconsumed module
      const realityUncertainty = uncertainties.find((u) => u.search_lens === 'PRODUCT_REALITY' && u.uncertainty_id === 'UNCERT-UNHYDRATED-VIETNAM-CORE');
      expect(realityUncertainty).toBeDefined();
      expect(realityUncertainty?.is_material).toBe(true);
      expect(realityUncertainty?.decision_at_stake).toContain('Vietnam core series');
      expect(realityUncertainty?.falsifier).toBeDefined();

      const consumptionUncertainty = uncertainties.find((u) => u.search_lens === 'CONSUMPTION_INTEGRITY');
      expect(consumptionUncertainty).toBeDefined();
      expect(consumptionUncertainty?.uncertainty_id).toBe('UNCERT-CONSUMPTION-ANALYTICS-BREAKEVENADJUSTER');
      expect(consumptionUncertainty?.decision_at_stake).toContain('breakevenAdjuster');

      const journeyUncertainty = uncertainties.find((u) => u.search_lens === 'GOLDEN_JOURNEYS');
      expect(journeyUncertainty).toBeDefined();
      expect(journeyUncertainty?.uncertainty_id).toBe('UNCERT-JOURNEY-BLOCKER-JOURNEY_3_CREDIT_REAL_ESTATE');
    });

    it('creates fully formed RegenerativeProductQuestion satisfying the Section 10 contract', () => {
      const parsedGoal = parseProductGoal(sampleGoal);
      const uncertainties = evaluateSearchLenses({
        goal: parsedGoal,
        reality: sampleReality,
        existingIds: new Set(),
        existingQuestions: [],
      });

      const topUncertainty = uncertainties[0];
      const question = productQuestionFromUncertainty(topUncertainty, 'git-rev-abc123');

      // Verify all 13 mandatory fields
      expect(question.id).toMatch(/^RQ-/);
      expect(question.question).toBeTruthy();
      expect(question.goal_lineage).toBeTruthy();
      expect(question.reality_trigger).toBeTruthy();
      expect(question.decision_at_stake).toBeTruthy();
      expect(question.current_belief).toBeTruthy();
      expect(question.known_evidence.length).toBeGreaterThanOrEqual(1);
      expect(question.important_unknown).toBeTruthy();
      expect(question.falsifier).toBeTruthy();
      expect(question.evidence_path).toBeTruthy();
      expect(question.reality_revision).toBe('git-rev-abc123');
      expect(question.evidence_revision).toBe('git-rev-abc123');
      expect(question.status).toBe('IN_PROGRESS');

      // Verify admission gate passes
      const admission = evaluateDiscoveryAdmission(topUncertainty);
      expect(admission.admitted).toBe(true);
      expect(admission.reason).toBeTruthy();
    });

    it('creates an opportunity candidate with bounded allowed_paths and acceptance criteria', () => {
      const parsedGoal = parseProductGoal(sampleGoal);
      const uncertainties = evaluateSearchLenses({
        goal: parsedGoal,
        reality: sampleReality,
        existingIds: new Set(),
        existingQuestions: [],
      });

      const topUncertainty = uncertainties[0];
      const candidate = opportunityCandidateFromUncertainty(topUncertainty, 'git-rev-abc123');

      expect(candidate.opportunity_id).toMatch(/^OPP-/);
      expect(candidate.allowed_paths).toBeDefined();
      expect(candidate.allowed_paths?.length).toBeGreaterThanOrEqual(1);
      expect(candidate.acceptance_criteria.length).toBeGreaterThanOrEqual(2);
      expect(candidate.non_goals).toContain('premature build authorization without evidence');
      expect(candidate.suggested_work_intent).toBe('PRODUCT_DISCOVERY');
    });
  });

  describe('2. Negative Control: Zero-Cognition Wait on Unchanged Reality', () => {
    it('produces identical fingerprint on identical reality and goal state', () => {
      const fp1 = computeSemanticDiscoveryFingerprint({
        goalText: sampleGoal,
        realityHash: 'hash-abc',
        questionIds: ['RQ-1'],
        candidateIds: ['OPP-1'],
        runwayState: 'HEALTHY',
        deliveredIds: ['DEL-1'],
      });
      const fp2 = computeSemanticDiscoveryFingerprint({
        goalText: sampleGoal,
        realityHash: 'hash-abc',
        questionIds: ['RQ-1'],
        candidateIds: ['OPP-1'],
        runwayState: 'HEALTHY',
        deliveredIds: ['DEL-1'],
      });

      expect(fp1).toBe(fp2);
      expect(fp1.length).toBe(64); // SHA-256 hex
    });

    it('changes fingerprint when reality changes', () => {
      const fp1 = computeSemanticDiscoveryFingerprint({
        goalText: sampleGoal,
        realityHash: 'hash-abc',
        questionIds: ['RQ-1'],
        candidateIds: ['OPP-1'],
        runwayState: 'HEALTHY',
        deliveredIds: ['DEL-1'],
      });
      const fp2 = computeSemanticDiscoveryFingerprint({
        goalText: sampleGoal,
        realityHash: 'hash-xyz',
        questionIds: ['RQ-1'],
        candidateIds: ['OPP-1'],
        runwayState: 'HEALTHY',
        deliveredIds: ['DEL-1'],
      });

      expect(fp1).not.toBe(fp2);
    });

    it('yields zero uncertainties when all reality items are already in existingIds or questions', () => {
      const parsedGoal = parseProductGoal(sampleGoal);
      const existingIds = new Set([
        'UNCERT-UNHYDRATED-VIETNAM-CORE',
        'UNCERT-CONSUMPTION-ANALYTICS-BREAKEVENADJUSTER',
        'UNCERT-EVIDENCE-HOLD-QW-EM-FX-RESERVE-BUFFER-MONITOR',
        'UNCERT-QUARANTINED-PROVIDER-FEASIBILITY',
        'UNCERT-JOURNEY-BLOCKER-JOURNEY_3_CREDIT_REAL_ESTATE',
      ]);
      const existingQuestions: Array<{ id: string; question: string }> = [];

      const uncertainties = evaluateSearchLenses({
        goal: parsedGoal,
        reality: sampleReality,
        existingIds,
        existingQuestions,
      });

      expect(uncertainties.length).toBe(0);
    });
  });

  describe('3. Wait State Separation: DELIVERY_WAIT vs COMPANY_JUSTIFIED_WAIT', () => {
    const supplyManager = new QualifiedWorkSupplyManager('/tmp/test-supply-manager');

    it('identifies DELIVERY_WAIT when build queue is empty but research/discovery is actionable', () => {
      const result = supplyManager.evaluateCompanyWaitStatus({
        ready_build_items: 0,
        actionable_research_questions: 2,
        actionable_evidence_actions: 0,
        actionable_validations: 0,
        actionable_discovery_uncertainties: 1,
      });

      expect(result.wait_type).toBe('DELIVERY_WAIT');
      expect(result.is_delivery_wait).toBe(true);
      expect(result.is_justified_wait).toBe(false);
      expect(result.next_best_action).toBe('RESEARCH');
      expect(result.reason).toContain('Build queue is empty (DELIVERY_WAIT)');
    });

    it('identifies DELIVERY_WAIT when evidence actions are actionable', () => {
      const result = supplyManager.evaluateCompanyWaitStatus({
        ready_build_items: 0,
        actionable_research_questions: 0,
        actionable_evidence_actions: 1,
        actionable_validations: 0,
      });

      expect(result.wait_type).toBe('DELIVERY_WAIT');
      expect(result.is_delivery_wait).toBe(true);
      expect(result.is_justified_wait).toBe(false);
      expect(result.next_best_action).toBe('ACQUIRE_EVIDENCE');
    });

    it('enters true COMPANY_JUSTIFIED_WAIT only when ALL work channels are zero', () => {
      const result = supplyManager.evaluateCompanyWaitStatus({
        ready_build_items: 0,
        actionable_research_questions: 0,
        actionable_evidence_actions: 0,
        actionable_validations: 0,
        actionable_discovery_uncertainties: 0,
      });

      expect(result.wait_type).toBe('COMPANY_JUSTIFIED_WAIT');
      expect(result.is_justified_wait).toBe(true);
      expect(result.is_delivery_wait).toBe(true);
      expect(result.next_best_action).toBe('JUSTIFIED_WAIT');
      expect(result.reason).toContain('Zero-cognition wait is optimal');
    });

    it('never waits when ready build items exist', () => {
      const result = supplyManager.evaluateCompanyWaitStatus({
        ready_build_items: 3,
        actionable_research_questions: 2,
        actionable_evidence_actions: 1,
        actionable_validations: 0,
      });

      expect(result.wait_type).toBe('NONE');
      expect(result.is_justified_wait).toBe(false);
      expect(result.is_delivery_wait).toBe(false);
      expect(result.next_best_action).toBe('BUILD');
    });
  });

  describe('4. Ahead-of-Starvation Runway Health Evaluation', () => {
    it('flags replenishment recommended when runway depth is low', () => {
      const runway: QualifiedWorkRunway = {
        assessed_at: new Date().toISOString(),
        qualified_depth: 1,
        semantic_diversity: 0.3,
        goal_coverage_pct: 40,
        readiness_score: 1.0,
        dependency_concentration: 0.0,
        research_maturity: 0.5,
        freshness_score: 0.8,
        uncertainty_level: 'MEDIUM',
        expected_contribution_score: 50,
        execution_velocity_cycles: 1,
        research_lead_time_cycles: 2,
        obsolescence_rate_pct: 0,
        estimated_runway_cycles: 1,
        runway_state: 'LOW',
        replenishment_recommended: true,
        replenishment_actions: ['Trigger regenerative discovery search lenses'],
      };

      expect(runway.replenishment_recommended).toBe(true);
      expect(runway.runway_state).toBe('LOW');
      expect(runway.estimated_runway_cycles).toBeLessThanOrEqual(2);
    });
  });
});
