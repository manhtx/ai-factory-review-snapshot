#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = (process.env.AUDIT_BASE_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const indicatorId = process.env.AUDIT_INDICATOR_ID ?? 'cpi-us';
const limit = Math.min(10000, Math.max(2, Number(process.env.AUDIT_LIMIT ?? 100)));
const generatedAt = new Date().toISOString();
const healthResponse = await fetch(`${baseUrl}/api/health`);
if (!healthResponse.ok) throw new Error(`health returned ${healthResponse.status}`);
const health = await healthResponse.json();
const seriesResponse = await fetch(`${baseUrl}/api/series/${encodeURIComponent(indicatorId)}?limit=${limit}`);
if (!seriesResponse.ok) throw new Error(`series returned ${seriesResponse.status}`);
const payload = await seriesResponse.json();
const rows = Array.isArray(payload.series) ? payload.series : [];
const periods = rows.map((row) => String(row.date ?? ''));
const validPeriods = periods.every((period) => /^\d{4}-\d{2}-\d{2}$/.test(period));
const uniquePeriods = new Set(periods).size;
const chronological = periods.every((period, index) => index === 0 || periods[index - 1] < period);
const latest = rows.at(-1) ?? null;
const report = {
  generated_at: generatedAt,
  base_url: baseUrl,
  indicator_id: indicatorId,
  requested_limit: limit,
  status: rows.length > 0 && validPeriods && uniquePeriods === rows.length && chronological ? 'PASS' : 'FAIL',
  health: { status: health.status, database: health.database, durable_persistence: health.durablePersistence, supabase_connected: health.supabase?.connected ?? false, production_ready: health.productionReady ?? false, runtime_revision: health.runtimeRevision },
  series: { row_count: rows.length, unique_period_count: uniquePeriods, valid_periods: validPeriods, chronological, duplicate_periods: periods.filter((period, index) => periods.indexOf(period) !== index), latest },
  limitations: ['Read-only HTTP probe; does not claim user-value improvement or production readiness.', 'Provider freshness is evaluated against the provider contract, not inferred from the current date alone.'],
};
const output = process.env.AUDIT_OUTPUT ?? path.join(process.cwd(), '.ai-company/reports/api-period-integrity-latest.json');
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ status: report.status, output, row_count: rows.length, unique_periods: uniquePeriods, latest_period: latest?.date ?? null }, null, 2));
if (report.status !== 'PASS') process.exitCode = 1;
