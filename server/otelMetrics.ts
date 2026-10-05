import type { Request, Response, NextFunction } from "express";
import { randomBytes } from "node:crypto";

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  traceFlags: string;
}

export type SpanKind = "SERVER" | "CLIENT" | "INTERNAL" | "PRODUCER" | "CONSUMER";
export type SpanStatus = "UNSET" | "OK" | "ERROR";

export interface SpanEvent {
  name: string;
  timestampMs: number;
  attributes?: Record<string, string | number | boolean>;
}

export interface Span {
  id: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  kind: SpanKind;
  startTimeMs: number;
  endTimeMs?: number;
  durationMs?: number;
  status: SpanStatus;
  statusMessage?: string;
  attributes: Record<string, string | number | boolean>;
  events: SpanEvent[];
}

export interface HistogramBucketConfig {
  buckets: number[];
}

interface HistogramData {
  count: number;
  sum: number;
  bucketCounts: Map<number, number>;
}

export const DEFAULT_LATENCY_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

export class PrometheusRegistry {
  private counters = new Map<string, { help: string; values: Map<string, number> }>();
  private gauges = new Map<string, { help: string; values: Map<string, number> }>();
  private histograms = new Map<
    string,
    { help: string; buckets: number[]; values: Map<string, HistogramData> }
  >();

  public registerCounter(name: string, help = `Metric ${name}`): void {
    if (!this.counters.has(name)) {
      this.counters.set(name, { help, values: new Map() });
    }
  }

  public registerGauge(name: string, help = `Metric ${name}`): void {
    if (!this.gauges.has(name)) {
      this.gauges.set(name, { help, values: new Map() });
    }
  }

  public registerHistogram(name: string, help = `Metric ${name}`, buckets = DEFAULT_LATENCY_BUCKETS): void {
    if (!this.histograms.has(name)) {
      const sorted = [...buckets].sort((a, b) => a - b);
      this.histograms.set(name, { help, buckets: sorted, values: new Map() });
    }
  }

  private serializeLabels(labels?: Record<string, string | number>): string {
    if (!labels || Object.keys(labels).length === 0) return "";
    const entries = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${String(v).replace(/"/g, '\\"')}"`);
    return entries.length > 0 ? `{${entries.join(",")}}` : "";
  }

  public incrementCounter(name: string, labels?: Record<string, string | number>, by = 1): void {
    if (!this.counters.has(name)) {
      this.registerCounter(name);
    }
    const metric = this.counters.get(name)!;
    const labelKey = this.serializeLabels(labels);
    const current = metric.values.get(labelKey) ?? 0;
    metric.values.set(labelKey, current + by);
  }

  public setGauge(name: string, value: number, labels?: Record<string, string | number>): void {
    if (!this.gauges.has(name)) {
      this.registerGauge(name);
    }
    const metric = this.gauges.get(name)!;
    const labelKey = this.serializeLabels(labels);
    metric.values.set(labelKey, value);
  }

  public incrementGauge(name: string, labels?: Record<string, string | number>, by = 1): void {
    if (!this.gauges.has(name)) {
      this.registerGauge(name);
    }
    const metric = this.gauges.get(name)!;
    const labelKey = this.serializeLabels(labels);
    const current = metric.values.get(labelKey) ?? 0;
    metric.values.set(labelKey, current + by);
  }

  public decrementGauge(name: string, labels?: Record<string, string | number>, by = 1): void {
    this.incrementGauge(name, labels, -by);
  }

  public observeHistogram(
    name: string,
    value: number,
    labels?: Record<string, string | number>,
  ): void {
    if (!this.histograms.has(name)) {
      this.registerHistogram(name);
    }
    const metric = this.histograms.get(name)!;
    const labelKey = this.serializeLabels(labels);
    let data = metric.values.get(labelKey);
    if (!data) {
      data = {
        count: 0,
        sum: 0,
        bucketCounts: new Map<number, number>(),
      };
      for (const b of metric.buckets) {
        data.bucketCounts.set(b, 0);
      }
      metric.values.set(labelKey, data);
    }

    data.count += 1;
    data.sum += value;

    for (const b of metric.buckets) {
      if (value <= b) {
        const c = data.bucketCounts.get(b) ?? 0;
        data.bucketCounts.set(b, c + 1);
      }
    }
  }

  public exportMetrics(): string {
    const lines: string[] = [];

    // Counters
    for (const [name, metric] of this.counters) {
      lines.push(`# HELP ${name} ${metric.help}`);
      lines.push(`# TYPE ${name} counter`);
      if (metric.values.size === 0) {
        lines.push(`${name} 0`);
      } else {
        for (const [labelKey, val] of metric.values) {
          lines.push(`${name}${labelKey} ${val}`);
        }
      }
    }

    // Gauges
    for (const [name, metric] of this.gauges) {
      lines.push(`# HELP ${name} ${metric.help}`);
      lines.push(`# TYPE ${name} gauge`);
      if (metric.values.size === 0) {
        lines.push(`${name} 0`);
      } else {
        for (const [labelKey, val] of metric.values) {
          lines.push(`${name}${labelKey} ${val}`);
        }
      }
    }

    // Histograms
    for (const [name, metric] of this.histograms) {
      lines.push(`# HELP ${name} ${metric.help}`);
      lines.push(`# TYPE ${name} histogram`);
      for (const [labelKey, data] of metric.values) {
        const rawLabels = labelKey ? labelKey.slice(1, -1) : "";
        for (const b of metric.buckets) {
          const count = data.bucketCounts.get(b) ?? 0;
          const leLabel = `le="${b}"`;
          const combined = rawLabels ? `{${rawLabels},${leLabel}}` : `{${leLabel}}`;
          lines.push(`${name}_bucket${combined} ${count}`);
        }
        const infLabel = rawLabels ? `{${rawLabels},le="+Inf"}` : `{le="+Inf"}`;
        lines.push(`${name}_bucket${infLabel} ${data.count}`);
        lines.push(`${name}_sum${labelKey} ${data.sum}`);
        lines.push(`${name}_count${labelKey} ${data.count}`);
      }
    }

    return lines.join("\n") + "\n";
  }

  public resetForTesting(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }
}

export const defaultPrometheusRegistry = new PrometheusRegistry();

export function initDefaultMetrics(registry = defaultPrometheusRegistry): void {
  registry.registerCounter("http_requests_total", "Total count of HTTP requests processed");
  registry.registerHistogram(
    "http_request_duration_ms",
    "HTTP request latency in milliseconds",
    DEFAULT_LATENCY_BUCKETS,
  );
  registry.registerGauge("active_requests_in_flight", "Current number of in-flight HTTP requests");
  registry.registerGauge("process_memory_heap_bytes", "Process memory heap usage in bytes");
  registry.registerGauge("process_uptime_seconds", "Process uptime in seconds");
  registry.registerCounter(
    "llm_inference_requests_total",
    "Total LLM inference and debate calls",
  );
  registry.registerHistogram(
    "llm_inference_duration_ms",
    "LLM inference round-trip latency in milliseconds",
    [100, 250, 500, 1000, 2000, 5000, 10000, 20000, 30000],
  );
  registry.registerCounter("llm_tokens_total", "Total LLM tokens consumed by type and provider");
  registry.registerCounter(
    "ingestion_pipeline_jobs_total",
    "Total ingestion pipeline task executions",
  );
  registry.registerHistogram(
    "ingestion_pipeline_duration_ms",
    "Ingestion pipeline batch execution duration in milliseconds",
    [50, 100, 250, 500, 1000, 3000, 5000, 10000],
  );
  registry.registerCounter("scheduler_runs_total", "Total scheduled background polling cycles");
  registry.registerCounter("scheduler_failures_total", "Total background task failures");
}

initDefaultMetrics();

export function generateTraceId(): string {
  return randomBytes(16).toString("hex");
}

export function generateSpanId(): string {
  return randomBytes(8).toString("hex");
}

export function parseTraceparent(header?: string | null): TraceContext {
  if (header && typeof header === "string") {
    const match = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i.exec(header.trim());
    if (match) {
      return {
        traceId: match[1].toLowerCase(),
        spanId: generateSpanId(),
        parentSpanId: match[2].toLowerCase(),
        traceFlags: match[3],
      };
    }
  }
  return {
    traceId: generateTraceId(),
    spanId: generateSpanId(),
    traceFlags: "01",
  };
}

export function formatTraceparent(context: TraceContext): string {
  return `00-${context.traceId}-${context.spanId}-${context.traceFlags}`;
}

export class SpanBuffer {
  private capacity: number;
  private spans: Span[] = [];

  constructor(capacity = 1000) {
    this.capacity = capacity;
  }

  public record(span: Span): void {
    if (this.spans.length >= this.capacity) {
      this.spans.shift();
    }
    this.spans.push(span);
  }

  public getSpans(filter?: { traceId?: string; name?: string; limit?: number }): Span[] {
    let result = [...this.spans];
    if (filter?.traceId) {
      result = result.filter((s) => s.traceId === filter.traceId);
    }
    if (filter?.name) {
      result = result.filter((s) => s.name.includes(filter.name!));
    }
    if (filter?.limit && filter.limit > 0) {
      result = result.slice(-filter.limit);
    }
    return result;
  }

  public clear(): void {
    this.spans = [];
  }

  public size(): number {
    return this.spans.length;
  }
}

export const defaultSpanBuffer = new SpanBuffer(1000);

export class ActiveSpan {
  public span: Span;
  private buffer: SpanBuffer;

  constructor(
    name: string,
    context: TraceContext,
    kind: SpanKind = "INTERNAL",
    attributes: Record<string, string | number | boolean> = {},
    buffer = defaultSpanBuffer,
  ) {
    this.buffer = buffer;
    this.span = {
      id: context.spanId,
      traceId: context.traceId,
      parentSpanId: context.parentSpanId,
      name,
      kind,
      startTimeMs: Date.now(),
      status: "UNSET",
      attributes: { ...attributes },
      events: [],
    };
  }

  public setAttribute(key: string, value: string | number | boolean): this {
    this.span.attributes[key] = value;
    return this;
  }

  public addEvent(name: string, attributes?: Record<string, string | number | boolean>): this {
    this.span.events.push({
      name,
      timestampMs: Date.now(),
      attributes,
    });
    return this;
  }

  public setStatus(status: SpanStatus, message?: string): this {
    this.span.status = status;
    if (message) this.span.statusMessage = message;
    return this;
  }

  public end(status: SpanStatus = "OK", message?: string): Span {
    this.span.endTimeMs = Date.now();
    this.span.durationMs = Math.max(0, this.span.endTimeMs - this.span.startTimeMs);
    if (this.span.status === "UNSET") {
      this.span.status = status;
    }
    if (message && !this.span.statusMessage) {
      this.span.statusMessage = message;
    }
    this.buffer.record(this.span);
    return this.span;
  }
}

export function startTraceSpan(
  name: string,
  parentContext?: TraceContext,
  kind: SpanKind = "INTERNAL",
  attributes: Record<string, string | number | boolean> = {},
  buffer = defaultSpanBuffer,
): ActiveSpan {
  const context: TraceContext = parentContext
    ? {
        traceId: parentContext.traceId,
        spanId: generateSpanId(),
        parentSpanId: parentContext.spanId,
        traceFlags: parentContext.traceFlags,
      }
    : {
        traceId: generateTraceId(),
        spanId: generateSpanId(),
        traceFlags: "01",
      };

  return new ActiveSpan(name, context, kind, attributes, buffer);
}

export async function traceLlmInference<T>(
  provider: string,
  task: string,
  fn: () => Promise<T>,
  registry = defaultPrometheusRegistry,
  parentContext?: TraceContext,
): Promise<T> {
  const targetRegistry =
    registry && typeof registry.incrementCounter === "function"
      ? registry
      : defaultPrometheusRegistry;
  const span = startTraceSpan(`llm.inference ${provider}`, parentContext, "CLIENT", {
    "llm.provider": provider,
    "llm.task": task,
  });
  const start = performance.now();
  targetRegistry.incrementCounter("llm_inference_requests_total", { provider, task });

  try {
    const result = await fn();
    const duration = Math.round(performance.now() - start);
    targetRegistry.observeHistogram("llm_inference_duration_ms", duration, {
      provider,
      task,
      status: "ok",
    });
    span.setAttribute("llm.duration_ms", duration);
    span.end("OK");
    return result;
  } catch (error) {
    const duration = Math.round(performance.now() - start);
    targetRegistry.observeHistogram("llm_inference_duration_ms", duration, {
      provider,
      task,
      status: "error",
    });
    span.setStatus("ERROR", error instanceof Error ? error.message : String(error));
    span.end("ERROR");
    throw error;
  }
}

export async function traceIngestionPipeline<T>(
  indicatorId: string,
  fn: () => Promise<T>,
  registry = defaultPrometheusRegistry,
  parentContext?: TraceContext,
): Promise<T> {
  const targetRegistry =
    registry && typeof registry.incrementCounter === "function"
      ? registry
      : defaultPrometheusRegistry;
  const span = startTraceSpan(`ingestion.pipeline ${indicatorId}`, parentContext, "INTERNAL", {
    "ingestion.indicator_id": indicatorId,
  });
  const start = performance.now();
  targetRegistry.incrementCounter("ingestion_pipeline_jobs_total", {
    indicator: indicatorId,
    status: "started",
  });

  try {
    const result = await fn();
    const duration = Math.round(performance.now() - start);
    targetRegistry.observeHistogram("ingestion_pipeline_duration_ms", duration, {
      indicator: indicatorId,
      status: "succeeded",
    });
    targetRegistry.incrementCounter("ingestion_pipeline_jobs_total", {
      indicator: indicatorId,
      status: "succeeded",
    });
    span.setAttribute("ingestion.duration_ms", duration);
    span.end("OK");
    return result;
  } catch (error) {
    const duration = Math.round(performance.now() - start);
    targetRegistry.observeHistogram("ingestion_pipeline_duration_ms", duration, {
      indicator: indicatorId,
      status: "failed",
    });
    targetRegistry.incrementCounter("ingestion_pipeline_jobs_total", {
      indicator: indicatorId,
      status: "failed",
    });
    span.setStatus("ERROR", error instanceof Error ? error.message : String(error));
    span.end("ERROR");
    throw error;
  }
}

export interface TracedRequest extends Request {
  traceContext?: TraceContext;
}

export function otelTracingMiddleware(
  registry = defaultPrometheusRegistry,
  buffer = defaultSpanBuffer,
) {
  const targetRegistry =
    registry && typeof registry.incrementCounter === "function"
      ? registry
      : defaultPrometheusRegistry;
  const targetBuffer =
    buffer && typeof buffer.record === "function" ? buffer : defaultSpanBuffer;

  return (req: Request, res: Response, next: NextFunction): void => {
    const incomingHeader =
      (req.headers["traceparent"] as string) || (req.headers["x-traceparent"] as string);
    const traceCtx = parseTraceparent(incomingHeader);
    (req as TracedRequest).traceContext = traceCtx;

    const span = new ActiveSpan(
      `HTTP ${req.method} ${req.path}`,
      traceCtx,
      "SERVER",
      {
        "http.method": req.method,
        "http.target": req.path,
        "http.user_agent": (req.headers["user-agent"] as string) ?? "unknown",
      },
      targetBuffer,
    );

    res.setHeader("X-Trace-Id", traceCtx.traceId);
    res.setHeader("traceparent", formatTraceparent(traceCtx));

    targetRegistry.incrementGauge("active_requests_in_flight");
    const startedAt = performance.now();

    res.on("finish", () => {
      targetRegistry.decrementGauge("active_requests_in_flight");
      const durationMs = Math.round(performance.now() - startedAt);
      const statusCode = res.statusCode;

      targetRegistry.incrementCounter("http_requests_total", {
        method: req.method,
        route: req.route?.path || req.path,
        status: statusCode,
      });

      targetRegistry.observeHistogram("http_request_duration_ms", durationMs, {
        method: req.method,
        route: req.route?.path || req.path,
      });

      span.setAttribute("http.status_code", statusCode);
      span.setAttribute("http.duration_ms", durationMs);

      if (statusCode >= 500) {
        span.setStatus("ERROR", `HTTP ${statusCode}`);
      } else {
        span.setStatus("OK");
      }

      span.end();
    });

    next();
  };
}

export function prometheusMetricsHandler(
  _req: Request,
  res: Response,
  registry?: unknown,
): void {
  const targetRegistry =
    registry && typeof (registry as any).exportMetrics === "function"
      ? (registry as PrometheusRegistry)
      : defaultPrometheusRegistry;

  const mem = process.memoryUsage();
  targetRegistry.setGauge("process_memory_heap_bytes", mem.heapUsed);
  targetRegistry.setGauge("process_uptime_seconds", Math.round(process.uptime()));

  const output = targetRegistry.exportMetrics();
  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.status(200).send(output);
}

export function recentTracesHandler(
  req: Request,
  res: Response,
  buffer?: unknown,
): void {
  const targetBuffer =
    buffer && typeof (buffer as any).getSpans === "function"
      ? (buffer as SpanBuffer)
      : defaultSpanBuffer;

  const traceId = typeof req.query.traceId === "string" ? req.query.traceId : undefined;
  const name = typeof req.query.name === "string" ? req.query.name : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 100;

  const spans = targetBuffer.getSpans({ traceId, name, limit });

  res.status(200).json({
    evidence: "institutional-opentelemetry-traces",
    totalSpans: spans.length,
    spans,
  });
}
