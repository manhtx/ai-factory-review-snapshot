import { expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { RoleWorkQueue } from './roleWorkQueue';
import { runAutonomousWorkflow } from './autonomousCoordinator';

it('fails closed instead of fabricating structured output or review PASS', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'implicit-completion-guard-'));
  const queue = new RoleWorkQueue(root);
  const item = await queue.create({ project_id: 'macro-os', backlog_id: 'B-GUARD', title: 'guard probe', role: 'pm' });
  const result = await runAutonomousWorkflow({
    queue,
    projectId: 'macro-os',
    runId: item.assignment!.run_id,
    namespace: item.assignment!.namespace,
    execute: async () => ({ evidence_ids: ['EVID:GUARD-ONLY'] }),
  });
  expect(result.status).toBe('BLOCKED_EXTERNAL');
  expect(result.failure_reason).toContain('Structured output missing');
  expect((await queue.records()).find((row) => row.work_id === item.work_id)?.state).toBe('BLOCKED');
});
