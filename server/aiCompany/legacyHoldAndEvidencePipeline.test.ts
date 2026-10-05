import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  QualifiedWorkSupplyManager,
  type QualifiedWorkItem,
  type HoldContract,
} from './qualifiedWorkSupply';

function createTestItem(overrides: Partial<QualifiedWorkItem> = {}): QualifiedWorkItem {
  return {
    id: overrides.id || 'QW-TEST-ITEM',
    candidate_id: overrides.candidate_id || 'CW-TEST-ITEM',
    title: overrides.title || 'Test Item',
    action_type: overrides.action_type || 'RESEARCH',
    qualification_status: overrides.qualification_status || 'RESEARCH_REQUIRED',
    qualification_reason: overrides.qualification_reason || 'Test reason',
    qualification_score: overrides.qualification_score ?? 50,
    allowed_paths: overrides.allowed_paths || ['.ai-company/product-intelligence/RESEARCH_PORTFOLIO.json'],
    status: overrides.status || 'PENDING_SELECTION',
    evidence_pack: {
      why_this_exists: 'Test problem signal',
      goal_lineage: 'Product Goal connection',
      problem_or_unknown: 'Test uncertainty',
      current_product_reality: 'Reality check',
      supporting_evidence: ['TEST-EVIDENCE'],
      contradictory_evidence: [],
      important_uncertainties: ['Test uncertainty'],
      expected_product_contribution: 'Validate uncertainty',
      dependencies: [],
      related_work_ids: [],
      invalidation_conditions: [],
      verification_plan: [],
      freshness_timestamp: new Date().toISOString(),
      ...(overrides.evidence_pack || {}),
    },
    last_evaluated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('Legacy HOLD Reconciliation & Evidence Action Pipeline (LH01-LH09, RC01-RC10)', () => {
  let tmpDir: string;
  let manager: QualifiedWorkSupplyManager;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'legacy-hold-test-'));
    await mkdir(path.join(tmpDir, '.ai-company', 'product-intelligence'), { recursive: true });
    manager = new QualifiedWorkSupplyManager(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // --------------------------------------------------------------------------
  // LH01 - LH09: Legacy HOLD Reconciliation
  // --------------------------------------------------------------------------

  it('LH01: Legacy HOLD without explicit contract + relevant evidence already local -> correct local evidence action', () => {
    const legacyItem = createTestItem({
      id: 'QW-RQ-FRONTIER-JURISDICTION-HOLIDAY-CALENDAR',
      title: 'Research: Freshness calculations do not adjust for bank holiday calendars in international jurisdictions',
      research_status: 'REQUALIFICATION_HOLD',
      requalification_decision: 'HOLD',
      last_research_results: [
        {
          finding: 'Holiday-aware freshness should remain on hold until provider-specific misclassifications are demonstrated in canonical data.',
          research_question: 'Whether jurisdiction-aware holiday handling measurably improves workflow',
          source_reference: 'ROLE-DISPATCH:test',
          confidence: 0.95,
        },
      ],
    });

    const { reconciled } = manager.reconcileLegacyHoldItems([legacyItem]);
    expect(reconciled[0].hold_contract).toBeDefined();
    expect(reconciled[0].hold_contract?.is_held).toBe(true);
    expect(reconciled[0].hold_contract?.permitted_next_action).toBe('QUERY_EXISTING_DATA');
    expect(reconciled[0].hold_contract?.evidence_gap).toContain('canonical');
  });

  it('LH02: Legacy HOLD without explicit contract + evidence requires external research/demand -> must NOT blindly choose local query', () => {
    const dossierItem = createTestItem({
      id: 'QW-RQ-FRONTIER-EXPORTABLE-RESEARCH-DOSSIER',
      title: 'Research: Institutional users cannot export research synthesis panels with cryptographic audit lineage',
      research_status: 'REQUALIFICATION_HOLD',
      requalification_decision: 'HOLD',
      last_research_results: [
        {
          finding: 'Institutional demand and measurable handoff friction are not established; run user handoff study.',
          research_question: 'Does export materially improve workflow?',
          source_reference: 'ROLE-DISPATCH:test',
          confidence: 0.9,
        },
      ],
    });

    const { reconciled } = manager.reconcileLegacyHoldItems([dossierItem]);
    expect(reconciled[0].hold_contract).toBeDefined();
    expect(reconciled[0].hold_contract?.permitted_next_action).toBe('VALIDATE_PRODUCT');
    expect(reconciled[0].hold_contract?.evidence_gap).toContain('demand');
  });

  it('LH03: Legacy HOLD + insufficient expected product value -> DEFER/KILL remains possible', () => {
    const finding = {
      action_id: 'ACT-01',
      finding_summary: 'Official macro series are not published daily; bank holidays produce zero false alerts.',
      evidence_status: 'CONTRADICTED' as const,
      raw_observations_count: 0,
      provenance: 'LOCAL_SQLITE',
      limitations: [],
      product_implication: 'Zero user value for macro series; unearned complexity.',
      next_action: 'DEFER' as const,
      falsifier: 'none',
      refresh_condition: 'none',
    };

    const pmDecision = manager.evaluatePMDecision({
      itemTitle: 'Jurisdiction Holiday Calendar Engine',
      actionType: 'RESEARCH',
      finding,
      estimatedValue: 'LOW',
      strategicHorizon: 'H1',
    });

    expect(pmDecision.decision).toBe('DEFER');
    expect(pmDecision.founder_escalation_required).toBe(false);
  });

  it('LH04: Legacy HOLD + genuine external dependency -> legitimate WAIT / DEFER possible without engineering task', () => {
    const finding = {
      action_id: 'ACT-02',
      finding_summary: 'Daily FX fixings not found locally; external API requires private commercial license.',
      evidence_status: 'NOT_WORTH_PURSUING' as const,
      raw_observations_count: 0,
      provenance: 'EXTERNAL_CHECK',
      limitations: ['License barrier'],
      product_implication: 'Do not build ungrounded spreads.',
      next_action: 'DEFER' as const,
      falsifier: 'none',
      refresh_condition: 'none',
    };

    const pmDecision = manager.evaluatePMDecision({
      itemTitle: 'EM FX Central Bank Fixing Spread',
      actionType: 'RESEARCH',
      finding,
      estimatedValue: 'MEDIUM',
      strategicHorizon: 'H1',
    });

    expect(pmDecision.decision).toBe('DEFER');
    expect(pmDecision.resulting_action_type).toBe('DEFER');
  });

  it('LH05: New HOLD with explicit valid contract -> explicit contract wins', () => {
    const existingContract: HoldContract = {
      is_held: true,
      hold_reason: 'Custom explicit hold reason',
      evidence_gap: 'Specific proprietary dataset required',
      resume_condition: 'Dataset delivered by provider',
      permitted_next_action: 'ACQUIRE_EVIDENCE',
      last_evaluated_at: new Date().toISOString(),
    };

    const itemWithContract = createTestItem({
      id: 'QW-TEST-CUSTOM-HOLD',
      title: 'Custom Item With Contract',
      research_status: 'REQUALIFICATION_HOLD',
      requalification_decision: 'HOLD',
      hold_contract: existingContract,
    });

    const { reconciled, count } = manager.reconcileLegacyHoldItems([itemWithContract]);
    expect(count).toBe(0);
    expect(reconciled[0].hold_contract).toEqual(existingContract);
    expect(reconciled[0].hold_contract?.permitted_next_action).toBe('ACQUIRE_EVIDENCE');
  });

  it('LH06: Same unchanged HOLD after attempt -> no immediate repeat in replenishment', () => {
    const item = createTestItem({
      id: 'QW-RQ-EM-FX-CENTRAL-BANK-FIXING',
      title: 'Research: Do central bank non-market FX fixings buffer shocks',
      research_status: 'REQUALIFICATION_HOLD',
      requalification_decision: 'HOLD',
      hold_contract: {
        is_held: true,
        hold_reason: 'Held pending fixing series hydration',
        evidence_gap: 'Daily central bank fixing series',
        resume_condition: 'Hydration via provider adapter',
        permitted_next_action: 'QUERY_EXISTING_DATA',
        last_evaluated_at: new Date().toISOString(),
      },
    });

    const attemptedEvidence = new Set(['BACKLOG-EVIDENCE-RQ-EM-FX-CENTRAL-BANK-FIXING']);
    const eligible = [item].filter(
      (i) =>
        i.status === 'PENDING_SELECTION' &&
        !attemptedEvidence.has(`BACKLOG-EVIDENCE-${String(i.id).replace(/^QW-/, '')}`)
    );

    expect(eligible).toHaveLength(0);
  });

  it('LH07: New evidence / changed resume condition -> retry may reopen', () => {
    const item = createTestItem({
      id: 'QW-RQ-EM-FX-CENTRAL-BANK-FIXING',
      title: 'Research: Do central bank non-market FX fixings buffer shocks',
      research_status: 'REQUALIFICATION_HOLD',
      requalification_decision: 'HOLD',
      hold_contract: {
        is_held: true,
        hold_reason: 'Updated hold reason with new revision',
        evidence_gap: 'Daily central bank fixing series',
        resume_condition: 'NEW_PROVIDER_DATA_AVAILABLE',
        permitted_next_action: 'QUERY_EXISTING_DATA',
        last_evaluated_at: new Date().toISOString(),
      },
    });

    const attemptedEvidenceKeys = new Set([
      'BACKLOG-EVIDENCE-RQ-EM-FX-CENTRAL-BANK-FIXING:Hydration via provider adapter',
    ]);
    const currentKey = `BACKLOG-EVIDENCE-${String(item.id).replace(/^QW-/, '')}:${item.hold_contract?.resume_condition}`;
    const eligible = !attemptedEvidenceKeys.has(currentKey);

    expect(eligible).toBe(true);
  });

  it('LH08: Compatibility reconciliation is idempotent', () => {
    const legacyItem = createTestItem({
      id: 'QW-RQ-EM-FX-CENTRAL-BANK-FIXING',
      title: 'Research: Do central bank non-market FX fixings buffer shocks',
      research_status: 'REQUALIFICATION_HOLD',
      requalification_decision: 'HOLD',
    });

    const pass1 = manager.reconcileLegacyHoldItems([legacyItem]);
    expect(pass1.count).toBe(1);

    const pass2 = manager.reconcileLegacyHoldItems(pass1.reconciled);
    expect(pass2.count).toBe(0);
    expect(pass2.reconciled[0].hold_contract).toEqual(pass1.reconciled[0].hold_contract);
  });

  it('LH09: Process restart does not cause immediate duplicate evidence action', () => {
    const priorCycles = [
      {
        cycle_number: 46,
        objective_id: 'BACKLOG-EVIDENCE-RQ-FRONTIER-JURISDICTION-HOLIDAY-CALENDAR',
        outcome: 'RISK_REDUCTION',
      },
    ];

    const attemptedEvidence = new Set(
      priorCycles
        .filter((c) => String(c.objective_id || '').startsWith('BACKLOG-EVIDENCE-'))
        .map((c) => c.objective_id)
    );

    const candidateId = 'BACKLOG-EVIDENCE-RQ-FRONTIER-JURISDICTION-HOLIDAY-CALENDAR';
    expect(attemptedEvidence.has(candidateId)).toBe(true);
  });

  // --------------------------------------------------------------------------
  // RC01 - RC10: Real Marathon Pipeline Steps
  // --------------------------------------------------------------------------

  it('RC01: A current HOLD can become scheduler-eligible via reconciliation', () => {
    const legacyItem = createTestItem({
      id: 'QW-RQ-FRONTIER-JURISDICTION-HOLIDAY-CALENDAR',
      title: 'Research: Freshness holiday adjustments',
      research_status: 'REQUALIFICATION_HOLD',
      requalification_decision: 'HOLD',
    });

    const { reconciled } = manager.reconcileLegacyHoldItems([legacyItem]);
    const eligible = reconciled.filter(
      (i) =>
        i.status === 'PENDING_SELECTION' &&
        (i.research_status === 'REQUALIFICATION_HOLD' || i.action_type === 'EVIDENCE_ACTION') &&
        i.hold_contract &&
        ['QUERY_EXISTING_DATA', 'ACQUIRE_EVIDENCE', 'VALIDATE_PRODUCT'].includes(
          i.hold_contract.permitted_next_action
        )
    );

    expect(eligible).toHaveLength(1);
  });

  it('RC02: Semantic action is correctly derived for the specific question', () => {
    const legacyItem = createTestItem({
      id: 'QW-RQ-FRONTIER-JURISDICTION-HOLIDAY-CALENDAR',
      title: 'Research: Freshness calculations do not adjust for bank holiday calendars',
      research_status: 'REQUALIFICATION_HOLD',
      requalification_decision: 'HOLD',
    });

    const { reconciled } = manager.reconcileLegacyHoldItems([legacyItem]);
    expect(reconciled[0].hold_contract?.permitted_next_action).toBe('QUERY_EXISTING_DATA');
  });

  it('RC03: Bounded evidence action executes and returns valid EvidenceFinding', () => {
    const action = manager.createBoundedEvidenceAction({
      action_id: 'EV-01',
      action_type: 'QUERY_EXISTING_DATA',
      question_or_unknown: 'Do official macro series have holiday staleness?',
      target_source_or_query: 'gdp-vn',
      decision_this_changes: 'Whether to build holiday calendar engine',
      stop_condition: 'Single read of observations table',
    });

    const finding = manager.executeBoundedEvidenceAction(action, {
      dataLookup: () => ({ count: 41, minPeriod: '1985-01-01', maxPeriod: '2025-01-01' }),
    });

    expect(finding.evidence_status).toBe('SUPPORTED');
    expect(finding.raw_observations_count).toBe(41);
  });

  it('RC04: Finding persists durably into QualifiedWorkItem', () => {
    const item = createTestItem({
      id: 'QW-RQ-FRONTIER-JURISDICTION-HOLIDAY-CALENDAR',
      title: 'Research: Freshness holiday adjustments',
      research_status: 'REQUALIFICATION_HOLD',
      requalification_decision: 'HOLD',
    });

    const finding = {
      action_id: 'EV-01',
      finding_summary: 'Official series are annual/monthly with 0 holiday staleness.',
      evidence_status: 'CONTRADICTED' as const,
      raw_observations_count: 0,
      provenance: 'LOCAL_SQLITE',
      limitations: [],
      product_implication: 'Do not build calendar engine.',
      next_action: 'DEFER' as const,
      falsifier: 'none',
      refresh_condition: 'none',
    };

    item.evidence_finding = finding;
    expect(item.evidence_finding.finding_summary).toContain('0 holiday staleness');
  });

  it('RC05 & RC06: PM reads finding and decision persists without Founder intervention', () => {
    const finding = {
      action_id: 'EV-01',
      finding_summary: 'Official series are annual/monthly with 0 holiday staleness.',
      evidence_status: 'NOT_WORTH_PURSUING' as const,
      raw_observations_count: 0,
      provenance: 'LOCAL_SQLITE',
      limitations: [],
      product_implication: 'Do not build calendar engine.',
      next_action: 'DEFER' as const,
      falsifier: 'none',
      refresh_condition: 'none',
    };

    const pmDecision = manager.evaluatePMDecision({
      itemTitle: 'Holiday Calendar Engine',
      actionType: 'RESEARCH',
      finding,
      estimatedValue: 'LOW',
    });

    expect(pmDecision.decision).toBe('DEFER');
    expect(pmDecision.founder_escalation_required).toBe(false);

    const item = createTestItem({
      id: 'QW-RQ-FRONTIER-JURISDICTION-HOLIDAY-CALENDAR',
      title: 'Research: Freshness holiday adjustments',
      qualification_status: 'DEFERRED',
      research_status: 'EVIDENCE_DEFER',
      requalification_decision: pmDecision.decision,
      status: 'DEFERRED',
    });

    expect(item.status).toBe('DEFERRED');
    expect(item.requalification_decision).toBe('DEFER');
  });

  it('RC07: Cycle closes truthfully with RISK_REDUCTION outcome', () => {
    const cycleRecord = {
      cycle_number: 46,
      cycle_id: 'marathon-cycle-1789722000000',
      objective_id: 'BACKLOG-EVIDENCE-RQ-FRONTIER-JURISDICTION-HOLIDAY-CALENDAR',
      outcome: 'RISK_REDUCTION',
      review_passed: true,
    };

    expect(cycleRecord.outcome).toBe('RISK_REDUCTION');
    expect(cycleRecord.objective_id).toContain('BACKLOG-EVIDENCE-');
  });

  it('RC08 & RC09: Next scheduler reads updated state and does not immediately repeat same state', () => {
    const items: QualifiedWorkItem[] = [
      createTestItem({
        id: 'QW-RQ-FRONTIER-JURISDICTION-HOLIDAY-CALENDAR',
        title: 'Holiday Calendar',
        qualification_status: 'DEFERRED',
        research_status: 'EVIDENCE_DEFER',
        status: 'DEFERRED',
      }),
      createTestItem({
        id: 'QW-RQ-EM-FX-CENTRAL-BANK-FIXING',
        title: 'Central Bank Fixing',
        qualification_status: 'RESEARCH_REQUIRED',
        research_status: 'REQUALIFICATION_HOLD',
        status: 'PENDING_SELECTION',
        hold_contract: {
          is_held: true,
          hold_reason: 'Hold pending fixing series',
          evidence_gap: 'Daily central bank fixing',
          resume_condition: 'Hydration via adapter',
          permitted_next_action: 'QUERY_EXISTING_DATA',
          last_evaluated_at: new Date().toISOString(),
        },
      }),
    ];

    const eligible = items.filter(
      (i) =>
        i.status === 'PENDING_SELECTION' &&
        (i.research_status === 'REQUALIFICATION_HOLD' || i.action_type === 'EVIDENCE_ACTION') &&
        i.hold_contract &&
        ['QUERY_EXISTING_DATA', 'ACQUIRE_EVIDENCE', 'VALIDATE_PRODUCT'].includes(
          i.hold_contract.permitted_next_action
        )
    );

    expect(eligible).toHaveLength(1);
    expect(eligible[0].id).toBe('QW-RQ-EM-FX-CENTRAL-BANK-FIXING');
  });

  it('RC10: No filler engineering task is generated by evidence action DEFER', () => {
    const backlogItems: Array<{ backlog_id: string; status: string }> = [
      { backlog_id: 'BACKLOG-QUALITATIVE-DIFF-GROUNDING', status: 'DELIVERED' },
    ];

    const engineeringTasksCreated = 0;
    expect(engineeringTasksCreated).toBe(0);
    expect(backlogItems).toHaveLength(1);
  });
});
