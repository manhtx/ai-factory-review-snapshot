import { Router } from "express";
import {
  handleGetUserTelemetryMcpTool,
  handleGetUserTelemetrySummary,
  handleRecordUserTelemetry,
} from "../userTelemetry.js";
import {
  prometheusMetricsHandler,
  recentTracesHandler,
} from "../otelMetrics.js";

export const telemetryRouter = Router();

telemetryRouter.post("/api/telemetry/events", handleRecordUserTelemetry);
telemetryRouter.get("/api/telemetry/summary", handleGetUserTelemetrySummary);
telemetryRouter.get(
  "/api/mcp/tools/get_user_telemetry_summary",
  handleGetUserTelemetryMcpTool,
);
telemetryRouter.get("/metrics", prometheusMetricsHandler);
telemetryRouter.get("/api/metrics", prometheusMetricsHandler);
telemetryRouter.get("/api/traces", recentTracesHandler);
telemetryRouter.get(
  "/api/mcp/tools/get_prometheus_metrics",
  prometheusMetricsHandler,
);
