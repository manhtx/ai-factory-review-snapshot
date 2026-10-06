import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, expect, it } from 'vitest';
import { codexWorkerPermissionArgs } from './macSandbox';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, {recursive:true,force:true}); });
function fixture() {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'codex-policy-test-'));roots.push(root);
  const control=path.join(root,'control'),workspace=path.join(root,'worker'),home=path.join(root,'auth-home'),temp=path.join(workspace,'attempt-tmp');
  for(const p of [control,workspace,home,temp])fs.mkdirSync(p);
  fs.mkdirSync(path.join(control,'node_modules'));fs.writeFileSync(path.join(control,'node_modules','dependency-fixture'),'DUMMY_ONLY');
  fs.writeFileSync(path.join(control,'credential-fixture'),'DUMMY_ONLY');fs.writeFileSync(path.join(home,'auth-fixture'),'DUMMY_ONLY');
  fs.symlinkSync(control,path.join(workspace,'escape'));
  return {root,control,workspace,home,temp};
}
it('rejects unsafe roots, modes and writable aliases',()=>{
  const f=fixture();
  expect(()=>codexWorkerPermissionArgs(f.control,f.control,'workspace-write')).toThrow();
  expect(()=>codexWorkerPermissionArgs(f.control,f.root,'workspace-write')).toThrow();
  expect(()=>codexWorkerPermissionArgs(f.control,f.workspace,'danger-full-access')).toThrow();
  expect(()=>codexWorkerPermissionArgs(f.control,f.workspace,'read-only',[path.join(f.workspace,'escape')])).toThrow();
  fs.rmSync(path.join(f.control,'node_modules'),{recursive:true});fs.symlinkSync(f.home,path.join(f.control,'node_modules'));
  expect(()=>codexWorkerPermissionArgs(f.control,f.workspace,'workspace-write')).toThrow('must not be an alias');
});

const macIt=process.platform==='darwin'?it:it.skip;
for(const mode of ['read-only','workspace-write'])macIt(`actual installed Codex utility enforces generated ${mode} policy`,()=>{
  const f=fixture();const args=codexWorkerPermissionArgs(f.control,f.workspace,mode,[f.temp]);
  const result=spawnSync('/Users/manhtx/.npm-global/bin/codex',['sandbox',...args,'--',process.execPath,'-e',`
    const fs=require('node:fs');const attempt=f=>{try{f();return true}catch{return false}};
    const [control,workspace,home,temp]=process.argv.slice(1);
    console.log(JSON.stringify({controlRead:attempt(()=>fs.readFileSync(control+'/credential-fixture')),authRead:attempt(()=>fs.readFileSync(home+'/auth-fixture')),escapeRead:attempt(()=>fs.readFileSync(workspace+'/escape/credential-fixture')),dependencyRead:attempt(()=>fs.readFileSync(control+'/node_modules/dependency-fixture')),dependencyWrite:attempt(()=>fs.writeFileSync(control+'/node_modules/forbidden','DUMMY')),workspaceWrite:attempt(()=>fs.writeFileSync('allowed','DUMMY')),tempWrite:attempt(()=>fs.writeFileSync(temp+'/allowed','DUMMY'))}));
  `,f.control,f.workspace,f.home,f.temp],{cwd:f.workspace,env:{PATH:'/usr/local/bin:/usr/bin:/bin',HOME:f.home,CODEX_HOME:f.home,TMPDIR:f.temp},encoding:'utf8',timeout:5000});
  expect(result.error).toBeUndefined();expect(result.status,result.stderr).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual({controlRead:false,authRead:false,escapeRead:false,dependencyRead:true,dependencyWrite:false,workspaceWrite:mode==='workspace-write',tempWrite:true});
});
