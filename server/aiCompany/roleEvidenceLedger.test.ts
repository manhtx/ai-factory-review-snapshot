import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, writeFile, stat, chmod, symlink, link, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { RoleWorkQueue } from './roleWorkQueue';
import { RoleEvidenceLedger, nativeProviderReceiptId } from './roleEvidenceLedger';
import { recordNativeFixture } from './nativeReceiptTestFixture';
async function fixture(root?: string) {
 root ??= await mkdtemp(path.join(os.tmpdir(),'native-writer-'));
 const ledger=new RoleEvidenceLedger(root),queue=new RoleWorkQueue(root,ledger),work=await queue.create({project_id:'unit',backlog_id:'B',title:'Unit receipt only',role:'ux-research',namespace:'N',run_id:'R'}),claim=await queue.claim(work.work_id,'fixture');
 await queue.reserveProviderDispatch(work.work_id,'stub',claim.attempt_authority,claim);
 const input={receipt_id:nativeProviderReceiptId(work.work_id,claim.attempt_id!),project_id:'unit',work_id:work.work_id,attempt_id:claim.attempt_id!,role:work.role,provider_id:'stub',model:'stub',namespace:'N',run_id:'R',output:'Unit receipt only',limitation:'No actual provider or product outcome',usage:{input_tokens:0,output_tokens:0,estimated_cost_usd:0}};
 return{root,ledger,queue,input,authority:claim.attempt_authority};
}
describe('RoleEvidenceLedger',()=>{it('creates deterministic server-owned evidence and deduplicates',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'role-evidence-')),ledger=new RoleEvidenceLedger(root),queue=new RoleWorkQueue(root,ledger),item=await queue.create({project_id:'macro-os',backlog_id:'B',title:'Unit receipt dedupe',role:'coder',namespace:'test',run_id:'run-1'}),claimed=await queue.claim(item.work_id,'fixture');
 const input={project_id:'macro-os',namespace:'test',run_id:'run-1',work_id:item.work_id,attempt_id:claimed.attempt_id!,role:'coder' as const,provider_id:'local',model:'qwen',output:'bounded result',limitation:'needs QA',usage:{input_tokens:1,output_tokens:2,estimated_cost_usd:0}};
 const first=await recordNativeFixture(queue,ledger,input,claimed.attempt_authority);expect(await ledger.record(input,claimed.attempt_authority)).toEqual(first);expect(first.evidence_id).toMatch(/^ROLE-EVIDENCE-/);expect(await ledger.records('macro-os')).toHaveLength(1);
});});
it('two native writer instances publish one identity and preserve queue bytes',async()=>{
 const f=await fixture(),a=f.ledger,b=new RoleEvidenceLedger(f.root),queueFile=path.join(f.root,'role-work-queue.jsonl'),queueBefore=await readFile(queueFile);
 const rows=await Promise.all([a.record(f.input,f.authority),b.record(f.input,f.authority)]);expect(rows[0]).toEqual(rows[1]);expect(await a.records()).toHaveLength(1);
 const file=path.join(f.root,'role-evidence.jsonl'),before=await stat(file);expect(await a.record(f.input,f.authority)).toEqual(rows[0]);expect((await stat(file)).ino).toBe(before.ino);expect(await readFile(queueFile)).toEqual(queueBefore);
});
it('concurrent conflicting outputs have one winner without duplicate publication',async()=>{
 const f=await fixture(),results=await Promise.allSettled([f.ledger.record(f.input,f.authority),new RoleEvidenceLedger(f.root).record({...f.input,output:'Conflicting unit output'},f.authority)]);
 expect(results.filter(row=>row.status==='fulfilled')).toHaveLength(1);expect(results.filter(row=>row.status==='rejected')).toHaveLength(1);expect(await f.ledger.records()).toHaveLength(1);
});
it('corrupt or duplicate existing receipt history refuses publication and preserves bytes',async()=>{
 for(const kind of ['corrupt','duplicate','unterminated']){
  const f=await fixture(),row=await f.ledger.record(f.input,f.authority),file=path.join(f.root,'role-evidence.jsonl');
  await writeFile(file,kind==='corrupt'?'{invalid}\n':kind==='unterminated'?JSON.stringify(row):JSON.stringify(row)+'\n'+JSON.stringify(row)+'\n');const before=await readFile(file);
  await expect(f.ledger.record(f.input,f.authority)).rejects.toThrow(/corrupt|duplicate/);expect(await readFile(file)).toEqual(before);
 }
});
it('native publication refuses symlink and hardlink targets and preserves existing mode',async()=>{
 for(const kind of ['symlink','hardlink']){
  const f=await fixture(),external=path.join(f.root,'preserved'),file=path.join(f.root,'role-evidence.jsonl');await writeFile(external,'Private unit bytes');await (kind==='symlink'?symlink(external,file):link(external,file));
  await expect(f.ledger.record(f.input,f.authority)).rejects.toThrow('regular unaliased file');expect(await readFile(external,'utf8')).toBe('Private unit bytes');
 }
 const f=await fixture();await f.ledger.record(f.input,f.authority);const file=path.join(f.root,'role-evidence.jsonl');await chmod(file,0o600);await f.ledger.record(f.input,f.authority);expect((await stat(file)).mode&0o777).toBe(0o600);
 // A distinct legitimate producer checks mode preservation on a new append too.
 const second=await fixture(f.root);await second.ledger.record(second.input,second.authority);expect((await stat(file)).mode&0o777).toBe(0o600);
});
it('two OS processes publish the same native receipt once',async()=>{
 const {spawn}=await import('node:child_process'),{createRequire}=await import('node:module'),f=await fixture(),worker=path.join(f.root,'worker.mts'),request=path.join(f.root,'private-request.json'),module=path.join(process.cwd(),'server/aiCompany/roleEvidenceLedger.ts');
 await writeFile(request,JSON.stringify({input:f.input,authority:f.authority}),{mode:0o600});
 await writeFile(worker,`import {readFile} from 'node:fs/promises';import {RoleEvidenceLedger} from ${JSON.stringify(module)};const request=JSON.parse(await readFile(process.argv[3],'utf8'));const row=await new RoleEvidenceLedger(process.argv[2]).record(request.input,request.authority);console.log(JSON.stringify(row));`);
 const launch=()=>new Promise<{code:number|null;stdout:string;stderr:string}>((resolve,reject)=>{const child=spawn(process.execPath,['--import',createRequire(import.meta.url).resolve('tsx'),worker,f.root,request],{stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);const timer=setTimeout(()=>child.kill('SIGKILL'),5000);child.once('error',reject);child.once('close',code=>{clearTimeout(timer);resolve({code,stdout,stderr});});});
 try{const [a,b]=await Promise.all([launch(),launch()]);expect(a.code,a.stderr).toBe(0);expect(b.code,b.stderr).toBe(0);expect(JSON.parse(a.stdout)).toEqual(JSON.parse(b.stdout));expect(await f.ledger.records()).toHaveLength(1);expect(await readFile(path.join(f.root,'role-evidence.jsonl'),'utf8')).not.toContain(f.authority.token);}finally{await unlink(request);}
});
it('raw record has no capability compatibility bypass or absent-queue publication',async()=>{
 const f=await fixture();await expect(f.ledger.record(f.input)).rejects.toThrow('capability');await expect(readFile(path.join(f.root,'role-evidence.jsonl'))).rejects.toMatchObject({code:'ENOENT'});
 const empty=await mkdtemp(path.join(os.tmpdir(),'native-no-queue-'));await expect(new RoleEvidenceLedger(empty).record(f.input,f.authority)).rejects.toThrow('work is missing');await expect(readFile(path.join(empty,'role-work-queue.jsonl'))).rejects.toMatchObject({code:'ENOENT'});await expect(readFile(path.join(empty,'role-evidence.jsonl'))).rejects.toMatchObject({code:'ENOENT'});
});
