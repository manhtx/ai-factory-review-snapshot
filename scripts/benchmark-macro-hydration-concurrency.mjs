#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const baseUrl = (process.env.MACRO_BENCHMARK_BASE_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const reportPath = path.join(root, '.ai-company', 'reports', 'macro-hydration-concurrency-benchmark-latest.json');
const trials = Number(process.env.MACRO_BENCHMARK_TRIALS ?? 3);
const fetchJson = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
};
const snapshots = await fetchJson(`${baseUrl}/api/snapshots`);
const run = async (concurrency) => {
  const samples = [];
  for (let trial = 0; trial < trials; trial += 1) {
    const started = Date.now();
    let completed = 0;
    let failures = 0;
    for (let offset = 0; offset < snapshots.length; offset += concurrency) {
      const batch = snapshots.slice(offset, offset + concurrency);
      const settled = await Promise.allSettled(batch.map((snapshot) => fetchJson(`${baseUrl}/api/series/${encodeURIComponent(snapshot.indicatorId)}?limit=2000`)));
      completed += settled.filter((result) => result.status === 'fulfilled' && result.value?.researchEligibility?.operationSupported === true).length;
      failures += settled.filter((result) => result.status === 'rejected' || result.value?.researchEligibility?.operationSupported !== true).length;
    }
    samples.push({ trial: trial + 1, duration_ms: Date.now() - started, evidence_eligible: completed, failures });
  }
  const values = samples.map((sample) => sample.duration_ms).sort((a, b) => a - b);
  return { concurrency, samples, p50_ms: values[Math.floor(values.length / 2)] ?? null, min_ms: values[0] ?? null, max_ms: values.at(-1) ?? null, evidence_eligible: samples.map((sample) => sample.evidence_eligible), failures: samples.map((sample) => sample.failures) };
};
const baseline = await run(3);
const candidate = await run(2);
const report = {
  generated_at: new Date().toISOString(),
  base_url: baseUrl,
  snapshot_count: snapshots.length,
  trials,
  baseline,
  candidate,
  comparison: { duration_delta_ms_p50: candidate.p50_ms == null || baseline.p50_ms == null ? null : candidate.p50_ms - baseline.p50_ms, failure_delta: (candidate.failures.reduce((a, b) => a + b, 0) - baseline.failures.reduce((a, b) => a + b, 0)) },
  outcome: 'INCONCLUSIVE_LOCAL_RUNTIME_MEASUREMENT',
  limitation: 'This endpoint benchmark is not browser first-paint evidence and does not establish a production SLO or user-value WIN.',
};
await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ report: path.relative(root, reportPath), snapshot_count: snapshots.length, baseline_p50_ms: baseline.p50_ms, candidate_p50_ms: candidate.p50_ms, outcome: report.outcome }, null, 2));
