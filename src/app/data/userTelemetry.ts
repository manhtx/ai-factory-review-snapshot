export type UserTelemetryEventType =
  | "page_view"
  | "indicator_discover"
  | "indicator_inspect"
  | "indicator_compare"
  | "compare_explanation_opened"
  | "compare_follow_up_started"
  | "workspace_save"
  | "value_moment_achieved"
  | "journey_step_error"
  | "forecast_export"
  | "scenario_simulation"
  | "debate_run"
  | "filter_change"
  | "alert_subscription"
  | "hydration_batch"
  | "hydration_ready";

export const ALLOWED_EVENT_TYPES: readonly UserTelemetryEventType[] = [
  "page_view",
  "indicator_discover",
  "indicator_inspect",
  "indicator_compare",
  "compare_explanation_opened",
  "compare_follow_up_started",
  "workspace_save",
  "value_moment_achieved",
  "journey_step_error",
  "forecast_export",
  "scenario_simulation",
  "debate_run",
  "filter_change",
  "alert_subscription",
  "hydration_batch",
  "hydration_ready",
] as const;

export type UserTelemetryMetadata = Record<string, string | number | boolean>;

export interface UserTelemetryEvent {
  id: string;
  eventType: UserTelemetryEventType;
  sessionId: string;
  timestamp: string;
  metadata: UserTelemetryMetadata;
  durationMs?: number | null;
  /** Set only by the trusted server ingestion boundary; never accepted from client JSON. */
  provenance?: "local_runtime" | "production_attested" | "test_harness";
}

export interface UserTelemetryEventInput {
  id?: string;
  eventType: UserTelemetryEventType;
  sessionId: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
  durationMs?: number | null;
}

export interface CoreJourneyFunnel {
  discover: number;
  inspect: number;
  compare: number;
  compare_explanation: number;
  compare_follow_up: number;
  save_or_monitor: number;
  value_completion: number;
  funnel_conversion_rate: number;
  error_count: number;
}

export interface UserTelemetrySummary {
  totalEvents: number;
  totalSessions: number;
  eventsByType: Record<UserTelemetryEventType, number>;
  activeJourneys: { journey: string; count: number }[];
  averageSessionDurationMs: number | null;
  coreJourneyFunnel: CoreJourneyFunnel;
  engagementTier: "high" | "moderate" | "baseline" | "insufficient-evidence";
  scorecardAdoptionMetric: {
    score: number;
    confidence: number;
    evidence: "institutional-user-telemetry";
    verifiedEventsCount: number;
  };
}

const FORBIDDEN_METADATA_KEYS = new Set([
  "password",
  "secret",
  "token",
  "authorization",
  "key",
  "email",
  "apikey",
  "api_key",
  "bearer",
]);

export function sanitizeTelemetryMetadata(
  raw?: Record<string, unknown> | null,
): UserTelemetryMetadata {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  const sanitized: UserTelemetryMetadata = {};
  for (const [key, value] of Object.entries(raw)) {
    const lowerKey = key.toLowerCase().trim();
    if (FORBIDDEN_METADATA_KEYS.has(lowerKey)) {
      continue;
    }
    if (typeof value === "string") {
      sanitized[key] = value.slice(0, 128);
    } else if (typeof value === "number" && Number.isFinite(value)) {
      sanitized[key] = value;
    } else if (typeof value === "boolean") {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function validateUserTelemetryEvent(raw: unknown): {
  valid: boolean;
  event?: UserTelemetryEvent;
  error?: string;
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { valid: false, error: "Event payload must be a non-null object" };
  }

  const candidate = raw as Record<string, unknown>;
  const eventType = candidate.eventType as UserTelemetryEventType;
  if (!ALLOWED_EVENT_TYPES.includes(eventType)) {
    return {
      valid: false,
      error: `Invalid eventType '${String(eventType)}'. Allowed: ${ALLOWED_EVENT_TYPES.join(", ")}`,
    };
  }

  if (
    typeof candidate.sessionId !== "string" ||
    candidate.sessionId.trim().length === 0
  ) {
    return { valid: false, error: "sessionId is required and must be a non-empty string" };
  }

  const sessionId = candidate.sessionId.trim().slice(0, 64);
  const id =
    typeof candidate.id === "string" && candidate.id.trim().length > 0
      ? candidate.id.trim().slice(0, 64)
      : `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  let timestamp = new Date().toISOString();
  if (typeof candidate.timestamp === "string" && !Number.isNaN(Date.parse(candidate.timestamp))) {
    timestamp = candidate.timestamp;
  }

  let durationMs: number | null = null;
  if (
    typeof candidate.durationMs === "number" &&
    Number.isFinite(candidate.durationMs) &&
    candidate.durationMs >= 0 &&
    candidate.durationMs <= 86_400_000
  ) {
    durationMs = Math.round(candidate.durationMs);
  }

  const metadata = sanitizeTelemetryMetadata(
    candidate.metadata as Record<string, unknown> | undefined,
  );

  return {
    valid: true,
    event: {
      id,
      eventType,
      sessionId,
      timestamp,
      metadata,
      durationMs,
    },
  };
}

export function aggregateUserTelemetry(
  events: readonly UserTelemetryEvent[],
): UserTelemetrySummary {
  const eventsByType: Record<UserTelemetryEventType, number> = {
    page_view: 0,
    indicator_discover: 0,
    indicator_inspect: 0,
    indicator_compare: 0,
    compare_explanation_opened: 0,
    compare_follow_up_started: 0,
    workspace_save: 0,
    value_moment_achieved: 0,
    journey_step_error: 0,
    forecast_export: 0,
    scenario_simulation: 0,
    debate_run: 0,
    filter_change: 0,
    alert_subscription: 0,
    hydration_batch: 0,
    hydration_ready: 0,
  };

  const sessions = new Set<string>();
  const durations: number[] = [];
  const journeyCounts: Record<string, number> = {};

  for (const evt of events) {
    if (evt.eventType in eventsByType) {
      eventsByType[evt.eventType] += 1;
    }
    sessions.add(evt.sessionId);

    if (typeof evt.durationMs === "number" && evt.durationMs > 0) {
      durations.push(evt.durationMs);
    }

    const journeyKey = (evt.metadata?.journey as string) || evt.eventType;
    journeyCounts[journeyKey] = (journeyCounts[journeyKey] || 0) + 1;
  }

  const totalEvents = events.length;
  const totalSessions = sessions.size;
  const averageSessionDurationMs =
    durations.length > 0
      ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)
      : null;

  const discoverCount = eventsByType.indicator_discover;
  const inspectCount = eventsByType.indicator_inspect;
  const compareCount = eventsByType.indicator_compare;
  const compareExplanationCount = eventsByType.compare_explanation_opened;
  const saveCount = eventsByType.workspace_save + eventsByType.alert_subscription;
  const valueCount = eventsByType.value_moment_achieved + eventsByType.forecast_export;
  const errorCount = eventsByType.journey_step_error;

  const coreJourneyFunnel: CoreJourneyFunnel = {
    discover: discoverCount,
    inspect: inspectCount,
    compare: compareCount,
    compare_explanation: compareExplanationCount,
    compare_follow_up: eventsByType.compare_follow_up_started,
    save_or_monitor: saveCount,
    value_completion: valueCount,
    funnel_conversion_rate: discoverCount > 0 ? Math.round((valueCount / discoverCount) * 1000) / 10 : 0,
    error_count: errorCount,
  };

  const activeJourneys = Object.entries(journeyCounts)
    .map(([journey, count]) => ({ journey, count }))
    .sort((a, b) => b.count - a.count);

  let engagementTier: UserTelemetrySummary["engagementTier"] = "insufficient-evidence";
  let score = 1.0;
  let confidence = 0.3;

  if (totalEvents >= 100 && totalSessions >= 10) {
    engagementTier = "high";
    score = 4.5;
    confidence = 0.95;
  } else if (totalEvents >= 25 && totalSessions >= 3) {
    engagementTier = "moderate";
    score = 3.5;
    confidence = 0.85;
  } else if (totalEvents > 0) {
    engagementTier = "baseline";
    score = 2.5;
    confidence = 0.7;
  }

  return {
    totalEvents,
    totalSessions,
    eventsByType,
    activeJourneys,
    averageSessionDurationMs,
    coreJourneyFunnel,
    engagementTier,
    scorecardAdoptionMetric: {
      score,
      confidence,
      evidence: "institutional-user-telemetry",
      verifiedEventsCount: totalEvents,
    },
  };
}

export class UserTelemetryBuffer {
  private buffer: UserTelemetryEvent[] = [];
  private readonly maxCapacity: number;

  constructor(maxCapacity = 1000) {
    this.maxCapacity = Math.max(1, maxCapacity);
  }

  public record(raw: unknown): boolean {
    const result = validateUserTelemetryEvent(raw);
    if (!result.valid || !result.event) {
      return false;
    }

    if (this.buffer.length >= this.maxCapacity) {
      this.buffer.shift();
    }

    this.buffer.push(result.event);
    return true;
  }

  public recordBatch(rawEvents: unknown[]): { accepted: number; rejected: number } {
    let accepted = 0;
    let rejected = 0;
    for (const item of rawEvents) {
      if (this.record(item)) {
        accepted += 1;
      } else {
        rejected += 1;
      }
    }
    return { accepted, rejected };
  }

  public getEvents(): readonly UserTelemetryEvent[] {
    return [...this.buffer];
  }

  public getSummary(): UserTelemetrySummary {
    return aggregateUserTelemetry(this.buffer);
  }

  public clear(): void {
    this.buffer = [];
  }

  public size(): number {
    return this.buffer.length;
  }
}
