#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const telemetryPath = path.join(root, '.ai-company', 'runtime', 'user-telemetry.jsonl');
const reportPath = path.join(root, '.ai-company', 'reports', 'macro-funnel-latency-authoritative-latest.json');
const raw = await readFile(telemetryPath, 'utf8').catch(() => '');
const events = raw.split('\n').filter(Boolean).map((line) => JSON.parse(line));
const durations = new Map();
for (const event of events) {
  if (typeof event.durationMs !== 'number' || !Number.isFinite(event.durationMs) || event.durationMs < 0) continue;
  const values = durations.get(event.eventType) ?? [];
  values.push(event.durationMs);
  durations.set(event.eventType, values);
}
const percentile = (values, p) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)];
};
const byEventType = Object.fromEntries([...durations.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([eventType, values]) => [eventType, {
  samples: values.length,
  min_ms: Math.min(...values),
  p50_ms: percentile(values, 0.5),
  p95_ms: percentile(values, 0.95),
  max_ms: Math.max(...values),
}]));
const hydrationBatches = events
  .filter((event) => event.eventType === 'hydration_batch' && typeof event.durationMs === 'number' && Number.isFinite(event.durationMs))
  .reduce((groups, event) => {
    const key = event.sessionId ?? 'unknown';
    const group = groups.get(key) ?? [];
    group.push(event);
    groups.set(key, group);
    return groups;
  }, new Map());
const hydrationIntervals = [];
for (const group of hydrationBatches.values()) {
  group.sort((a, b) => String(a.timestamp ?? '').localeCompare(String(b.timestamp ?? '')));
  let previous = 0;
  for (const event of group) {
    hydrationIntervals.push(Math.max(0, event.durationMs - previous));
    previous = event.durationMs;
  }
}
const hydrationIntervalStats = hydrationIntervals.length ? {
  samples: hydrationIntervals.length,
  min_ms: Math.min(...hydrationIntervals),
  p50_ms: percentile(hydrationIntervals, 0.5),
  p95_ms: percentile(hydrationIntervals, 0.95),
  max_ms: Math.max(...hydrationIntervals),
  interpretation: 'derived interval from cumulative hydration_batch durations; first interval is measured from hydration start',
} : null;
const report = {
  generated_at: new Date().toISOString(),
  source: telemetryPath,
  measurement: 'bounded local Macro OS funnel latency',
  event_count: events.length,
  session_count: new Set(events.map((event) => event.sessionId).filter(Boolean)).size,
  by_event_type: byEventType,
  hydration_batch_interval_ms: hydrationIntervalStats,
  observed_error_events: events.filter((event) => event.eventType === 'journey_step_error').length,
  status: 'MEASURED_LOCAL_NO_PRODUCTION_SLO_CLAIM',
  limitation: 'No production traffic or approved product latency SLO is inferred from this local sample.',
};
await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ report: path.relative(root, reportPath), event_count: report.event_count, session_count: report.session_count, measured_types: Object.keys(byEventType).length, status: report.status }, null, 2));
