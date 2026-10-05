import type { Request, Response } from "express";
import {
  UserTelemetryBuffer,
  type UserTelemetryEvent,
  type UserTelemetrySummary,
  validateUserTelemetryEvent,
} from "../src/app/data/userTelemetry.js";
import { UserTelemetryLedger } from "./userTelemetryLedger.js";
import { synthesizeUserTelemetryInsights } from "./userTelemetryInsights.js";

const DEFAULT_MAX_TELEMETRY_CAPACITY = 2000;
const telemetryBuffer = new UserTelemetryBuffer(DEFAULT_MAX_TELEMETRY_CAPACITY);
const telemetryLedger = new UserTelemetryLedger(process.env.AI_COMPANY_STATE_DIR ?? ".ai-company/runtime");
let telemetryWakeHandler: ((event: string) => Promise<unknown> | unknown) | null = null;

export function setTelemetryWakeHandler(handler: ((event: string) => Promise<unknown> | unknown) | null): void { telemetryWakeHandler = handler; }

export function recordUserTelemetryEvent(raw: unknown): boolean {
  const validation = validateUserTelemetryEvent(raw);
  if (!validation.valid || !validation.event) return false;
  return telemetryBuffer.record({ ...validation.event, provenance: "local_runtime" });
}

export function recordUserTelemetryBatch(rawEvents: unknown[]): {
  accepted: number;
  rejected: number;
} {
  const events = rawEvents.map((raw) => {
    const validation = validateUserTelemetryEvent(raw);
    return validation.valid && validation.event ? { ...validation.event, provenance: "local_runtime" } : raw;
  });
  return telemetryBuffer.recordBatch(events);
}

export function getUserTelemetryEvents(): readonly UserTelemetryEvent[] {
  return telemetryBuffer.getEvents();
}

export function getUserTelemetrySummary(): UserTelemetrySummary {
  return telemetryBuffer.getSummary();
}

export function getUserTelemetryInsights() { return synthesizeUserTelemetryInsights(getUserTelemetryEvents()); }

export function clearUserTelemetry(): void {
  telemetryBuffer.clear();
}

export async function handleRecordUserTelemetry(request: Request, response: Response): Promise<void> {
  const body = request.body;
  if (Array.isArray(body)) {
    if (body.length > 100) {
      response.status(400).json({
        error: "Batch size exceeded maximum limit of 100 events per request",
      });
      return;
    }
    const validEvents = body
      .map((item) => validateUserTelemetryEvent(item))
      .filter((result): result is { valid: true; event: UserTelemetryEvent } => result.valid && Boolean(result.event));
    const trustedEvents = validEvents.map(({ event }) => ({ ...event, provenance: "local_runtime" as const }));
    const result = recordUserTelemetryBatch(body);
    await Promise.all(trustedEvents.map((event) => telemetryLedger.record(event)));
    void Promise.resolve(telemetryWakeHandler?.("fresh-user-telemetry")).catch(() => undefined);
    response.status(200).json({
      status: "recorded",
      accepted: result.accepted,
      rejected: result.rejected,
      evidence: "institutional-user-telemetry",
    });
    return;
  }

  const validation = validateUserTelemetryEvent(body);
  if (!validation.valid || !validation.event) {
    response.status(400).json({
      error: validation.error || "Invalid user telemetry event payload",
    });
    return;
  }

  const trustedEvent = { ...validation.event, provenance: "local_runtime" as const };
  telemetryBuffer.record(trustedEvent);
  void telemetryLedger.record(trustedEvent).catch(() => undefined);
  void Promise.resolve(telemetryWakeHandler?.("fresh-user-telemetry")).catch(() => undefined);
  response.status(201).json({
    status: "recorded",
    eventId: validation.event.id,
    evidence: "institutional-user-telemetry",
  });
}

export async function hydrateUserTelemetry(): Promise<void> {
  const events = await telemetryLedger.records();
  telemetryBuffer.clear();
  telemetryBuffer.recordBatch(events);
}

export async function getDurableUserTelemetryEvents(): Promise<readonly UserTelemetryEvent[]> {
  return telemetryLedger.records();
}

export function handleGetUserTelemetrySummary(_request: Request, response: Response): void {
  const summary = getUserTelemetrySummary();
  response.status(200).json(summary);
}

export function handleGetUserTelemetryMcpTool(_request: Request, response: Response): void {
  const summary = getUserTelemetrySummary();
  response.status(200).json({
    content: [
      {
        type: "text",
        text: JSON.stringify(summary, null, 2),
      },
    ],
    metadata: {
      evidence: "institutional-user-telemetry",
      schema: "v1",
    },
  });
}
