import { describe, expect, it } from 'vitest';
import {
  buildCanonicalSnapshot,
  renderShadowProjections,
  validateClaimCeiling,
  validateConsistency,
  shadowAuditAndPublish,
  type CanonicalSnapshot,
} from './truthProjection';

describe('Deterministic Truth Projection Engine', () => {
  it('T01: builds canonical snapshot from current repository state', async () => {
    const root = process.cwd();
    const snapshot = await buildCanonicalSnapshot(root);

    expect(snapshot.verified_cycle_count).toBeGreaterThanOrEqual(0);
    expect(snapshot.current_cycle_number).toBe(snapshot.verified_cycle_count + 1);
    expect(snapshot.last_completed_cycle).toBe(snapshot.verified_cycle_count);
    expect(snapshot.current_objective).toBe(snapshot.marathon_state.current_objective || 'BACKLOG-INDICATOR-FRESHNESS-COVERAGE');
    expect(snapshot.resource_visibility.capability).toBe('ERROR_ONLY_RESOURCE_SIGNAL');
    expect(snapshot.resource_visibility.status).toBe('UNKNOWN / ERROR_ONLY_RESOURCE_SIGNAL');
    expect(snapshot.resource_visibility.remaining).toBe('UNKNOWN');
  });

  it('T02: renders all 7 Control Pack projections without drift', async () => {
    const root = process.cwd();
    const snapshot = await buildCanonicalSnapshot(root);
    const projections = renderShadowProjections(snapshot);

    const keys = Object.keys(projections);
    expect(keys).toContain('AI_COMPANY_DASHBOARD.md');
    expect(keys).toContain('RESOURCE_STATUS.md');
    expect(keys).toContain('CURRENT_CYCLE.md');
    expect(keys).toContain('REVIEW_LATEST.md');
    expect(keys).toContain('OPERATING_PLAN.md');
    expect(keys).toContain('SYSTEM_IMPROVEMENT_LEDGER.md');
    expect(keys).toContain('reports/marathon/INDEX.md');
  });

  it('T03: validates consistency and claim ceiling for canonical snapshot projections', async () => {
    const root = process.cwd();
    const snapshot = await buildCanonicalSnapshot(root);
    const projections = renderShadowProjections(snapshot);

    const claimAudit = validateClaimCeiling(snapshot, projections);
    expect(claimAudit.valid).toBe(true);
    expect(claimAudit.errors).toEqual([]);

    const consistencyAudit = validateConsistency(snapshot, projections);
    expect(consistencyAudit.valid).toBe(true);
    expect(consistencyAudit.errors).toEqual([]);
  });

  it('T04: enforces C01 & C02 monotonic cycle numbering', async () => {
    const root = process.cwd();
    const snapshot = await buildCanonicalSnapshot(root);
    const projections = renderShadowProjections(snapshot);

    expect(projections['AI_COMPANY_DASHBOARD.md']).toContain(`Verified Cycle: ${snapshot.verified_cycle_count}`);
    expect(projections['AI_COMPANY_DASHBOARD.md']).toContain(`Current Cycle: ${snapshot.current_cycle_number}`);
    expect(projections['OPERATING_PLAN.md']).toContain(`Verified Cycles: ${snapshot.verified_cycle_count}`);
    expect(projections['OPERATING_PLAN.md']).toContain(`Current Cycle: ${snapshot.current_cycle_number}`);
    expect(projections['CURRENT_CYCLE.md']).toContain(`Marathon Cycle ${snapshot.current_cycle_number}`);
  });

  it('T05: enforces C03 current objective alignment across all documents', async () => {
    const root = process.cwd();
    const snapshot = await buildCanonicalSnapshot(root);
    const projections = renderShadowProjections(snapshot);

    const obj = snapshot.current_objective;
    expect(projections['AI_COMPANY_DASHBOARD.md']).toContain(obj);
    expect(projections['OPERATING_PLAN.md']).toContain(obj);
    expect(projections['CURRENT_CYCLE.md']).toContain(obj);
  });

  it('T06: enforces C05 REVIEW_LATEST targets latest completed cycle', async () => {
    const root = process.cwd();
    const snapshot = await buildCanonicalSnapshot(root);
    const projections = renderShadowProjections(snapshot);

    expect(projections['REVIEW_LATEST.md']).toContain(`Cycle ${snapshot.last_completed_cycle}`);
    if (snapshot.latest_cycle) expect(projections['REVIEW_LATEST.md']).toContain(snapshot.latest_cycle.objective_id);
  });

  it('T07: enforces C07 claim ceiling — zero HEALTHY_VERIFIED under ERROR_ONLY_RESOURCE_SIGNAL', async () => {
    const root = process.cwd();
    const snapshot = await buildCanonicalSnapshot(root);
    const projections = renderShadowProjections(snapshot);

    for (const [name, content] of Object.entries(projections)) {
      expect(content, `${name} should not claim HEALTHY_VERIFIED`).not.toMatch(/Provider Resource State:\s*HEALTHY_VERIFIED/);
      expect(content, `${name} should not claim HEALTHY_VERIFIED`).not.toMatch(/Resource Status:\s*HEALTHY_VERIFIED/);
    }
  });

  it('T08: enforces C08 & C09 — never reports numeric 0 for unmeasured tokens or remaining quota', async () => {
    const root = process.cwd();
    const snapshot = await buildCanonicalSnapshot(root);
    const projections = renderShadowProjections(snapshot);

    for (const [name, content] of Object.entries(projections)) {
      expect(content, `${name} should not have remaining 0`).not.toMatch(/Remaining:\s*0\b/);
      expect(content, `${name} should not have 0 actual tokens`).not.toMatch(/0 actual/);
    }
  });

  it('T09: enforces C10 — concurrency limit is not conflated with token budget', async () => {
    const root = process.cwd();
    const snapshot = await buildCanonicalSnapshot(root);
    const projections = renderShadowProjections(snapshot);

    expect(projections['RESOURCE_STATUS.md']).toContain('distinct from token budget');
  });

  it('T10: enforces C12 — System Improvement statuses reflect non-final state', async () => {
    const root = process.cwd();
    const snapshot = await buildCanonicalSnapshot(root);
    const projections = renderShadowProjections(snapshot);

    expect(projections['SYSTEM_IMPROVEMENT_LEDGER.md']).toContain('SI-006');
    expect(projections['SYSTEM_IMPROVEMENT_LEDGER.md']).toContain('`IMPLEMENTED_UNVALIDATED`');
    expect(projections['SYSTEM_IMPROVEMENT_LEDGER.md']).toContain('0 improvements currently at KEEP/REVISE/REVERT status');
  });

  it('T11: enforces C14 — no 100% Antigravity claim across mixed executor history', async () => {
    const root = process.cwd();
    const snapshot = await buildCanonicalSnapshot(root);
    const projections = renderShadowProjections(snapshot);

    for (const [name, content] of Object.entries(projections)) {
      expect(content, `${name} should not claim 100% Antigravity across mixed history`).not.toContain('100% Antigravity host cognition path verified');
    }
  });

  it('T12: enforces C16 & C17 — source revision and timestamp consistency', async () => {
    const root = process.cwd();
    const snapshot = await buildCanonicalSnapshot(root);
    const projections = renderShadowProjections(snapshot);

    for (const [name, content] of Object.entries(projections)) {
      expect(content, `${name} should contain matching timestamp`).toContain(snapshot.timestamp);
      if (name !== 'SYSTEM_IMPROVEMENT_LEDGER.md' && name !== 'reports/marathon/INDEX.md') {
        expect(content, `${name} should contain matching revision`).toContain(snapshot.revision);
      }
    }
  });

  it('T13: renders live waiting state and latest non-accept review without hardcoded drift', () => {
    const snapshot = {
      timestamp: '2026-09-17T10:00:00.000Z',
      revision: 'REV-MARATHON-0039',
      last_event_id: 'EVT-CYCLE-038-VERIFIED',
      marathon_state: {
        marathon_status: 'MARATHON_WAITING_SCHEDULE',
        current_operation: null,
        current_wait_state: 'JUSTIFIED_WAIT',
        next_safe_action: 'WAIT_FOR_RELEVANT_ELIGIBILITY_CHANGE',
        current_objective: 'BACKLOG-REQUALIFY-COMPOSITE-LIQUIDITY-RESEARCH',
        current_cycle_id: 'marathon-cycle-39',
      },
      cycles: [],
      verified_cycle_count: 38,
      current_cycle_number: 39,
      last_completed_cycle: 38,
      latest_cycle: {
        cycle_number: 38,
        objective_id: 'BACKLOG-REQUALIFY-COMPOSITE-LIQUIDITY-RESEARCH',
        outcome: 'RISK_REDUCTION',
        review: { verdict: 'REVISE', summary: 'Product outcome remains blocked.' },
      },
      current_objective: 'BACKLOG-REQUALIFY-COMPOSITE-LIQUIDITY-RESEARCH',
      is_maintenance_hold: false,
      maintenance_lease: null,
      queue_summary: { total: 0, byState: {}, active: [] },
      resource_visibility: { capability: 'ERROR_ONLY_RESOURCE_SIGNAL', status: 'UNKNOWN / ERROR_ONLY_RESOURCE_SIGNAL', remaining: 'UNKNOWN', reset_at: 'UNKNOWN', evidence_ceiling: 'REACTIVE_ONLY', evidence_source: 'test' },
      system_improvements: [],
      product_intelligence: { inventory_total: 6, qualified_depth: 0, active_commitments: 0, runway_state: 'STARVATION_RISK', estimated_runway_cycles: 0, goal_coverage_pct: 100, strategic_optionality_ratio: '0:0 (NO_ACTIVE_COMMITMENT_VERIFIED)', evidence_source: 'test' },
    } as any;

    const projections = renderShadowProjections(snapshot);
    expect(projections['AI_COMPANY_DASHBOARD.md']).toContain('Current Operation: JUSTIFIED_WAIT');
    expect(projections['AI_COMPANY_DASHBOARD.md']).toContain('Working / Waiting / Recovering: WAITING');
    expect(projections['RESOURCE_STATUS.md']).toContain('Waiting: true');
    expect(projections['CURRENT_CYCLE.md']).toContain('WAIT STATE** | JUSTIFIED_WAIT');
    expect(projections['REVIEW_LATEST.md']).toContain('**`REVISE`**');
    expect(projections['REVIEW_LATEST.md']).not.toContain('**`ACCEPT`**');
    expect(projections['OPERATING_PLAN.md']).toContain('Marathon Status: MARATHON_WAITING_SCHEDULE');
  });

  // Negative Test Fixtures (Cases A - G)
  it('Case A [Negative]: detects cycle number mismatch between snapshot and projection', () => {
    const mockSnapshot: CanonicalSnapshot = {
      timestamp: '2026-09-16T12:00:00.000Z',
      revision: 'REV-0017',
      last_event_id: 'EVT-016',
      marathon_state: {} as any,
      cycles: [],
      verified_cycle_count: 16,
      current_cycle_number: 17,
      last_completed_cycle: 16,
      latest_cycle: null,
      current_objective: 'BACKLOG-INDICATOR-FRESHNESS-COVERAGE',
      is_maintenance_hold: false,
      maintenance_lease: null,
      queue_summary: { total: 0, byState: {}, active: [] },
      resource_visibility: {
        capability: 'ERROR_ONLY_RESOURCE_SIGNAL',
        status: 'UNKNOWN / ERROR_ONLY_RESOURCE_SIGNAL',
        remaining: 'UNKNOWN',
        reset_at: 'UNKNOWN',
        retry_not_before: 'UNKNOWN',
        evidence_ceiling: 'REACTIVE_ONLY',
        evidence_source: 'test',
      },
      system_improvements: [],
    };

    const badProjections = {
      'AI_COMPANY_DASHBOARD.md': 'Verified Cycle: 10\nCurrent Cycle: 11\nUpdated At: 2026-09-16T12:00:00.000Z\nREV-0017\nBACKLOG-INDICATOR-FRESHNESS-COVERAGE',
    };

    const audit = validateConsistency(mockSnapshot, badProjections);
    expect(audit.valid).toBe(false);
    expect(audit.errors.some((e) => e.includes('does not state verified cycle count 16'))).toBe(true);
    expect(audit.errors.some((e) => e.includes('does not reference current cycle number 17'))).toBe(true);
  });

  it('Case B [Negative]: detects ERROR_ONLY claim overreach (HEALTHY_VERIFIED)', () => {
    const mockSnapshot = {
      resource_visibility: { capability: 'ERROR_ONLY_RESOURCE_SIGNAL' },
    } as any;

    const badProjections = {
      'AI_COMPANY_DASHBOARD.md': 'Provider Resource State: HEALTHY_VERIFIED',
    };

    const audit = validateClaimCeiling(mockSnapshot, badProjections);
    expect(audit.valid).toBe(false);
    expect(audit.errors.some((e) => e.includes("prohibited claim 'HEALTHY_VERIFIED'"))).toBe(true);
  });

  it('Case C [Negative]: detects unmeasured usage reported as numeric 0', () => {
    const mockSnapshot = {} as any;
    const badProjections = {
      'RESOURCE_STATUS.md': 'Remaining: 0\nTokens Consumed (Actual / Est): 0 actual / 226000 estimated',
    };

    const audit = validateClaimCeiling(mockSnapshot, badProjections);
    expect(audit.valid).toBe(false);
    expect(audit.errors.some((e) => e.includes('numeric 0 for unmeasured remaining quota'))).toBe(true);
    expect(audit.errors.some((e) => e.includes("'0 actual' tokens for unmeasured provider consumption"))).toBe(true);
  });

  it('Case D [Negative]: detects premature KEEP status in System Improvement Ledger', () => {
    const mockSnapshot: CanonicalSnapshot = {
      timestamp: '2026-09-16T12:00:00.000Z',
      revision: 'REV-0017',
      last_event_id: 'EVT-016',
      marathon_state: {} as any,
      cycles: [],
      verified_cycle_count: 16,
      current_cycle_number: 17,
      last_completed_cycle: 16,
      latest_cycle: null,
      current_objective: 'BACKLOG-INDICATOR-FRESHNESS-COVERAGE',
      is_maintenance_hold: false,
      maintenance_lease: null,
      queue_summary: { total: 0, byState: {}, active: [] },
      resource_visibility: {} as any,
      system_improvements: [
        {
          id: 'SI-999',
          title: 'Fake Improvement',
          status: 'KEEP',
        } as any,
      ],
    };

    const projections = {
      'SYSTEM_IMPROVEMENT_LEDGER.md': 'Updated At: 2026-09-16T12:00:00.000Z',
    };

    const audit = validateConsistency(mockSnapshot, projections);
    expect(audit.valid).toBe(false);
    expect(audit.errors.some((e) => e.includes('marked KEEP without validated multi-cycle evidence'))).toBe(true);
  });

  it('Case E [Negative]: detects false 100% Antigravity claim across mixed executor history', () => {
    const mockSnapshot = {} as any;
    const badProjections = {
      'OPERATING_PLAN.md': '100% Antigravity host cognition path verified. Zero unapproved provider switches.',
    };

    const audit = validateConsistency(mockSnapshot, badProjections);
    expect(audit.valid).toBe(false);
    expect(audit.errors.some((e) => e.includes('claims 100% Antigravity across mixed executor history'))).toBe(true);
  });

  it('Case F [Negative]: detects wait state drift when waiting is false but active resume conditions remain', () => {
    const mockSnapshot = {
      timestamp: '2026-09-16T12:00:00.000Z',
      revision: 'REV-0017',
      verified_cycle_count: 16,
      current_cycle_number: 17,
      current_objective: 'TEST',
      last_completed_cycle: 16,
      system_improvements: [],
    } as any;

    const badProjections = {
      'RESOURCE_STATUS.md': 'Waiting: false\nResume Condition: IMMEDIATE\nUpdated At: 2026-09-16T12:00:00.000Z\nREV-0017',
    };

    const audit = validateConsistency(mockSnapshot, badProjections);
    expect(audit.valid).toBe(false);
    expect(audit.errors.some((e) => e.includes('has waiting: false but contains active Resume Condition'))).toBe(true);
  });

  it('Case G [Negative]: detects objective mismatch across documents', () => {
    const mockSnapshot = {
      timestamp: '2026-09-16T12:00:00.000Z',
      revision: 'REV-0017',
      verified_cycle_count: 16,
      current_cycle_number: 17,
      current_objective: 'BACKLOG-INDICATOR-FRESHNESS-COVERAGE',
      last_completed_cycle: 16,
      system_improvements: [],
    } as any;

    const badProjections = {
      'AI_COMPANY_DASHBOARD.md': 'Verified Cycle: 16\nCurrent Cycle: 17\nCurrent Objective: WRONG-OBJECTIVE\nUpdated At: 2026-09-16T12:00:00.000Z\nREV-0017',
    };

    const audit = validateConsistency(mockSnapshot, badProjections);
    expect(audit.valid).toBe(false);
    expect(audit.errors.some((e) => e.includes("does not reference current objective 'BACKLOG-INDICATOR-FRESHNESS-COVERAGE'"))).toBe(true);
  });
});
