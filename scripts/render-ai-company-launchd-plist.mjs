#!/usr/bin/env node
import { homedir } from 'node:os';
import { resolve } from 'node:path';

const projectRoot = resolve(process.env.AI_COMPANY_PROJECT_ROOT ?? process.cwd());
const node = process.env.AI_COMPANY_NODE_PATH ?? process.execPath;
const logDir = resolve(process.env.AI_COMPANY_LOG_DIR ?? `${homedir()}/Library/Logs/AICompany`);
const stateDir = resolve(process.env.AI_COMPANY_STATE_DIR ?? `${projectRoot}/.ai-company/runtime`);
const esc = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const args = [node, '--env-file=.env.local', '--import', 'tsx', 'server/index.ts'];
const array = (values) => values.map((value) => `    <string>${esc(value)}</string>`).join('\n');
console.log(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.macrolens.ai-company-supervisor</string>
  <key>ProgramArguments</key><array>
${array(args)}
  </array>
  <key>WorkingDirectory</key><string>${esc(projectRoot)}</string>
  <key>EnvironmentVariables</key><dict>
    <key>AI_COMPANY_STATE_DIR</key><string>${esc(stateDir)}</string>
    <key>PRODUCTION_AUTONOMY</key><string>DISABLED</string>
    <key>MACRO_LLM_ENDPOINT</key><string>http://127.0.0.1:11434/api/chat</string>
    <key>MACRO_LLM_MODEL</key><string>qwen3:8b</string>
    <key>MACRO_LLM_PROVIDER_ID</key><string>ollama-local</string>
    <key>AI_COMPANY_ROLE_EXECUTOR_ENABLED</key><string>false</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>${esc(`${logDir}/supervisor.stdout.log`)}</string>
  <key>StandardErrorPath</key><string>${esc(`${logDir}/supervisor.stderr.log`)}</string>
</dict></plist>`);
