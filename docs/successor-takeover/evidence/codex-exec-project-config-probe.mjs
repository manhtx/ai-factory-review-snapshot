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
const mode = process.argv.includes('--workspace-write') ? 'workspace-write' : 'read-only';
const model = process.argv.includes('--dispatcher-model') ? 'gpt-5.6-sol' : 'fixture-model';
const exercisePatches = process.argv.includes('--exercise-patches');
const registryOnly = process.argv.includes('--registry-only');
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
    fs.writeFileSync(path.join(workspace, '.codex', 'config.toml'), 'sandbox_mode = "danger-full-access"\ndeveloper_instructions = "PROJECT_LAYER_FIXTURE_ONLY"\n[agents]\nenabled=true\n');
  }
  const requests = [];
  const patchTargets = { workspace: path.join(workspace, 'patch-workspace'), temp: path.join(tempDirectory, 'patch-temp'), control: path.join(control, `patch-control-${path.basename(workspace)}`), auth: path.join(home, `patch-auth-${path.basename(workspace)}`), dependency: path.join(control, 'node_modules', `patch-dependency-${path.basename(workspace)}`), escape: path.join(workspace, 'escape', `patch-escape-${path.basename(workspace)}`), gitMetadata: path.join(workspace, '.git', 'patch-git-metadata') };
  const server = http.createServer((request, response) => {
    let body = '';
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => {
      try { requests.push({ method: request.method, url: request.url, body: JSON.parse(body) }); }
      catch { requests.push({ method: request.method, url: request.url, invalidJson: true }); }
      response.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const toolCode = `const fs=require('node:fs');const attempt=f=>{try{f();return true}catch{return false}};console.log(JSON.stringify({controlRead:attempt(()=>fs.readFileSync(${JSON.stringify(path.join(control, 'private-fixture'))})),authRead:attempt(()=>fs.readFileSync(${JSON.stringify(path.join(home, 'auth-fixture'))})),escapeRead:attempt(()=>fs.readFileSync('escape/private-fixture')),workspaceRead:attempt(()=>fs.readFileSync('read-fixture')),dependencyRead:attempt(()=>fs.readFileSync(${JSON.stringify(path.join(control, 'node_modules', 'dependency-fixture'))})),workspaceWrite:attempt(()=>fs.writeFileSync('write-fixture','DUMMY_ONLY')),controlWrite:attempt(()=>fs.writeFileSync(${JSON.stringify(path.join(control, 'forbidden-write'))},'DUMMY_ONLY')),authWrite:attempt(()=>fs.writeFileSync(${JSON.stringify(path.join(home, 'forbidden-write'))},'DUMMY_ONLY')),dependencyWrite:attempt(()=>fs.writeFileSync(${JSON.stringify(path.join(control, 'node_modules', 'forbidden-write'))},'DUMMY_ONLY')),escapeWrite:attempt(()=>fs.writeFileSync('escape/forbidden-write','DUMMY_ONLY')),tempWrite:attempt(()=>fs.writeFileSync(${JSON.stringify(path.join(tempDirectory, 'allowed-write'))},'DUMMY_ONLY')),gitMetadataWrite:attempt(()=>fs.writeFileSync('.git/dummy-metadata-write','DUMMY_ONLY'))}));`;
      const shellQuote = value => `'${value.replaceAll("'", "'\\''")}'`;
      const call = { id: 'fc_fixture', type: 'function_call', status: 'completed', call_id: 'call_fixture', name: 'exec_command', arguments: JSON.stringify({ cmd: `${shellQuote(process.execPath)} -e ${shellQuote(toolCode)}`, login: false, max_output_tokens: 1000, yield_time_ms: 1000 }) };
      const advertised = requests[0]?.body?.input?.flatMap(item => item.type === 'additional_tools' ? item.tools || [] : []) || [];
      const codeMode = advertised.some(tool => tool.name === 'exec' && tool.type === 'custom');
      const codeCall = { id: 'cc_fixture', type: 'custom_tool_call', status: 'completed', call_id: 'call_fixture', name: 'exec', input: `text(await tools.exec_command(${call.arguments}));` };
      const registryCall = { id: 'cc_registry_fixture', type: 'custom_tool_call', status: 'completed', call_id: 'registry_fixture', name: 'exec', input: 'text({nativeRegistryNames:ALL_TOOLS.map(tool=>tool.name)});' };
      const patches = Object.entries(patchTargets).map(([key, file]) => ({ key, patch: `*** Begin Patch\n*** Add File: ${file}\n+DUMMY_PATCH_ONLY\n*** End Patch` }));
      const patchCall = { id: 'cc_patch_fixture', type: 'custom_tool_call', status: 'completed', call_id: 'patch_fixture', name: 'exec', input: `const results=[];for(const item of ${JSON.stringify(patches)}){try{results.push({key:item.key,result:await tools.apply_patch(item.patch)});}catch(error){results.push({key:item.key,error:String(error)});}}text(results);` };
      const imageCall = { id: `fc_image_${requests.length}`, type: 'function_call', status: 'completed', call_id: `image_call_${requests.length}`, name: 'view_image', arguments: JSON.stringify({ path: requests.length === 2 ? path.join(control, 'private-fixture.png') : path.join(workspace, 'read-fixture.png') }) };
      const item = registryOnly && requests.length === 1 && codeMode ? registryCall : exerciseTools && requests.length === 1 ? (codeMode ? codeCall : call) : exerciseImages && [2, 3].includes(requests.length) ? imageCall : exercisePatches && requests.length === 4 ? patchCall : { id: 'msg_fixture', type: 'message', status: 'completed', role: 'assistant', content: [{ type: 'output_text', text: 'DUMMY_FIXTURE_FINISHED', annotations: [] }] };
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
  const args = ['exec', '--json', '--ephemeral', ...(ignoreUserConfig ? ['--ignore-user-config'] : []), '--model', model, '--cd', workspace,
    ...codexWorkerPermissionArgs(control, workspace, mode, [attemptDirectory, tempDirectory]),
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
  const directTools = requests[0]?.body?.tools || [];
  const additionalTools = requests[0]?.body?.input?.flatMap(item => item.type === 'additional_tools' ? item.tools || [] : []) || [];
  const tools = [...directTools, ...additionalTools];
  const toolSchemaTransport = directTools.length ? 'responses.tools' : additionalTools.length ? 'input.additional_tools' : 'UNOBSERVED';
  const advertisedToolNames = [...new Set(tools.flatMap(tool => [tool.name || tool.type, ...(tool.tools || []).map(nested => nested.name), ...Array.from((tool.description || '').matchAll(/declare const tools:\s*\{\s*(\w+)\s*\(/g), match => match[1])]))];
  const delegationAbsent = advertisedToolNames.every(name => !/multi_agent|^(spawn_agent|resume_agent|send_input|wait_agent|close_agent)$/.test(name));
  const registryOutput = requests.flatMap(request => request.body?.input || []).find(item => item.type === 'custom_tool_call_output' && item.call_id === 'registry_fixture')?.output;
  const registryText = Array.isArray(registryOutput) ? registryOutput.find(item => item.type === 'input_text' && item.text?.startsWith('{"nativeRegistryNames":'))?.text : null;
  const nativeRegistryNames = registryText ? JSON.parse(registryText).nativeRegistryNames : null;
  const registryDelegationAbsent = Array.isArray(nativeRegistryNames) && nativeRegistryNames.length > 0 && nativeRegistryNames.every(name => !/multi_agent|spawn_agent|resume_agent|send_input|wait_agent|close_agent/.test(name));
  const patchEffects = Object.fromEntries(Object.entries(patchTargets).map(([key, file]) => [key, fs.existsSync(file)]));
  const patchContentsMatch = Object.entries(patchTargets).every(([key, file]) => !patchEffects[key] || fs.readFileSync(file, 'utf8') === 'DUMMY_PATCH_ONLY\n');
  const checksPass = exitCode === 0 && !timedOut && finalResponse === 'DUMMY_FIXTURE_FINISHED'
    && delegationAbsent
    && toolSchemaTransport !== 'UNOBSERVED'
    && (!registryOnly || registryDelegationAbsent)
    && (!exercisePatches || (patchContentsMatch && Object.entries({ workspace: mode === 'workspace-write', temp: true, control: false, auth: false, dependency: false, escape: false, gitMetadata: false }).every(([key, expected]) => patchEffects[key] === expected)))
    && (!exerciseTools || Object.entries({ controlRead: false, authRead: false, escapeRead: false, workspaceRead: true, dependencyRead: true, workspaceWrite: mode === 'workspace-write', controlWrite: false, authWrite: false, dependencyWrite: false, escapeWrite: false, tempWrite: true }).every(([key, expected]) => permissionChecks?.[key] === expected))
    && (!exerciseImages || (typeof toolOutputs.image_call_2 === 'string' && toolOutputs.image_call_2.includes('Operation not permitted') && Array.isArray(toolOutputs.image_call_3) && toolOutputs.image_call_3.some(item => item.type === 'input_image')));
  observations.push({ legacyOverride, ignoreUserConfig, exitCode, signal, timedOut, args, stdout, stderr, requests,
    finalResponse, permissionChecks, patchEffects, patchContentsMatch, advertisedToolNames, toolSchemaTransport, delegationAbsent, nativeRegistryNames, registryDelegationAbsent, checksPass });
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
  fixtureRoot: root, mode, requestedModel: model, registryOnly, credentials: 'NONE; isolated HOME/CODEX_HOME; localhost dummy provider',
  scope: 'Exact exec flags plus explicit trusted project; dummy localhost Responses provider; optional actual exec_command; no actual model reasoning/all-tool/managed-config proof', observations };
const output = process.argv[2] || path.join(root, 'results.json');
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ output, observations: observations.map(({ legacyOverride, ignoreUserConfig, exitCode, timedOut, requests, finalResponse }) => ({ legacyOverride, ignoreUserConfig, exitCode, timedOut, requestCount: requests.length, finalResponse })) }, null, 2));
if (observations.some(observation => !observation.checksPass)) process.exitCode = 1;
