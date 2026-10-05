import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MarathonStateManager, MarathonCycleRecord } from './marathonState';

describe('MarathonStateManager', () => {
  let tempDir: string;
  let manager: MarathonStateManager;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'marathon-state-test-'));
    manager = new MarathonStateManager(tempDir, 'TEST-MARATHON-01');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('initializes default marathon state with ANTIGRAVITY executor and 0 verified cycles', async () => {
    const state = await manager.initializeOrLoad();
    expect(state.marathon_status).toBe('MARATHON_RUNNING');
    expect(state.selected_executor).toBe('ANTIGRAVITY');
    expect(state.verified_company_cycle_number).toBe(0);
    expect(state.current_cycle_number).toBe(1);
    expect(state.next_report_at_cycle).toBe(10);
  });

  it('records verified cycles monotonically and updates marathon state', async () => {
    await manager.initializeOrLoad();

    const sampleCycle: MarathonCycleRecord = {
      cycle_number: 1,
      cycle_id: 'marathon-cycle-1',
      marathon_id: 'TEST-MARATHON-01',
      parent_goal_id: 'Macro OS Product Excellence',
      objective_id: 'BACKLOG-PROVIDER-INGESTION-CADENCE',
      start_time: new Date().toISOString(),
      end_time: new Date().toISOString(),
      start_product_state: { routes: 27 },
      next_best_action: 'BUILD',
      why_selected: 'High priority backlog item',
      pm_result: 'APPROVED',
      authorized_work: 'Implement adaptive ingestion cadence',
      executor: 'ANTIGRAVITY',
      operations: [
        { role: 'pm', action: 'groom', status: 'DONE' },
        { role: 'backend-engineer', action: 'implement', status: 'DONE' },
        { role: 'functional-qa', action: 'verify', status: 'DONE' },
      ],
      execution_result: { files_changed: ['server/scheduler.ts'] },
      review: { verdict: 'PASS', summary: 'All tests pass', evidence: ['test_passed'] },
      outcome: 'DELIVERY_PROGRESS',
      learning: 'Provider cadence derives cleanly from publication frequency',
      decision_delta: 'Apply same cadence model to emerging markets',
      system_friction: {
        right_work_selected: 'Yes',
        founder_intervention_needed: 'No',
        review_useful: 'Yes',
      },
      end_product_state: { routes: 27, cadence_configured: true },
      next_continuation: 'START_CYCLE_2',
      founder_intervention: {
        count: 0,
        required_by_policy: 0,
        required_by_missing_capability: 0,
        details: [],
      },
      resource_event: {
        invocations: 3,
        tokens_actual: 45000,
        tokens_estimated: 50000,
        latency_ms: 12000,
        quota_pauses: 0,
      },
      evidence_level: 'LOCAL_RUNTIME_PROVEN',
    };

    await manager.recordCycleClose(sampleCycle);

    const updatedState = await manager.initializeOrLoad();
    expect(updatedState.verified_company_cycle_number).toBe(1);
    expect(updatedState.current_cycle_number).toBe(2);
    expect(updatedState.last_completed_cycle).toBe(1);

    const allCycles = await manager.readAllCycles();
    expect(allCycles.length).toBe(1);
    expect(allCycles[0].cycle_id).toBe('marathon-cycle-1');
  });

  it('generates a 10-cycle forensic report adhering to adversarial requirements', async () => {
    await manager.initializeOrLoad();

    for (let i = 1; i <= 10; i++) {
      const cycle: MarathonCycleRecord = {
        cycle_number: i,
        cycle_id: `marathon-cycle-${i}`,
        marathon_id: 'TEST-MARATHON-01',
        parent_goal_id: 'Macro OS Product Excellence',
        objective_id: `BACKLOG-ITEM-${i}`,
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
        start_product_state: {},
        next_best_action: 'BUILD',
        why_selected: 'Test queue',
        pm_result: 'APPROVED',
        authorized_work: `Task ${i}`,
        executor: 'ANTIGRAVITY',
        operations: [{ role: 'pm', action: 'spec', status: 'DONE' }],
        execution_result: {},
        review: { verdict: 'PASS', summary: 'Pass', evidence: [] },
        outcome: i % 2 === 0 ? 'DELIVERY_PROGRESS' : 'VALUE_PROGRESS',
        learning: `Learning from cycle ${i}`,
        decision_delta: `Delta ${i}`,
        system_friction: {
          right_work_selected: 'Yes',
          founder_intervention_needed: 'No',
        },
        end_product_state: {},
        next_continuation: `START_CYCLE_${i + 1}`,
        founder_intervention: {
          count: 0,
          required_by_policy: 0,
          required_by_missing_capability: 0,
          details: [],
        },
        resource_event: {
          invocations: 1,
          tokens_actual: 10000,
          tokens_estimated: 12000,
          latency_ms: 3000,
          quota_pauses: 0,
        },
        evidence_level: 'LOCAL_RUNTIME_PROVEN',
      };
      await manager.recordCycleClose(cycle);
    }

    const report = await manager.generate10CycleForensicReport(1, 10);
    expect(report.content).toContain('# AI COMPANY MARATHON — 10-CYCLE FORENSIC REPORT');
    expect(report.content).toContain('Selected Executor:** `ANTIGRAVITY`');
    expect(report.content).toContain('Executive Summary');
    expect(report.content).toContain('Adversarial Claim Audit');
    expect(report.content).toContain('Top 3 Product Bottlenecks');
    expect(report.content).toContain('Continuation Order');
    expect(report.content).toContain('Marathon Mode advances immediately to Cycle 11');
  });
});
