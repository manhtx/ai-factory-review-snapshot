import { describe, expect, it } from 'vitest';
import { latestStateByWork, summarizeCurrentStates } from './stateProjection';
describe('state projection', () => {
  it('deduplicates append-only rows by latest timestamp', () => {
    const rows = [{work_id:'w',state:'READY',updated_at:'2026-01-01T00:00:00Z'},{work_id:'w',state:'DONE',updated_at:'2026-01-02T00:00:00Z'}];
    expect(latestStateByWork(rows).get('w')?.state).toBe('DONE');
    expect(summarizeCurrentStates(rows)).toMatchObject({unique_work_count:1,by_state:{DONE:1}});
  });
});
