import { RoleWorkQueue } from '../server/aiCompany/roleWorkQueue.ts';
import { RoleHandoffLedger } from '../server/aiCompany/roleHandoffLedger.ts';
import path from 'node:path';

const root = process.cwd();
const runtime = path.join(root, '.ai-company', 'runtime', 'projects', 'macro-os');
const queue = new RoleWorkQueue(runtime);
const handoffs = new RoleHandoffLedger(runtime);
const stamp = Date.now();

console.log('Creating clean BENCHMARK_B0 baseline runs (3 loops)...');
for (let loop = 1; loop <= 3; loop += 1) {
  const runId = `benchmark-b0-${stamp}-${loop}`;
  const namespace = `benchmark-b0-loop-${loop}`;
  const base = `B0-${stamp}-${loop}`;
  const roles = ['pm', 'functional-qa', 'quality-control', 'ceo-guild'];
  const ids = roles.map((role) => `${base}-${role}`);
  const specs = ids.map((work_id, i) => ({
    work_id,
    project_id: 'macro-os',
    backlog_id: `${base}:baseline-evaluation`,
    title: `Benchmark B0 Loop ${loop}: evaluate assignment, coordination, context efficiency and review for ${roles[i]}`,
    role: roles[i],
    run_id: runId,
    namespace,
    workflow_id: 'benchmark-b0',
    depends_on: i ? [ids[i - 1]] : [],
  }));

  const items = await queue.createBatch(specs);
  for (let i = 0; i < items.length; i += 1) {
    await handoffs.record({
      project_id: 'macro-os',
      work_id: items[i].work_id,
      from_role: i ? items[i - 1].role : 'ceo',
      to_role: items[i].role,
      actor: 'benchmark-b0-coordinator',
      objective: items[i].title,
      context: ['benchmark-b0-spec', 'product-goal-master'],
      evidence_ids: ['benchmark-b0-spec'],
      acceptance_criteria: ['bounded role evidence', 'typed review verdict', 'context composition breakdown'],
    });
  }
  console.log(JSON.stringify({ runId, namespace, backlogPrefix: base, workIds: ids }));
}
console.log('BENCHMARK_B0 batches registered successfully.');
