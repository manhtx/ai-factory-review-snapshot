import { describe, expect, it } from 'vitest';
import { BoundedOrchestrator } from './orchestrator';
import { CompanyStateStore } from './stateStore';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

describe('production orchestrator configuration', () => {
  it('requires a release gate in production', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const orchestrator = new BoundedOrchestrator(new CompanyStateStore(await mkdtemp(path.join(os.tmpdir(), 'prod-'))), [{ id: 'coder', run: async () => ({ worker_id: 'coder', ok: true, evidence_ids: ['E'] }) }]);
      await expect(orchestrator.run({ task_id: 'T', project_id: 'p', risk_level: 'P2', acceptance_criteria: ['x'], budget: { max_attempts: 1, timeout_seconds: 1 } })).rejects.toThrow('requires release gate');
    } finally { process.env.NODE_ENV = previous; }
  });
});
