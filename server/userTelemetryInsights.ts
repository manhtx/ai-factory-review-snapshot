import type { UserTelemetryEvent } from "../src/app/data/userTelemetry.js";

export interface UserTelemetryInsight {
  insight_id: string;
  kind: "OBSERVED_WORKFLOW_DEMAND";
  workflow: UserTelemetryEvent["eventType"];
  observation: string;
  event_ids: string[];
  confidence: "low" | "medium";
  limitation: string;
}

const workflowLabels: Partial<Record<UserTelemetryEvent["eventType"], string>> = {
  indicator_discover: "indicator discovery",
  indicator_inspect: "indicator detail inspection",
  indicator_compare: "indicator comparison",
  workspace_save: "workspace snapshot saving",
  value_moment_achieved: "macro value realization",
  journey_step_error: "journey step failure",
  forecast_export: "forecast export",
  scenario_simulation: "scenario simulation",
  debate_run: "evidence debate",
  alert_subscription: "alert subscription",
};

export function synthesizeUserTelemetryInsights(events: readonly UserTelemetryEvent[], minimumEvents = 3): UserTelemetryInsight[] {
  const threshold = Math.max(1, Math.floor(minimumEvents));
  const grouped = new Map<UserTelemetryEvent["eventType"], UserTelemetryEvent[]>();
  for (const event of events) grouped.set(event.eventType, [...(grouped.get(event.eventType) ?? []), event]);
  return [...grouped.entries()]
    .filter(([eventType, items]) => Boolean(workflowLabels[eventType]) && items.length >= threshold)
    .map(([workflow, items]) => ({
      insight_id: `USAGE-${workflow}`,
      kind: "OBSERVED_WORKFLOW_DEMAND" as const,
      workflow,
      observation: `${items.length} recorded ${workflowLabels[workflow]} events indicate repeated workflow usage.`,
      event_ids: items.map((item) => item.id),
      confidence: items.length >= threshold * 3 ? "medium" as const : "low" as const,
      limitation: "Usage frequency is not satisfaction, causality, retention or product-market-fit evidence; validate with user research and outcomes.",
    }))
    .sort((a, b) => b.event_ids.length - a.event_ids.length);
}
