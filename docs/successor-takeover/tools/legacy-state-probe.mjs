import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Read-only reproduction. Never instantiate a live queue or invoke an executor.
const root = resolve(process.argv[2] ?? process.cwd());
const load = relative => import(pathToFileURL(resolve(root, relative)).href);
const { eligibilityForObjective } = await load('server/aiCompany/objectiveEligibility.ts');
const { selectAutonomousNextAction } = await load('server/aiCompany/autonomousNextAction.ts');
const { runAutonomousWorkflow } = await load('server/aiCompany/autonomousCoordinator.ts');
let executionCalls = 0;
const emptyRun = await runAutonomousWorkflow({
  queue: { records: async () => [] }, projectId: 'ISOLATED_PROBE',
  runId: 'missing-run', namespace: 'ISOLATED_PROBE',
  execute: async () => { executionCalls++; throw new Error('PROBE_MUST_NOT_EXECUTE'); },
});
const sourceFiles = ['server/aiCompany/objectiveEligibility.ts', 'server/aiCompany/autonomousNextAction.ts', 'server/aiCompany/autonomousCoordinator.ts'];
console.log(JSON.stringify({
  schema: 'successor-takeover.legacy-state-probe.v1',
  sourceHashes: Object.fromEntries(sourceFiles.map(file => [file, createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex')])),
  unknownEffectiveState: eligibilityForObjective('objective-1', [{ work_id: 'work-1', objective_id: 'objective-1', effective_state: 'FUTURE_STATE' }]),
  queueStates: Object.fromEntries(['FUTURE_STATE', 'CLAIMED', 'IN_REVIEW', 'QUARANTINED'].map(state => [state, selectAutonomousNextAction({ rows: [{ work_id: 'work-1', state }], completed: [] })])),
  emptyRun, executionCalls,
  claimLimit: 'Direct function reproduction with in-memory fixtures; no observed live dispatch or production incidence inferred.',
}, null, 2));
