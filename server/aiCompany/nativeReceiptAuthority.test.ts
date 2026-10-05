import {it,expect} from 'vitest';
import {mkdtemp,readFile,writeFile,symlink,realpath} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';
import {RoleWorkQueue} from './roleWorkQueue';import {nativeProviderReceiptId, type RoleEvidenceArtifact} from './roleEvidenceLedger';import {RoleEvidenceResolver} from './roleEvidenceResolver';
import { RoleEvidenceLedger } from './roleEvidenceLedger';
import { evidenceProducingRoleWorkExecutor } from './roleWorkExecutor';
async function fixture(issued=true){
 const root=await mkdtemp(path.join(os.tmpdir(),'native-authority-')),queue=new RoleWorkQueue(root,new RoleEvidenceResolver(root));
 const item=await queue.create({project_id:'unit',backlog_id:'B',title:'Unit only',role:'ux-research',namespace:'N',run_id:'R'}),{attempt_authority:authority,...claimed}=await queue.claim(item.work_id,'fixture');
 if(issued)await queue.reserveProviderDispatch(item.work_id,'stub',authority,claimed);
 const output='Unit receipt only';const receipt:RoleEvidenceArtifact={evidence_id:nativeProviderReceiptId(item.work_id,claimed.attempt_id!),project_id:'unit',work_id:item.work_id,attempt_id:claimed.attempt_id,namespace:'N',run_id:'R',role:item.role,provider_id:'stub',model:'unit',output,limitation:'No actual provider or product outcome',usage:{input_tokens:0,output_tokens:0,estimated_cost_usd:0},protocol_status:'RECEIVED',content_hash:createHash('sha256').update(output).digest('hex'),created_at:new Date().toISOString(),source_artifact:'untrusted input path'};
 return{root,queue,item,authority,receipt,file:path.join(root,'role-evidence.jsonl')};
}
it('concurrent native publishers dedupe without changing queue bytes or exposing capability',async()=>{
 const f=await fixture(),queueFile=path.join(f.root,'role-work-queue.jsonl'),before=await readFile(queueFile);
 const [a,b]=await Promise.all([f.queue.publishNativeReceipt(f.receipt,f.authority),f.queue.publishNativeReceipt(f.receipt,f.authority)]);expect(a).toEqual(b);
 expect(a.source_artifact).toBe(`${path.join(await realpath(f.root),'role-evidence.jsonl')}#${f.receipt.evidence_id}`);
 const bytes=await readFile(f.file,'utf8');expect(bytes.trim().split('\n')).toHaveLength(1);expect(bytes).not.toContain(f.authority.token);expect(await readFile(queueFile)).toEqual(before);
});
it.each(['block','quarantine','reclaim'])('actual native provider returning after %s cannot publish',async action=>{
 const f=await fixture(false),ledger=new RoleEvidenceLedger(f.root),work=(await f.queue.records())[0];
 let entered!:()=>void,release!:()=>void,calls=0;const ready=new Promise<void>(resolve=>entered=resolve),paused=new Promise<void>(resolve=>release=resolve);
 const execute=evidenceProducingRoleWorkExecutor({id:'stub',complete:async({task})=>{calls++;entered();await paused;return{ok:true,text:JSON.stringify({research_question:'Unit',source_reference:task.role_execution!.receipt_evidence_id!,finding:'Unit only',confidence:.2}),evidence_ids:[],usage:{input_tokens:0,output_tokens:0,estimated_cost_usd:0}};}},ledger,f.queue);
 const pending=execute(work,f.authority);await ready;
 if(action==='quarantine')await f.queue.quarantine(work.work_id,'Unit explicit withdrawal');else{await f.queue.blockAttempt(work.work_id,'Unit explicit withdrawal',f.authority);if(action==='reclaim'){await f.queue.requeueBlocked(work.work_id);await f.queue.claim(work.work_id,'next-fixture');}}
 const before=await readFile(path.join(f.root,'role-work-queue.jsonl'));release();await expect(pending).rejects.toThrow(/active issued|capability/);expect(calls).toBe(1);expect(await ledger.records()).toHaveLength(0);expect(await readFile(path.join(f.root,'role-work-queue.jsonl'))).toEqual(before);
});
it('wrong native ledger root refuses before provider or issuance',async()=>{
 const f=await fixture(false),foreign=await mkdtemp(path.join(os.tmpdir(),'native-foreign-')),ledger=new RoleEvidenceLedger(foreign);let calls=0;
 const execute=evidenceProducingRoleWorkExecutor({id:'stub',complete:async()=>{calls++;throw new Error('Must not call unit provider');}},ledger,f.queue),before=await readFile(path.join(f.root,'role-work-queue.jsonl'));
 await expect(execute((await f.queue.records())[0],f.authority)).rejects.toThrow('canonical queue root');expect(calls).toBe(0);expect(await readFile(path.join(f.root,'role-work-queue.jsonl'))).toEqual(before);expect(await ledger.records()).toHaveLength(0);
});
it('same canonical native root via an alias remains a legitimate provider path',async()=>{
 const f=await fixture(false),alias=path.join(await mkdtemp(path.join(os.tmpdir(),'native-root-alias-')),'alias');await symlink(f.root,alias);
 const ledger=new RoleEvidenceLedger(alias),execute=evidenceProducingRoleWorkExecutor({id:'stub',complete:async({task})=>({ok:true,text:JSON.stringify({research_question:'Unit',source_reference:task.role_execution!.receipt_evidence_id!,finding:'Unit only',confidence:.2}),evidence_ids:[],usage:{input_tokens:0,output_tokens:0,estimated_cost_usd:0}})},ledger,f.queue);
 const result=await execute((await f.queue.records())[0],f.authority);expect(await ledger.records()).toHaveLength(1);expect(result.evidence_ids).toEqual([f.receipt.evidence_id]);
});
it.each(['missing','owner','role','id','pass','invalid-time','future-time','usage'])('refuses %s authority or receipt mismatch',async kind=>{
 const f=await fixture(),receipt=structuredClone(f.receipt),authority={...f.authority};
 if(kind==='owner')authority.owner='foreign';if(kind==='role')receipt.role='coder';if(kind==='id')receipt.evidence_id='ROLE-EVIDENCE-FOREIGN';if(kind==='pass')receipt.protocol_status='PASS';if(kind==='invalid-time')receipt.created_at='invalid';if(kind==='future-time')receipt.created_at=new Date(Date.now()+3600000).toISOString();if(kind==='usage')receipt.usage.output_tokens=-1;
 const before=await readFile(path.join(f.root,'role-work-queue.jsonl'));
 await expect(f.queue.publishNativeReceipt(receipt,kind==='missing'?undefined:authority)).rejects.toThrow();await expect(readFile(f.file)).rejects.toMatchObject({code:'ENOENT'});expect(await readFile(path.join(f.root,'role-work-queue.jsonl'))).toEqual(before);
});
it('copied queue bytes do not transfer a capability to another root',async()=>{
 const f=await fixture(),other=await mkdtemp(path.join(os.tmpdir(),'native-copied-'));
 await writeFile(path.join(other,'role-work-queue.jsonl'),await readFile(path.join(f.root,'role-work-queue.jsonl')));
 await expect(new RoleWorkQueue(other,new RoleEvidenceResolver(other)).publishNativeReceipt(f.receipt,f.authority)).rejects.toThrow('capability');await expect(readFile(path.join(other,'role-evidence.jsonl'))).rejects.toMatchObject({code:'ENOENT'});
});
it('terminal success cannot publish or idempotently republish a receipt',async()=>{
 const f=await fixture(),receipt=await f.queue.publishNativeReceipt(f.receipt,f.authority);await f.queue.submitForReview(f.item.work_id,f.authority);await f.queue.complete(f.item.work_id,[receipt.evidence_id],{research_question:'Unit',source_reference:receipt.evidence_id,finding:'Unit only',confidence:.2},undefined,undefined,undefined,undefined,f.authority);
 const before=await readFile(f.file);await expect(f.queue.publishNativeReceipt(f.receipt,f.authority)).rejects.toThrow('active issued');expect(await readFile(f.file)).toEqual(before);
});
it.each(['token','scope','project','attempt','hash','provider'])('refuses %s mismatch without receipt publication',async kind=>{
 const f=await fixture(),receipt={...f.receipt},authority={...f.authority};
 if(kind==='token')authority.token='0'.repeat(64);if(kind==='scope')receipt.namespace='foreign';if(kind==='project')receipt.project_id='foreign';if(kind==='attempt')receipt.attempt_id='00000000-0000-4000-8000-000000000001';if(kind==='hash')receipt.content_hash='0'.repeat(64);if(kind==='provider')receipt.provider_id='different';
 await expect(f.queue.publishNativeReceipt(receipt,authority)).rejects.toThrow();await expect(readFile(f.file)).rejects.toMatchObject({code:'ENOENT'});
});
it('requires issued attempt and refuses publication after terminal containment',async()=>{
 const f=await fixture(false);await expect(f.queue.publishNativeReceipt(f.receipt,f.authority)).rejects.toThrow('active issued');
 const active=await fixture();await active.queue.blockAttempt(active.item.work_id,'Unit stopped',active.authority);
 await expect(active.queue.publishNativeReceipt(active.receipt,active.authority)).rejects.toThrow();await expect(readFile(active.file)).rejects.toMatchObject({code:'ENOENT'});
});
it('allows current IN_REVIEW publication and rejects conflicting identity',async()=>{
 const f=await fixture();await f.queue.submitForReview(f.item.work_id,f.authority);await f.queue.publishNativeReceipt(f.receipt,f.authority);
 const output='Conflicting unit receipt';await expect(f.queue.publishNativeReceipt({...f.receipt,output,content_hash:createHash('sha256').update(output).digest('hex')},f.authority)).rejects.toThrow('different output or lineage');
 expect((await readFile(f.file,'utf8')).trim().split('\n')).toHaveLength(1);
});
it.each(['corrupt','duplicate','unterminated','alias','hash'])('refuses %s original ledger and preserves bytes',async kind=>{
 const f=await fixture(),canonical={...f.receipt,source_artifact:`${f.file}#${f.receipt.evidence_id}`},serialized=JSON.stringify(canonical),original=kind==='corrupt'?'{invalid}\n':kind==='duplicate'?serialized+'\n'+serialized+'\n':kind==='hash'?JSON.stringify({...f.receipt,evidence_id:'UNRELATED-OLD',content_hash:'0'.repeat(64)})+'\n':serialized;
 if(kind==='alias'){await writeFile(path.join(f.root,'preserved'),original);await symlink(path.join(f.root,'preserved'),f.file);}else await writeFile(f.file,original);
 const before=await readFile(f.file);await expect(f.queue.publishNativeReceipt(f.receipt,f.authority)).rejects.toThrow();expect(await readFile(f.file)).toEqual(before);
});
it('stale and wrong-root capabilities cannot publish',async()=>{
 const f=await fixture(),other=await fixture();await expect(other.queue.publishNativeReceipt(f.receipt,f.authority)).rejects.toThrow();
 await f.queue.blockAttempt(f.item.work_id,'Unit reattempt',f.authority);await f.queue.requeueBlocked(f.item.work_id);await f.queue.claim(f.item.work_id,'fixture');
 await expect(f.queue.publishNativeReceipt(f.receipt,f.authority)).rejects.toThrow();await expect(readFile(f.file)).rejects.toMatchObject({code:'ENOENT'});
});

it('two OS publishers dedupe with capability transported only in a private temporary fixture file',async()=>{
 const {spawn}=await import('node:child_process'),{createRequire}=await import('node:module'),{unlink}=await import('node:fs/promises');const f=await fixture(),worker=path.join(f.root,'publisher.mts'),request=path.join(f.root,'private-request.json');
 await writeFile(request,JSON.stringify({receipt:f.receipt,authority:f.authority}),{mode:0o600});
 await writeFile(worker,`import {readFile} from 'node:fs/promises';import {RoleWorkQueue} from ${JSON.stringify(path.join(process.cwd(),'server/aiCompany/roleWorkQueue.ts'))};import {RoleEvidenceResolver} from ${JSON.stringify(path.join(process.cwd(),'server/aiCompany/roleEvidenceResolver.ts'))};const input=JSON.parse(await readFile(process.argv[3],'utf8'));const row=await new RoleWorkQueue(process.argv[2],new RoleEvidenceResolver(process.argv[2])).publishNativeReceipt(input.receipt,input.authority);console.log(JSON.stringify(row));`);
 const launch=()=>new Promise<{code:number|null;stdout:string;stderr:string}>((resolve,reject)=>{const child=spawn(process.execPath,['--import',createRequire(import.meta.url).resolve('tsx'),worker,f.root,request],{stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);const timer=setTimeout(()=>child.kill('SIGKILL'),5000);child.once('error',reject);child.once('close',code=>{clearTimeout(timer);resolve({code,stdout,stderr});});});
 try{const [a,b]=await Promise.all([launch(),launch()]);expect(a.code,a.stderr).toBe(0);expect(b.code,b.stderr).toBe(0);expect(JSON.parse(a.stdout)).toEqual(JSON.parse(b.stdout));const stored=await readFile(f.file,'utf8');expect(stored.trim().split('\n')).toHaveLength(1);expect(stored).not.toContain(f.authority.token);}finally{await unlink(request);}
});
