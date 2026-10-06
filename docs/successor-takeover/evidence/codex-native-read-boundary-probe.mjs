import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

// Explicit installed executable; isolated HOME and dummy files only. No model.
const cli = process.argv[2];
if (!cli || !path.isAbsolute(cli)) throw new Error('Pass an absolute installed Codex executable path');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-native-boundary-'));
const control = path.join(root, 'control'), workspace = path.join(root, 'worker'), home = path.join(root, 'fixture-home');
try {
  for (const directory of [control, workspace, home]) fs.mkdirSync(directory);
  fs.writeFileSync(path.join(control, 'private-fixture'), 'DUMMY_CONTROLLER_CREDENTIAL_ONLY');
  const env = { PATH: '/usr/local/bin:/usr/bin:/bin', HOME: home, CODEX_HOME: home, TMPDIR: home };
  const reports = [];
  for (const mode of ['read-only', 'workspace-write']) {
    const code = `const fs=require('node:fs');const attempt=f=>{try{f();return true}catch{return false}};console.log(JSON.stringify({privateRead:attempt(()=>fs.readFileSync(${JSON.stringify(path.join(control,'private-fixture'))})),controlWrite:attempt(()=>fs.writeFileSync(${JSON.stringify(path.join(control,'forbidden'))},'fixture')),workspaceWrite:attempt(()=>fs.writeFileSync('allowed','fixture'))}));`;
    const result = spawnSync(cli, ['sandbox', '-c', `sandbox_mode=${JSON.stringify(mode)}`, '--', process.execPath, '-e', code], { cwd: workspace, env, encoding: 'utf8', timeout: 5000 });
    reports.push({ requestedMode: mode, exitCode: result.status, error: result.error?.code, stdout: result.stdout, stderr: result.stderr });
  }
  const version = spawnSync(cli, ['--version'], { env, encoding: 'utf8', timeout: 3000 });
  console.log(JSON.stringify({ observedAt: new Date().toISOString(), scope: 'Installed Codex sandbox utility; isolated HOME/dummy control credential; no API/model or actual private file; not an actual model tool invocation', independent: false, cliVersion: version.stdout.trim(), launcherHash: createHash('sha256').update(fs.readFileSync(cli)).digest('hex'), nativePayloadCompleteness: 'OPEN', reports }, null, 2));
} finally { fs.rmSync(root, { recursive: true, force: true }); }
