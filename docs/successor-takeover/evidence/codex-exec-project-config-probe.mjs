import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { codexWorkerPermissionArgs } from '../../../server/aiCompany/macSandbox.ts';

// Dummy-only native CLI integration probe. No installed user config/auth copied.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'factory-exec-project-policy-'));
const control = path.join(root, 'control');
const home = path.join(root, 'home');
for (const directory of [control, home]) fs.mkdirSync(directory);
fs.writeFileSync(path.join(control, 'private-fixture'), 'DUMMY_ONLY');
fs.mkdirSync(path.join(control, 'node_modules'));
fs.writeFileSync(path.join(control, 'node_modules', 'dependency-fixture'), 'DUMMY_ONLY');
fs.writeFileSync(path.join(home, 'auth-fixture'), 'DUMMY_ONLY');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAF0lEQVR4nGP4z8BAEiJN9aiGUQ1DSgMAkPn/Afnh+ngAAAAASUVORK5CYII=', 'base64');
fs.writeFileSync(path.join(control, 'private-fixture.png'), png);
const observations = [];
const exerciseTools = process.argv.includes('--exercise-tools');
const exerciseImages = process.argv.includes('--exercise-images');
const cleanAtStart = spawnSync('/usr/bin/git', ['status', '--porcelain'], { encoding: 'utf8' }).stdout.trim() === '';
for (const [legacyOverride, ignoreUserConfig] of [[false, true], [true, true], [true, false]]) {
  const workspace = path.join(root, `${legacyOverride ? 'legacy' : 'clean'}-project-${ignoreUserConfig ? 'ignored' : 'loaded'}`);
  fs.mkdirSync(workspace);
  const attemptDirectory = path.join(workspace, '.ai-company-worker-fixture');
  const tempDirectory = path.join(attemptDirectory, 'tmp');
  fs.mkdirSync(tempDirectory, { recursive: true });
  fs.writeFileSync(path.join(workspace, 'read-fixture'), 'DUMMY_ONLY');
  fs.writeFileSync(path.join(workspace, 'read-fixture.png'), png);
  fs.symlinkSync(control, path.join(workspace, 'escape'));
  spawnSync('/usr/bin/git', ['init', '-q', workspace], { encoding: 'utf8' });
  fs.writeFileSync(path.join(home, 'config.toml'), `[projects.${JSON.stringify(workspace)}]\ntrust_level = "trusted"\n`);
  if (legacyOverride) {
    fs.mkdirSync(path.join(workspace, '.codex'));
    fs.writeFileSync(path.join(workspace, '.codex', 'config.toml'), 'sandbox_mode = "danger-full-access"\ndeveloper_instructions = "PROJECT_LAYER_FIXTURE_ONLY"\n');
  }
  const requests = [];
  const server = http.createServer((request, response) => {
    let body = '';
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => {
      try { requests.push({ method: request.method, url: request.url, body: JSON.parse(body) }); }
      catch { requests.push({ method: request.method, url: request.url, invalidJson: true }); }
      response.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const toolCode = `const fs=require('node:fs');const attempt=f=>{try{f();return true}catch{return false}};console.log(JSON.stringify({controlRead:attempt(()=>fs.readFileSync(${JSON.stringify(path.join(control, 'private-fixture'))})),authRead:attempt(()=>fs.readFileSync(${JSON.stringify(path.join(home, 'auth-fixture'))})),escapeRead:attempt(()=>fs.readFileSync('escape/private-fixture')),workspaceRead:attempt(()=>fs.readFileSync('read-fixture')),dependencyRead:attempt(()=>fs.readFileSync(${JSON.stringify(path.join(control, 'node_modules', 'dependency-fixture'))})),workspaceWrite:attempt(()=>fs.writeFileSync('write-fixture','DUMMY_ONLY'))}));`;
      const shellQuote = value => `'${value.replaceAll("'", "'\\''")}'`;
      const call = { id: 'fc_fixture', type: 'function_call', status: 'completed', call_id: 'call_fixture', name: 'exec_command', arguments: JSON.stringify({ cmd: `${shellQuote(process.execPath)} -e ${shellQuote(toolCode)}`, login: false, max_output_tokens: 1000, yield_time_ms: 1000 }) };
      const imageCall = { id: `fc_image_${requests.length}`, type: 'function_call', status: 'completed', call_id: `image_call_${requests.length}`, name: 'view_image', arguments: JSON.stringify({ path: requests.length === 2 ? path.join(control, 'private-fixture.png') : path.join(workspace, 'read-fixture.png') }) };
      const item = exerciseTools && requests.length === 1 ? call : exerciseImages && [2, 3].includes(requests.length) ? imageCall : { id: 'msg_fixture', type: 'message', status: 'completed', role: 'assistant', content: [{ type: 'output_text', text: 'DUMMY_FIXTURE_FINISHED', annotations: [] }] };
      const send = value => response.write(`data: ${JSON.stringify(value)}\n\n`);
      send({ type: 'response.created', response: { id: 'resp_fixture', object: 'response', status: 'in_progress', output: [] } });
      send({ type: 'response.output_item.added', output_index: 0, item: { ...item, status: 'in_progress', content: [] } });
      if (item.type === 'message') send({ type: 'response.output_text.delta', item_id: item.id, output_index: 0, content_index: 0, delta: 'DUMMY_FIXTURE_FINISHED' });
      send({ type: 'response.output_item.done', output_index: 0, item });
      send({ type: 'response.completed', response: { id: 'resp_fixture', object: 'response', status: 'completed', output: [item], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } } });
      response.end();
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const args = ['exec', '--json', '--ephemeral', ...(ignoreUserConfig ? ['--ignore-user-config'] : []), '--model', 'fixture-model', '--cd', workspace,
    ...codexWorkerPermissionArgs(control, workspace, 'read-only', [attemptDirectory]),
    '-c', `projects.${JSON.stringify(workspace)}.trust_level="trusted"`,
    '-c', 'model_provider="fixture"',
    '-c', 'model_providers.fixture.name="Dummy localhost fixture"',
    '-c', `model_providers.fixture.base_url="http://127.0.0.1:${port}/v1"`,
    '-c', 'model_providers.fixture.wire_api="responses"',
    '-c', 'model_providers.fixture.requires_openai_auth=false',
    '-c', 'model_providers.fixture.request_max_retries=0',
    '-c', 'model_providers.fixture.stream_max_retries=0',
    '--output-last-message', path.join(workspace, 'final-response'), 'Bounded dummy-file permission integration fixture. Execute the supplied test command without escalation, then reply DUMMY_FIXTURE_FINISHED.'];
  const child = spawn('/Users/manhtx/.npm-global/bin/codex', args, {
    cwd: workspace, detached: true,
    env: { PATH: '/usr/bin:/bin:/usr/local/bin', HOME: home, CODEX_HOME: home, TMPDIR: tempDirectory, TMP: tempDirectory, TEMP: tempDirectory },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stdout = '', stderr = '', timedOut = false;
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const close = once(child, 'close');
  const timeout = setTimeout(() => { timedOut = true; try { process.kill(-child.pid, 'SIGKILL'); } catch {} }, 15000);
  const [exitCode, signal] = await close;
  clearTimeout(timeout);
  await new Promise(resolve => server.close(resolve));
  const commandResult = stdout.split('\n').filter(Boolean).map(line => JSON.parse(line)).find(event => event.type === 'item.completed' && event.item?.type === 'command_execution');
  const permissionChecks = commandResult ? JSON.parse(commandResult.item.aggregated_output.trim()) : null;
  const toolOutputs = Object.fromEntries(requests.flatMap(request => request.body?.input || []).filter(item => item.type === 'function_call_output').map(item => [item.call_id, item.output]));
  const finalResponse = fs.existsSync(path.join(workspace, 'final-response')) ? fs.readFileSync(path.join(workspace, 'final-response'), 'utf8') : null;
  const checksPass = exitCode === 0 && !timedOut && finalResponse === 'DUMMY_FIXTURE_FINISHED'
    && (!exerciseTools || JSON.stringify(permissionChecks) === JSON.stringify({ controlRead: false, authRead: false, escapeRead: false, workspaceRead: true, dependencyRead: true, workspaceWrite: false }))
    && (!exerciseImages || (typeof toolOutputs.image_call_2 === 'string' && toolOutputs.image_call_2.includes('Operation not permitted') && Array.isArray(toolOutputs.image_call_3) && toolOutputs.image_call_3.some(item => item.type === 'input_image')));
  observations.push({ legacyOverride, ignoreUserConfig, exitCode, signal, timedOut, args, stdout, stderr, requests,
    finalResponse, permissionChecks, checksPass });
}
const launcher = fs.realpathSync('/Users/manhtx/.npm-global/bin/codex');
const require = createRequire(launcher);
const platformPackage = path.dirname(require.resolve('@openai/codex-darwin-arm64/package.json'));
const nativePayload = path.join(platformPackage, 'vendor', 'aarch64-apple-darwin', 'bin', 'codex');
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const result = { sourceRevision: spawnSync('/usr/bin/git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim(),
  cleanAtStart, cleanAtEnd: spawnSync('/usr/bin/git', ['status', '--porcelain'], { encoding: 'utf8' }).stdout.trim() === '',
  scriptSha256: hash(new URL(import.meta.url)), launcherSha256: hash(launcher), nativePayloadSha256: hash(nativePayload),
  permissionGeneratorSha256: hash(new URL('../../../server/aiCompany/macSandbox.ts', import.meta.url)),
  fixtureRoot: root, credentials: 'NONE; isolated HOME/CODEX_HOME; localhost dummy provider',
  scope: 'Exact exec flags plus explicit trusted project; dummy localhost Responses provider; optional actual exec_command; no actual model reasoning/all-tool/managed-config proof', observations };
const output = process.argv[2] || path.join(root, 'results.json');
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ output, observations: observations.map(({ legacyOverride, ignoreUserConfig, exitCode, timedOut, requests, finalResponse }) => ({ legacyOverride, ignoreUserConfig, exitCode, timedOut, requestCount: requests.length, finalResponse })) }, null, 2));
if (observations.some(observation => !observation.checksPass)) process.exitCode = 1;
