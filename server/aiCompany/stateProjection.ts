export interface StateRow { work_id: string; state: string; created_at?: string; updated_at?: string; [key: string]: unknown; }

export function latestStateByWork(rows: readonly StateRow[]): Map<string, StateRow> {
  const latest = new Map<string, StateRow>();
  for (const row of rows) {
    if (!row.work_id) continue;
    const previous = latest.get(row.work_id);
    if (!previous || compareRows(previous, row) <= 0) latest.set(row.work_id, row);
  }
  return latest;
}

function compareRows(a: StateRow, b: StateRow): number {
  const aTime = Date.parse(String(a.updated_at ?? a.created_at ?? ''));
  const bTime = Date.parse(String(b.updated_at ?? b.created_at ?? ''));
  if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) return aTime - bTime;
  return 0;
}

export function summarizeCurrentStates(rows: readonly StateRow[]) {
  const latest = [...latestStateByWork(rows).values()];
  return {
    unique_work_count: latest.length,
    by_state: latest.reduce<Record<string, number>>((out, row) => { out[row.state] = (out[row.state] ?? 0) + 1; return out; }, {}),
    oldest_active_at: latest.filter((row) => ['READY', 'CLAIMED', 'IN_REVIEW'].includes(row.state)).map((row) => row.updated_at ?? row.created_at).filter(Boolean).sort()[0] ?? null,
  };
}
