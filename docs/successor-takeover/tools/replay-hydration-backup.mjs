import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Historical read-only rehearsal only. Never import the server DB initializer.
const [candidate, backup, output] = process.argv.slice(2);
if (!candidate || !backup || !output) throw new Error('Usage: node --import tsx replay-hydration-backup.mjs <candidate> <verified-backup> <new-output>');
const backupSha256 = createHash('sha256').update(readFileSync(backup)).digest('hex');
if (backupSha256 !== 'f88bd0896dc5879d48b39b8aa3335b0a35b158ea55295dd769a1f68a3d16f80c') throw new Error('F0_BACKUP_IDENTITY_MISMATCH');
const moduleAt = relative => import(pathToFileURL(path.join(candidate, relative)).href);
const { admitHydratedIndicator } = await moduleAt('src/app/services/hydrationAdmission.ts');
const { indicatorCatalogMetadata } = await moduleAt('src/app/data/indicatorCatalogMetadata.ts');
const { normalizeIndicator } = await moduleAt('src/app/data/dataContract.ts');
const config = await moduleAt('src/app/config/dataSources.ts');
const { freshnessStatus } = await moduleAt('src/app/data/sourceFreshness.ts');
const sources = { ...config.DATA_SOURCES, ...config.MVP_EXPANSION_SOURCES, ...config.OECD_MONTHLY_EXPANSION_SOURCES, ...config.EMERGING_MARKETS_EXPANSION_SOURCES };
const bases = new Map(indicatorCatalogMetadata.map(base => [base.id, normalizeIndicator(base, sources[base.id])]));
const now = new Date();
const db = new DatabaseSync(backup, { readOnly: true });
const snapshots = db.prepare(`WITH ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY indicator_id ORDER BY period DESC, vintage DESC) AS rank FROM observations
) SELECT indicator_id AS indicatorId, period AS date, value, status, quality, source_name AS sourceName,
source_series_id AS sourceSeriesId, unit, frequency, transformation, vintage, ingested_at AS ingestedAt
FROM ranked WHERE rank = 1 ORDER BY indicator_id`).all();
const query = db.prepare(`SELECT indicator_id AS indicatorId, period AS date, value, status, quality,
source_name AS sourceName, source_series_id AS sourceSeriesId, unit, frequency, transformation, vintage, ingested_at AS ingestedAt
FROM (SELECT observations.*, ROW_NUMBER() OVER (
PARTITION BY indicator_id, period ORDER BY vintage DESC, ingested_at DESC, rowid DESC) AS revision_rank
FROM observations WHERE indicator_id = ?) WHERE revision_rank = 1 ORDER BY period DESC LIMIT 2000`);
const results = [];
try {
  for (const snapshot of snapshots) {
    const base = bases.get(snapshot.indicatorId);
    const source = sources[snapshot.indicatorId];
    if (!base || !source) { results.push({ indicatorId: snapshot.indicatorId, admitted: false, reason: 'not in current catalog/source registry' }); continue; }
    const series = query.all(snapshot.indicatorId).reverse().map(row => ({ ...row, sourceUrl: source.sourceUrl, unit: row.unit ?? source.unit ?? null }));
    const apiSnapshot = { ...snapshot, sourceUrl: source.sourceUrl, freshness: freshnessStatus(snapshot.date, source.frequencyLabel, now) };
    try {
      const admitted = admitHydratedIndicator(base, apiSnapshot, { indicatorId: base.id, series }, now);
      results.push({ indicatorId: base.id, admitted: true, frequency: admitted.frequency, unit: admitted.unit,
        transformation: admitted.provenance.transformation, freshness: admitted.provenance.freshness, points: series.length });
    } catch (error) {
      results.push({ indicatorId: base.id, admitted: false, reason: error.message, points: series.length,
        actual: { frequency: snapshot.frequency, unit: snapshot.unit, transformation: snapshot.transformation },
        catalog: { frequency: base.frequency, unit: base.unit, transformation: base.provenance.transformation } });
    }
  }
} finally { db.close(); }
const report = { schema: 'successor-takeover.hydration-backup-replay.v1', authoritative: false,
  generatedAt: now.toISOString(), backupSha256, candidate, total: results.length,
  admitted: results.filter(row => row.admitted).length, withheld: results.filter(row => !row.admitted).length,
  limitations: 'Historical verified F0 SQLite backup and current candidate metadata only. API fallback/query shape reproduced, not live API/provider/storage or source authenticity proof. Provider operation eligibility not adjudicated. Withheld capability requires lineage/semantic reconciliation, not silent removal.', results };
writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ output, total: report.total, admitted: report.admitted, withheld: report.withheld }));
