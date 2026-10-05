import { expect, it } from 'vitest'; import { mkdtemp } from 'node:fs/promises'; import os from 'node:os'; import path from 'node:path'; import { RoleWorkQueue } from './roleWorkQueue'; import { runAutonomousWorkflow } from './autonomousCoordinator'; import type { RecoveryPlan } from './recoveryPlan';
import { InMemoryEvidenceResolver } from './evidenceResolver';
import type { RoleWorkItem } from './roleWorkQueue';
import type { RoleWorkExecutor } from './roleWorkExecutor';

function registerFixture(resolver: InMemoryEvidenceResolver, item: RoleWorkItem, id: string) {
  const row = resolver.createEvidence({ evidence_id: id, namespace: item.assignment!.namespace, run_id: item.assignment!.run_id, produced_by_role: item.role, content: 'Isolated workflow fixture; no product effect or outcome proof.' });
  resolver.register({ ...row, work_id: item.work_id, source_artifact: 'autonomousCoordinator.test.ts' });
}

const pmOutput = (id: string) => ({ role: 'pm' as const, problem: 'test problem', target_user: 'Macro Analyst', product_goal_objective: 'Reliable research workflow', evidence_ids: [id], facts: ['test fact'], assumptions: [], scope: ['assigned scope'], non_goals: [], recommendation: 'PROCEED', confidence: 0.8, unknowns: [] });
it('advances one invocation through ready work and bounded terminal state',async()=>{const resolver=new InMemoryEvidenceResolver();const queue=new RoleWorkQueue(await mkdtemp(path.join(os.tmpdir(),'auto-')),resolver);const a=await queue.create({project_id:'macro-os',backlog_id:'B',title:'a',role:'pm'});await queue.create({project_id:'macro-os',backlog_id:'B',title:'b',role:'functional-qa',run_id:a.assignment!.run_id,namespace:a.assignment!.namespace,depends_on:[a.work_id]});registerFixture(resolver,a,`E:${a.work_id}`);const execute:RoleWorkExecutor=async(item)=>item.role==='pm'?({evidence_ids:[`E:${item.work_id}`],structured_output:pmOutput(`E:${item.work_id}`)}):({evidence_ids:[`E:${a.work_id}`],review_verdict:{verdict:'PASS',gate:'qa',summary:'dependency fixture inspected',evidence:[`E:${a.work_id}`],failure_class:'NONE',root_cause:'none',recovery_required:false,recovery_actions:[],unblock_evidence:[],retry_budget:0,next_review_trigger:'none',confidence:1}});const result=await runAutonomousWorkflow({queue,projectId:'macro-os',runId:a.assignment!.run_id,namespace:a.assignment!.namespace,execute});expect(result.status).toBe('SUCCESS');expect(result.completed).toHaveLength(2);expect(result.next_action?.kind).toBe('REVIEW_COMPLETED_CYCLE');expect((await queue.records()).every(x=>x.state==='DONE')).toBe(true);});
it('recovers a HOLD without a manual next-wave trigger', async () => {
  const resolver = new InMemoryEvidenceResolver();
  const queue = new RoleWorkQueue(await mkdtemp(path.join(os.tmpdir(), 'auto-recovery-')), resolver);
  const source = await queue.create({ project_id: 'macro-os', backlog_id: 'B', title: 'source', role: 'pm' });
  const plan: RecoveryPlan = { recovery_id: 'R', source_decision_id: source.work_id, failure_class: 'INSUFFICIENT_EVIDENCE', root_cause: 'missing evidence', actions: ['collect evidence'], accountable_role: 'sre', re_review_role: 'ceo-guild', dependency_updates: [source.work_id], required_evidence: ['E2'], acceptance_criteria: ['evidence'], retry_budget: 2, priority: 'P1', re_review_trigger: 'E2 exists', terminal_if_failed: 'TERMINAL_HOLD' };
  const execute: RoleWorkExecutor = async item => {
    if (item.work_id === source.work_id) {
      const id = `E:${item.work_id}`;
      registerFixture(resolver, item, id);
      return { evidence_ids: [id], structured_output: pmOutput(id), review_verdict: { verdict: 'HOLD', gate: 'evidence', summary: 'missing', evidence: [id], failure_class: 'INSUFFICIENT_EVIDENCE', root_cause: 'missing evidence', recovery_required: true, recovery_actions: ['collect'], accountable_role: 'sre', unblock_evidence: ['E2'], retry_budget: 2, next_review_trigger: 'E2 exists', confidence: .8 } };
    }
    if (item.role === 'sre') {
      registerFixture(resolver, item, 'E2');
      return { evidence_ids: ['E2'], research_result: { research_question: item.title, source_reference: 'E2', finding: 'isolated corrective evidence collected', confidence: .5 } };
    }
    return { evidence_ids: ['E2'], structured_output: { role: 'ceo-guild', decision: 'ACCEPT', reason: 'corrective fixture reviewed; original source not re-evaluated', evidence_ids: ['E2'], dissent: [], next_workflow: 'source-re-evaluation', owner: 'test', retest_condition: 'original source reviewed' }, review_verdict: { verdict: 'PASS', gate: 'corrective-review', summary: 'corrective dependency fixture inspected', evidence: ['E2'], failure_class: 'NONE', root_cause: 'none', recovery_required: false, recovery_actions: [], unblock_evidence: [], retry_budget: 0, next_review_trigger: 'original source re-evaluation', confidence: .5 } };
  };
  const result = await runAutonomousWorkflow({ queue, projectId: 'macro-os', runId: source.assignment!.run_id, namespace: source.assignment!.namespace, execute, recoveryFor: () => plan });
  // Prior SUCCESS/three DONE assertion was contradicted by retained HOLD evidence.
  expect(result.status, JSON.stringify(result)).toBe('TERMINAL_HOLD');
  expect(result.recovery_tasks).toHaveLength(1);
  expect(result.completed).toHaveLength(2);
  const rows = await queue.records();
  expect(rows.filter(row => row.state === 'DONE')).toHaveLength(2);
  expect(rows.find(row => row.work_id === source.work_id)).toMatchObject({ state: 'BLOCKED', review_verdict: { verdict: 'HOLD' } });
});

it('reports provider usage as actual instead of relabeling context estimates', async()=>{const resolver=new InMemoryEvidenceResolver();const queue=new RoleWorkQueue(await mkdtemp(path.join(os.tmpdir(),'auto-usage-')),resolver);const item=await queue.create({project_id:'macro-os',backlog_id:'B',title:'usage',role:'pm'});registerFixture(resolver,item,`E:${item.work_id}`);const result=await runAutonomousWorkflow({queue,projectId:'macro-os',runId:item.assignment!.run_id,namespace:item.assignment!.namespace,execute:async(work:any)=>({evidence_ids:[`E:${work.work_id}`],usage:{input_tokens:11,output_tokens:7},structured_output:pmOutput(`E:${work.work_id}`)})});expect(result.status).toBe('SUCCESS');expect(result.total_tokens_consumed).toBe(18);expect(result.total_tokens_estimated).toBe(item.assignment!.context_budget.target_tokens);expect(result.token_provenance).toBe('ACTUAL');});

it('does not report SUCCESS for DONE history without original receipts', async () => {
  const { readinessAuthorityFixture } = await import('./readinessAuthorityTestFixture');
  const { unlink } = await import('node:fs/promises');
  const f = await readinessAuthorityFixture(['data-engineer']);
  await unlink(path.join(f.root, 'role-evidence.jsonl'));
  const execute = async () => { throw new Error('Unexpected execution of terminal history'); };
  expect(await runAutonomousWorkflow({ queue: f.queue, projectId: 'unit', runId: 'R', namespace: 'N', execute })).toMatchObject({ status: 'TERMINAL_HOLD', runs: 0, completed: [] });
});
