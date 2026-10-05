import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(process.argv[2] ?? process.cwd());
const source = resolve(root, 'server/aiCompany/waitWake.ts');
const { WaitWakeLedger } = await import(pathToFileURL(source).href);
const dir = await mkdtemp(join(tmpdir(), 'takeover-wait-probe-'));
try {
  const ledger = new WaitWakeLedger(dir);
  const base = { project_id: 'ISOLATED', workflow_id: 'probe', state: 'AWAITING_REAL_EVIDENCE', wake_type: 'EVENT', wake_condition: 'sample', earliest_time: null, deadline: null, evidence_required: ['sample'], next_action: 'inspect' };
  const unknownWake = await ledger.wait({ ...base, wake_type: 'FUTURE_WAKE' });
  const unknownState = await ledger.wait({ ...base, state: 'FUTURE_STATE' });
  const invalidTimer = await ledger.wait({ ...base, wake_type: 'TIMER', earliest_time: 'not-a-date' });
  const eventDue = await ledger.due(new Date('2026-10-01T00:00:00Z'), 'sample');
  const manualDue = await ledger.due(new Date('2026-10-01T00:00:00Z'), 'founder-approved');
  const farFuture = await ledger.due(new Date('2099-01-01T00:00:00Z'));
  console.log(JSON.stringify({ schema: 'successor-takeover.wait-state-probe.v1', sourceSha256: createHash('sha256').update(await readFile(source)).digest('hex'),
    unknownWakeAccepted: unknownWake.wake_type === 'FUTURE_WAKE',
    unknownWakeUsesManualFallback: manualDue.some(row => row.wait_id === unknownWake.wait_id),
    unknownStateBecomesDue: eventDue.some(row => row.wait_id === unknownState.wait_id),
    invalidTimerPersisted: (await ledger.records()).some(row => row.wait_id === invalidTimer.wait_id),
    invalidTimerDueIn2099: farFuture.some(row => row.wait_id === invalidTimer.wait_id),
    claimLimit: 'Temporary-directory function reproduction only; no live event, approval, executor or runtime invocation.',
  }, null, 2));
} finally {
  await rm(dir, { recursive: true, force: true });
}
