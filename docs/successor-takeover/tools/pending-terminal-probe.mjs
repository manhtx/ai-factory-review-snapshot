import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { RoleWorkQueue } from '../../../server/aiCompany/roleWorkQueue.ts';
import { InMemoryEvidenceResolver } from '../../../server/aiCompany/evidenceResolver.ts';

// Temp-only deterministic interleaving; no live state, provider, or external effect.
const root = await mkdtemp(path.join(tmpdir(), 'pending-terminal-probe-'));
const fixture = new InMemoryEvidenceResolver();
let enteredResolve;
let releaseResolve;
const entered = new Promise(resolve => { enteredResolve = resolve; });
const release = new Promise(resolve => { releaseResolve = resolve; });
const queue = new RoleWorkQueue(root, { resolve: async id => {
  enteredResolve();
  await release;
  return fixture.resolve(id);
} });
const item = await queue.create({ project_id: 'isolated-probe', backlog_id: 'PENDING-TERMINAL', title: 'Probe stale completion', role: 'ux-research' });
const receipt = fixture.createEvidence({ evidence_id: 'E-PENDING', namespace: item.assignment.namespace, run_id: item.assignment.run_id, produced_by_role: item.role, content: 'Isolated byte fixture; actual product outcome UNKNOWN' });
fixture.register({ ...receipt, work_id: item.work_id, source_artifact: 'pending-terminal-probe.mjs' });
await queue.claim(item.work_id, 'isolated-owner');
await queue.submitForReview(item.work_id);
const pending = queue.complete(item.work_id, ['E-PENDING'], { research_question: 'Can stale completion overwrite a newer block?', source_reference: 'E-PENDING', finding: 'Isolated admission fixture', confidence: 0.5 });
await entered;
const block = await queue.block(item.work_id, 'Newer authoritative stop during evidence resolution');
releaseResolve();
let completion;
try { completion = { accepted: true, state: (await pending).state }; }
catch (error) { completion = { accepted: false, error: error.message }; }
const states = (await readFile(path.join(root, 'role-work-queue.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line).state);
const finalState = (await queue.records())[0].state;
console.log(JSON.stringify({ schema: 'ai-factory.counterexample.v1', observedAt: new Date().toISOString(), root, sourceHash: createHash('sha256').update(await readFile(new URL('../../../server/aiCompany/roleWorkQueue.ts', import.meta.url))).digest('hex'), blockState: block.state, completion, states, finalState, reproduced: block.state === 'BLOCKED' && completion.accepted && finalState === 'DONE', limits: ['Temp-only single process deterministic race', 'No actual product effect or actor identity proof', 'No live writer or G1 probe'] }, null, 2));
