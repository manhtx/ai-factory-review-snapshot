import type { UserTelemetryEventInput } from "../data/userTelemetry";

export function trackUserTelemetry(event: UserTelemetryEventInput): Promise<void> {
  return fetch("/api/telemetry/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(event), keepalive: true })
    .then(() => undefined)
    .catch(() => undefined);
}
