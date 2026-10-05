import { afterEach, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { RoleWorkQueue } from './roleWorkQueue';
import { RoleHandoffLedger } from './roleHandoffLedger';

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
const macIt = process.platform === 'darwin' ? it : it.skip;
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cli-sandbox-')); roots.push(root);
  const control = path.join(root, 'control'), workspace = path.join(root, 'worker');
  const runtime = path.join(control, '.ai-company/runtime/projects/isolated');
  const queue = new RoleWorkQueue(runtime);
  const work = await queue.create({ project_id: 'isolated', backlog_id: 'TEMP-SANDBOX', title: 'OS sandbox fixture; product outcome UNKNOWN', role: 'ux-research', run_id: 'temporary', namespace: 'temporary' });
  await new RoleHandoffLedger(runtime).record({ project_id: 'isolated', work_id: work.work_id, from_role: 'ceo', to_role: work.role, actor: 'fixture', objective: work.title, context: ['temporary filesystem boundary'], evidence_ids: ['fixture'], acceptance_criteria: ['OS boundary only'] });
  const bin = path.join(workspace, 'bin'); await mkdir(bin, { recursive: true });
  await writeFile(path.join(control, 'private-fixture'), 'PRIVATE_FIXTURE_ONLY');
  await writeFile(path.join(bin, 'agy'), `#!${process.execPath}
const fs = require('node:fs');
const attempt = (fn) => { try { fn(); return true; } catch { return false; } };
fs.writeFileSync('boundary-result.json', JSON.stringify({
  privateRead: attempt(() => fs.readFileSync(${JSON.stringify(path.join(control, 'private-fixture'))})),
  controlWrite: attempt(() => fs.writeFileSync(${JSON.stringify(path.join(control, 'forbidden'))}, 'fixture')),
  workspaceWrite: attempt(() => fs.writeFileSync('allowed', 'fixture')),
}));
const evidence = process.argv.at(-1).match(/RECEIPT EVIDENCE ID: ([A-Za-z0-9_:-]+)/)[1];
const response = 'ROLE_RESEARCH_RESULT_JSON ' + JSON.stringify({ research_question:'OS fixture', source_reference:evidence, finding:'Fixture only; product outcome UNKNOWN', confidence:0.5 }) + '\\nROLE_WORK_COMPLETE';
console.log(JSON.stringify({event:'result',result:{response,usage:{input_tokens:1,output_tokens:1}}}));
`, { mode: 0o700 });
  const dispatch = async (assigned: string) => {
    const child = spawn(process.execPath, ['--import', createRequire(import.meta.url).resolve('tsx'), path.join(process.cwd(), 'scripts/ai-company-role-dispatch.mjs'), '--role', work.role, '--work-id', work.work_id, '--project-id', 'isolated', '--runner', 'agy', '--model', 'no-real-provider', '--control-root', control, '--workspace', assigned], {
      cwd: process.cwd(), env: { ...process.env, PATH: bin, AI_COMPANY_MAC_SANDBOX: 'true', AI_COMPANY_REQUIRE_WORKTREE: 'false' }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.resume(); let stderr = ''; child.stderr.on('data', bytes => stderr += bytes);
    const deadline = setTimeout(() => child.kill('SIGKILL'), 6000);
    try {
      const code = await new Promise<number | null>((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
      return { code, stderr };
    } finally { clearTimeout(deadline); }
  };
  return { control, workspace, queue, dispatch };
}

macIt('actual dispatcher protects the supplied control root distinct from its checkout', async () => {
  const f = await fixture();
  const result = await f.dispatch(f.workspace);
  expect(result.code, result.stderr).toBe(0);
  expect(JSON.parse(await readFile(path.join(f.workspace, 'boundary-result.json'), 'utf8'))).toEqual({ privateRead: false, controlWrite: false, workspaceWrite: true });
  expect((await f.queue.records())[0].state).toBe('DONE'); // Transport only; no product outcome claim.
});

macIt('actual dispatcher rejects nonexistent workspace before changing a queued attempt', async () => {
  const f = await fixture(); const before = await f.queue.records();
  const result = await f.dispatch(path.join(f.workspace, 'missing'));
  expect(result.code).not.toBe(0);
  expect(result.stderr).toContain('ENOENT');
  expect(await f.queue.records()).toEqual(before);
});
