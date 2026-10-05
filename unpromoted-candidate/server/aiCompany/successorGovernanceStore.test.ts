import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { SuccessorGovernanceStore, type GovernanceBinding } from './successorGovernanceStore';

const binding: GovernanceBinding = { missionHash: 'a'.repeat(64), envelopeHash: 'b'.repeat(64), policyHash: 'c'.repeat(64), trustEpoch: 'ISOLATED_TEST_ONLY' };
const directories: string[] = [];
const stores: SuccessorGovernanceStore[] = [];
afterEach(() => {
  for (const store of stores.splice(0)) { try { store.close(); } catch { /* Test may already have closed it. */ } }
  for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'successor-governance-'));
  directories.push(dir);
  const file = join(dir, 'control.sqlite');
  const store = SuccessorGovernanceStore.createNew(file, binding, 'founder-gateway');
  stores.push(store);
  return { dir, file, store };
}
const command = { commandId: 'command-1', actor: 'founder-gateway', expectedRevision: 0, nextOwner: 'founder-gateway' };

describe('isolated successor storage and logical authority boundary', () => {
  it('requires explicit genesis and preserves existing stores', () => {
    const { dir, file, store } = fixture();
    expect(() => SuccessorGovernanceStore.openExisting(join(dir, 'missing.sqlite'), binding)).toThrow();
    const before = readFileSync(file);
    expect(() => SuccessorGovernanceStore.createNew(file, binding, 'other')).toThrow();
    expect(readFileSync(file)).toEqual(before);
    expect(store.authority()).toEqual({ owner: 'founder-gateway', revision: 0 });
  });

  it('pins mission, policy, envelope and trust epoch independently', () => {
    const { file } = fixture();
    for (const field of Object.keys(binding) as Array<keyof GovernanceBinding>) {
      expect(() => SuccessorGovernanceStore.openExisting(file, { ...binding, [field]: field === 'trustEpoch' ? 'OTHER' : 'd'.repeat(64) })).toThrow(/BINDING_MISMATCH/);
    }
  });

  it('binds idempotency to command content and reopens the committed receipt', () => {
    const { file, store } = fixture();
    expect(store.advanceAuthority(command)).toMatchObject({ revision: 1, replayed: false });
    const before = store.authority();
    expect(store.advanceAuthority(command)).toMatchObject({ revision: 1, replayed: true });
    expect(store.authority()).toEqual(before);
    expect(() => store.advanceAuthority({ ...command, nextOwner: 'other' })).toThrow(/COMMAND_ID_CONFLICT/);
    store.close();
    const reopened = SuccessorGovernanceStore.openExisting(file, binding); stores.push(reopened);
    expect(reopened.authority()).toEqual(before);
    expect(reopened.advanceAuthority(command)).toMatchObject({ revision: 1, replayed: true });
  });

  it('checks current logical authority and revision before a new commit', () => {
    const { store } = fixture();
    expect(() => store.advanceAuthority({ ...command, actor: 'not-authorized' })).toThrow(/ACTOR_NOT_CURRENT/);
    store.advanceAuthority({ ...command, nextOwner: 'new-owner' });
    expect(() => store.advanceAuthority(command)).toThrow(/ACTOR_NOT_CURRENT/);
    expect(() => store.advanceAuthority({ ...command, commandId: 'stale', actor: 'new-owner' })).toThrow(/STALE_REVISION/);
    expect(store.authority()).toEqual({ owner: 'new-owner', revision: 1 });
  });

  it('fails visibly for invalid schema or missing authority', () => {
    const { file, store } = fixture(); store.close();
    const db = new DatabaseSync(file);
    db.exec('DELETE FROM authority'); db.close();
    expect(() => SuccessorGovernanceStore.openExisting(file, binding)).toThrow(/STATE_INVALID/);
    const raw = new DatabaseSync(file);
    raw.prepare('UPDATE binding SET schema_version=?').run('future-schema'); raw.close();
    expect(() => SuccessorGovernanceStore.openExisting(file, binding)).toThrow(/BINDING_MISMATCH/);
  });

  it.each([
    ['receipt suppression trigger', 'CREATE TRIGGER discard_receipt BEFORE INSERT ON commands BEGIN SELECT RAISE(IGNORE); END;'],
    ['altered receipt owner', "UPDATE commands SET owner='owner-z'"],
    ['deleted history', 'DELETE FROM commands'],
    ['missing table', 'DROP TABLE commands'],
  ])('rejects %s at reopen before exposing authority or accepting commands', (_name, sql) => {
    const { file, store } = fixture();
    store.advanceAuthority(command); store.close();
    const damaged = new DatabaseSync(file); damaged.exec(sql); damaged.close();
    const before = readFileSync(file);
    expect(() => SuccessorGovernanceStore.openExisting(file, binding)).toThrow();
    expect(readFileSync(file)).toEqual(before);
  });

  it('admits only one of eight independent process contenders and preserves receipt/owner coherence', async () => {
    const { file, store } = fixture();
    const moduleUrl = pathToFileURL(resolve('server/aiCompany/successorGovernanceStore.ts')).href;
    const program = `import {SuccessorGovernanceStore} from ${JSON.stringify(moduleUrl)};
      const [file,binding,id]=process.argv.slice(1);
      const store=SuccessorGovernanceStore.openExisting(file,JSON.parse(binding));
      try { console.log(JSON.stringify({ok:true,receipt:store.advanceAuthority({commandId:id,actor:'founder-gateway',expectedRevision:0,nextOwner:'founder-gateway'})})); }
      catch(error){console.log(JSON.stringify({ok:false,error:error.message}));}finally{store.close();}`;
    const results = await Promise.all(Array.from({ length: 8 }, (_, index) => new Promise<{ ok: boolean; error?: string; receipt?: { revision: number; commandId: string } }>((resolveResult, reject) => {
      const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', program, file, JSON.stringify(binding), `contender-${index}`], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '', stderr = '';
      const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
      child.stdout.on('data', chunk => { stdout += chunk; });
      child.stderr.on('data', chunk => { stderr += chunk; });
      child.on('error', reject);
      child.on('close', code => { clearTimeout(timer); if (code !== 0) reject(new Error(stderr || `worker exit ${code}`)); else { try { resolveResult(JSON.parse(stdout)); } catch (error) { reject(error); } } });
    })));
    expect(results.filter(result => result.ok)).toHaveLength(1);
    expect(results.filter(result => result.error === 'GOVERNANCE_STALE_REVISION')).toHaveLength(7);
    expect(store.authority()).toEqual({ owner: 'founder-gateway', revision: 1 });
    const winner = results.find(result => result.ok)!.receipt!;
    expect(winner.revision).toBe(1);
    expect(store.advanceAuthority({ ...command, commandId: winner.commandId })).toMatchObject({ replayed: true, revision: 1 });
  });

  it.each(['before', 'after'])('reconstructs with no surviving connection after kill %s COMMIT', async boundary => {
    const { file, store } = fixture(); store.close();
    const moduleUrl = pathToFileURL(resolve('server/aiCompany/successorGovernanceStore.ts')).href;
    const program = `import {DatabaseSync} from 'node:sqlite'; import {writeSync} from 'node:fs';
      import {SuccessorGovernanceStore} from ${JSON.stringify(moduleUrl)};
      const [file,binding,boundary]=process.argv.slice(1);
      const store=SuccessorGovernanceStore.openExisting(file,JSON.parse(binding));
      const original=DatabaseSync.prototype.exec;
      DatabaseSync.prototype.exec=function(sql){
        if(sql==='COMMIT'){
          if(boundary==='after')original.call(this,sql);
          writeSync(1,'INJECTED_BOUNDARY\\n');
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);
        }
        return original.call(this,sql);
      };
      store.advanceAuthority({commandId:'interrupted',actor:'founder-gateway',expectedRevision:0,nextOwner:'founder-gateway'});`;
    await new Promise<void>((resolveResult, reject) => {
      const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', program, file, JSON.stringify(binding), boundary], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '', errorOutput = '', observedBoundary = false;
      const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
      child.stdout.on('data', chunk => { output += chunk; if (output.includes('INJECTED_BOUNDARY') && !observedBoundary) { observedBoundary = true; child.kill('SIGKILL'); } });
      child.stderr.on('data', chunk => { errorOutput += chunk; });
      child.on('error', reject);
      child.on('close', (_code, signal) => {
        clearTimeout(timer);
        if (observedBoundary && signal === 'SIGKILL') resolveResult();
        else reject(new Error(`Missing confirmed interruption boundary: ${errorOutput}`));
      });
    });
    const reopened = SuccessorGovernanceStore.openExisting(file, binding); stores.push(reopened);
    expect(reopened.authority()).toEqual({ owner: 'founder-gateway', revision: boundary === 'before' ? 0 : 1 });
    const receipt = reopened.advanceAuthority({ ...command, commandId: 'interrupted' });
    expect(receipt).toMatchObject({ owner: 'founder-gateway', revision: 1, replayed: boundary === 'after' });
    expect(reopened.authority()).toEqual({ owner: 'founder-gateway', revision: 1 });
  });
});
