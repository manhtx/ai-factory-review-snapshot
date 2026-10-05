import { mkdtemp, writeFile, readFile, mkdir, chmod } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const candidate = '/Users/manhtx/.codex/worktrees/successor-integrity/Macro Research Platform';
const base = await mkdtemp('/tmp/successor-probe-run.');
process.chdir(base);
const files = ['server/aiCompany/durableOperation.ts','scripts/ai-company-continuity-kernel.mjs'];
async function hashes() { return Object.fromEntries(await Promise.all(files.map(async f => [f,createHash('sha256').update(await readFile(path.join(candidate,f))).digest('hex')]))); }
const before = await hashes();
const { DurableOperationLedger } = await import(pathToFileURL(path.join(candidate,files[0])));
const { stepContinuityCycle, fileExists } = await import(pathToFileURL(path.join(candidate,files[1])));
const evidence=[];
const emit = (name, data) => { const record={name,...data}; evidence.push(record); console.log(JSON.stringify(record)); };
const contract = {effect_class:'READ_ONLY',recovery_policy:'SAFE_RETRY',idempotency_strategy:'NONE',observable_side_effects:[],reconciliation_check:'NONE',retry_budget:1,unknown_outcome_policy:'FAIL_CLOSED'};
const row = {operation_id:'op',mission_id:'mission',semantic_cycle_id:'cycle',action_id:'action',operation_semantic:'inspect',operation_state:'WAITING_RESOURCE',attempt_id:'attempt',idempotency_key:'key',last_committed_transition:null,checkpoint_reference:null,next_safe_transition:'CLAIM',execution_lease_id:null,lease_revision:1,controller:'controller',provider:'provider',runtime_model_id:'model',runner:'runner',authority_scope:'scope',failure_class:null,wait_reason:null,reactivation_condition:null,next_wake_at:null,recovery_attempt:0,owner:null,owner_lease:null,recovery_contract:contract,created_at:'2026-01-01T00:00:00.000Z',updated_at:'2026-01-01T00:00:00.000Z'};
async function ledgerFor(value) { const dir=await mkdtemp(path.join(base,'ledger-')); const ledger=new DurableOperationLedger(dir); await writeFile(ledger.operationsFile,JSON.stringify(value)+'\n'); return ledger; }
for (const [field,values] of Object.entries({next_wake_at:['2026-02-30T00:00:00.000Z','2026-04-31T00:00:00Z','0','2026-01-01T00:00:00','not-a-date'],operation_state:['running','RUNNING ','FUTURE_SUCCESS'],next_safe_transition:['RETRY_FOREVER','CLAIM\u0000'],owner:['garbage','kernel-pid-0','kernel-pid-123junk'],recovery_attempt:['1',-1,1.5,9007199254740992],failure_class:['UNKNOWN','UNKNOWN_FAILURE ']})) {
  for(const value of values) { const ledger=await ledgerFor({...row,[field]:value}); try {await ledger.getAll(); emit('decode',{field,value,accepted:true,interpreted:field==='next_wake_at'?new Date(value).toISOString():undefined});} catch(e){emit('decode',{field,value,accepted:false,error:e.message});} }
}
const dated=await ledgerFor({...row,next_wake_at:'2026-02-30T00:00:00.000Z'});
emit('invalid-date-effect',{report:await dated.reconcileOrphans({now:new Date('2026-03-03T00:00:00Z')}),state:(await dated.getAll())[0].operation_state});
function dependencies(overrides={}) {
 const calls=[]; const d={root:base,stopSentinel:path.join(base,'missing-stop'),fileExists,readFile,
 supervisor:{acquire:async()=>{calls.push('acquire');}},
 queue:{recoverStaleLeases:async()=>{calls.push('recover');return [];},reconcileOrphanedReady:async()=>{calls.push('orphans');return [];},summary:async()=>{calls.push('summary');return {total:1,byState:{READY:1}};}},
 opLedger:{reconcileOrphans:async()=>{calls.push('operations');return {orphaned_count:0,reconciled:[]};}},waitWake:{resumeDue:async()=>{calls.push('wake');return [];}},
 leaseManager:{resolveExecutionAuthority:async()=>{calls.push('authority');return {status:'RESOLVED',lease:{runtime_model_id:'test',lease_id:'test',runner:'test'}};}},evaluateAntigravityAdmission:async()=>{calls.push('admission');return {decision:'ALLOW'};},
 logEvent:(event)=>calls.push(event),runRunner:async()=>{calls.push('dispatch');return 0;},hasRunningChild:()=>false,...overrides}; return {d,calls};
}
async function cycle(name,setup) {const {d,calls}=dependencies(); if(setup)await setup(d);try {const result=await stepContinuityCycle(d);emit(name,{result,calls});}catch(e){emit(name,{error:e.message,code:e.code,calls});}}
await cycle('healthy');
for(const [obj,method] of [['queue','recoverStaleLeases'],['queue','reconcileOrphanedReady'],['opLedger','reconcileOrphans'],['waitWake','resumeDue'],['queue','summary']]) await cycle('throw-'+method,d=>{d[obj][method]=async()=>{throw new Error('INJECTED_'+method);};});
await cycle('sentinel-EACCES',d=>{d.fileExists=async()=>{throw Object.assign(new Error('INJECTED_SENTINEL'),{code:'EACCES'});};});
const stopParent=path.join(base,'not-directory');await writeFile(stopParent,'x');
await cycle('sentinel-real-ENOTDIR',d=>{d.stopSentinel=path.join(stopParent,'COMPANY_STOP');});
const denied=path.join(base,'denied');await mkdir(denied);await writeFile(path.join(denied,'COMPANY_STOP'),'stop');await chmod(denied,0);
try {await cycle('sentinel-real-EACCES',d=>{d.stopSentinel=path.join(denied,'COMPANY_STOP');});}finally{await chmod(denied,0o700);}
for (const raw of ['{broken','{}','{"pid":"123"}','{"pid":0}','{"pid":-1}','{"pid":1.5}']) await cycle('marathon-'+raw,d=>{d.readFile=async()=>raw;});
await cycle('marathon-EACCES',d=>{d.readFile=async()=>{throw Object.assign(new Error('INJECTED_OWNER'),{code:'EACCES'});};});
const originalKill=process.kill;
try {
 process.kill=()=>{throw Object.assign(new Error('INJECTED_PID_EPERM'),{code:'EPERM'});};
 await cycle('marathon-PID-EPERM',d=>{d.readFile=async()=>'{"pid":123}';});
 const owned=await ledgerFor({...row,operation_state:'RUNNING',owner:'kernel-pid-123'});
 await cycle('operation-PID-EPERM',d=>{d.opLedger=owned;});
 emit('operation-PID-EPERM-state',{state:(await owned.getAll())[0].operation_state});
 const malformed=await ledgerFor({...row,operation_state:'RUNNING',owner:'not-a-pid'});
 await cycle('operation-malformed-owner',d=>{d.opLedger=malformed;});
 emit('operation-malformed-owner-state',{state:(await malformed.getAll())[0].operation_state});
 const seen=[];process.kill=(pid,signal)=>{seen.push({pid,signal});return true;};
 const alias=await ledgerFor({...row,operation_state:'RUNNING',owner:'kernel-pid-0junk'});
 await cycle('operation-owner-alias',d=>{d.opLedger=alias;});
 emit('operation-owner-alias-effect',{seen,state:(await alias.getAll())[0].operation_state});
}finally{process.kill=originalKill;}
// Exercise write admission with a serialization-changing control value.
const dir=await mkdtemp(path.join(base,'write-'));const writable=new DurableOperationLedger(dir);
const input={operation_id:'serialize',semantic_cycle_id:'cycle',action_id:'action',operation_semantic:'inspect',recovery_contract:{...contract,toJSON(){return {recovery_policy:'RETRY_FOREVER'};}}};
try {await writable.createOperation(input);emit('serialized-contract-write',{accepted:true});}catch(e){emit('serialized-contract-write',{accepted:false,error:e.message});}
try {await writable.getAll();emit('serialized-contract-read',{accepted:true});}catch(e){emit('serialized-contract-read',{accepted:false,error:e.message});}
emit('serialized-contract-bytes',{raw:await readFile(writable.operationsFile,'utf8')});
const corrupt=await ledgerFor({...row,operation_state:'UNKNOWN_PROTOCOL'});
const corruptBefore=await readFile(corrupt.operationsFile,'utf8');
await cycle('real-invalid-ledger-step',d=>{d.opLedger=corrupt;});
emit('real-invalid-ledger-preservation',{unchanged:corruptBefore===await readFile(corrupt.operationsFile,'utf8')});
const invalidAppend=await ledgerFor(row);const appendBefore=await readFile(invalidAppend.operationsFile,'utf8');
try {await invalidAppend.transition('op','FUTURE_SUCCESS');emit('invalid-transition',{accepted:true});}catch(e){emit('invalid-transition',{accepted:false,error:e.message,unchanged:appendBefore===await readFile(invalidAppend.operationsFile,'utf8')});}
emit('identity',{base,before,after:await hashes()});
await writeFile(path.join(base,'evidence.json'),JSON.stringify(evidence,null,2)+'\n');
console.log('EVIDENCE_FILE='+path.join(base,'evidence.json'));
