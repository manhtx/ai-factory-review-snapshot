export type ChangeObservation = { date: string; value: number; vintage?: string | null; ingestedAt?: string | null; status?: string; quality?: string };

export function buildChangeReport(observations: ChangeObservation[], limit = 10) {
  const ordered = observations.filter((row) => Number.isFinite(row.value)).sort((a, b) => a.date.localeCompare(b.date) || String(a.vintage ?? "").localeCompare(String(b.vintage ?? "")));
  const periodChanges = ordered.slice(1).map((current, index) => {
    const previous = ordered[index];
    return {
      type: "period-change" as const,
      date: current.date,
      previousDate: previous.date,
      value: current.value,
      previousValue: previous.value,
      delta: current.value - previous.value,
      percentChange: previous.value === 0 ? null : ((current.value - previous.value) / Math.abs(previous.value)) * 100,
      vintage: current.vintage ?? null,
    };
  }).filter((change) => change.delta !== 0 && change.date !== change.previousDate).slice(-limit).reverse();
  const revisions = new Map<string, ChangeObservation[]>();
  for (const row of ordered) revisions.set(row.date, [...(revisions.get(row.date) ?? []), row]);
  const vintageChanges = [...revisions.entries()].flatMap(([date, rows]) => rows.slice(1).map((current, index) => {
    const previous = rows[index];
    return current.value === previous.value ? null : { type: "vintage-revision" as const, date, value: current.value, previousValue: previous.value, delta: current.value - previous.value, vintage: current.vintage ?? null, previousVintage: previous.vintage ?? null };
  }).filter((change): change is NonNullable<typeof change> => Boolean(change))).slice(-limit).reverse();
  return {
    latest: ordered.at(-1) ?? null,
    previous: ordered.at(-2) ?? null,
    periodChanges,
    vintageChanges,
    limitations: [
      "Changes are descriptive comparisons of stored observations; they do not explain causality.",
      "A missing prior period or unavailable vintage history can make the change list incomplete.",
    ],
  };
}
