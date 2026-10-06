import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const repo = process.cwd();
const { RoleWorkQueue } = await import(path.join(repo, 'server/aiCompany/roleWorkQueue.ts'));
const { RoleHandoffLedger } = await import(path.join(repo, 'server/aiCompany/roleHandoffLedger.ts'));
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'controller-git-effect-'));
let child: ReturnType<typeof spawn> | undefined;
let helperPid: number | undefined;
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function waitFile(file: string, timeout = 8000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { try { return await fs.readFile(file, 'utf8'); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; } await pause(20); }
  throw Error('bounded fixture observation expired: ' + path.basename(file));
}
function git(args: string[]) {
  const r = spawnSync('/usr/bin/git', args, { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) throw Error('temporary Git fixture failed: ' + r.stderr);
}
try {
  await fs.writeFile(path.join(root, 'README.md'), 'TEMPORARY FIXTURE ONLY; no product outcome\n');
  await fs.writeFile(path.join(root, '.gitignore'), '.ai-company/\nnode_modules/\nbin/\n');
  git(['init','-q']); git(['add','README.md','.gitignore']);
  git(['-c','user.name=Local Fixture','-c','user.email=fixture@example.invalid','commit','-qm','temporary fixture']);
  await fs.symlink(path.join(repo, 'node_modules'), path.join(root, 'node_modules'));
  const runtime = path.join(root, '.ai-company/runtime/projects/isolated');
  const queue = new RoleWorkQueue(runtime);
  const work = await queue.create({ project_id:'isolated', backlog_id:'TEMP-GIT-EFFECT', title:'Temporary lifecycle probe; no actual product objective', role:'backend-engineer', run_id:'fixture-run', namespace:'fixture-namespace' });
  await new RoleHandoffLedger(runtime).record({project_id:'isolated',work_id:work.work_id,from_role:'ceo',to_role:work.role,actor:'fixture',objective:work.title,context:['OS/Git lifecycle only'],evidence_ids:['fixture'],acceptance_criteria:['observe bounded delayed Git effect']});
  const bin = path.join(root,'bin'); await fs.mkdir(bin);
  const entered = path.join(root,'git-entered.json'), resume = path.join(root,'resume-git'), effect = path.join(root,'late-effect.json');
  await fs.writeFile(path.join(bin,'git'), `#!${process.execPath}
const fs=require('node:fs'),cp=require('node:child_process');
const args=process.argv.slice(2);
if(args[0]==='worktree'&&args[1]==='add'){
 fs.writeFileSync(${JSON.stringify(entered)},JSON.stringify({pid:process.pid,parentPid:process.ppid,target:args[3]}));
 const tick=setInterval(()=>{if(!fs.existsSync(${JSON.stringify(resume)}))return;clearInterval(tick);
 const result=cp.spawnSync('/usr/bin/git',args,{cwd:process.cwd(),stdio:'ignore'});
 fs.writeFileSync(${JSON.stringify(effect)},JSON.stringify({gitExit:result.status,targetExists:fs.existsSync(args[3])}));process.exit(result.status??1);},20);
 setTimeout(()=>process.exit(9),15000).unref();
}else{const r=cp.spawnSync('/usr/bin/git',args,{cwd:process.cwd(),stdio:'inherit'});process.exit(r.status??1);}
`, {mode:0o700});
  let stderr='';
  child=spawn(process.execPath,['--import','tsx',path.join(repo,'scripts/ai-company-run-ready.mjs'),'--project-id','isolated','--run-id','fixture-run','--namespace','fixture-namespace','--runner','codex','--model','no-provider'],{cwd:root,env:{...process.env,PATH:bin+path.delimiter+(process.env.PATH??''),AI_COMPANY_COORDINATOR_PHASE_TIMEOUT_MS:'5000'},stdio:['ignore','pipe','pipe']});
  child.stdout!.resume(); child.stderr!.on('data',b=>{stderr+=b;});
  const exited=new Promise(resolve=>{child!.once('error',e=>resolve({error:String(e)}));child!.once('exit',(code,signal)=>resolve({code,signal}));});
  const helper=JSON.parse(await waitFile(entered));helperPid=helper.pid;
  const controllerExit=await Promise.race([exited,pause(8000).then(()=>{throw Error('controller did not reach bounded timeout');})]);
  let helperAlive=false;try{process.kill(helperPid!,0);helperAlive=true;}catch{/* actual observed absence */}
  const before=(await queue.records())[0];
  await fs.writeFile(resume,'resume fixture only');
  const late=JSON.parse(await waitFile(effect,3000));
  const report={observedAt:new Date().toISOString(),sourceRevision:spawnSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).stdout.trim(),cleanSourceAtStart:spawnSync('git',['status','--porcelain'],{cwd:repo,encoding:'utf8'}).stdout.trim()==='',sourceHashes:Object.fromEntries(await Promise.all(['scripts/ai-company-run-ready.mjs','server/aiCompany/worktreeManager.ts'].map(async p=>[p,createHash('sha256').update(await fs.readFile(path.join(repo,p))).digest('hex')]))),scope:'Actual run-ready plus actual WorktreeManager/Git; Node wrapper delays genuine Git worktree add in temporary repo; no provider/model/live product',independent:false,controllerExit,gitHelperAliveAfterControllerExit:helperAlive,queueStateAtControllerExit:before.state,attemptIssued:!!before.attempt_id,lateGitEffect:late,stderr:stderr.slice(-3500),conclusion:helperAlive&&late.gitExit===0&&late.targetExists?'CURRENT_REPRODUCED: real Git workspace effect completes after coordinator timed out/exited before queue claim':'INCOMPLETE_OR_DIFFERENT_OUTCOME'};
  await fs.writeFile('/tmp/controller-git-effect-proof.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  await pause(200);
} finally {
  if(child&&child.exitCode===null&&child.signalCode===null){const exit=new Promise(r=>child!.once('exit',r));child.kill('SIGKILL');await exit;}
  if(helperPid){
    const status=spawnSync('/bin/ps',['-p',String(helperPid),'-o','command='],{encoding:'utf8'});
    if(status.status===0&&status.stdout.includes(path.join(root,'bin','git'))){process.kill(helperPid,'SIGKILL');await pause(100);}
  }
  await fs.rm(root,{recursive:true,force:true});
}
