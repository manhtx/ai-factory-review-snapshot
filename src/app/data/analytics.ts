import { DataPoint } from "./types";

export type Transformation = "level" | "change" | "pct_change" | "yoy" | "z_score";

export function transformSeries(
  series: DataPoint[],
  transformation: Transformation,
  periodsPerYear = 12
): DataPoint[] {
  if (transformation === "level") return series;
  if (transformation === "z_score") {
    if (series.length < 2) return [];
    const mean = series.reduce((sum, point) => sum + point.value, 0) / series.length;
    const variance =
      series.reduce((sum, point) => sum + (point.value - mean) ** 2, 0) /
      (series.length - 1);
    const deviation = Math.sqrt(variance);
    return series.map((point) => ({
      ...point,
      value: deviation === 0 ? 0 : (point.value - mean) / deviation,
    }));
  }
  const lag = transformation === "yoy" ? periodsPerYear : 1;
  return series.slice(lag).map((point, index) => {
    const previous = series[index].value;
    const value =
      transformation === "change"
        ? point.value - previous
        : previous === 0
        ? 0
        : ((point.value - previous) / Math.abs(previous)) * 100;
    return { ...point, value };
  });
}

export function pearsonCorrelation(x: number[], y: number[]) {
  const n = Math.min(x.length, y.length);
  if (n < 3) return Number.NaN;
  const xs = x.slice(0, n);
  const ys = y.slice(0, n);
  const meanX = xs.reduce((sum, value) => sum + value, 0) / n;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / n;
  const numerator = xs.reduce(
    (sum, value, index) => sum + (value - meanX) * (ys[index] - meanY),
    0
  );
  const denominator = Math.sqrt(
    xs.reduce((sum, value) => sum + (value - meanX) ** 2, 0) *
      ys.reduce((sum, value) => sum + (value - meanY) ** 2, 0)
  );
  return denominator === 0 ? 0 : numerator / denominator;
}

export function approximateCorrelationPValue(r: number, n: number) {
  if (!Number.isFinite(r) || n < 4 || Math.abs(r) >= 1) return Number.NaN;
  const t = Math.abs(r) * Math.sqrt((n - 2) / (1 - r * r));
  // Normal approximation is intentionally conservative for small samples.
  const p = Math.exp(-0.717 * t - 0.416 * t * t);
  return Math.min(1, Math.max(0, p));
}

export function rollingCorrelation(
  x: number[],
  y: number[],
  window: number
): { index: number; correlation: number }[] {
  const n = Math.min(x.length, y.length);
  if (window < 3 || n < window) return [];
  const output: { index: number; correlation: number }[] = [];
  for (let index = window; index <= n; index++) {
    output.push({
      index: index - 1,
      correlation: pearsonCorrelation(
        x.slice(index - window, index),
        y.slice(index - window, index)
      ),
    });
  }
  return output;
}

export function lagSweep(
  x: number[],
  y: number[],
  maxLag: number
): { lag: number; correlation: number; n: number }[] {
  const output: { lag: number; correlation: number; n: number }[] = [];
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    const xs = lag >= 0 ? x.slice(0, x.length - lag || undefined) : x.slice(-lag);
    const ys = lag >= 0 ? y.slice(lag) : y.slice(0, y.length + lag);
    const n = Math.min(xs.length, ys.length);
    output.push({
      lag,
      correlation: pearsonCorrelation(xs.slice(0, n), ys.slice(0, n)),
      n,
    });
  }
  return output;
}
