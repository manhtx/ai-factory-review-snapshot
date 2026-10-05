#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const indicatorId = process.env.AUDIT_INDICATOR_ID ?? 'cpi-us';
const seriesId = process.env.AUDIT_FRED_SERIES_ID ?? 'CPIAUCSL';
const baseUrl = (process.env.AUDIT_BASE_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const key = process.env.FRED_API_KEY;
if (!key) throw new Error('FRED_API_KEY is required; no provider call was made');
const fredUrl = new URL('https://api.stlouisfed.org/fred/series/observations');
fredUrl.search = new URLSearchParams({ series_id: seriesId, api_key: key, file_type: 'json', sort_order: 'asc', limit: '100000', units: 'pc1' });
const fredResponse = await fetch(fredUrl);
if (!fredResponse.ok) throw new Error(`FRED returned ${fredResponse.status}`);
const fred = await fredResponse.json();
const apiResponse = await fetch(`${baseUrl}/api/series/${encodeURIComponent(indicatorId)}?limit=10`);
if (!apiResponse.ok) throw new Error(`local API returned ${apiResponse.status}`);
const api = await apiResponse.json();
const providerRows = (fred.observations ?? []).filter((row) => row.value !== '.').slice(-10);
const apiRows = api.series ?? [];
const byDate = new Map(apiRows.map((row) => [row.date, row]));
const comparisons = providerRows.map((row) => ({
  period: row.date,
  provider_value: Number(row.value),
  provider_revision: row.realtime_start ?? null,
  api_value: byDate.get(row.date)?.value ?? null,
  api_vintage: byDate.get(row.date)?.vintage ?? null,
  revision_match: row.realtime_start === byDate.get(row.date)?.vintage?.slice(0, 10),
}));
const report = {
  generated_at: new Date().toISOString(), indicator_id: indicatorId, provider: 'fred', series_id: seriesId,
  status: comparisons.length > 0 && comparisons.every((row) => row.revision_match) ? 'PASS' : 'REVISE',
  provider_rows_checked: comparisons.length, comparisons,
  limitations: ['Read-only probe; no ingestion or mutation performed.', 'A mismatch means deployed ingestion has not yet persisted provider revision identity; it is not repaired by the read path.'],
};
const output = process.env.AUDIT_OUTPUT ?? path.join(process.cwd(), '.ai-company/reports/fred-revision-parity-latest.json');
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ status: report.status, output, checked: report.provider_rows_checked, mismatches: comparisons.filter((row) => !row.revision_match).length }, null, 2));
if (report.status !== 'PASS') process.exitCode = 1;
