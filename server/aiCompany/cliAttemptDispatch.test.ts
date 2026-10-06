import { recordNativeFixture } from './nativeReceiptTestFixture';
import { expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { RoleWorkQueue } from './roleWorkQueue';
import { RoleEvidenceLedger } from './roleEvidenceLedger';
import { RoleEvidenceResolver } from './roleEvidenceResolver';
import { RoleHandoffLedger } from './roleHandoffLedger';
import { roleAttemptArtifactName } from './roleAttemptArtifact';

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cli-attempt-fixture-'));
  const runtime = path.join(root, '.ai-company/runtime/projects/isolated');
  const queue = new RoleWorkQueue(runtime);
  const item = await queue.create({ project_id: 'isolated', backlog_id: 'B', title: 'Unit-only transport input; actual product outcome UNKNOWN', role: 'ux-research', run_id: 'isolated-run', namespace: 'isolated-namespace' });
  await new RoleHandoffLedger(runtime).record({ project_id: 'isolated', work_id: item.work_id, from_role: 'ceo', to_role: item.role, actor: 'unit-fixture', objective: item.title, context: ['isolated inputs'], evidence_ids: ['fixture'], acceptance_criteria: ['attempt-bound transport only'] });
  const bin = path.join(root, 'stub-bin'); await mkdir(bin);
  const workspace = path.join(root, 'worker'); await mkdir(workspace);
  const descendantCode = "const fs=require('node:fs'); process.on('SIGTERM',()=>{}); fs.writeFileSync('descendant-ready','ready'); const tick=setInterval(()=>{if(!fs.existsSync('stub-resume'))return;clearInterval(tick);fs.writeFileSync('stub-effect','isolated descendant effect');process.exit(0);},10);setTimeout(()=>process.exit(0),3000).unref();";
  const stub = `#!${process.execPath}
const fs = require('node:fs');
// This stub observes trusted dispatcher state; it is not the sandboxed model tool.
process.chdir(${JSON.stringify(root)});
const mode = fs.existsSync('stub-mode.txt') ? fs.readFileSync('stub-mode.txt', 'utf8') : 'success';
const file = '.ai-company/runtime/projects/isolated/role-work-queue.jsonl';
const current = fs.readFileSync(file, 'utf8').trim().split('\\n').map(JSON.parse).at(-1);
fs.writeFileSync('stub-call.json', JSON.stringify({state:current.state, attempt_id:current.attempt_id, provider_dispatch:current.provider_dispatch, argsContainCapability:process.argv.join(' ').includes('attempt_authority')}));
if (mode === 'worker-done') fs.appendFileSync(file, JSON.stringify({...current,state:'DONE'})+'\\n');
if (mode === 'silent') process.exit(0);
if (mode === 'descendant') {
  require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(descendantCode)}], {stdio:'ignore'});
  const entered=setInterval(()=>{if(!fs.existsSync('descendant-ready'))return;clearInterval(entered);fs.writeFileSync('stub-entered','ready');},10);
  setInterval(()=>{},1000);
  setTimeout(()=>process.exit(0),3000).unref();
} else if (mode === 'waiting') {
  fs.writeFileSync('stub-entered', 'isolated stub');
  const tick = setInterval(() => {
    if (!fs.existsSync('stub-resume')) return;
    clearInterval(tick);
    fs.writeFileSync('stub-effect', 'isolated effect');
    emit();
  }, 10);
  setTimeout(() => process.exit(5), 3000).unref();
} else emit();
function emit() {
const message = fs.existsSync('review-verdict.json') ? 'REVIEW_VERDICT_JSON '+fs.readFileSync('review-verdict.json','utf8')+'\\nROLE_WORK_COMPLETE' : 'ROLE_RESEARCH_RESULT_JSON '+JSON.stringify({research_question:'Unit transport',source_reference:mode==='unresolved'?'UNRESOLVED-DECLARED':process.argv.at(-1).match(/RECEIPT EVIDENCE ID: ([A-Za-z0-9_:-]+)/)[1],finding:'Unit stub only; product outcome UNKNOWN',confidence:0.5})+'\\nROLE_WORK_COMPLETE';
console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:message}}));
console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:1,output_tokens:1}}));
}
`;
  await writeFile(path.join(bin, 'codex'), stub, { mode: 0o700 });
  await mkdir(path.join(root, '.ai-company/reports'), { recursive: true });
  await writeFile(path.join(root, '.ai-company/reports', `role-output-${item.work_id}.md`), 'ROLE_RESEARCH_RESULT_JSON {"finding":"STALE","research_question":"old","source_reference":"old","confidence":1}\nROLE_WORK_COMPLETE');
  return { root, runtime, queue, item, bin, workspace };
}

async function dispatch(input: Awaited<ReturnType<typeof fixture>>, mode = 'success', control?: (child: ReturnType<typeof spawn>) => Promise<void>) {
  await writeFile(path.join(input.root, 'stub-mode.txt'), mode);
  const messages: unknown[] = []; let stdout = '', stderr = '';
  const child = spawn(process.execPath, ['--import', createRequire(import.meta.url).resolve('tsx'), path.join(process.cwd(), 'scripts/ai-company-role-dispatch.mjs'), '--role', input.item.role, '--work-id', input.item.work_id, '--project-id', 'isolated', '--runner', 'codex', '--model', 'unit-stub', '--control-root', input.root, '--workspace', input.workspace], {
    cwd: input.root, env: { ...process.env, PATH: `${input.bin}${path.delimiter}${process.env.PATH ?? ''}`, AI_COMPANY_REQUIRE_WORKTREE: 'false' }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  child.on('message', message => messages.push(message));
  child.stdout?.on('data', chunk => { stdout += chunk; }); child.stderr?.on('data', chunk => { stderr += chunk; });
  const timeout = setTimeout(() => child.kill('SIGKILL'), 10_000);
  const exit = new Promise<number | null>((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
  if (control) await control(child);
  const code = await exit; clearTimeout(timeout);
  return { code, messages, stdout, stderr };
}

it('claims before stub provider, passes no capability, and ACKs its actual attempt', async () => {
  const input = await fixture(); const result = await dispatch(input);
  expect(result.code, result.stderr).toBe(0);
  const row = (await input.queue.records())[0]; expect(row.state).toBe('DONE');
  const call = JSON.parse(await readFile(path.join(input.root, 'stub-call.json'), 'utf8'));
  expect(call).toMatchObject({ state: 'CLAIMED', attempt_id: row.attempt_id, provider_dispatch: { attempt_id: row.attempt_id, provider_id: 'cli:codex:unit-stub' }, argsContainCapability: false });
  expect(result.messages).toEqual([{ type: 'ROLE_ATTEMPT_CLAIMED', work_id: row.work_id, attempt_id: row.attempt_id, output_name: roleAttemptArtifactName(row.work_id, row.attempt_id) }]);
  expect(await readFile(path.join(input.runtime, 'role-dispatch-evidence.jsonl'), 'utf8')).not.toContain('attempt_authority');
});

it('refuses provider dispatch when stopped while paused after claim ACK', async () => {
  const input = await fixture();
  const result = await dispatch(input, 'success', async child => {
    await new Promise<void>(resolve => child.once('message', () => { process.kill(child.pid!, 'SIGSTOP'); resolve(); }));
    try {
      const selected = (await input.queue.records())[0];
      await input.queue.block(input.item.work_id, 'Unit explicit stop before provider', selected);
    } finally { process.kill(child.pid!, 'SIGCONT'); }
  });
  expect(result.code).not.toBe(0);
  expect(await readdir(input.root)).not.toContain('stub-call.json');
  expect((await input.queue.records())[0]).toMatchObject({ state: 'BLOCKED', blocked_reason: 'Unit explicit stop before provider' });
  expect(await readdir(input.runtime)).not.toContain('role-dispatch-evidence.jsonl');
});

it('does not adopt an existing claim or call the stub provider', async () => {
  const input = await fixture(); await input.queue.claim(input.item.work_id, 'other-owner'); const before = await readFile(path.join(input.runtime, 'role-work-queue.jsonl'));
  const result = await dispatch(input); expect(result.code).toBe(4); expect(result.messages).toEqual([]);
  expect(await readdir(input.root)).not.toContain('stub-call.json');
  expect(await readFile(path.join(input.runtime, 'role-work-queue.jsonl'))).toEqual(before);
});

it('never consumes a legacy work-only completion artifact for a silent new attempt', async () => {
  const input = await fixture(); const result = await dispatch(input, 'silent');
  expect(result.code).not.toBe(0); expect(result.stderr).toContain('Role completion marker missing');
  const row = (await input.queue.records())[0]; expect(row.state).toBe('BLOCKED');
  expect(result.messages).toHaveLength(1);
});

async function awaitStub(root: string) {
  for (let i = 0; i < 300; i++) {
    if ((await readdir(root)).includes('stub-entered')) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('stub did not start within bounded wait');
}

it('does not record semantic evidence after the claimed attempt was explicitly stopped', async () => {
  const input = await fixture();
  const result = await dispatch(input, 'waiting', async () => {
    await awaitStub(input.root);
    const selected = (await input.queue.records())[0];
    await input.queue.block(input.item.work_id, 'explicit isolated stop', selected);
    await writeFile(path.join(input.root, 'stub-resume'), 'resume');
  });
  expect(result.code).toBe(3);
  expect((await input.queue.records())[0].state).toBe('BLOCKED');
  expect(await readdir(input.runtime)).not.toContain('role-dispatch-evidence.jsonl');
});

it('terminates the owned stub provider before exiting on dispatcher SIGTERM', async () => {
  const input = await fixture();
  const result = await dispatch(input, 'waiting', async child => {
    await awaitStub(input.root);
    child.kill('SIGTERM');
  });
  expect(result.code, result.stderr).toBe(143);
  await writeFile(path.join(input.root, 'stub-resume'), 'resume');
  await new Promise(resolve => setTimeout(resolve, 100));
  expect(await readdir(input.root)).not.toContain('stub-effect');
  expect(await readdir(input.runtime)).not.toContain('role-dispatch-evidence.jsonl');
  expect((await input.queue.records())[0].state).toBe('BLOCKED');
});

it('awaits bounded group escalation when a descendant ignores SIGTERM', async () => {
  const input = await fixture();
  const result = await dispatch(input, 'descendant', async child => {
    await awaitStub(input.root);
    child.kill('SIGTERM');
  });
  expect(result.code, result.stderr).toBe(143);
  await writeFile(path.join(input.root, 'stub-resume'), 'resume');
  await new Promise(resolve => setTimeout(resolve, 100));
  expect(await readdir(input.root)).not.toContain('stub-effect');
  expect(await readdir(input.runtime)).not.toContain('role-dispatch-evidence.jsonl');
  expect((await input.queue.records())[0].state).toBe('BLOCKED');
});

it('quarantines worker-written DONE before creating semantic receipts', async () => {
  const input = await fixture(); const result = await dispatch(input, 'worker-done');
  expect(result.code).toBe(3);
  expect((await input.queue.records())[0].state).toBe('QUARANTINED');
  expect(await readdir(input.runtime)).not.toContain('role-dispatch-evidence.jsonl');
});

it('preserves an unresolved provider citation and blocks instead of replacing it', async () => {
  const input=await fixture();const result=await dispatch(input,'unresolved');
  expect(result.code).toBe(3);expect(result.stderr).toContain('cannot be resolved');
  expect((await input.queue.records())[0].state).toBe('BLOCKED');
  expect(await readFile(path.join(input.runtime,'role-dispatch-evidence.jsonl'),'utf8')).toContain('UNRESOLVED-DECLARED');
});

async function reviewFixture(mode: 'same-scope'|'cross-scope'|'unresolved') {
  const input=await fixture();const ledger=new RoleEvidenceLedger(input.runtime);const queue=new RoleWorkQueue(input.runtime,new RoleEvidenceResolver(input.runtime));
  const claimed=await queue.claim(input.item.work_id,'unit-producer');
  const source=await recordNativeFixture(queue, ledger, {project_id:input.item.project_id,work_id:input.item.work_id,attempt_id:claimed.attempt_id!,role:input.item.role,namespace:input.item.assignment!.namespace,run_id:input.item.assignment!.run_id,provider_id:'unit-stub',model:'unit-stub',output:'Original independent fixture bytes',limitation:'No actual product outcome',usage:{input_tokens:0,output_tokens:0,estimated_cost_usd:0}}, claimed.attempt_authority);
  await queue.submitForReview(input.item.work_id,claimed.attempt_authority);await queue.complete(input.item.work_id,[source.evidence_id],{research_question:'Unit input',source_reference:source.evidence_id,finding:'Unit bytes only',confidence:.5},undefined,undefined,undefined,undefined,claimed.attempt_authority);
  const review=await queue.create({project_id:'isolated',backlog_id:'REVIEW',title:'Unit original lineage review',role:'functional-qa',run_id:mode==='cross-scope'?'wrong-run':input.item.assignment!.run_id,namespace:mode==='cross-scope'?'wrong-scope':input.item.assignment!.namespace,depends_on:[input.item.work_id]});
  await new RoleHandoffLedger(input.runtime).record({project_id:'isolated',work_id:review.work_id,from_role:'ceo',to_role:review.role,actor:'unit-fixture',objective:review.title,context:['original independent bytes'],evidence_ids:[source.evidence_id],acceptance_criteria:['original scope only']});
  const verdict={verdict:'PASS',gate:'Unit original input contract',summary:'Unit evidence only; outcome UNKNOWN',evidence:[mode==='unresolved'?'UNRESOLVED-DECLARED':source.evidence_id],failure_class:'NONE',root_cause:'none',recovery_required:false,recovery_actions:[],unblock_evidence:[],retry_budget:0,next_review_trigger:'unit only',confidence:.5};
  await writeFile(path.join(input.root,'review-verdict.json'),JSON.stringify(verdict));
  await mkdir(path.join(input.root,'.ai-company/reports/dependencies'),{recursive:true});await writeFile(path.join(input.root,'.ai-company/reports/dependencies',input.item.work_id),'Original unit artifact; never receipt rescoping');
  return {...input,queue,item:review,source,verdict};
}

it.each(['same-scope','cross-scope','unresolved'] as const)('CLI review preserves actual original reference for %s',async mode=>{
  const input=await reviewFixture(mode);const file=path.join(input.runtime,'role-evidence.jsonl');const before=await readFile(file);
  const result=await dispatch(input);const current=(await input.queue.records()).find(row=>row.work_id===input.item.work_id)!;
  if(mode==='same-scope'){expect(result.code,result.stderr).toBe(0);expect(current.state).toBe('DONE');expect(current.review_verdict?.evidence).toEqual([input.source.evidence_id]);}
  else{expect(result.code).toBe(3);expect(current.state).toBe('BLOCKED');expect(result.stderr).toMatch(mode==='cross-scope'?/mismatch/:/cannot be resolved/);}
  expect(await readFile(file)).toEqual(before);const cli=await readFile(path.join(input.runtime,'role-dispatch-evidence.jsonl'),'utf8');expect(cli).not.toContain('ROLE-DISPATCH:DEPENDENCY:');expect(cli.trim().split('\n')).toHaveLength(1);
});

it('rejects missing dependency receipts explicitly before claim or stub provider',async()=>{
 const {unlink}=await import('node:fs/promises');const input=await reviewFixture('same-scope');
 await unlink(path.join(input.runtime,'role-evidence.jsonl'));
 const before=await readFile(path.join(input.runtime,'role-work-queue.jsonl'));
 const result=await dispatch(input);
 expect(result.code,result.stderr).toBe(4);expect(result.stderr).toContain('ASSIGNMENT_ADMISSION_FAILED');
 expect(await readFile(path.join(input.runtime,'role-work-queue.jsonl'))).toEqual(before);
 expect(await readdir(input.root)).not.toContain('stub-call.json');
});

it('CLI selected dependency admission preserves explicit same-scope failed-review correction',async()=>{
 const {unlink}=await import('node:fs/promises'),input=await reviewFixture('same-scope');
 const handle=await input.queue.claim(input.item.work_id,'fixture');await input.queue.submitForReview(input.item.work_id,handle.attempt_authority);
 await input.queue.complete(input.item.work_id,[input.source.evidence_id],undefined,{...input.verdict,verdict:'HOLD',failure_class:'INSUFFICIENT_EVIDENCE'},undefined,undefined,undefined,handle.attempt_authority);
 const child=await input.queue.create({project_id:'isolated',backlog_id:'CORRECTION',title:'Unit corrective context only',role:'ux-research',namespace:input.item.namespace,run_id:input.item.run_id,depends_on:[input.item.work_id],recovery_source_work_id:input.item.work_id});
 await new RoleHandoffLedger(input.runtime).record({project_id:'isolated',work_id:child.work_id,from_role:'ceo',to_role:child.role,actor:'unit-fixture',objective:child.title,context:['Unit failed review context'],evidence_ids:[input.source.evidence_id],acceptance_criteria:['Scope retained']});
 await unlink(path.join(input.root,'review-verdict.json'));
 const result=await dispatch({...input,item:child});expect(result.code,result.stderr).toBe(0);
 const rows=await input.queue.records();expect(rows.find(row=>row.work_id===child.work_id)!.state).toBe('DONE');expect(rows.find(row=>row.work_id===input.item.work_id)!.state).toBe('BLOCKED');
});

it('run-ready rejects corrupt lifecycle JSON instead of persisting an empty-work wake',async()=>{
 const {appendFile}=await import('node:fs/promises'),input=await fixture();
 const file=path.join(input.runtime,'role-work-queue.jsonl');
 await appendFile(file,JSON.stringify({...input.item,state:'UNKNOWN-LIFECYCLE',queue_revision:2})+'\n');
 const before=await readFile(file);let stdout='',stderr='';
 const child=spawn(process.execPath,['--import',createRequire(import.meta.url).resolve('tsx'),path.join(process.cwd(),'scripts/ai-company-run-ready.mjs'),'--project-id','isolated','--runner','codex','--model','unit-stub'],{cwd:input.root,env:{...process.env,PATH:`${input.bin}${path.delimiter}${process.env.PATH??''}`,AI_COMPANY_REQUIRE_WORKTREE:'false'},stdio:['ignore','pipe','pipe']});
 child.stdout?.on('data',chunk=>{stdout+=chunk;});child.stderr?.on('data',chunk=>{stderr+=chunk;});
 const timer=setTimeout(()=>child.kill('SIGKILL'),10000);
 const code=await new Promise<number|null>((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});clearTimeout(timer);
 expect(code,stderr).toBe(1);expect(stderr).toContain('corrupt queue record');expect(stdout).not.toContain('no dispatchable work');
 expect(await readFile(file)).toEqual(before);expect(await readdir(input.runtime)).not.toContain('wait-wake.jsonl');expect(await readdir(input.root)).not.toContain('stub-call.json');
});
