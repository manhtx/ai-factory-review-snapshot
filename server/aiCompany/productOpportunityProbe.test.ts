import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverTelemetryOpportunity } from './productOpportunityProbe';
import { BacklogLedger } from './backlogLedger';
import { materializeTelemetryOpportunityBacklog } from './productOpportunityProbe';

describe('product opportunity probe', () => {
  it('detects a local compare-to-value drop-off with provenance', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-company-opportunity-')); const rows = [...Array(20)].map((_, i) => JSON.stringify({ eventType: 'indicator_compare', sessionId: `s${i % 4}` })); rows.push(JSON.stringify({ eventType: 'value_moment_achieved', sessionId: 's1' })); await writeFile(join(dir, 'user-telemetry.jsonl'), `${rows.join('\n')}\n`);
    await expect(discoverTelemetryOpportunity(dir)).resolves.toMatchObject({ state: 'CANDIDATE_LOCAL', observed_metrics: { sessions: 4, compare_events: 20, value_events: 1 }, evidence_ids: expect.arrayContaining([`telemetry:${join(dir, 'user-telemetry.jsonl')}`]) });
  });
  it('does not create an opportunity without enough evidence', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-company-opportunity-')); await writeFile(join(dir, 'user-telemetry.jsonl'), '{"eventType":"indicator_compare","sessionId":"s1"}\n'); await expect(discoverTelemetryOpportunity(dir)).resolves.toBeNull();
  });
});

it('materializes a discovered opportunity into an idempotent executable backlog item', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ai-company-opportunity-backlog-'));
  const opportunity = { opportunity_id: 'OPP-1', project_id: 'macro-os', problem: 'drop-off', evidence_ids: ['telemetry:test'], observed_metrics: { value: 0 }, confidence: 0.8, state: 'CANDIDATE_LOCAL' as const, created_at: new Date().toISOString() };
  const ledger = new BacklogLedger(dir);
  await materializeTelemetryOpportunityBacklog(ledger, opportunity);
  await materializeTelemetryOpportunityBacklog(ledger, opportunity);
  await expect(ledger.items('macro-os')).resolves.toHaveLength(1);
});
