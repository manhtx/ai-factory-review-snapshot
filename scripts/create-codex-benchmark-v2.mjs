import { RoleWorkQueue } from '../server/aiCompany/roleWorkQueue.ts';
import { RoleHandoffLedger } from '../server/aiCompany/roleHandoffLedger.ts';
import path from 'node:path';
const root = process.cwd(); const runtime = path.join(root, '.ai-company', 'runtime', 'projects', 'macro-os');
const queue = new RoleWorkQueue(runtime); const handoffs = new RoleHandoffLedger(runtime); const stamp = Date.now();
for (let loop = 1; loop <= 3; loop += 1) {
  const runId = `codex-v2-${stamp}-${loop}`, namespace = `benchmark-v2-${loop}`, base = `CODEX-V2-${stamp}-${loop}`;
  const ids = ['pm','functional-qa','quality-control','ceo-guild'].map((role) => `${base}-${role}`);
  const specs = ids.map((work_id, i) => ({ work_id, project_id:'macro-os', backlog_id:`${base}:recoverable-hold`, title:`Benchmark V2 loop ${loop}: evaluate assignment, coordination, recovery and CEO review`, role: ['pm','functional-qa','quality-control','ceo-guild'][i], run_id:runId, namespace, workflow_id:'codex-benchmark-v2', depends_on:i ? [ids[i-1]] : [] }));
  const items = await queue.createBatch(specs);
  for (let i = 0; i < items.length; i += 1) await handoffs.record({ project_id:'macro-os', work_id:items[i].work_id, from_role:i ? items[i-1].role : 'ceo', to_role:items[i].role, actor:'benchmark-v2-coordinator', objective:items[i].title, context:['benchmark-v2-spec','product-goal'], evidence_ids:['benchmark-v2-spec'], acceptance_criteria:['bounded role evidence','typed completion marker'] });
  console.log(JSON.stringify({runId,namespace,backlogPrefix:base,workIds:ids}));
}
