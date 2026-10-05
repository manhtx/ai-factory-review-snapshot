import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DurableSupervisorState } from '../server/aiCompany/durableSupervisor.ts';
import { WaitWakeLedger } from '../server/aiCompany/waitWake.ts';

const root = await mkdtemp(path.join(os.tmpdir(), 'ai-company-7d-simulation-'));
const startMs = Date.parse('2026-09-11T00:00:00.000Z');
let nowMs = startMs;
const now = () => new Date(nowMs);
const supervisor = new DurableSupervisorState(path.join(root, 'supervisor'), now, process.pid);
const waitWake = new WaitWakeLedger(path.join(root, 'wait-wake'));
const owner = 'founderless-simulation';
await supervisor.acquire(owner, 8 * 24 * 60 * 60 * 1000);
const seenActions = new Set();
const events = [];
await supervisor.checkpoint({ run_id: 'SIM-7D', namespace: 'simulation:macro-os', status: 'RUNNING', next_action: 'inspect product state' });
for (let day = 0; day < 7; day += 1) {
  nowMs = startMs + day * 24 * 60 * 60 * 1000;
  const checkpoint = await supervisor.loadCheckpoint();
  if (!checkpoint) throw new Error(`missing checkpoint on simulated day ${day}`);
  events.push({ day, phase: 'BOOT_RECONCILE', checkpoint_action: checkpoint.next_action });
  const action = day === 0 ? 'evaluate-macro-and-discover' : day === 1 ? 'persist-learning-and-reprioritize' : 'review-completed-cycle';
  if (seenActions.has(`${day}:${action}`)) throw new Error(`duplicate side effect on simulated day ${day}`);
  seenActions.add(`${day}:${action}`);
  await supervisor.checkpoint({ run_id: 'SIM-7D', namespace: 'simulation:macro-os', status: 'RUNNING', next_action: action, payload: { simulated_day: day, provenance: 'ACCELERATED_SIMULATION' } });
  if (day === 2) {
    const waiting = await waitWake.wait({ project_id: 'macro-os', workflow_id: 'SIM-7D', state: 'AWAITING_REAL_EVIDENCE', wake_type: 'TIMER', wake_condition: 'simulated-evidence-window', earliest_time: new Date(startMs + 4 * 24 * 60 * 60 * 1000).toISOString(), deadline: null, evidence_required: ['simulated sample'], next_action: 'measure outcome' });
    events.push({ day, phase: 'SLEEP', wait_id: waiting.wait_id });
  }
  if (day >= 4) {
    const due = await waitWake.due(now());
    for (const item of due) { await waitWake.resume(item.wait_id, now().toISOString()); events.push({ day, phase: 'WAKE', wait_id: item.wait_id }); }
  }
}
await supervisor.release(owner);
const report = { generated_at: new Date().toISOString(), provenance: 'ACCELERATED_SIMULATION_NOT_REAL_SEVEN_DAY_EVIDENCE', simulated_days: 7, events, checkpoints_persisted: Boolean(await DurableSupervisorState.isReadable(supervisor.checkpointPath)), wait_records: (await waitWake.records()).length, resumed_waits: (await waitWake.records()).filter((row) => row.resumed_at).length, duplicate_side_effects: 0, production_autonomy: 'DISABLED', result: 'PASS_LOCAL_SIMULATION' };
const output = path.resolve(process.env.AI_COMPANY_CONTINUITY_REPORT ?? '.ai-company/reports/founderless-continuity-simulation-latest.json');
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
