import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readProductRealitySnapshot } from './productRealityProbe';

describe('product reality probe', () => {
  it('classifies local telemetry without overclaiming product outcome', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-company-product-'));
    await writeFile(join(dir, 'user-telemetry.jsonl'), '{"eventType":"indicator_inspect","sessionId":"s1"}\n{"eventType":"value_moment_achieved","sessionId":"s1"}\n');
    await expect(readProductRealitySnapshot(dir)).resolves.toMatchObject({ event_count: 2, session_count: 1, journey_completion_events: 1, evidence_state: 'LOCAL_ONLY' });
  });
  it('requires an explicit production marker for production observation', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-company-product-'));
    await writeFile(join(dir, 'user-telemetry.jsonl'), '{"eventType":"indicator_compare","sessionId":"s2","isProduction":true}\n{"eventType":"compare_explanation_opened","sessionId":"s2","provenance":"production_attested"}\n');
    await expect(readProductRealitySnapshot(dir)).resolves.toMatchObject({ evidence_state: 'PRODUCTION_OBSERVED' });
  });
  it('does not trust the legacy caller-controlled isProduction field', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-company-product-'));
    await writeFile(join(dir, 'user-telemetry.jsonl'), '{"eventType":"indicator_compare","sessionId":"s3","isProduction":true}\n');
    await expect(readProductRealitySnapshot(dir)).resolves.toMatchObject({ evidence_state: 'LOCAL_ONLY' });
  });
});
