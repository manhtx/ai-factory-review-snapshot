#!/usr/bin/env node
/** Deterministically measure Codex transport and completion-marker reliability. */
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const logDir = path.join(root, '.ai-company', 'logs', 'roles');
const report = path.join(root, '.ai-company', 'reports', 'codex-transport-authoritative-latest.json');
const names = (await readdir(logDir).catch(() => [])).filter((name) => name.endsWith('.log'));
const rows = [];
const timestampFromName = (name) => {
  const match = name.match(/^(\d{4}-\d{2}-\d{2})T(\d{6})\.(\d{3})Z/);
  if (!match) return null;
  const [, date, clock, millis] = match;
  return `${date}T${clock.slice(0, 2)}:${clock.slice(2, 4)}:${clock.slice(4, 6)}.${millis}Z`;
};
for (const name of names) {
  const text = await readFile(path.join(logDir, name), 'utf8');
  if (!text.includes('codex_api')) continue;
  const reconnects = (text.match(/(?:Reconnecting\. \d+\/\d+|retrying sampling request)/g) ?? []).length;
  const http503 = (text.match(/HTTP error: 503 Service Unavailable/g) ?? []).length;
  const markerMissing = text.includes('Role completion marker missing');
  const completed = text.includes('ROLE_DISPATCH_COMPLETE');
  rows.push({ log: path.relative(root, path.join(logDir, name)), started_at: timestampFromName(name), reconnects, http503, marker_missing: markerMissing, dispatch_complete: completed });
}
const datedRows = rows.filter((row) => row.started_at).sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at));
const failedRows = rows.filter((row) => row.reconnects > 0 || row.http503 > 0 || row.marker_missing);
const reconnectEvents = rows.reduce((n, row) => n + row.reconnects, 0);
const http503Events = rows.reduce((n, row) => n + row.http503, 0);
const output = {
  generated_at: new Date().toISOString(),
  source: '.ai-company/logs/roles',
  logs_with_codex_transport_events: rows.length,
  reconnect_events: reconnectEvents,
  http_503_events: http503Events,
  marker_missing_events: rows.filter((row) => row.marker_missing).length,
  dispatch_completed_events: rows.filter((row) => row.dispatch_complete).length,
  observed_window: datedRows.length ? { started_at: datedRows[0].started_at, ended_at: datedRows.at(-1).started_at } : null,
  failed_log_rate: rows.length ? Number((failedRows.length / rows.length).toFixed(4)) : null,
  clean_logs: rows.length - failedRows.length,
  mean_reconnects_per_log: rows.length ? Number((reconnectEvents / rows.length).toFixed(2)) : null,
  mean_http_503_per_log: rows.length ? Number((http503Events / rows.length).toFixed(2)) : null,
  classification_policy: 'log-derived; no synthetic success and no mutation of queue state',
  events: rows,
};
await mkdir(path.dirname(report), { recursive: true });
await writeFile(report, JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ report: path.relative(root, report), logs: rows.length, reconnects: output.reconnect_events, http503: output.http_503_events, marker_missing: output.marker_missing_events }));
