export type ObservationRevisionLike = { date?: unknown; vintage?: unknown; ingestedAt?: unknown };

/** Selects one deterministic current revision for each economic period. */
export function selectLatestPerPeriod<T extends ObservationRevisionLike>(rows: T[]): T[] {
  const selected = new Map<string, T>();
  const revisionKey = (row: T) => `${String(row.vintage ?? '')}\u0000${String(row.ingestedAt ?? '')}`;
  for (const row of rows) {
    const period = String(row.date ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(period)) continue;
    const current = selected.get(period);
    if (!current || revisionKey(row) > revisionKey(current)) selected.set(period, row);
  }
  return [...selected.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, row]) => row);
}
