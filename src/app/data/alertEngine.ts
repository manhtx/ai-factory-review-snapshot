import { Alert, Indicator } from "./types";

export function isAlertTriggered(alert: Alert, indicator?: Indicator): boolean {
  if (!alert.active || !indicator || indicator.series.length === 0) return false;
  if (
    indicator.provenance?.status !== "actual" ||
    indicator.provenance.quality !== "verified" ||
    !indicator.provenance.sourceUrl
  ) return false;
  if (indicator.provenance.freshness && indicator.provenance.freshness !== "fresh") return false;
  const current = indicator.series.at(-1)!.value;
  const previous = indicator.series.at(-2)?.value;
  if (alert.condition === "above") return current > alert.threshold;
  if (alert.condition === "below") return current < alert.threshold;
  if (previous === undefined) return false;
  return (
    (previous <= alert.threshold && current > alert.threshold) ||
    (previous >= alert.threshold && current < alert.threshold)
  );
}

export function evaluateAlerts(alerts: Alert[], indicators: Indicator[], now = new Date()): Alert[] {
  const timestamp = now.toISOString();
  return alerts.map((alert) => {
    const triggered = isAlertTriggered(
      alert,
      indicators.find((indicator) => indicator.id === alert.indicatorId)
    );
    return {
      ...alert,
      triggered,
      triggeredAt: triggered ? alert.triggeredAt ?? timestamp : undefined,
    };
  });
}
