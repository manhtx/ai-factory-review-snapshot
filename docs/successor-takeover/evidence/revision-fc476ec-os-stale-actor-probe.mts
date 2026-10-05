import { mkdtemp, readFile } from 'node:fs/promises';
import { fork } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { RoleWorkQueue } from '/Users/manhtx/Documents/Macro Research Platform/server/aiCompany/roleWorkQueue.ts';
import { RoleEvidenceResolver } from '/Users/manhtx/Documents/Macro Research Platform/server/aiCompany/roleEvidenceResolver.ts';
import { RoleEvidenceLedger } from '/Users/manhtx/Documents/Macro Research Platform/server/aiCompany/roleEvidenceLedger.ts';

if (process.argv[2] === 'worker') {
  const root = process.argv[3], workId = process.argv[4], owner = process.argv[5];
  const queue = new RoleWorkQueue(root, new RoleEvidenceResolver(root));
  const { attempt_authority: authority, ...claim } = await queue.claim(workId, owner);
  await queue.reserveProviderDispatch(workId, 'bounded-stub', authority, claim);
  if (owner === 'OS-B') await queue.submitForReview(workId, authority);
  process.send?.({ type: 'claimed', attempt: claim.attempt_id, pid: process.pid });
  process.on('message', async (message: any) => {
    if (message.type === 'late') {
      const ledger = new RoleEvidenceLedger(root);
      const outcomes = {};
      const operations = {
        reserve: () => queue.reserveProviderDispatch(workId, 'bounded-stub', authority, claim),
        publish: () => ledger.record({ project_id: claim.project_id, work_id: workId, attempt_id: claim.attempt_id, namespace: claim.assignment.namespace, run_id: claim.assignment.run_id, role: claim.role, provider_id: 'bounded-stub', model: 'none', output: 'Temporary late output only', limitation: 'No model or product effects', usage: { input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0 } }, authority),
        admission: () => queue.submitForReview(workId, authority),
        complete: () => queue.complete(workId, ['E-LATE'], { research_question: 'Bounded stale OS actor probe', source_reference: 'E-LATE', finding: 'Temporary output only; no product outcome', confidence: 0.5 }, undefined, undefined, undefined, undefined, authority),
        blockAttempt: () => queue.blockAttempt(workId, 'Late actor error', authority),
      };
      for (const [name, operation] of Object.entries(operations)) {
        try { await operation(); outcomes[name] = { accepted: true }; }
        catch (error) { outcomes[name] = { accepted: false, error: String(error.message) }; }
      }
      process.send?.({ type: 'lateResult', outcomes });
    }
    if (message.type === 'adminBlock') {
      try { await queue.block(workId, 'Stale OS actor using unrestricted administrative entrypoint'); process.send?.({ type: 'adminResult', accepted: true }); }
      catch (error) { process.send?.({ type: 'adminResult', accepted: false, error: String(error.message) }); }
    }
    if (message.type === 'exit') process.exit(0);
  });
} else {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ai-factory-os-stale-'));
  const queue = new RoleWorkQueue(root, new RoleEvidenceResolver(root));
  const work = await queue.create({ project_id: 'temporary', backlog_id: 'BOUNDED-OS-PROBE', title: 'Temporary actual OS actor authority experiment', role: 'ux-research' });
  const children = [];
  const wait = (child, type) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Bounded IPC deadline')), 15000);
    const listener = message => { if (message.type === type) { clearTimeout(timer); child.off('message', listener); resolve(message); } };
    child.on('message', listener);
  });
  const launch = owner => { const child = fork('/tmp/ai-factory-os-stale-actor.mts', ['worker', root, work.work_id, owner], { execArgv: ['--import', '/Users/manhtx/Documents/Macro Research Platform/node_modules/tsx/dist/loader.mjs'], stdio: ['ignore', 'ignore', 'pipe', 'ipc'] }); children.push(child); return child; };
  const digest = async () => createHash('sha256').update(await readFile(path.join(root, 'role-work-queue.jsonl'))).digest('hex');
  try {
    const a = launch('OS-A'); const aClaim = await wait(a, 'claimed');
    await queue.block(work.work_id, 'Explicit administrative recovery supersedes A', (await queue.records())[0]);
    await queue.requeueBlocked(work.work_id);
    const b = launch('OS-B'); const bClaim = await wait(b, 'claimed');
    const before = await digest(); const latePromise = wait(a, 'lateResult'); a.send({ type: 'late' }); const late = await latePromise;
    const after = await digest(); const stateAfterLate = (await queue.records())[0];
    const adminPromise = wait(a, 'adminResult'); a.send({ type: 'adminBlock' }); const admin = await adminPromise;
    const stateAfterAdmin = (await queue.records())[0];
    console.log(JSON.stringify({ observedAt: new Date().toISOString(), sourceRevision: 'fc476ecf935cd68d570e3995bf7a11008b15f996', scope: 'Actual two OS processes using queue APIs; isolated store; no provider/model/product effects', aClaim, bClaim, late, queueUnchangedByCapabilityOperations: before === after, bAttemptPreserved: stateAfterLate.attempt_id === bClaim.attempt, stateAfterLate: stateAfterLate.state, unrestrictedAdministrativeBlock: admin, stateAfterAdmin: stateAfterAdmin.state, adminBlockRetainedBIdentity: stateAfterAdmin.attempt_id === bClaim.attempt, limitations: ['OS isolation is not an authorization boundary for the unrestricted administrative queue API', 'No controller lease authority was fabricated or claimed', 'No actual provider effect or cross-store atomicity proof'] }, null, 2));
  } finally { for (const child of children) child.kill('SIGKILL'); }
}
