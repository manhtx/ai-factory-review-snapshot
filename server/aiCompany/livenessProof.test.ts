import { describe, it, expect } from 'vitest';
import {
  LIVENESS_CONTRACTS,
  getContinuationContract,
  resumableContracts,
  terminalContracts,
  validateContract,
  type CompanyState,
} from './livenessProof';

// ── Contract completeness ─────────────────────────────────────────────────────

describe('livenessProof — contract completeness', () => {
  const allStates: CompanyState[] = [
    'QUOTA_EXHAUSTED',
    'PROCESS_DEATH',
    'CRASH',
    'MAC_SLEEP',
    'EMPTY_QUEUE',
    'MANUAL_STOP',
    'CONSECUTIVE_ERRORS',
  ];

  it('has a contract for every declared CompanyState', () => {
    for (const state of allStates) {
      expect(LIVENESS_CONTRACTS[state], `missing contract for ${state}`).toBeDefined();
    }
  });

  it('every contract has all 8 continuation fields non-empty', () => {
    for (const state of allStates) {
      const contract = getContinuationContract(state);
      const { valid, missing } = validateContract(contract);
      expect(valid, `${state} contract missing fields: ${missing.join(', ')}`).toBe(true);
    }
  });

  it('every contract state field matches its map key', () => {
    for (const [key, contract] of Object.entries(LIVENESS_CONTRACTS)) {
      expect(contract.state).toBe(key);
    }
  });
});

// ── Terminality classification ─────────────────────────────────────────────────

describe('livenessProof — terminality', () => {
  it('QUOTA_EXHAUSTED is RESUMABLE', () => {
    expect(getContinuationContract('QUOTA_EXHAUSTED').terminality).toBe('RESUMABLE');
  });

  it('PROCESS_DEATH is RESUMABLE', () => {
    expect(getContinuationContract('PROCESS_DEATH').terminality).toBe('RESUMABLE');
  });

  it('CRASH is RESUMABLE', () => {
    expect(getContinuationContract('CRASH').terminality).toBe('RESUMABLE');
  });

  it('MAC_SLEEP is RESUMABLE', () => {
    expect(getContinuationContract('MAC_SLEEP').terminality).toBe('RESUMABLE');
  });

  it('EMPTY_QUEUE is RESUMABLE', () => {
    expect(getContinuationContract('EMPTY_QUEUE').terminality).toBe('RESUMABLE');
  });

  it('MANUAL_STOP is TERMINAL', () => {
    expect(getContinuationContract('MANUAL_STOP').terminality).toBe('TERMINAL');
  });

  it('CONSECUTIVE_ERRORS is TERMINAL', () => {
    expect(getContinuationContract('CONSECUTIVE_ERRORS').terminality).toBe('TERMINAL');
  });

  it('resumableContracts returns exactly 5 states', () => {
    const resumable = resumableContracts();
    expect(resumable).toHaveLength(5);
    expect(resumable.every((c) => c.terminality === 'RESUMABLE')).toBe(true);
  });

  it('terminalContracts returns exactly 2 states', () => {
    const terminal = terminalContracts();
    expect(terminal).toHaveLength(2);
    expect(terminal.every((c) => c.terminality === 'TERMINAL')).toBe(true);
  });
});

// ── Wake mechanism specifics ───────────────────────────────────────────────────

describe('livenessProof — wake mechanisms', () => {
  it('QUOTA_EXHAUSTED names the supervisor script as wake mechanism', () => {
    const c = getContinuationContract('QUOTA_EXHAUSTED');
    expect(c.wake_mechanism).toContain('ai-company-loop-supervisor.sh');
  });

  it('QUOTA_EXHAUSTED names quota-pause.json as the durable state source', () => {
    const c = getContinuationContract('QUOTA_EXHAUSTED');
    expect(c.resume_from).toContain('quota-pause.json');
  });

  it('PROCESS_DEATH names launchd as the observer', () => {
    const c = getContinuationContract('PROCESS_DEATH');
    expect(c.observer).toContain('launchd');
  });

  it('CRASH names launchd as the observer', () => {
    const c = getContinuationContract('CRASH');
    expect(c.observer).toContain('launchd');
  });

  it('MAC_SLEEP names launchd as the observer', () => {
    const c = getContinuationContract('MAC_SLEEP');
    expect(c.observer).toContain('launchd');
  });

  it('EMPTY_QUEUE names the epoch loop as the observer — not launchd', () => {
    const c = getContinuationContract('EMPTY_QUEUE');
    expect(c.observer).toContain('epoch loop');
    expect(c.observer).not.toContain('launchd');
  });

  it('MANUAL_STOP requires Founder action (human observer)', () => {
    const c = getContinuationContract('MANUAL_STOP');
    expect(c.observer).toContain('Founder');
    expect(c.wake_mechanism).toContain('kickstart');
  });

  it('CONSECUTIVE_ERRORS requires Founder review', () => {
    const c = getContinuationContract('CONSECUTIVE_ERRORS');
    expect(c.observer).toContain('Founder');
  });
});

// ── Reconciliation guard ───────────────────────────────────────────────────────

describe('livenessProof — reconciliation contracts', () => {
  it('every RESUMABLE state specifies a reconciliation step before next action', () => {
    for (const c of resumableContracts()) {
      expect(c.reconciliation.trim().length, `${c.state} has empty reconciliation`).toBeGreaterThan(0);
    }
  });

  it('QUOTA_EXHAUSTED reconciliation mentions reconcileOnResume', () => {
    const c = getContinuationContract('QUOTA_EXHAUSTED');
    expect(c.reconciliation).toContain('reconcileOnResume');
  });

  it('PROCESS_DEATH and CRASH reconciliation mention stale lock recovery', () => {
    for (const state of ['PROCESS_DEATH', 'CRASH'] as const) {
      const c = getContinuationContract(state);
      expect(c.reconciliation.toLowerCase()).toContain('stale');
    }
  });
});

// ── Resume-from sources ────────────────────────────────────────────────────────

describe('livenessProof — resume-from durable sources', () => {
  it('every RESUMABLE state names company-state.json as a resume source', () => {
    for (const c of resumableContracts()) {
      expect(c.resume_from, `${c.state} does not mention company-state.json`).toContain('company-state.json');
    }
  });
});
