import {it,expect} from 'vitest';
import {mkdtemp,readFile,writeFile,symlink} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';
import {RoleWorkQueue} from './roleWorkQueue';import {RoleEvidenceResolver} from './roleEvidenceResolver';
async function fixture(issued=true){
 const root=await mkdtemp(path.join(os.tmpdir(),'cli-receipt-')),queue=new RoleWorkQueue(root,new RoleEvidenceResolver(root));
 const item=await queue.create({project_id:'unit',backlog_id:'B',title:'Unit only',role:'ux-research',namespace:'N',run_id:'R'}),{attempt_authority:authority,...claimed}=await queue.claim(item.work_id,'fixture');
 if(issued)await queue.reserveProviderDispatch(item.work_id,'cli:stub:unit',authority,claimed);
 const content='Unit receipt only';const receipt={evidence_id:`ROLE-DISPATCH:${item.work_id}:${claimed.attempt_id}`,project_id:'unit',work_id:item.work_id,attempt_id:claimed.attempt_id,evidence_kind:'PROVIDER_OUTPUT' as const,namespace:'N',run_id:'R',produced_by_role:item.role,runner:'stub',model:'unit',content,content_hash:createHash('sha256').update(content).digest('hex'),created_at:new Date().toISOString(),source_artifact:'cliReceiptPublication.test.ts'};
 return{root,queue,item,authority,receipt,file:path.join(root,'role-dispatch-evidence.jsonl')};
}
it('concurrent CLI publishers dedupe without changing queue bytes or exposing capability',async()=>{
 const f=await fixture(),queueFile=path.join(f.root,'role-work-queue.jsonl'),before=await readFile(queueFile);
 const [a,b]=await Promise.all([f.queue.publishCliReceipt(f.receipt,f.authority),f.queue.publishCliReceipt(f.receipt,f.authority)]);expect(a).toEqual(b);
 const bytes=await readFile(f.file,'utf8');expect(bytes.trim().split('\n')).toHaveLength(1);expect(bytes).not.toContain(f.authority.token);expect(await readFile(queueFile)).toEqual(before);
});
it.each(['token','scope','project','attempt','hash','provider'])('refuses %s mismatch without receipt publication',async kind=>{
 const f=await fixture(),receipt={...f.receipt},authority={...f.authority};
 if(kind==='token')authority.token='0'.repeat(64);if(kind==='scope')receipt.namespace='foreign';if(kind==='project')receipt.project_id='foreign';if(kind==='attempt')receipt.attempt_id='00000000-0000-4000-8000-000000000001';if(kind==='hash')receipt.content_hash='0'.repeat(64);if(kind==='provider')receipt.model='different';
 await expect(f.queue.publishCliReceipt(receipt,authority)).rejects.toThrow();await expect(readFile(f.file)).rejects.toMatchObject({code:'ENOENT'});
});
it('requires issued attempt and refuses publication after terminal containment',async()=>{
 const f=await fixture(false);await expect(f.queue.publishCliReceipt(f.receipt,f.authority)).rejects.toThrow('active issued');
 const active=await fixture();await active.queue.blockAttempt(active.item.work_id,'Unit stopped',active.authority);
 await expect(active.queue.publishCliReceipt(active.receipt,active.authority)).rejects.toThrow();await expect(readFile(active.file)).rejects.toMatchObject({code:'ENOENT'});
});
it('allows current IN_REVIEW publication and rejects conflicting identity',async()=>{
 const f=await fixture();await f.queue.submitForReview(f.item.work_id,f.authority);await f.queue.publishCliReceipt(f.receipt,f.authority);
 const content='Conflicting unit receipt';await expect(f.queue.publishCliReceipt({...f.receipt,content,content_hash:createHash('sha256').update(content).digest('hex')},f.authority)).rejects.toThrow('different content or lineage');
 expect((await readFile(f.file,'utf8')).trim().split('\n')).toHaveLength(1);
});
it.each(['corrupt','duplicate','unterminated','alias','hash'])('refuses %s original ledger and preserves bytes',async kind=>{
 const f=await fixture(),serialized=JSON.stringify(f.receipt),original=kind==='corrupt'?'{invalid}\n':kind==='duplicate'?serialized+'\n'+serialized+'\n':kind==='hash'?JSON.stringify({...f.receipt,evidence_id:'UNRELATED-OLD',content_hash:'0'.repeat(64)})+'\n':serialized;
 if(kind==='alias'){await writeFile(path.join(f.root,'preserved'),original);await symlink(path.join(f.root,'preserved'),f.file);}else await writeFile(f.file,original);
 const before=await readFile(f.file);await expect(f.queue.publishCliReceipt(f.receipt,f.authority)).rejects.toThrow();expect(await readFile(f.file)).toEqual(before);
});
it('stale and wrong-root capabilities cannot publish',async()=>{
 const f=await fixture(),other=await fixture();await expect(other.queue.publishCliReceipt(f.receipt,f.authority)).rejects.toThrow();
 await f.queue.blockAttempt(f.item.work_id,'Unit reattempt',f.authority);await f.queue.requeueBlocked(f.item.work_id);await f.queue.claim(f.item.work_id,'fixture');
 await expect(f.queue.publishCliReceipt(f.receipt,f.authority)).rejects.toThrow();await expect(readFile(f.file)).rejects.toMatchObject({code:'ENOENT'});
});

it('two OS publishers dedupe with capability transported only in a private temporary fixture file',async()=>{
 const {spawn}=await import('node:child_process'),{createRequire}=await import('node:module'),{unlink}=await import('node:fs/promises');const f=await fixture(),worker=path.join(f.root,'publisher.mts'),request=path.join(f.root,'private-request.json');
 await writeFile(request,JSON.stringify({receipt:f.receipt,authority:f.authority}),{mode:0o600});
 await writeFile(worker,`import {readFile} from 'node:fs/promises';import {RoleWorkQueue} from ${JSON.stringify(path.join(process.cwd(),'server/aiCompany/roleWorkQueue.ts'))};import {RoleEvidenceResolver} from ${JSON.stringify(path.join(process.cwd(),'server/aiCompany/roleEvidenceResolver.ts'))};const input=JSON.parse(await readFile(process.argv[3],'utf8'));const row=await new RoleWorkQueue(process.argv[2],new RoleEvidenceResolver(process.argv[2])).publishCliReceipt(input.receipt,input.authority);console.log(JSON.stringify(row));`);
 const launch=()=>new Promise<{code:number|null;stdout:string;stderr:string}>((resolve,reject)=>{const child=spawn(process.execPath,['--import',createRequire(import.meta.url).resolve('tsx'),worker,f.root,request],{stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);const timer=setTimeout(()=>child.kill('SIGKILL'),5000);child.once('error',reject);child.once('close',code=>{clearTimeout(timer);resolve({code,stdout,stderr});});});
 try{const [a,b]=await Promise.all([launch(),launch()]);expect(a.code,a.stderr).toBe(0);expect(b.code,b.stderr).toBe(0);expect(JSON.parse(a.stdout)).toEqual(JSON.parse(b.stdout));const stored=await readFile(f.file,'utf8');expect(stored.trim().split('\n')).toHaveLength(1);expect(stored).not.toContain(f.authority.token);}finally{await unlink(request);}
});
