import { describe, expect, it } from 'vitest';
import { deriveCompanyOperatingStatus } from './companyOperatingStatus';

const base = { running: true, ticking: false, startedAt: '2026-09-04T08:00:00Z', lastTickAt: '2026-09-04T08:01:00Z', lastResults: [], readiness: { ready: true, blockers: [], checkedAt: '2026-09-04T08:00:00Z' } };

describe('company operating status', () => {
  it('reports blocked when a production readiness gate is open', () => {
    expect(deriveCompanyOperatingStatus({ runtime: { ...base, readiness: { ...base.readiness, ready: false, blockers: ['managed storage is not connected'] } } })).toMatchObject({ state: 'blocked', local_ready: false, production_ready: false });
  });
  it('reports degraded when runtime has not completed a tick', () => {
    expect(deriveCompanyOperatingStatus({ runtime: { ...base, lastTickAt: null } })).toMatchObject({ state: 'degraded' });
  });
  it('reports operating only when readiness and runtime evidence are healthy', () => {
    expect(deriveCompanyOperatingStatus({ runtime: base })).toMatchObject({ state: 'operating', blockers: [], local_ready: true, production_ready: false });
  });
  it('reports degraded when the queue contains blocked work', () => {
    expect(deriveCompanyOperatingStatus({ runtime: base, governance: { blocked_work_items: 2 } })).toMatchObject({ state: 'degraded', blockers: ['2 work item(s) are blocked'], local_ready: true, production_ready: false });
  });
});
