import { describe, expect, it } from 'vitest';
import { selectAutonomousNextAction } from './autonomousNextAction';

const row = (state: any, work_id: string, blocked_reason?: string) => ({ state, work_id, blocked_reason } as any);

describe('autonomous next-action selection', () => {
  it('selects ready work before creating activity', () => {
    expect(selectAutonomousNextAction({ rows: [row('READY', 'W1')], completed: [] })).toMatchObject({ kind: 'EXECUTE_READY_WORK', work_ids: ['W1'] });
  });
  it('waits when no meaningful work exists', () => {
    expect(selectAutonomousNextAction({ rows: [], completed: [] })).toMatchObject({ kind: 'WAITING_FOR_MEANINGFUL_WORK', wake_condition: 'new-authorized-work-or-product-evidence' });
  });
  it('prioritizes recovery over routine continuation', () => {
    expect(selectAutonomousNextAction({ rows: [row('BLOCKED', 'W2')], completed: [] }).kind).toBe('RECOVER_BLOCKED_WORK');
  });
  it('does not treat intentional PM-gated downstream blocks as recovery work', () => {
    expect(selectAutonomousNextAction({ rows: [row('BLOCKED', 'W3', 'UPSTREAM_PM_GATE: PM recommendation=HOLD')], completed: [] }).kind).toBe('WAITING_FOR_MEANINGFUL_WORK');
  });
});
