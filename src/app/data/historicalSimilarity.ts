import { HistoricalCycle, Indicator } from "./types";

export type HistoricalSimilarity = {
  cycleId: string;
  comparedIndicators: number;
  matchingDirections: number;
  score: number | null;
};

function directionBetween(indicator: Indicator, start: string, end: string) {
  const startPoint = indicator.series.find((point) => point.date >= start);
  const endPoint = [...indicator.series].reverse().find((point) => point.date <= end);
  if (!startPoint || !endPoint || startPoint.value === endPoint.value) return null;
  return endPoint.value > startPoint.value ? "up" : "down";
}

export function calculateHistoricalSimilarity(indicators: Indicator[], cycle: HistoricalCycle): HistoricalSimilarity {
  let comparedIndicators = 0;
  let matchingDirections = 0;
  for (const id of cycle.keyIndicators) {
    const indicator = indicators.find((item) => item.id === id);
    if (!indicator) continue;
    const historicalDirection = directionBetween(indicator, cycle.period.start, cycle.period.end);
    if (!historicalDirection || indicator.trend === "flat") continue;
    comparedIndicators += 1;
    if (historicalDirection === indicator.trend) matchingDirections += 1;
  }
  return {
    cycleId: cycle.id,
    comparedIndicators,
    matchingDirections,
    score: comparedIndicators ? matchingDirections / comparedIndicators : null,
  };
}
