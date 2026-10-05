import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readFileSync, mkdtempSync } from 'node:fs';
import { SuccessorGovernanceStore as Store } from '/Users/manhtx/.codex/worktrees/successor-integrity/Macro Research Platform/server/aiCompany/successorGovernanceStore.ts';
const binding = { missionHash: 'a'.repeat(64), envelopeHash: 'b'.repeat(64), policyHash: 'c'.repeat(64), trustEpoch: 'ISOLATED_TEST_ONLY' };
const command = { commandId: 'c1', actor: 'owner-a', expectedRevision: 0, nextOwner: 'owner-a' };
const root = mkdtempSync('/tmp/g1-adversarial-ml1O3M/run-');
console.log(JSON.stringify({temporaryState:root}));
function attempt(fn) { try { return { ok: true, result: fn() }; } catch (e) { return { ok: false, error: e.message }; } }
function seed(name) { const file = `${root}/${name}.sqlite`; const s = Store.createNew(file, binding, 'owner-a'); s.advanceAuthority(command); s.close(); return file; }
function damage(file, sql) { const db = new DatabaseSync(file); db.exec(sql); db.close(); }
function inspect(file) { const db = new DatabaseSync(file, {readOnly:true}); try { return { authority: db.prepare('SELECT * FROM authority').all(), receipts: db.prepare('SELECT * FROM commands').all() }; } finally { db.close(); } }
// Closed-store corruption / incomplete restore fixtures; no concurrent raw writer.
for (const [name,sql] of [
  ['missing-receipts', 'DELETE FROM commands'],
  ['wrong-receipt-owner', "UPDATE commands SET owner='owner-z'"],
  ['missing-table', 'DROP TABLE commands'],
]) {
  const file=seed(name); damage(file,sql);
  const reopened=attempt(()=>Store.openExisting(file,binding));
  if (!reopened.ok) { console.log(JSON.stringify({name,open:reopened})); continue; }
  const s=reopened.result;
  const before=s.authority();
  const replay=attempt(()=>s.advanceAuthority(command));
  const next=attempt(()=>s.advanceAuthority({commandId:'c2',actor:'owner-a',expectedRevision:1,nextOwner:'owner-a'}));
  s.close();
  console.log(JSON.stringify({name,openAccepted:true,before,replay,next,stored:attempt(()=>inspect(file))}));
}
// Incompatible schema retaining the version label: suppress receipt insertion.
{
  const file=seed('unknown-trigger');
  damage(file,"CREATE TRIGGER discard_receipt BEFORE INSERT ON commands BEGIN SELECT RAISE(IGNORE); END;");
  const s=Store.openExisting(file,binding);
  const commit=attempt(()=>s.advanceAuthority({commandId:'c2',actor:'owner-a',expectedRevision:1,nextOwner:'owner-b'}));
  s.close();
  const reopened=Store.openExisting(file,binding);
  console.log(JSON.stringify({name:'unknown-trigger',commit,afterRestart:reopened.authority(),stored:inspect(file)}));
  reopened.close();
}
for (const file of ['server/aiCompany/successorGovernanceStore.ts','server/aiCompany/successorGovernanceStore.test.ts']) {
  const path='/Users/manhtx/.codex/worktrees/successor-integrity/Macro Research Platform/'+file;
  console.log(JSON.stringify({file,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}));
}
