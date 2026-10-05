#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const exec = promisify(execFile);
const root = process.cwd();
const label = 'com.macrolens.ai-company-supervisor';
const reportPath = path.join(root, '.ai-company', 'reports', 'local-supervisor-authoritative-latest.json');
let launchd = { installed: false, state: 'unavailable' };
try {
  const { stdout } = await exec('launchctl', ['print', `gui/${process.getuid?.() ?? 0}/${label}`], { cwd: root, maxBuffer: 256 * 1024 });
  const line = (key) => stdout.match(new RegExp(`^\\s*${key} = (.+)$`, 'm'))?.[1]?.trim() ?? null;
  launchd = { installed: true, state: line('state'), runs: Number(line('runs')), pid: Number(line('pid')), last_terminating_signal: line('last terminating signal'), production_autonomy: stdout.match(/PRODUCTION_AUTONOMY => (.+)/)?.[1]?.trim() ?? null, provider: stdout.match(/MACRO_LLM_PROVIDER_ID => (.+)/)?.[1]?.trim() ?? null };
} catch (error) { launchd.error = String(error).slice(0, 240); }
let health;
try { health = await fetch('http://127.0.0.1:8787/api/health', { signal: AbortSignal.timeout(5000) }).then((response) => response.json()); }
catch (error) { health = { error: String(error).slice(0, 240) }; }
const report = { generated_at: new Date().toISOString(), label, launchd, health, production_autonomy: launchd.production_autonomy ?? 'UNKNOWN', status: launchd.installed && launchd.state === 'running' ? 'LOCAL_SUPERVISOR_RUNNING' : 'LOCAL_SUPERVISOR_NOT_VERIFIED', limitation: 'A running LaunchAgent and short health probe do not prove literal seven-day unattended operation or production readiness.' };
await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ report: path.relative(root, reportPath), status: report.status, launchd: report.launchd, health: health ? { status: health.status, database: health.database, durablePersistence: health.durablePersistence, productionReady: health.productionReady } : null }, null, 2));
