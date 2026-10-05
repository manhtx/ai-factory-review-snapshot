import { Indicator } from "./types";
import { isCurrentSourceBackedIndicator } from "./dataContract";

export interface RegimeResult { label: string; eligibleSignals: number; totalSignals: number; confidence: number | null; }

export function detectRegime(indicators: Indicator[]): RegimeResult {
  const eligible = indicators.filter(isCurrentSourceBackedIndicator);
  if (eligible.length < 3) return { label: "Unavailable — insufficient verified signals", eligibleSignals: eligible.length, totalSignals: indicators.length, confidence: null };
  const up = eligible.filter((indicator) => indicator.trend === "up").length;
  const down = eligible.filter((indicator) => indicator.trend === "down").length;
  const dominance = Math.max(up, down) / eligible.length;
  return { label: up >= 3 && down <= 1 ? "Expansion-like configuration" : down >= 3 && up <= 1 ? "Contraction-like configuration" : "Mixed / transition configuration", eligibleSignals: eligible.length, totalSignals: indicators.length, confidence: dominance };
}
