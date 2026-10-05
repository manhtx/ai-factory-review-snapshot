export interface WatchlistItem { indicatorId: string; addedAt: string; }

export type WatchlistAlertCondition = "ABOVE_THRESHOLD" | "BELOW_THRESHOLD";
export interface WatchlistAlertRule {
  alertId: string;
  indicatorId: string;
  condition: WatchlistAlertCondition;
  thresholdValue: number;
  enabled: boolean;
  createdAt: string;
}
export interface IndicatorEvaluationInput {
  indicatorId: string;
  currentValue: number | null;
  observationDate: string;
  isStale: boolean;
}
export interface TriggeredWatchlistAlert extends WatchlistAlertRule {
  observedValue: number;
  severity: "WARNING";
}

/** Deterministic, fail-closed threshold evaluation for watchlist alerts. */
export function evaluateWatchlistAlerts(
  rules: WatchlistAlertRule[],
  inputs: Record<string, IndicatorEvaluationInput>,
): TriggeredWatchlistAlert[] {
  return rules.flatMap((rule) => {
    if (!rule.enabled || !Number.isFinite(rule.thresholdValue)) return [];
    const input = inputs[rule.indicatorId];
    if (!input || input.isStale || input.currentValue === null || !Number.isFinite(input.currentValue)) return [];
    const breached = rule.condition === "ABOVE_THRESHOLD"
      ? input.currentValue > rule.thresholdValue
      : input.currentValue < rule.thresholdValue;
    return breached ? [{ ...rule, observedValue: input.currentValue, severity: "WARNING" as const }] : [];
  });
}

export function normalizeWatchlist(items: WatchlistItem[], knownIds: Set<string>) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!knownIds.has(item.indicatorId) || seen.has(item.indicatorId)) return false;
    seen.add(item.indicatorId);
    return true;
  });
}
