export type ComparisonPoint = { date: string; value: number };
export type ComparisonTransformation = "level" | "change" | "pct_change";

function transform(points: ComparisonPoint[], transformation: ComparisonTransformation) {
  if (transformation === "level") return points;
  return points.slice(1).map((point, index) => ({ date: point.date, value: transformation === "change" ? point.value - points[index].value : points[index].value === 0 ? 0 : ((point.value - points[index].value) / Math.abs(points[index].value)) * 100 }));
}

function correlation(x: number[], y: number[]) {
  if (x.length < 3) return null;
  const meanX = x.reduce((sum, value) => sum + value, 0) / x.length;
  const meanY = y.reduce((sum, value) => sum + value, 0) / y.length;
  const numerator = x.reduce((sum, value, index) => sum + (value - meanX) * (y[index] - meanY), 0);
  const denominator = Math.sqrt(x.reduce((sum, value) => sum + (value - meanX) ** 2, 0) * y.reduce((sum, value) => sum + (value - meanY) ** 2, 0));
  return denominator === 0 ? 0 : numerator / denominator;
}

export function buildComparisonReport(seriesByIndicator: Record<string, ComparisonPoint[]>, options?: { transformation?: ComparisonTransformation; maxLag?: number }) {
  const indicatorIds = Object.keys(seriesByIndicator);
  const transformation = options?.transformation ?? "level";
  const maxLag = Math.min(12, Math.max(0, Math.floor(options?.maxLag ?? 0)));
  const dateMaps = indicatorIds.map((indicatorId) => new Map(transform(seriesByIndicator[indicatorId].filter((point) => Number.isFinite(point.value)), transformation).map((point) => [point.date, point.value])));
  const dates = [...(dateMaps[0]?.keys() ?? [])].filter((date) => dateMaps.every((map) => map.has(date))).sort();
  const leftValues = dates.map((date) => dateMaps[0].get(date)!);
  const rightValues = dates.map((date) => dateMaps[1].get(date)!);
  const pairs = indicatorIds.length === 2 && dates.length >= 3 ? { left: indicatorIds[0], right: indicatorIds[1], correlation: correlation(leftValues, rightValues), sampleSize: dates.length, lagSweep: [...Array(maxLag * 2 + 1)].map((_, index) => index - maxLag).map((lag) => { const left = lag >= 0 ? leftValues.slice(0, leftValues.length - lag || undefined) : leftValues.slice(-lag); const right = lag >= 0 ? rightValues.slice(lag) : rightValues.slice(0, rightValues.length + lag); const sampleSize = Math.min(left.length, right.length); return { lag, correlation: sampleSize >= 3 ? correlation(left.slice(0, sampleSize), right.slice(0, sampleSize)) : null, sampleSize }; }) } : null;
  return {
    indicatorIds,
    transformation,
    overlap: { status: dates.length >= 3 ? "sufficient" : "insufficient", periods: dates, count: dates.length },
    aligned: dates.map((date) => ({ date, values: Object.fromEntries(indicatorIds.map((indicatorId, index) => [indicatorId, dateMaps[index].get(date)])) })),
    relationship: pairs,
    limitations: [
      "Correlation is descriptive overlap evidence and does not establish causality, direction or investment performance.",
      ...(dates.length < 3 ? ["There are fewer than three comparable periods; relationship statistics are withheld."] : []),
      ...(maxLag > 0 ? ["Lag correlations are descriptive alignment tests; lag selection does not establish temporal causality."] : []),
    ],
  };
}
