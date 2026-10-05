// Local takeover backup tool. Does not enable execution or grant successor authority.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = '/Users/manhtx/Documents/Macro Research Platform';
const backup = '/Users/manhtx/Documents/macro-successor-f0-I5xvdx';
const archive = path.join(backup, 'control-state-suspended.tgz');
const restore = path.join(backup, 'control-suspended-restore');
if (process.cwd() !== root || !existsSync(path.join(root, '.ai-company/COMPANY_STOP'))) throw new Error('Unexpected root or missing intentional-stop sentinel');
if (existsSync(archive) || existsSync(restore)) throw new Error('Snapshot target already exists; never overwrite forensic state');
const labels = ['com.macrolens.ai-company-supervisor', 'com.macrolens.ai-company-loop'];
const identity = pid => execFileSync('ps', ['-p', String(pid), '-o', 'lstart=,comm='], { encoding: 'utf8' }).trim();
const owners = labels.map(label => {
  const output = execFileSync('launchctl', ['print', `gui/${process.getuid()}/${label}`], { encoding: 'utf8' });
  const pid = Number(output.match(/^\s*pid = (\d+)$/m)?.[1]);
  if (!Number.isSafeInteger(pid) || pid < 2) throw new Error(`No live owner for ${label}`);
  const cwd = execFileSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], { encoding: 'utf8' });
  if (!cwd.split('\n').includes(`n${root}`)) throw new Error(`Unexpected cwd for ${label}`);
  return { label, pid, identity: identity(pid) };
});
const topFiles = readdirSync(path.join(root, '.ai-company'), { withFileTypes: true })
  .filter(item => item.isFile()).map(item => `.ai-company/${item.name}`);
const dirs = ['runtime', 'mission', 'product-intelligence', 'backlogs', 'memory', 'workflows', 'prompts', 'epochs']
  .map(name => `.ai-company/${name}`).filter(name => existsSync(path.join(root, name)));
const selected = [...topFiles, ...dirs];
const digest = file => createHash('sha256').update(readFileSync(file)).digest('hex');
function manifest(base) {
  const result = {};
  const visit = relative => {
    const full = path.join(base, relative);
    const stat = lstatSync(full);
    if (stat.isSymbolicLink()) throw new Error(`Symlink requires explicit adjudication: ${relative}`);
    if (stat.isDirectory()) for (const name of readdirSync(full).sort()) visit(path.join(relative, name));
    else if (stat.isFile()) result[relative] = { bytes: stat.size, sha256: digest(full) };
    else throw new Error(`Unsupported state entry: ${relative}`);
  };
  selected.forEach(visit);
  return result;
}

// Independent watchdog resumes only matching process identities if this tool dies.
const watchdog = spawn(process.execPath, ['--input-type=module', '-e', `
  import {execFileSync} from 'node:child_process';
  const owners=JSON.parse(process.argv[1]);
  setTimeout(()=>{for(const owner of owners){try{
    const current=execFileSync('ps',['-p',String(owner.pid),'-o','lstart=,comm='],{encoding:'utf8'}).trim();
    if(current===owner.identity)process.kill(owner.pid,'SIGCONT');
  }catch{}}},45000);
`, JSON.stringify(owners)], { detached: true, stdio: 'ignore' });
watchdog.unref();
const suspended = [];
const started = Date.now();
let report;
try {
  for (const owner of owners) {
    if (identity(owner.pid) !== owner.identity) throw new Error('Process identity drift before suspension');
    process.kill(owner.pid, 'SIGSTOP'); suspended.push(owner);
  }
  for (const owner of owners) {
    const state = execFileSync('ps', ['-p', String(owner.pid), '-o', 'state='], { encoding: 'utf8' }).trim();
    if (!state.includes('T')) throw new Error('Writer did not enter stopped state');
  }
  const before = manifest(root);
  const packed = spawnSync('tar', ['-czf', archive, '--null', '-T', '-'], {
    cwd: root, input: selected.join('\0') + '\0', encoding: 'utf8',
    env: { ...process.env, LC_ALL: 'C' }, timeout: 20000,
  });
  if (packed.status !== 0) throw new Error(`Snapshot tar failed: ${packed.status}`);
  const after = manifest(root);
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Control-state changed during suspended capture');
  mkdirSync(restore, { mode: 0o700 });
  execFileSync('tar', ['-xzf', archive, '-C', restore], { env: { ...process.env, LC_ALL: 'C' }, timeout: 10000 });
  const restored = manifest(restore);
  if (JSON.stringify(before) !== JSON.stringify(restored)) throw new Error('Restore content mismatch');
  report = { schema: 'successor-takeover.suspended-snapshot.v1', capturedAt: new Date().toISOString(),
    archive, archiveSha256: digest(archive), restore, owners, fileCount: Object.keys(before).length,
    manifestSha256: createHash('sha256').update(JSON.stringify(before)).digest('hex'),
    scope: selected, stableDuringCapture: true, restoredBytesMatch: true,
    claimLimit: 'Declared company process writers suspended; external/undeclared writers not globally fenced; no migration or authority transfer.' };
} finally {
  const resumeErrors = [];
  for (const owner of suspended) {
    try {
      if (identity(owner.pid) !== owner.identity) throw new Error('Process identity changed');
      process.kill(owner.pid, 'SIGCONT');
    } catch { resumeErrors.push(owner.label); }
  }
  if (!resumeErrors.length) watchdog.kill('SIGTERM');
  if (resumeErrors.length) throw new Error(`Resume failed; watchdog retained: ${resumeErrors.join(', ')}`);
}
report.suspendedElapsedMs = Date.now() - started;
report.resumed = owners.map(owner => ({ label: owner.label, pid: owner.pid, sameIdentity: identity(owner.pid) === owner.identity,
  state: execFileSync('ps', ['-p', String(owner.pid), '-o', 'state='], { encoding: 'utf8' }).trim() }));
console.log(JSON.stringify(report));
