import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AiUsageLedger } from './aiUsageLedger';

describe('AiUsageLedger', () => {
  it('keeps actual and estimated token provenance separate', async () => {
    const ledger = new AiUsageLedger(await mkdtemp(path.join(os.tmpdir(), 'ai-usage-')));
    await ledger.record({ company_id: 'ai-company', product_id: 'macro-os', run_id: 'r', workflow_id: 'w', task_id: 't', assignment_id: 'a', agent_role: 'pm', provider: 'codex', runner: 'codex', model: 'gpt', prompt_fingerprint: 'fp', input_tokens_actual: null, input_tokens_estimated: 100, output_tokens_actual: 40, output_tokens_estimated: null, total_tokens_actual: null, total_tokens_estimated: 140, latency_ms: 1, retry_count: 0, exit_code: 0, status: 'COMPLETED' });
    expect(await ledger.records()).toMatchObject([{ input_tokens_actual: null, input_tokens_estimated: 100, output_tokens_actual: 40, output_tokens_estimated: null }]);
  });
});
