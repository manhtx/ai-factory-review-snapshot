import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { RoleWorkQueue } from '../../../server/aiCompany/roleWorkQueue.ts';
import { InMemoryEvidenceResolver } from '../../../server/aiCompany/evidenceResolver.ts';
const root = await mkdtemp(path.join(tmpdir(), 'stale-attempt-probe-'));
const resolver = new InMemoryEvidenceResolver(); const queue = new RoleWorkQueue(root, resolver);
const item = await queue.create({ project_id: 'isolated-probe', backlog_id: 'STALE-ATTEMPT', title: 'Old attempt output after newer claim', role: 'ux-research' });
const receipt = resolver.createEvidence({ evidence_id: 'E-OLD-ATTEMPT', namespace: item.assignment.namespace, run_id: item.assignment.run_id, produced_by_role: item.role, content: 'Isolated old-attempt fixture; no real outcome' });
resolver.register({ ...receipt, work_id: item.work_id, source_artifact: 'stale-attempt-probe.mjs' });
const oldClaim = await queue.claim(item.work_id, 'old-owner'); await queue.submitForReview(item.work_id, oldClaim.attempt_authority);
await queue.block(item.work_id, 'old attempt no longer authorized'); await queue.requeueBlocked(item.work_id);
const newClaim = await queue.claim(item.work_id, 'new-owner'); await queue.submitForReview(item.work_id, newClaim.attempt_authority);
let rejected = false; let error;
try { await queue.complete(item.work_id, ['E-OLD-ATTEMPT'], { research_question: 'Can old actor return after newer attempt?', source_reference: 'E-OLD-ATTEMPT', finding: 'Isolated stale fixture', confidence: 0.5 }, undefined, undefined, undefined, undefined, oldClaim.attempt_authority); }
catch (failure) { rejected = true; error = failure.message; }
const current = (await queue.records())[0];
console.log(JSON.stringify({ schema: 'ai-factory.scoped-proof.v1', observedAt: new Date().toISOString(), root, sourceHash: createHash('sha256').update(await readFile(new URL('../../../server/aiCompany/roleWorkQueue.ts', import.meta.url))).digest('hex'), oldClaim: { owner: oldClaim.owner, revision: oldClaim.queue_revision }, newClaim: { owner: newClaim.owner, revision: newClaim.queue_revision }, staleAttemptRejected: rejected, error, finalState: current.state, finalOwner: current.owner, limits: ['Temp-only callback; no provider/product effect', 'CLI and evidence attempt origin still OPEN', 'No live/G1 action'] }, null, 2));
