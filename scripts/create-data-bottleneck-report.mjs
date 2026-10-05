#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DATA_SOURCES } from '../src/app/config/dataSources.ts';

const root = process.cwd();
const reportsDir = path.join(root, '.ai-company', 'reports');
const names = (await import('node:fs')).readdirSync(reportsDir)
  .filter((name) => /^real-data-audit-.*\.json$/.test(name)).sort();
if (!names.length) throw new Error('No real-data audit report found');
const auditName = names.at(-1);
const audit = JSON.parse(await readFile(path.join(reportsDir, auditName), 'utf8'));
const fredPath = path.join(reportsDir, 'fred-contract-authoritative-latest.json');
let fredContract = null;
try { fredContract = JSON.parse(await readFile(fredPath, 'utf8')); } catch { /* optional audit input */ }
const rows = audit.freshnessAudit ?? [];
const sourceOf = (id) => DATA_SOURCES[id] ?? null;
const classify = (row) => {
  const source = sourceOf(row.indicatorId);
  if (!source) return 'UNMAPPED_INDICATOR';
  if (row.freshnessState === 'outdated') return 'OUTDATED_SOURCE_OR_INGESTION';
  if (row.freshnessState === 'delayed') return 'NORMAL_RELEASE_LAG_OR_INGESTION_SLA';
  return 'CURRENT';
};
const groups = {};
for (const row of rows) {
  const key = classify(row);
  (groups[key] ??= []).push({ ...row, provider: sourceOf(row.indicatorId)?.type ?? null, source: sourceOf(row.indicatorId)?.source ?? null, frequency: sourceOf(row.indicatorId)?.frequencyLabel ?? null });
}
const report = {
  generated_at: new Date().toISOString(),
  audit_report: path.relative(root, path.join(reportsDir, auditName)),
  status: audit.auditStatus,
  catalog_count: rows.length,
  counts: Object.fromEntries(Object.entries(groups).map(([key, value]) => [key, value.length])),
  unhydrated_indicators: audit.unhydratedIndicators ?? [],
  provider_contract: fredContract ? { report: path.relative(root, fredPath), status: fredContract.status, total: fredContract.total, reachable: fredContract.reachable, contract404: fredContract.contract404 ?? [], transient_failures: fredContract.transientFailures ?? [] } : null,
  groups,
  policy: {
    no_synthetic_fallback: true,
    no_provider_claim_without_verified_source: true,
    production_autonomy: 'DISABLED',
    production_release: 'HUMAN_GATED',
  },
  next_actions: [
    'Prioritize OUTDATED_SOURCE_OR_INGESTION by product importance and provider availability.',
    'For delayed series, compare expected release cadence with the configured scheduler SLA before changing frequency.',
    'Resolve every unhydrated indicator with a verified source or keep it explicitly unavailable; never backfill synthetic values.',
  ],
};
const stamp = new Date().toISOString().replaceAll(':', '').replaceAll('.', '');
const jsonPath = path.join(reportsDir, `DATA_BOTTLENECK_REMEDIATION_${stamp}.json`);
const latestPath = path.join(reportsDir, 'data-bottleneck-remediation-latest.json');
const mdPath = path.join(reportsDir, 'DATA_BOTTLENECK_REMEDIATION_LATEST.md');
const table = Object.entries(report.counts).map(([key, count]) => `| ${key} | ${count} |`).join('\n');
const md = `# Data Bottleneck Remediation\n\nGenerated: ${report.generated_at}\n\nAuthoritative input: \`${report.audit_report}\`\n\nThis report separates provenance/label integrity from actual recency. It is diagnostic evidence, not permission to claim current data.\n\n## Counts\n\n| Class | Count |\n|---|---:|\n${table}\n\n## Unhydrated indicators\n\n${report.unhydrated_indicators.length ? report.unhydrated_indicators.map((id) => `- \`${id}\``).join('\n') : '- None'}\n\n## Next actions\n\n${report.next_actions.map((x) => `- ${x}`).join('\n')}\n\nProduction autonomy: **DISABLED**  \nProduction release: **HUMAN-GATED**\n`;
await Promise.all([
  writeFile(jsonPath, JSON.stringify(report, null, 2) + '\n'),
  writeFile(latestPath, JSON.stringify(report, null, 2) + '\n'),
  writeFile(mdPath, md),
]);
console.log(JSON.stringify({ jsonPath, latestPath, mdPath, counts: report.counts, unhydrated: report.unhydrated_indicators.length }, null, 2));
