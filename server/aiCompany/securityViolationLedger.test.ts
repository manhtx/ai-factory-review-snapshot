import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SecurityViolationLedger } from './securityViolationLedger';

describe('SecurityViolationLedger', () => {
  it('persists a durable prevented boundary event', async () => {
    const ledger = new SecurityViolationLedger(await mkdtemp(path.join(os.tmpdir(), 'security-events-')));
    await ledger.record({ project_id: 'macro-os', run_id: 'r', namespace: 'n', work_id: 'w', assignment_id: 'a', role: 'coder', violation_type: 'FORBIDDEN_PATH', attempted_paths: ['.ai-company/runtime/x'], prevented: true, action: 'BLOCKED' });
    expect(await ledger.records()).toMatchObject([{ prevented: true, action: 'BLOCKED', violation_type: 'FORBIDDEN_PATH' }]);
  });
});
