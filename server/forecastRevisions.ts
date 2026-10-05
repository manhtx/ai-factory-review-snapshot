export type ForecastRevisionInput = {
  id: string;
  indicatorId: string;
  targetDate: string;
  forecastDate: string;
  forecastValue: number;
  institution: string;
  version: number;
  sourceName?: string | null;
  sourceUrl?: string | null;
  methodology?: string | null;
  sourceGovernance?: { sourceId: string; eligible: boolean; state: "eligible" | "review-required" | "disabled"; reason: string };
  actualValue?: number | null;
  accuracyState?: "pending" | "available";
  error?: number | null;
  absolutePercentageError?: number | null;
};

export function buildForecastRevisionTimeline(rows: ForecastRevisionInput[]) {
  const groups = new Map<string, ForecastRevisionInput[]>();
  for (const row of rows) {
    const key = `${row.indicatorId}:${row.institution}:${row.targetDate}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return [...groups.values()].map((group) => {
    const ordered = [...group].sort((a, b) =>
      a.forecastDate.localeCompare(b.forecastDate) || a.version - b.version || a.id.localeCompare(b.id));
    const latestIndex = ordered.length - 1;
    const revisions = ordered.map((row, index) => ({
      ...row,
      lifecycle: row.accuracyState === "available"
        ? "evaluated"
        : index < latestIndex
          ? "superseded"
          : index === 0
            ? "published"
            : "revised",
    }));
    return {
      indicatorId: ordered[0].indicatorId,
      institution: ordered[0].institution,
      targetDate: ordered[0].targetDate,
      current: revisions[latestIndex],
      revisions,
      revisionCount: revisions.length,
      evaluationState: revisions.some((row) => row.accuracyState === "available") ? "evaluated" : "pending",
      limitation: "Lifecycle ordering describes publication history; it does not rank forecast quality or establish causality.",
    };
  }).sort((a, b) => a.targetDate.localeCompare(b.targetDate) || a.institution.localeCompare(b.institution));
}
