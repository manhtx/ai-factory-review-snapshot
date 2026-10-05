import { describe, expect, it } from 'vitest';
import { assertProductAuthority, canTransitionBacklog, definitionOfReady, founderInboxCandidate } from './productBacklog';

describe('product backlog authority', () => {
  it('requires backlog, PM approval and active sprint for product mutation', () => {
    expect(() => assertProductAuthority({ intent: 'PRODUCT_CHANGE' })).toThrow('MISSING_BACKLOG_AUTHORITY');
    expect(() => assertProductAuthority({ intent: 'PRODUCT_CHANGE', backlog_id: 'BL-1', pm_review_status: 'PENDING' })).toThrow('PM_APPROVAL_REQUIRED');
    expect(() => assertProductAuthority({ intent: 'PRODUCT_CHANGE', backlog_id: 'BL-1', pm_review_status: 'APPROVED', backlog_status: 'READY', sprint_id: 'S-2', activeSprintId: 'S-1' })).toThrow('NOT_IN_ACTIVE_SPRINT');
    expect(() => assertProductAuthority({ intent: 'PRODUCT_CHANGE', backlog_id: 'BL-1', pm_review_status: 'APPROVED', backlog_status: 'READY', sprint_id: 'S-1', activeSprintId: 'S-1' })).not.toThrow();
  });
  it('preserves R0 and recovery exceptions without granting new product scope', () => { expect(() => assertProductAuthority({ intent: 'TEST_ONLY' })).not.toThrow(); expect(() => assertProductAuthority({ intent: 'RECOVERY', backlog_id: 'BL-1' })).not.toThrow(); });
  it('fails closed Definition of Ready and allows only valid transitions', () => { expect(definitionOfReady({ priority: 'P1' }).status).toBe('NOT_READY'); expect(canTransitionBacklog('CANDIDATE', 'PM_REVIEW')).toBe(true); expect(canTransitionBacklog('CANDIDATE', 'IN_PROGRESS')).toBe(false); });
  it('ingests Founder text as a candidate without execution authority', () => { const item = founderInboxCandidate({ title: 'Improve evidence UX' }); expect(item.source).toBe('FOUNDER'); expect(item.status).toBe('CANDIDATE'); expect(item.pm_review_status).toBe('PENDING'); });
});
